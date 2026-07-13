/* ============================================================
   3martna (عمارتنا) — Stored Procedures: Finance
   Invoices, Payments, Receipts, Expenses, Reports, Dashboards
   ============================================================ */
USE Amartna;
GO

/* ---------------------- INVOICES ---------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Invoice_Create
    @ApartmentId INT, @IssuedToUserId INT, @ContractId INT = NULL,
    @InvoiceType VARCHAR(20) = 'Rent', @PeriodStart DATE = NULL, @PeriodEnd DATE = NULL,
    @DueDate DATE, @Amount DECIMAL(12,2), @Notes NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Number VARCHAR(30) =
        CONCAT('INV-', YEAR(SYSUTCDATETIME()), '-',
               RIGHT('000000' + CAST(NEXT VALUE FOR dbo.Seq_InvoiceNumber AS VARCHAR(10)), 6));

    INSERT INTO dbo.Invoices (InvoiceNumber, ContractId, ApartmentId, IssuedToUserId,
                              InvoiceType, PeriodStart, PeriodEnd, DueDate, Amount, Notes)
    VALUES (@Number, @ContractId, @ApartmentId, @IssuedToUserId,
            @InvoiceType, @PeriodStart, @PeriodEnd, @DueDate, @Amount, @Notes);

    DECLARE @InvoiceId INT = SCOPE_IDENTITY();
    EXEC dbo.sp_Invoice_GetById @InvoiceId = @InvoiceId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Invoice_GetById @InvoiceId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT i.InvoiceId, i.InvoiceNumber, i.ContractId, c.ContractNumber,
           i.ApartmentId, a.ApartmentNumber, a.BuildingId, b.Name AS BuildingName,
           i.IssuedToUserId, u.FullName AS IssuedToName, u.Phone AS IssuedToPhone,
           i.InvoiceType, i.PeriodStart, i.PeriodEnd, i.DueDate,
           i.Amount, i.LateFee, i.TotalAmount, i.Status, i.Notes, i.CreatedAt,
           ISNULL(p.PaidTotal, 0) AS PaidAmount,
           i.TotalAmount - ISNULL(p.PaidTotal, 0) AS BalanceDue
    FROM dbo.Invoices i
    JOIN dbo.Apartments a ON a.ApartmentId = i.ApartmentId
    JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
    JOIN dbo.Users u ON u.UserId = i.IssuedToUserId
    LEFT JOIN dbo.Contracts c ON c.ContractId = i.ContractId
    OUTER APPLY (SELECT SUM(Amount) AS PaidTotal FROM dbo.Payments p
                 WHERE p.InvoiceId = i.InvoiceId AND p.Status = 'Confirmed') p
    WHERE i.InvoiceId = @InvoiceId;

    SELECT p.PaymentId, p.Amount, p.Method, p.ReferenceNumber, p.Status, p.PaidAt,
           pb.FullName AS PaidByName, r.ReceiptNumber, r.PdfUrl AS ReceiptUrl
    FROM dbo.Payments p
    JOIN dbo.Users pb ON pb.UserId = p.PaidByUserId
    LEFT JOIN dbo.Receipts r ON r.PaymentId = p.PaymentId
    WHERE p.InvoiceId = @InvoiceId
    ORDER BY p.PaidAt DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Invoice_List
    @Page INT = 1, @PageSize INT = 20, @BuildingId INT = NULL,
    @ApartmentId INT = NULL, @IssuedToUserId INT = NULL, @Status VARCHAR(20) = NULL,
    @InvoiceType VARCHAR(20) = NULL, @FromDate DATE = NULL, @ToDate DATE = NULL,
    @Search NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT i.InvoiceId, i.InvoiceNumber, i.ApartmentId, a.ApartmentNumber,
           a.BuildingId, b.Name AS BuildingName,
           i.IssuedToUserId, u.FullName AS IssuedToName,
           i.InvoiceType, i.DueDate, i.Amount, i.LateFee, i.TotalAmount, i.Status,
           ISNULL(p.PaidTotal, 0) AS PaidAmount, i.CreatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.Invoices i
    JOIN dbo.Apartments a ON a.ApartmentId = i.ApartmentId
    JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
    JOIN dbo.Users u ON u.UserId = i.IssuedToUserId
    OUTER APPLY (SELECT SUM(Amount) AS PaidTotal FROM dbo.Payments p
                 WHERE p.InvoiceId = i.InvoiceId AND p.Status = 'Confirmed') p
    WHERE (@BuildingId IS NULL OR a.BuildingId = @BuildingId)
      AND (@ApartmentId IS NULL OR i.ApartmentId = @ApartmentId)
      AND (@IssuedToUserId IS NULL OR i.IssuedToUserId = @IssuedToUserId)
      AND (@Status IS NULL OR i.Status = @Status)
      AND (@InvoiceType IS NULL OR i.InvoiceType = @InvoiceType)
      AND (@FromDate IS NULL OR i.DueDate >= @FromDate)
      AND (@ToDate IS NULL OR i.DueDate <= @ToDate)
      AND (@Search IS NULL OR i.InvoiceNumber LIKE '%' + @Search + '%'
           OR u.FullName LIKE '%' + @Search + '%')
    ORDER BY i.DueDate DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Invoice_Cancel @InvoiceId INT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.Payments WHERE InvoiceId = @InvoiceId AND Status = 'Confirmed')
        THROW 50050, 'INVOICE_HAS_PAYMENTS', 1;
    UPDATE dbo.Invoices SET Status = 'Cancelled', UpdatedAt = SYSUTCDATETIME()
    WHERE InvoiceId = @InvoiceId;
END;
GO

/* Monthly batch: generate rent invoices for active contracts.
   Idempotent — skips contracts already invoiced for the period. */
