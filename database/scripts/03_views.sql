/* ============================================================
   3martna (عمارتنا) — Views
   Read models for dashboards & reporting.
   ============================================================ */
USE Amartna;
GO

/* Full apartment detail: building, floor, owner, current tenant */
CREATE OR ALTER VIEW dbo.vw_ApartmentDetails AS
SELECT
    a.ApartmentId, a.ApartmentNumber, a.Bedrooms, a.Bathrooms, a.AreaSqm,
    a.RentAmount, a.Status, a.Description,
    b.BuildingId, b.Name AS BuildingName, b.Address, b.City,
    f.FloorId, f.FloorNumber,
    own.UserId  AS OwnerUserId,  own.FullName AS OwnerName,  own.Phone AS OwnerPhone,
    ten.UserId  AS TenantUserId, ten.FullName AS TenantName, ten.Phone AS TenantPhone,
    c.ContractId AS ActiveContractId, c.MonthlyRent AS ContractRent, c.EndDate AS ContractEndDate
FROM dbo.Apartments a
JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
JOIN dbo.Floors f    ON f.FloorId = a.FloorId
LEFT JOIN dbo.Users own ON own.UserId = a.OwnerUserId
LEFT JOIN dbo.Contracts c ON c.ApartmentId = a.ApartmentId AND c.Status = 'Active'
LEFT JOIN dbo.Users ten ON ten.UserId = c.TenantUserId;
GO

/* Active residents with user info */
CREATE OR ALTER VIEW dbo.vw_ActiveResidents AS
SELECT
    r.ResidentId, r.ApartmentId, r.ResidencyType, r.MoveInDate,
    u.UserId, u.FullName, u.Phone, u.Email, u.ProfileImageUrl, u.NationalId,
    a.ApartmentNumber, a.BuildingId, b.Name AS BuildingName
FROM dbo.Residents r
JOIN dbo.Users u ON u.UserId = r.UserId AND u.IsDeleted = 0
JOIN dbo.Apartments a ON a.ApartmentId = r.ApartmentId
JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
WHERE r.MoveOutDate IS NULL;
GO

/* Outstanding balances per invoice */
CREATE OR ALTER VIEW dbo.vw_OutstandingInvoices AS
SELECT
    i.InvoiceId, i.InvoiceNumber, i.InvoiceType, i.ApartmentId, i.IssuedToUserId,
    u.FullName AS IssuedToName, a.ApartmentNumber, a.BuildingId, b.Name AS BuildingName,
    i.DueDate, i.Amount, i.LateFee, i.TotalAmount, i.Status,
    ISNULL(p.PaidTotal, 0) AS PaidAmount,
    i.TotalAmount - ISNULL(p.PaidTotal, 0) AS BalanceDue,
    DATEDIFF(DAY, i.DueDate, CAST(SYSUTCDATETIME() AS DATE)) AS DaysOverdue
FROM dbo.Invoices i
JOIN dbo.Users u ON u.UserId = i.IssuedToUserId
JOIN dbo.Apartments a ON a.ApartmentId = i.ApartmentId
JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
OUTER APPLY (
    SELECT SUM(Amount) AS PaidTotal
    FROM dbo.Payments p WHERE p.InvoiceId = i.InvoiceId AND p.Status = 'Confirmed'
) p
WHERE i.Status IN ('Unpaid','PartiallyPaid','Overdue');
GO

/* Monthly revenue per building */
CREATE OR ALTER VIEW dbo.vw_MonthlyRevenue AS
SELECT
    a.BuildingId,
    YEAR(p.PaidAt)  AS RevenueYear,
    MONTH(p.PaidAt) AS RevenueMonth,
    SUM(p.Amount)   AS TotalRevenue,
    COUNT(*)        AS PaymentCount
FROM dbo.Payments p
JOIN dbo.Invoices i ON i.InvoiceId = p.InvoiceId
JOIN dbo.Apartments a ON a.ApartmentId = i.ApartmentId
WHERE p.Status = 'Confirmed'
GROUP BY a.BuildingId, YEAR(p.PaidAt), MONTH(p.PaidAt);
GO

/* Income vs expenses per building per month */
CREATE OR ALTER VIEW dbo.vw_BuildingFinancialSummary AS
SELECT
    b.BuildingId, b.Name AS BuildingName,
    m.Yr, m.Mo,
    ISNULL(rev.TotalRevenue, 0)  AS Income,
    ISNULL(exp.TotalExpenses, 0) AS Expenses,
    ISNULL(rev.TotalRevenue, 0) - ISNULL(exp.TotalExpenses, 0) AS NetIncome
