/* ============================================================
   Migration 0001 — Identity & Authentication
   Tables: Users, Roles, Permissions, RolePermissions, UserRoles,
           RefreshTokens, VerificationCodes, AuditLogs
   Standards (every table): Id, CreatedAt, UpdatedAt, CreatedBy,
   UpdatedBy, IsDeleted (soft delete), RowVersion (concurrency).
   Multi-tenant readiness: Users.TenantId (nullable until the
   Tenants feature sprint introduces dbo.Tenants + FK).
   ============================================================ */

/* ------------------------- ROLES ------------------------- */
CREATE TABLE dbo.Roles (
    Id          INT IDENTITY(1,1) NOT NULL,
    Name        VARCHAR(50)   NOT NULL,
    NameAr      NVARCHAR(50)  NOT NULL,
    Description NVARCHAR(255) NULL,
    CreatedAt   DATETIME2(0)  NOT NULL CONSTRAINT DF_Roles_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2(0)  NOT NULL CONSTRAINT DF_Roles_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy   INT           NULL,
    UpdatedBy   INT           NULL,
    IsDeleted   BIT           NOT NULL CONSTRAINT DF_Roles_IsDeleted DEFAULT 0,
    RowVersion  ROWVERSION    NOT NULL,
    CONSTRAINT PK_Roles PRIMARY KEY (Id),
    CONSTRAINT UQ_Roles_Name UNIQUE (Name)
);
GO

/* ---------------------- PERMISSIONS ---------------------- */
CREATE TABLE dbo.Permissions (
    Id          INT IDENTITY(1,1) NOT NULL,
    Code        VARCHAR(100)  NOT NULL,   -- machine name, e.g. 'users.manage'
    Name        NVARCHAR(150) NOT NULL,
    Category    VARCHAR(50)   NOT NULL,   -- grouping for admin UI
    CreatedAt   DATETIME2(0)  NOT NULL CONSTRAINT DF_Permissions_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2(0)  NOT NULL CONSTRAINT DF_Permissions_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy   INT           NULL,
    UpdatedBy   INT           NULL,
    IsDeleted   BIT           NOT NULL CONSTRAINT DF_Permissions_IsDeleted DEFAULT 0,
    RowVersion  ROWVERSION    NOT NULL,
    CONSTRAINT PK_Permissions PRIMARY KEY (Id),
    CONSTRAINT UQ_Permissions_Code UNIQUE (Code)
);
GO

CREATE TABLE dbo.RolePermissions (
    Id           INT IDENTITY(1,1) NOT NULL,
    RoleId       INT NOT NULL,
    PermissionId INT NOT NULL,
    CreatedAt    DATETIME2(0) NOT NULL CONSTRAINT DF_RolePermissions_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt    DATETIME2(0) NOT NULL CONSTRAINT DF_RolePermissions_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy    INT NULL,
    UpdatedBy    INT NULL,
    IsDeleted    BIT NOT NULL CONSTRAINT DF_RolePermissions_IsDeleted DEFAULT 0,
    RowVersion   ROWVERSION NOT NULL,
    CONSTRAINT PK_RolePermissions PRIMARY KEY (Id),
    CONSTRAINT UQ_RolePermissions UNIQUE (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles (Id),
    CONSTRAINT FK_RolePermissions_Permissions FOREIGN KEY (PermissionId) REFERENCES dbo.Permissions (Id)
);
GO

/* ------------------------- USERS ------------------------- */
CREATE TABLE dbo.Users (
    Id                INT IDENTITY(1,1) NOT NULL,
    PublicId          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Users_PublicId DEFAULT NEWID(),
    TenantId          INT NULL,                 -- multi-tenant readiness (FK added with Tenants sprint)
    FirstName         NVARCHAR(75)  NOT NULL,
    LastName          NVARCHAR(75)  NOT NULL,
    Email             VARCHAR(255)  NULL,
    PhoneNumber       VARCHAR(20)   NOT NULL,
    PasswordHash      VARCHAR(255)  NOT NULL,
    ProfileImageUrl   VARCHAR(500)  NULL,
    PreferredLanguage VARCHAR(2)    NOT NULL CONSTRAINT DF_Users_Lang DEFAULT 'ar',
    Status            VARCHAR(20)   NOT NULL CONSTRAINT DF_Users_Status DEFAULT 'Active',
    EmailVerified     BIT           NOT NULL CONSTRAINT DF_Users_EmailVerified DEFAULT 0,
    PhoneVerified     BIT           NOT NULL CONSTRAINT DF_Users_PhoneVerified DEFAULT 0,
    LastLoginAt       DATETIME2(0)  NULL,
    FailedLoginCount  INT           NOT NULL CONSTRAINT DF_Users_FailedLogins DEFAULT 0,
    LockedUntil       DATETIME2(0)  NULL,       -- brute-force lockout
    CreatedAt         DATETIME2(0)  NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt         DATETIME2(0)  NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy         INT           NULL,
    UpdatedBy         INT           NULL,
    IsDeleted         BIT           NOT NULL CONSTRAINT DF_Users_IsDeleted DEFAULT 0,
    RowVersion        ROWVERSION    NOT NULL,
    CONSTRAINT PK_Users PRIMARY KEY (Id),
    CONSTRAINT UQ_Users_PublicId UNIQUE (PublicId),
    CONSTRAINT CK_Users_Lang CHECK (PreferredLanguage IN ('ar', 'en')),
    CONSTRAINT CK_Users_Status CHECK (Status IN ('Active', 'Suspended'))
);
GO

/* Uniqueness that respects soft delete (deleted rows free the value) */
CREATE UNIQUE NONCLUSTERED INDEX UQ_Users_Email
    ON dbo.Users (Email) WHERE Email IS NOT NULL AND IsDeleted = 0;
CREATE UNIQUE NONCLUSTERED INDEX UQ_Users_Phone
    ON dbo.Users (PhoneNumber) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_Users_TenantId
    ON dbo.Users (TenantId) WHERE TenantId IS NOT NULL;
CREATE NONCLUSTERED INDEX IX_Users_Status
    ON dbo.Users (Status) WHERE IsDeleted = 0;
GO

/* ----------------------- USER ROLES ----------------------- */
CREATE TABLE dbo.UserRoles (
    Id         INT IDENTITY(1,1) NOT NULL,
    UserId     INT NOT NULL,
    RoleId     INT NOT NULL,
    CreatedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_UserRoles_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_UserRoles_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy  INT NULL,
    UpdatedBy  INT NULL,
    IsDeleted  BIT NOT NULL CONSTRAINT DF_UserRoles_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_UserRoles PRIMARY KEY (Id),
    CONSTRAINT UQ_UserRoles UNIQUE (UserId, RoleId),
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id),
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles (Id)
);
GO