CREATE OR ALTER PROCEDURE dbo.sp_Invoice_GenerateMonthly
    @PeriodStart DATE = NULL   -- defaults to first day of current month
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @PeriodStart = ISNULL(@PeriodStart,
        DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1));
    DECLARE @PeriodEnd DATE = EOMONTH(@PeriodStart);
    DECLARE @Created TABLE (InvoiceId INT);

    BEGIN TRANSACTION;

    INSERT INTO dbo.Invoices (InvoiceNumber, ContractId, ApartmentId, IssuedToUserId,
                              InvoiceType, PeriodStart, PeriodEnd, DueDate, Amount)
    OUTPUT inserted.InvoiceId INTO @Created
    SELECT
        CONCAT('INV-', YEAR(@PeriodStart), '-',
               RIGHT('000000' + CAST(NEXT VALUE FOR dbo.Seq_InvoiceNumber AS VARCHAR(10)), 6)),
        c.ContractId, c.ApartmentId, c.TenantUserId,
        'Rent', @PeriodStart, @PeriodEnd,
        DATEADD(DAY, c.GraceDays, @PeriodStart),
        CASE c.PaymentFrequency
            WHEN 'Monthly'    THEN c.MonthlyRent
            WHEN 'Quarterly'  THEN c.MonthlyRent * 3
            WHEN 'SemiAnnual' THEN c.MonthlyRent * 6
            WHEN 'Annual'     THEN c.MonthlyRent * 12
        END
    FROM dbo.Contracts c
    WHERE c.Status = 'Active'
      AND c.StartDate <= @PeriodEnd AND c.EndDate >= @PeriodStart
      -- respect payment frequency: only bill on period boundaries
      AND (c.PaymentFrequency = 'Monthly'
           OR (c.PaymentFrequency = 'Quarterly'  AND DATEDIFF(MONTH, c.StartDate, @PeriodStart) % 3  = 0)
           OR (c.PaymentFrequency = 'SemiAnnual' AND DATEDIFF(MONTH, c.StartDate, @PeriodStart) % 6  = 0)
           OR (c.PaymentFrequency = 'Annual'     AND DATEDIFF(MONTH, c.StartDate, @PeriodStart) % 12 = 0))
      AND NOT EXISTS (
          SELECT 1 FROM dbo.Invoices i
          WHERE i.ContractId = c.ContractId AND i.InvoiceType = 'Rent'
            AND i.PeriodStart = @PeriodStart AND i.Status <> 'Cancelled');

    COMMIT TRANSACTION;

    SELECT i.InvoiceId, i.InvoiceNumber, i.IssuedToUserId, i.Amount, i.DueDate
    FROM dbo.Invoices i JOIN @Created cr ON cr.InvoiceId = i.InvoiceId;
END;
GO

