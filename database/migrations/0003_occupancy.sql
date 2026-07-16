/* ============================================================
   Migration 0003 — Sprint 5: Occupancy Management

   1. Residents become registrable BEFORE they occupy an apartment:
      ApartmentId / MoveInDate turn nullable. Current occupancy lives
      on the resident row; per-stay history lives in dbo.Occupancies.
   2. dbo.Occupancies — one row per stay (move-in → move-out).
      History is never deleted; a stay is "active" while
      MoveOutDate IS NULL. Filtered unique indexes enforce at most
      one active stay per apartment and per resident.
   3. One ACTIVE lease per resident (per-apartment index exists
      since 0002).
   4. dbo.IdempotencyKeys — request de-duplication for POSTs.
   ============================================================ */

/* ---------- 1. Residents: registration precedes occupancy ---------- */
ALTER TABLE dbo.Residents DROP CONSTRAINT CK_Residents_Dates;
GO
ALTER TABLE dbo.Residents ALTER COLUMN ApartmentId UNIQUEIDENTIFIER NULL;
ALTER TABLE dbo.Residents ALTER COLUMN MoveInDate DATE NULL;
GO
ALTER TABLE dbo.Residents ADD CONSTRAINT CK_Residents_Dates
    CHECK (MoveOutDate IS NULL OR (MoveInDate IS NOT NULL AND MoveOutDate >= MoveInDate));
/* A resident occupying an apartment must have a move-in date */
ALTER TABLE dbo.Residents ADD CONSTRAINT CK_Residents_Occupancy
    CHECK (ApartmentId IS NULL OR MoveInDate IS NOT NULL);
GO

/* ---------------------- 2. Occupancies ---------------------- */
CREATE TABLE dbo.Occupancies (
    Id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Occupancies_Id DEFAULT NEWSEQUENTIALID(),
    TenantId        UNIQUEIDENTIFIER NOT NULL,
    ApartmentId     UNIQUEIDENTIFIER NOT NULL,
    ResidentId      UNIQUEIDENTIFIER NOT NULL,
    LeaseContractId UNIQUEIDENTIFIER NOT NULL,
    MoveInDate      DATE NOT NULL,
    MoveOutDate     DATE NULL,                       -- NULL = currently occupied
    MoveOutReason   NVARCHAR(300) NULL,
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Occupancies_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Occupancies_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy       UNIQUEIDENTIFIER NULL,
    UpdatedBy       UNIQUEIDENTIFIER NULL,
    IsDeleted       BIT NOT NULL CONSTRAINT DF_Occupancies_IsDeleted DEFAULT 0,
    RowVersion      ROWVERSION NOT NULL,
    CONSTRAINT PK_Occupancies PRIMARY KEY (Id),
    CONSTRAINT FK_Occupancies_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Occupancies_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (Id),
    CONSTRAINT FK_Occupancies_Residents FOREIGN KEY (ResidentId) REFERENCES dbo.Residents (Id),
    CONSTRAINT FK_Occupancies_Leases FOREIGN KEY (LeaseContractId) REFERENCES dbo.LeaseContracts (Id),
    CONSTRAINT CK_Occupancies_Dates CHECK (MoveOutDate IS NULL OR MoveOutDate >= MoveInDate)
);
GO
/* Business invariants: at most one ACTIVE stay per apartment / per resident */
CREATE UNIQUE NONCLUSTERED INDEX UQ_Occupancies_ActivePerApartment
    ON dbo.Occupancies (ApartmentId) WHERE MoveOutDate IS NULL AND IsDeleted = 0;
CREATE UNIQUE NONCLUSTERED INDEX UQ_Occupancies_ActivePerResident
    ON dbo.Occupancies (ResidentId) WHERE MoveOutDate IS NULL AND IsDeleted = 0;
/* History reads */
CREATE NONCLUSTERED INDEX IX_Occupancies_Tenant_Apartment
    ON dbo.Occupancies (TenantId, ApartmentId, MoveInDate DESC) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_Occupancies_Tenant_Resident
    ON dbo.Occupancies (TenantId, ResidentId, MoveInDate DESC) WHERE IsDeleted = 0;
GO

/* -------- 3. One ACTIVE lease per resident (mirror of 0002's
             per-apartment invariant) -------- */
CREATE UNIQUE NONCLUSTERED INDEX UQ_LeaseContracts_ActivePerResident
    ON dbo.LeaseContracts (ResidentId) WHERE Status = 'Active' AND IsDeleted = 0;
GO

/* -------------------- 4. Idempotency keys -------------------- */
/* Scope = caller + endpoint; RequestHash detects key reuse with a
   different payload. Completed rows replay the stored response. */
CREATE TABLE dbo.IdempotencyKeys (
    Id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_IdempotencyKeys_Id DEFAULT NEWSEQUENTIALID(),
    Scope          VARCHAR(400) NOT NULL,            -- userId + method + path
    IdemKey        VARCHAR(200) NOT NULL,
    RequestHash    CHAR(64) NOT NULL,                -- SHA-256 of the request body
    Status         VARCHAR(12) NOT NULL,             -- InProgress | Completed
    ResponseStatus INT NULL,
    ResponseBody   NVARCHAR(MAX) NULL,
    CreatedAt      DATETIME2(0) NOT NULL CONSTRAINT DF_IdempotencyKeys_CreatedAt DEFAULT SYSUTCDATETIME(),
    ExpiresAt      DATETIME2(0) NOT NULL,
    CONSTRAINT PK_IdempotencyKeys PRIMARY KEY (Id),
    CONSTRAINT CK_IdempotencyKeys_Status CHECK (Status IN ('InProgress', 'Completed'))
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_IdempotencyKeys_Scope_Key
    ON dbo.IdempotencyKeys (Scope, IdemKey);
CREATE NONCLUSTERED INDEX IX_IdempotencyKeys_ExpiresAt
    ON dbo.IdempotencyKeys (ExpiresAt);
GO