FROM dbo.Buildings b
CROSS APPLY (
    SELECT YEAR(p.PaidAt) AS Yr, MONTH(p.PaidAt) AS Mo
    FROM dbo.Payments p JOIN dbo.Invoices i ON i.InvoiceId = p.InvoiceId
                        JOIN dbo.Apartments a ON a.ApartmentId = i.ApartmentId
    WHERE a.BuildingId = b.BuildingId
    UNION
    SELECT YEAR(e.ExpenseDate), MONTH(e.ExpenseDate)
    FROM dbo.Expenses e WHERE e.BuildingId = b.BuildingId
) m
OUTER APPLY (
    SELECT SUM(p.Amount) AS TotalRevenue
    FROM dbo.Payments p JOIN dbo.Invoices i ON i.InvoiceId = p.InvoiceId
                        JOIN dbo.Apartments a ON a.ApartmentId = i.ApartmentId
    WHERE a.BuildingId = b.BuildingId AND p.Status = 'Confirmed'
      AND YEAR(p.PaidAt) = m.Yr AND MONTH(p.PaidAt) = m.Mo
) rev
OUTER APPLY (
    SELECT SUM(e.Amount) AS TotalExpenses
    FROM dbo.Expenses e
    WHERE e.BuildingId = b.BuildingId
      AND YEAR(e.ExpenseDate) = m.Yr AND MONTH(e.ExpenseDate) = m.Mo
) exp;
GO

/* Occupancy per building */
CREATE OR ALTER VIEW dbo.vw_OccupancySummary AS
SELECT
    b.BuildingId, b.Name AS BuildingName,
    COUNT(a.ApartmentId) AS TotalApartments,
    SUM(CASE WHEN a.Status IN ('Rented','OwnerOccupied') THEN 1 ELSE 0 END) AS OccupiedApartments,
    SUM(CASE WHEN a.Status = 'Available' THEN 1 ELSE 0 END) AS AvailableApartments,
    SUM(CASE WHEN a.Status = 'UnderMaintenance' THEN 1 ELSE 0 END) AS UnderMaintenance,
    CAST(100.0 * SUM(CASE WHEN a.Status IN ('Rented','OwnerOccupied') THEN 1 ELSE 0 END)
         / NULLIF(COUNT(a.ApartmentId), 0) AS DECIMAL(5,2)) AS OccupancyRate
FROM dbo.Buildings b
LEFT JOIN dbo.Apartments a ON a.BuildingId = b.BuildingId
WHERE b.IsActive = 1
GROUP BY b.BuildingId, b.Name;
GO

/* Maintenance workload per building */
CREATE OR ALTER VIEW dbo.vw_MaintenanceSummary AS
SELECT
    m.BuildingId, b.Name AS BuildingName,
    COUNT(*) AS TotalRequests,
    SUM(CASE WHEN m.Status IN ('Open','Assigned','InProgress','OnHold') THEN 1 ELSE 0 END) AS OpenRequests,
    SUM(CASE WHEN m.Status = 'Completed' THEN 1 ELSE 0 END) AS CompletedRequests,
    SUM(CASE WHEN m.Priority = 'Emergency' AND m.Status NOT IN ('Completed','Cancelled','Rejected') THEN 1 ELSE 0 END) AS OpenEmergencies,
    AVG(CASE WHEN m.CompletedAt IS NOT NULL THEN DATEDIFF(HOUR, m.CreatedAt, m.CompletedAt) END) AS AvgResolutionHours,
    AVG(CAST(m.Rating AS DECIMAL(3,2))) AS AvgRating
FROM dbo.MaintenanceRequests m
JOIN dbo.Buildings b ON b.BuildingId = m.BuildingId
GROUP BY m.BuildingId, b.Name;
GO

/* Users with their roles (comma-separated) */
CREATE OR ALTER VIEW dbo.vw_UserProfiles AS
SELECT
    u.UserId, u.PublicId, u.FullName, u.Email, u.Phone, u.NationalId,
    u.ProfileImageUrl, u.Address, u.PreferredLanguage, u.IsActive,
    u.IsPhoneVerified, u.LastLoginAt, u.CreatedAt,
    STUFF((SELECT ',' + r.Name FROM dbo.UserRoles ur
           JOIN dbo.Roles r ON r.RoleId = ur.RoleId
           WHERE ur.UserId = u.UserId FOR XML PATH('')), 1, 1, '') AS Roles
FROM dbo.Users u
WHERE u.IsDeleted = 0;
GO

/* Visitor log with host & apartment context */
CREATE OR ALTER VIEW dbo.vw_VisitorDetails AS
SELECT
    v.VisitorId, v.VisitorName, v.VisitorPhone, v.VehiclePlate, v.Purpose,
    v.ExpectedAt, v.ExpectedUntil, v.QrCode, v.Status,
    v.CheckedInAt, v.CheckedOutAt, v.CreatedAt,
    h.UserId AS HostUserId, h.FullName AS HostName, h.Phone AS HostPhone,
    a.ApartmentId, a.ApartmentNumber, a.BuildingId, b.Name AS BuildingName
FROM dbo.Visitors v
JOIN dbo.Users h ON h.UserId = v.HostUserId
JOIN dbo.Apartments a ON a.ApartmentId = v.ApartmentId
JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId;
GO

PRINT 'Views created.';
GO