/* Nightly job: mark overdue invoices + apply late fees per contract terms */
CREATE OR ALTER PROCEDURE dbo.sp_Invoice_ApplyOverdue
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Today DATE = CAST(SYSUTCDATETIME() AS DATE);

    UPDATE i
    SET i.Status = 'Overdue',
        i.LateFee = CASE
            WHEN c.LateFeePercent > 0 AND i.LateFee = 0
            THEN ROUND(i.Amount * c.LateFeePercent / 100.0, 2)
            ELSE i.LateFee END,
        i.UpdatedAt = SYSUTCDATETIME()
    FROM dbo.Invoices i
    LEFT JOIN dbo.Contracts c ON c.ContractId = i.ContractId
    WHERE i.Status IN ('Unpaid','PartiallyPaid')
      AND i.DueDate < @Today;

    SELECT @@ROWCOUNT AS OverdueCount;
END;
GO

/* Invoices needing a payment reminder (due within @DaysAhead or overdue) */
CREATE OR ALTER PROCEDURE dbo.sp_Invoice_GetDueForReminder @DaysAhead INT = 3
AS
BEGIN
    SET NOCOUNT ON;
    SELECT i.InvoiceId, i.InvoiceNumber, i.IssuedToUserId, u.FullName, u.PreferredLanguage,
           i.DueDate, i.TotalAmount, i.Status, a.ApartmentNumber, b.Name AS BuildingName
    FROM dbo.Invoices i
    JOIN dbo.Users u ON u.UserId = i.IssuedToUserId
    JOIN dbo.Apartments a ON a.ApartmentId = i.ApartmentId
    JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
    WHERE i.Status IN ('Unpaid','PartiallyPaid','Overdue')
      AND i.DueDate <= DATEADD(DAY, @DaysAhead, CAST(SYSUTCDATETIME() AS DATE));
END;
GO

/* ---------------------- PAYMENTS ---------------------- */

/* Record a payment + auto-generate its receipt (transactional).
   Invoice status is recalculated by trg_Payments_UpdateInvoiceStatus. */