CREATE NONCLUSTERED INDEX IX_UserRoles_UserId ON dbo.UserRoles (UserId) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_UserRoles_RoleId ON dbo.UserRoles (RoleId) WHERE IsDeleted = 0;
GO

/* --------------------- REFRESH TOKENS --------------------- */
CREATE TABLE dbo.RefreshTokens (
    Id                  BIGINT IDENTITY(1,1) NOT NULL,
    UserId              INT NOT NULL,
    TokenHash           VARCHAR(64) NOT NULL,     -- SHA-256 hex; plain token never stored
    ExpiresAt           DATETIME2(0) NOT NULL,
    RevokedAt           DATETIME2(0) NULL,
    ReplacedByTokenHash VARCHAR(64) NULL,         -- rotation chain (reuse detection)
    CreatedByIp         VARCHAR(45) NULL,
    CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_RefreshTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_RefreshTokens_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy           INT NULL,
    UpdatedBy           INT NULL,
    IsDeleted           BIT NOT NULL CONSTRAINT DF_RefreshTokens_IsDeleted DEFAULT 0,
    RowVersion          ROWVERSION NOT NULL,
    CONSTRAINT PK_RefreshTokens PRIMARY KEY (Id),
    CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id)
);
GO

CREATE UNIQUE NONCLUSTERED INDEX UQ_RefreshTokens_TokenHash ON dbo.RefreshTokens (TokenHash);
CREATE NONCLUSTERED INDEX IX_RefreshTokens_UserId
    ON dbo.RefreshTokens (UserId) INCLUDE (ExpiresAt, RevokedAt);
GO

/* ------------------- VERIFICATION CODES -------------------
   Email verification, phone verification and password-reset
   tokens. Only hashes are stored; codes expire and are
   single-use with an attempt counter. */
CREATE TABLE dbo.VerificationCodes (
    Id           BIGINT IDENTITY(1,1) NOT NULL,
    UserId       INT NOT NULL,
    CodeHash     VARCHAR(64) NOT NULL,             -- SHA-256 hex
    Purpose      VARCHAR(20) NOT NULL,
    ExpiresAt    DATETIME2(0) NOT NULL,
    ConsumedAt   DATETIME2(0) NULL,
    AttemptCount INT NOT NULL CONSTRAINT DF_VerificationCodes_Attempts DEFAULT 0,
    CreatedAt    DATETIME2(0) NOT NULL CONSTRAINT DF_VerificationCodes_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt    DATETIME2(0) NOT NULL CONSTRAINT DF_VerificationCodes_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy    INT NULL,
    UpdatedBy    INT NULL,
    IsDeleted    BIT NOT NULL CONSTRAINT DF_VerificationCodes_IsDeleted DEFAULT 0,
    RowVersion   ROWVERSION NOT NULL,
    CONSTRAINT PK_VerificationCodes PRIMARY KEY (Id),
    CONSTRAINT FK_VerificationCodes_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id),
    CONSTRAINT CK_VerificationCodes_Purpose CHECK (Purpose IN ('EmailVerify', 'PhoneVerify', 'PasswordReset'))
);
GO

CREATE NONCLUSTERED INDEX IX_VerificationCodes_User_Purpose
    ON dbo.VerificationCodes (UserId, Purpose) INCLUDE (ExpiresAt, ConsumedAt);
CREATE NONCLUSTERED INDEX IX_VerificationCodes_CodeHash ON dbo.VerificationCodes (CodeHash);
GO

/* ------------------------ AUDIT LOGS ----------------------- */
CREATE TABLE dbo.AuditLogs (
    Id         BIGINT IDENTITY(1,1) NOT NULL,
    UserId     INT NULL,                          -- NULL for anonymous events
    Action     VARCHAR(50) NOT NULL,              -- e.g. LOGIN, LOGIN_FAILED, PASSWORD_RESET
    EntityType VARCHAR(50) NULL,
    EntityId   VARCHAR(50) NULL,
    Metadata   NVARCHAR(MAX) NULL,                -- JSON payload (redacted at app layer)
    IpAddress  VARCHAR(45) NULL,
    UserAgent  VARCHAR(300) NULL,
    CreatedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_AuditLogs_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_AuditLogs_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy  INT NULL,
    UpdatedBy  INT NULL,
    IsDeleted  BIT NOT NULL CONSTRAINT DF_AuditLogs_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_AuditLogs PRIMARY KEY (Id),
    CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id)
);
GO

CREATE NONCLUSTERED INDEX IX_AuditLogs_User_Time ON dbo.AuditLogs (UserId, CreatedAt DESC);
CREATE NONCLUSTERED INDEX IX_AuditLogs_Action ON dbo.AuditLogs (Action, CreatedAt DESC);
GO
