/* ============================================================
   3martna (عمارتنا) — Triggers
   ============================================================ */
USE Amartna;
GO

/* Keep UpdatedAt current on row modification */
CREATE OR ALTER TRIGGER dbo.trg_Users_UpdatedAt ON dbo.Users AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(UpdatedAt)
        UPDATE u SET UpdatedAt = SYSUTCDATETIME()
        FROM dbo.Users u JOIN inserted i ON i.UserId = u.UserId;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_Apartments_UpdatedAt ON dbo.Apartments AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(UpdatedAt)
        UPDATE a SET UpdatedAt = SYSUTCDATETIME()
        FROM dbo.Apartments a JOIN inserted i ON i.ApartmentId = a.ApartmentId;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_Contracts_UpdatedAt ON dbo.Contracts AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(UpdatedAt)
        UPDATE c SET UpdatedAt = SYSUTCDATETIME()
        FROM dbo.Contracts c JOIN inserted i ON i.ContractId = c.ContractId;
END;
GO

/* Recalculate invoice status whenever payments change */
CREATE OR ALTER TRIGGER dbo.trg_Payments_UpdateInvoiceStatus
ON dbo.Payments AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;

    ;WITH affected AS (
        SELECT InvoiceId FROM inserted
        UNION
        SELECT InvoiceId FROM deleted
    )
    UPDATE i
    SET i.Status = CASE
            WHEN i.Status = 'Cancelled' THEN 'Cancelled'
            WHEN ISNULL(p.PaidTotal, 0) >= i.Amount + i.LateFee THEN 'Paid'
            WHEN ISNULL(p.PaidTotal, 0) > 0 THEN 'PartiallyPaid'
            WHEN i.DueDate < CAST(SYSUTCDATETIME() AS DATE) THEN 'Overdue'
            ELSE 'Unpaid'
        END,
        i.UpdatedAt = SYSUTCDATETIME()
    FROM dbo.Invoices i
    JOIN affected af ON af.InvoiceId = i.InvoiceId
    OUTER APPLY (
        SELECT SUM(Amount) AS PaidTotal
        FROM dbo.Payments p
        WHERE p.InvoiceId = i.InvoiceId AND p.Status = 'Confirmed'
    ) p;
END;
GO

/* Sync apartment status when a contract becomes Active / ends */
CREATE OR ALTER TRIGGER dbo.trg_Contracts_SyncApartmentStatus
ON dbo.Contracts AFTER INSERT, UPDATE AS
BEGIN
    SET NOCOUNT ON;

    -- Activated contracts → apartment Rented
    UPDATE a SET a.Status = 'Rented'
    FROM dbo.Apartments a
    JOIN inserted i ON i.ApartmentId = a.ApartmentId
    WHERE i.Status = 'Active' AND a.Status <> 'Rented';

    -- Terminated/expired contracts with no other active contract → Available
    UPDATE a SET a.Status = 'Available'
    FROM dbo.Apartments a
    JOIN inserted i ON i.ApartmentId = a.ApartmentId
    WHERE i.Status IN ('Terminated','Expired')
      AND NOT EXISTS (
          SELECT 1 FROM dbo.Contracts c
          WHERE c.ApartmentId = a.ApartmentId AND c.Status = 'Active'
      )
      AND a.Status = 'Rented';
END;
GO

/* Audit sensitive user changes (role/status/password) */
CREATE OR ALTER TRIGGER dbo.trg_Users_Audit ON dbo.Users AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.AuditLogs (UserId, Action, EntityType, EntityId, OldValues, NewValues)
    SELECT
        i.UserId, 'USER_UPDATED', 'User', CAST(i.UserId AS VARCHAR(50)),
        (SELECT d.Email, d.Phone, d.IsActive, d.IsDeleted FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
        (SELECT i.Email, i.Phone, i.IsActive, i.IsDeleted FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    JOIN deleted d ON d.UserId = i.UserId
    WHERE ISNULL(i.Email,'') <> ISNULL(d.Email,'')
       OR i.Phone <> d.Phone
       OR i.IsActive <> d.IsActive
       OR i.IsDeleted <> d.IsDeleted
       OR i.PasswordHash <> d.PasswordHash;
END;
GO

/* Audit payment mutations (financial trail is append-only) */
CREATE OR ALTER TRIGGER dbo.trg_Payments_Audit ON dbo.Payments AFTER INSERT, UPDATE AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.AuditLogs (UserId, Action, EntityType, EntityId, OldValues, NewValues)
    SELECT
        i.PaidByUserId,
        CASE WHEN d.PaymentId IS NULL THEN 'PAYMENT_CREATED' ELSE 'PAYMENT_UPDATED' END,
        'Payment', CAST(i.PaymentId AS VARCHAR(50)),
        CASE WHEN d.PaymentId IS NULL THEN NULL
             ELSE (SELECT d.Amount, d.Status, d.Method FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
        (SELECT i.Amount, i.Status, i.Method, i.InvoiceId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    LEFT JOIN deleted d ON d.PaymentId = i.PaymentId;
END;
GO

/* Prevent hard-deleting payments — financial records are immutable */
CREATE OR ALTER TRIGGER dbo.trg_Payments_BlockDelete ON dbo.Payments INSTEAD OF DELETE AS
BEGIN
    SET NOCOUNT ON;
    RAISERROR('Payments cannot be deleted. Set Status = ''Rejected'' instead.', 16, 1);
END;
GO

PRINT 'Triggers created.';
GO