CREATE OR ALTER PROCEDURE dbo.sp_Payment_Record
    @InvoiceId INT, @PaidByUserId INT, @Amount DECIMAL(12,2),
    @Method VARCHAR(20), @ReferenceNumber VARCHAR(100) = NULL,
    @ReceivedByUserId INT = NULL, @Notes NVARCHAR(500) = NULL,
    @Status VARCHAR(20) = 'Confirmed'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    DECLARE @InvoiceStatus VARCHAR(20), @Balance DECIMAL(12,2);
    SELECT @InvoiceStatus = i.Status,
           @Balance = i.TotalAmount - ISNULL(
               (SELECT SUM(Amount) FROM dbo.Payments
                WHERE InvoiceId = @InvoiceId AND Status = 'Confirmed'), 0)
    FROM dbo.Invoices i WHERE i.InvoiceId = @InvoiceId;

    IF @InvoiceStatus IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50051, 'INVOICE_NOT_FOUND', 1;
    END
    IF @InvoiceStatus = 'Cancelled'
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50052, 'INVOICE_CANCELLED', 1;
    END
    IF @Amount > @Balance
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50053, 'AMOUNT_EXCEEDS_BALANCE', 1;
    END

    INSERT INTO dbo.Payments (InvoiceId, PaidByUserId, Amount, Method, ReferenceNumber,
                              Status, ReceivedByUserId, Notes)
    VALUES (@InvoiceId, @PaidByUserId, @Amount, @Method, @ReferenceNumber,
            @Status, @ReceivedByUserId, @Notes);

    DECLARE @PaymentId INT = SCOPE_IDENTITY();

    IF @Status = 'Confirmed'
        INSERT INTO dbo.Receipts (PaymentId, ReceiptNumber)
        VALUES (@PaymentId,
                CONCAT('RCP-', YEAR(SYSUTCDATETIME()), '-',
                       RIGHT('000000' + CAST(NEXT VALUE FOR dbo.Seq_ReceiptNumber AS VARCHAR(10)), 6)));

    COMMIT TRANSACTION;
    EXEC dbo.sp_Payment_GetById @PaymentId = @PaymentId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Payment_GetById @PaymentId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.PaymentId, p.InvoiceId, i.InvoiceNumber, i.InvoiceType,
           p.PaidByUserId, u.FullName AS PaidByName, u.Phone AS PaidByPhone,
           p.Amount, p.Method, p.ReferenceNumber, p.Status, p.Notes, p.PaidAt,
           p.ReceivedByUserId, rb.FullName AS ReceivedByName,
           r.ReceiptId, r.ReceiptNumber, r.PdfUrl AS ReceiptUrl,
           a.ApartmentId, a.ApartmentNumber, b.BuildingId, b.Name AS BuildingName
    FROM dbo.Payments p
    JOIN dbo.Invoices i ON i.InvoiceId = p.InvoiceId
    JOIN dbo.Apartments a ON a.ApartmentId = i.ApartmentId
    JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
    JOIN dbo.Users u ON u.UserId = p.PaidByUserId
    LEFT JOIN dbo.Users rb ON rb.UserId = p.ReceivedByUserId
    LEFT JOIN dbo.Receipts r ON r.PaymentId = p.PaymentId
    WHERE p.PaymentId = @PaymentId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Payment_List
    @Page INT = 1, @PageSize INT = 20, @BuildingId INT = NULL,
    @PaidByUserId INT = NULL, @Method VARCHAR(20) = NULL, @Status VARCHAR(20) = NULL,
    @FromDate DATE = NULL, @ToDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.PaymentId, p.InvoiceId, i.InvoiceNumber, p.PaidByUserId, u.FullName AS PaidByName,
           p.Amount, p.Method, p.Status, p.PaidAt, r.ReceiptNumber,
           a.ApartmentNumber, b.BuildingId, b.Name AS BuildingName,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.Payments p
    JOIN dbo.Invoices i ON i.InvoiceId = p.InvoiceId
    JOIN dbo.Apartments a ON a.ApartmentId = i.ApartmentId
    JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
    JOIN dbo.Users u ON u.UserId = p.PaidByUserId
    LEFT JOIN dbo.Receipts r ON r.PaymentId = p.PaymentId
    WHERE (@BuildingId IS NULL OR a.BuildingId = @BuildingId)
      AND (@PaidByUserId IS NULL OR p.PaidByUserId = @PaidByUserId)
      AND (@Method IS NULL OR p.Method = @Method)
      AND (@Status IS NULL OR p.Status = @Status)
      AND (@FromDate IS NULL OR CAST(p.PaidAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(p.PaidAt AS DATE) <= @ToDate)
    ORDER BY p.PaidAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Payment_UpdateStatus @PaymentId INT, @Status VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Payments SET Status = @Status WHERE PaymentId = @PaymentId;
    IF @Status = 'Confirmed' AND NOT EXISTS (SELECT 1 FROM dbo.Receipts WHERE PaymentId = @PaymentId)
        INSERT INTO dbo.Receipts (PaymentId, ReceiptNumber)
        VALUES (@PaymentId,
                CONCAT('RCP-', YEAR(SYSUTCDATETIME()), '-',
                       RIGHT('000000' + CAST(NEXT VALUE FOR dbo.Seq_ReceiptNumber AS VARCHAR(10)), 6)));
    EXEC dbo.sp_Payment_GetById @PaymentId = @PaymentId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Receipt_SetPdfUrl @ReceiptId INT, @PdfUrl VARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Receipts SET PdfUrl = @PdfUrl WHERE ReceiptId = @ReceiptId;
END;
GO

/* ---------------------- EXPENSES ---------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Expense_Create
    @BuildingId INT, @CategoryId INT, @Amount DECIMAL(12,2), @ExpenseDate DATE,
    @Description NVARCHAR(500) = NULL, @VendorName NVARCHAR(150) = NULL,
    @ReceiptUrl VARCHAR(500) = NULL, @CreatedByUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Expenses (BuildingId, CategoryId, Amount, ExpenseDate,
                              Description, VendorName, ReceiptUrl, CreatedByUserId)
    VALUES (@BuildingId, @CategoryId, @Amount, @ExpenseDate,
            @Description, @VendorName, @ReceiptUrl, @CreatedByUserId);

    SELECT e.ExpenseId, e.BuildingId, b.Name AS BuildingName, e.CategoryId,
           ec.Name AS CategoryName, ec.NameAr AS CategoryNameAr,
           e.Amount, e.ExpenseDate, e.Description, e.VendorName, e.ReceiptUrl, e.CreatedAt
    FROM dbo.Expenses e
    JOIN dbo.Buildings b ON b.BuildingId = e.BuildingId
    JOIN dbo.ExpenseCategories ec ON ec.CategoryId = e.CategoryId
    WHERE e.ExpenseId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Expense_List
    @Page INT = 1, @PageSize INT = 20, @BuildingId INT = NULL,
    @CategoryId INT = NULL, @FromDate DATE = NULL, @ToDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT e.ExpenseId, e.BuildingId, b.Name AS BuildingName,
           e.CategoryId, ec.Name AS CategoryName, ec.NameAr AS CategoryNameAr,
           e.Amount, e.ExpenseDate, e.Description, e.VendorName, e.ReceiptUrl,
           u.FullName AS CreatedByName, e.CreatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.Expenses e
    JOIN dbo.Buildings b ON b.BuildingId = e.BuildingId
    JOIN dbo.ExpenseCategories ec ON ec.CategoryId = e.CategoryId
    JOIN dbo.Users u ON u.UserId = e.CreatedByUserId
    WHERE (@BuildingId IS NULL OR e.BuildingId = @BuildingId)
      AND (@CategoryId IS NULL OR e.CategoryId = @CategoryId)
      AND (@FromDate IS NULL OR e.ExpenseDate >= @FromDate)
      AND (@ToDate IS NULL OR e.ExpenseDate <= @ToDate)
    ORDER BY e.ExpenseDate DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Expense_Delete @ExpenseId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.Expenses WHERE ExpenseId = @ExpenseId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ExpenseCategory_List
AS
BEGIN
    SET NOCOUNT ON;
    SELECT CategoryId, Name, NameAr FROM dbo.ExpenseCategories ORDER BY Name;
END;
GO

/* ----------------------- REPORTS ---------------------- */

/* Financial report: income vs expenses per month for a date range */
CREATE OR ALTER PROCEDURE dbo.sp_Report_Financial
    @BuildingId INT = NULL, @OwnerUserId INT = NULL,
    @FromDate DATE, @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Monthly series
    SELECT f.Yr AS [Year], f.Mo AS [Month], SUM(f.Income) AS Income,
           SUM(f.Expenses) AS Expenses, SUM(f.NetIncome) AS NetIncome
    FROM dbo.vw_BuildingFinancialSummary f
    JOIN dbo.Buildings b ON b.BuildingId = f.BuildingId
    WHERE (@BuildingId IS NULL OR f.BuildingId = @BuildingId)
      AND (@OwnerUserId IS NULL OR b.OwnerUserId = @OwnerUserId)
      AND DATEFROMPARTS(f.Yr, f.Mo, 1) BETWEEN DATEFROMPARTS(YEAR(@FromDate), MONTH(@FromDate), 1) AND @ToDate
    GROUP BY f.Yr, f.Mo
    ORDER BY f.Yr, f.Mo;

    -- Totals
    SELECT
        (SELECT ISNULL(SUM(p.Amount), 0) FROM dbo.Payments p
         JOIN dbo.Invoices i ON i.InvoiceId = p.InvoiceId
         JOIN dbo.Apartments a ON a.ApartmentId = i.ApartmentId
         JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
         WHERE p.Status = 'Confirmed' AND CAST(p.PaidAt AS DATE) BETWEEN @FromDate AND @ToDate
           AND (@BuildingId IS NULL OR a.BuildingId = @BuildingId)
           AND (@OwnerUserId IS NULL OR b.OwnerUserId = @OwnerUserId)) AS TotalIncome,
        (SELECT ISNULL(SUM(e.Amount), 0) FROM dbo.Expenses e
         JOIN dbo.Buildings b ON b.BuildingId = e.BuildingId
         WHERE e.ExpenseDate BETWEEN @FromDate AND @ToDate
           AND (@BuildingId IS NULL OR e.BuildingId = @BuildingId)
           AND (@OwnerUserId IS NULL OR b.OwnerUserId = @OwnerUserId)) AS TotalExpenses,
        (SELECT ISNULL(SUM(v.BalanceDue), 0) FROM dbo.vw_OutstandingInvoices v
         JOIN dbo.Buildings b ON b.BuildingId = v.BuildingId
         WHERE (@BuildingId IS NULL OR v.BuildingId = @BuildingId)
           AND (@OwnerUserId IS NULL OR b.OwnerUserId = @OwnerUserId)) AS TotalOutstanding;

    -- Expense breakdown by category
    SELECT ec.Name AS Category, ec.NameAr AS CategoryAr, SUM(e.Amount) AS Total
    FROM dbo.Expenses e
    JOIN dbo.ExpenseCategories ec ON ec.CategoryId = e.CategoryId
    JOIN dbo.Buildings b ON b.BuildingId = e.BuildingId
    WHERE e.ExpenseDate BETWEEN @FromDate AND @ToDate
      AND (@BuildingId IS NULL OR e.BuildingId = @BuildingId)
      AND (@OwnerUserId IS NULL OR b.OwnerUserId = @OwnerUserId)
    GROUP BY ec.Name, ec.NameAr
    ORDER BY Total DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Report_Occupancy @OwnerUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT o.* FROM dbo.vw_OccupancySummary o
    JOIN dbo.Buildings b ON b.BuildingId = o.BuildingId
    WHERE @OwnerUserId IS NULL OR b.OwnerUserId = @OwnerUserId
    ORDER BY o.BuildingName;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Report_Maintenance
    @BuildingId INT = NULL, @OwnerUserId INT = NULL, @FromDate DATE, @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;

    -- By status
    SELECT m.Status, COUNT(*) AS Cnt
    FROM dbo.MaintenanceRequests m
    JOIN dbo.Buildings b ON b.BuildingId = m.BuildingId
    WHERE CAST(m.CreatedAt AS DATE) BETWEEN @FromDate AND @ToDate
      AND (@BuildingId IS NULL OR m.BuildingId = @BuildingId)
      AND (@OwnerUserId IS NULL OR b.OwnerUserId = @OwnerUserId)
    GROUP BY m.Status;

    -- By category
    SELECT m.Category, COUNT(*) AS Cnt,
           AVG(CASE WHEN m.CompletedAt IS NOT NULL
               THEN DATEDIFF(HOUR, m.CreatedAt, m.CompletedAt) END) AS AvgResolutionHours
    FROM dbo.MaintenanceRequests m
    JOIN dbo.Buildings b ON b.BuildingId = m.BuildingId
    WHERE CAST(m.CreatedAt AS DATE) BETWEEN @FromDate AND @ToDate
      AND (@BuildingId IS NULL OR m.BuildingId = @BuildingId)
      AND (@OwnerUserId IS NULL OR b.OwnerUserId = @OwnerUserId)
    GROUP BY m.Category
    ORDER BY Cnt DESC;

    -- Technician performance
    SELECT ma.AssignedToUserId, u.FullName AS TechnicianName,
           COUNT(DISTINCT m.RequestId) AS AssignedCount,
           SUM(CASE WHEN m.Status = 'Completed' THEN 1 ELSE 0 END) AS CompletedCount,
           AVG(CAST(m.Rating AS DECIMAL(3,2))) AS AvgRating
    FROM dbo.MaintenanceAssignments ma
    JOIN dbo.MaintenanceRequests m ON m.RequestId = ma.RequestId
    JOIN dbo.Buildings b ON b.BuildingId = m.BuildingId
    JOIN dbo.Users u ON u.UserId = ma.AssignedToUserId
    WHERE ma.UnassignedAt IS NULL
      AND CAST(m.CreatedAt AS DATE) BETWEEN @FromDate AND @ToDate
      AND (@BuildingId IS NULL OR m.BuildingId = @BuildingId)
      AND (@OwnerUserId IS NULL OR b.OwnerUserId = @OwnerUserId)
    GROUP BY ma.AssignedToUserId, u.FullName
    ORDER BY CompletedCount DESC;
END;
GO

/* --------------------- DASHBOARDS --------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_Owner @OwnerUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @MonthStart DATE = DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1);

    -- KPI card values
    SELECT
        (SELECT COUNT(*) FROM dbo.Buildings WHERE OwnerUserId = @OwnerUserId AND IsActive = 1) AS BuildingCount,
        (SELECT COUNT(*) FROM dbo.Apartments a JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
         WHERE b.OwnerUserId = @OwnerUserId) AS ApartmentCount,
        (SELECT COUNT(*) FROM dbo.vw_ActiveResidents r JOIN dbo.Buildings b ON b.BuildingId = r.BuildingId
         WHERE b.OwnerUserId = @OwnerUserId) AS ResidentCount,
        (SELECT ISNULL(SUM(p.Amount), 0) FROM dbo.Payments p
         JOIN dbo.Invoices i ON i.InvoiceId = p.InvoiceId
         JOIN dbo.Apartments a ON a.ApartmentId = i.ApartmentId
         JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
         WHERE b.OwnerUserId = @OwnerUserId AND p.Status = 'Confirmed'
           AND p.PaidAt >= @MonthStart) AS MonthIncome,
        (SELECT ISNULL(SUM(e.Amount), 0) FROM dbo.Expenses e
         JOIN dbo.Buildings b ON b.BuildingId = e.BuildingId
         WHERE b.OwnerUserId = @OwnerUserId AND e.ExpenseDate >= @MonthStart) AS MonthExpenses,
        (SELECT ISNULL(SUM(v.BalanceDue), 0) FROM dbo.vw_OutstandingInvoices v
         JOIN dbo.Buildings b ON b.BuildingId = v.BuildingId
         WHERE b.OwnerUserId = @OwnerUserId) AS OutstandingRent,
        (SELECT COUNT(*) FROM dbo.MaintenanceRequests m
         JOIN dbo.Buildings b ON b.BuildingId = m.BuildingId
         WHERE b.OwnerUserId = @OwnerUserId
           AND m.Status IN ('Open','Assigned','InProgress','OnHold')) AS OpenMaintenance,
        (SELECT COUNT(*) FROM dbo.Complaints c
         JOIN dbo.Buildings b ON b.BuildingId = c.BuildingId
         WHERE b.OwnerUserId = @OwnerUserId AND c.Status IN ('Open','InReview','Escalated')) AS OpenComplaints;

    -- 6-month income/expense trend
    SELECT f.Yr AS [Year], f.Mo AS [Month],
           SUM(f.Income) AS Income, SUM(f.Expenses) AS Expenses
    FROM dbo.vw_BuildingFinancialSummary f
    JOIN dbo.Buildings b ON b.BuildingId = f.BuildingId
    WHERE b.OwnerUserId = @OwnerUserId
      AND DATEFROMPARTS(f.Yr, f.Mo, 1) >= DATEADD(MONTH, -5, @MonthStart)
    GROUP BY f.Yr, f.Mo ORDER BY f.Yr, f.Mo;

    -- Occupancy per building
    SELECT o.* FROM dbo.vw_OccupancySummary o
    JOIN dbo.Buildings b ON b.BuildingId = o.BuildingId
    WHERE b.OwnerUserId = @OwnerUserId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_Tenant @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Current residence + contract
    SELECT TOP 1 r.ApartmentId, a.ApartmentNumber, a.BuildingId, b.Name AS BuildingName,
           b.Address, c.ContractId, c.MonthlyRent, c.EndDate AS ContractEndDate, c.Status AS ContractStatus
    FROM dbo.Residents r
    JOIN dbo.Apartments a ON a.ApartmentId = r.ApartmentId
    JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
    LEFT JOIN dbo.Contracts c ON c.ApartmentId = r.ApartmentId
        AND c.TenantUserId = @UserId AND c.Status = 'Active'
    WHERE r.UserId = @UserId AND r.MoveOutDate IS NULL
    ORDER BY r.MoveInDate DESC;

    -- Rent status summary
    SELECT
        (SELECT ISNULL(SUM(BalanceDue), 0) FROM dbo.vw_OutstandingInvoices WHERE IssuedToUserId = @UserId) AS TotalDue,
        (SELECT COUNT(*) FROM dbo.Invoices WHERE IssuedToUserId = @UserId AND Status = 'Overdue') AS OverdueCount,
        (SELECT MIN(DueDate) FROM dbo.Invoices WHERE IssuedToUserId = @UserId
         AND Status IN ('Unpaid','PartiallyPaid','Overdue')) AS NextDueDate,
        (SELECT COUNT(*) FROM dbo.MaintenanceRequests WHERE RequestedByUserId = @UserId
         AND Status IN ('Open','Assigned','InProgress','OnHold')) AS OpenMaintenance,
        (SELECT COUNT(*) FROM dbo.Notifications WHERE UserId = @UserId AND IsRead = 0) AS UnreadNotifications;

    -- Latest unpaid invoices
    SELECT TOP 5 InvoiceId, InvoiceNumber, InvoiceType, DueDate, TotalAmount, Status
    FROM dbo.Invoices
    WHERE IssuedToUserId = @UserId AND Status IN ('Unpaid','PartiallyPaid','Overdue')
    ORDER BY DueDate;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_Staff @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Today DATE = CAST(SYSUTCDATETIME() AS DATE);

    SELECT
        (SELECT COUNT(*) FROM dbo.MaintenanceAssignments ma
         JOIN dbo.MaintenanceRequests m ON m.RequestId = ma.RequestId
         WHERE ma.AssignedToUserId = @UserId AND ma.UnassignedAt IS NULL
           AND m.Status IN ('Assigned','InProgress','OnHold')) AS ActiveTasks,
        (SELECT COUNT(*) FROM dbo.MaintenanceAssignments ma
         JOIN dbo.MaintenanceRequests m ON m.RequestId = ma.RequestId
         WHERE ma.AssignedToUserId = @UserId AND m.Status = 'Completed') AS CompletedTasks,
        (SELECT COUNT(*) FROM dbo.StaffSchedules
         WHERE UserId = @UserId AND ScheduledDate = @Today AND Status <> 'Cancelled') AS TodaySchedules;

    -- Active assigned tasks
    SELECT m.RequestId, m.Title, m.Category, m.Priority, m.Status, m.ScheduledAt,
           a.ApartmentNumber, b.Name AS BuildingName, b.Address, ma.CheckInAt
    FROM dbo.MaintenanceAssignments ma
    JOIN dbo.MaintenanceRequests m ON m.RequestId = ma.RequestId
    JOIN dbo.Buildings b ON b.BuildingId = m.BuildingId
    LEFT JOIN dbo.Apartments a ON a.ApartmentId = m.ApartmentId
    WHERE ma.AssignedToUserId = @UserId AND ma.UnassignedAt IS NULL
      AND m.Status IN ('Assigned','InProgress','OnHold')
    ORDER BY CASE m.Priority WHEN 'Emergency' THEN 0 WHEN 'High' THEN 1
                             WHEN 'Medium' THEN 2 ELSE 3 END, m.CreatedAt;

    -- Today's schedule
    SELECT ScheduleId, TaskType, Title, ScheduledDate, StartTime, EndTime, Status,
           (SELECT Name FROM dbo.Buildings WHERE BuildingId = s.BuildingId) AS BuildingName
    FROM dbo.StaffSchedules s
    WHERE UserId = @UserId AND ScheduledDate = @Today
    ORDER BY StartTime;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_Admin
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @MonthStart DATE = DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1);

    SELECT
        (SELECT COUNT(*) FROM dbo.Users WHERE IsDeleted = 0) AS TotalUsers,
        (SELECT COUNT(*) FROM dbo.Users WHERE IsDeleted = 0 AND CreatedAt >= @MonthStart) AS NewUsersThisMonth,
        (SELECT COUNT(*) FROM dbo.Buildings WHERE IsActive = 1) AS TotalBuildings,
        (SELECT COUNT(*) FROM dbo.Apartments) AS TotalApartments,
        (SELECT COUNT(*) FROM dbo.Contracts WHERE Status = 'Active') AS ActiveContracts,
        (SELECT ISNULL(SUM(Amount), 0) FROM dbo.Payments
         WHERE Status = 'Confirmed' AND PaidAt >= @MonthStart) AS MonthRevenue,
        (SELECT ISNULL(SUM(BalanceDue), 0) FROM dbo.vw_OutstandingInvoices) AS TotalOutstanding,
        (SELECT COUNT(*) FROM dbo.MaintenanceRequests
         WHERE Status IN ('Open','Assigned','InProgress','OnHold')) AS OpenMaintenance,
        (SELECT COUNT(*) FROM dbo.Complaints WHERE Status IN ('Open','InReview','Escalated')) AS OpenComplaints,
        (SELECT COUNT(*) FROM dbo.Visitors WHERE Status = 'CheckedIn') AS VisitorsInside;

    -- 6-month revenue trend (platform-wide)
    SELECT YEAR(p.PaidAt) AS [Year], MONTH(p.PaidAt) AS [Month], SUM(p.Amount) AS Revenue
    FROM dbo.Payments p
    WHERE p.Status = 'Confirmed' AND p.PaidAt >= DATEADD(MONTH, -5, @MonthStart)
    GROUP BY YEAR(p.PaidAt), MONTH(p.PaidAt)
    ORDER BY [Year], [Month];

    -- Users per role
    SELECT r.Name AS Role, COUNT(*) AS Cnt
    FROM dbo.UserRoles ur
    JOIN dbo.Roles r ON r.RoleId = ur.RoleId
    JOIN dbo.Users u ON u.UserId = ur.UserId AND u.IsDeleted = 0
    GROUP BY r.Name;
END;
GO

PRINT 'Finance procedures created.';
GO
