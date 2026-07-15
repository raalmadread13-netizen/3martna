/* ============================================================
   Migration 0002 — Multi-Tenant Foundation & Core Business Domain
   (Sprint 3 — schema only, no business logic, no sample data)

   Standards (EVERY table): Id (GUID, NEWSEQUENTIALID default),
   TenantId, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy,
   IsDeleted (soft delete), RowVersion (optimistic concurrency).

   Tenant isolation: every business row belongs to exactly one
   Tenant; unique constraints are tenant-scoped filtered indexes;
   hot-path indexes lead with TenantId.
   ============================================================ */

/* ========================= TENANTS ========================= */
CREATE TABLE dbo.Tenants (
    Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Tenants_Id DEFAULT NEWSEQUENTIALID(),
    Name         NVARCHAR(150) NOT NULL,        -- display name (company / property manager)
    LegalName    NVARCHAR(200) NULL,
    ContactEmail VARCHAR(255)  NULL,
    ContactPhone VARCHAR(20)   NULL,
    Status       VARCHAR(20)   NOT NULL CONSTRAINT DF_Tenants_Status DEFAULT 'Active',
    CreatedAt    DATETIME2(0)  NOT NULL CONSTRAINT DF_Tenants_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt    DATETIME2(0)  NOT NULL CONSTRAINT DF_Tenants_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy    UNIQUEIDENTIFIER NULL,
    UpdatedBy    UNIQUEIDENTIFIER NULL,
    IsDeleted    BIT NOT NULL CONSTRAINT DF_Tenants_IsDeleted DEFAULT 0,
    RowVersion   ROWVERSION NOT NULL,
    CONSTRAINT PK_Tenants PRIMARY KEY (Id),
    CONSTRAINT CK_Tenants_Status CHECK (Status IN ('Active', 'Suspended'))
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_Tenants_Name ON dbo.Tenants (Name) WHERE IsDeleted = 0;
GO

/* Users now reference their tenant (nullable: platform-level users) */
ALTER TABLE dbo.Users
    ADD CONSTRAINT FK_Users_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id);
GO

/* ========================= BUILDINGS ======================= */
CREATE TABLE dbo.Buildings (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Buildings_Id DEFAULT NEWSEQUENTIALID(),
    TenantId    UNIQUEIDENTIFIER NOT NULL,
    Name        NVARCHAR(150) NOT NULL,
    Address     NVARCHAR(300) NOT NULL,
    City        NVARCHAR(100) NOT NULL,
    District    NVARCHAR(100) NULL,
    Latitude    DECIMAL(9,6)  NULL,
    Longitude   DECIMAL(9,6)  NULL,
    TotalFloors INT NOT NULL,
    YearBuilt   INT NULL,
    Status      VARCHAR(20) NOT NULL CONSTRAINT DF_Buildings_Status DEFAULT 'Active',
    Notes       NVARCHAR(500) NULL,
    CreatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_Buildings_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_Buildings_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy   UNIQUEIDENTIFIER NULL,
    UpdatedBy   UNIQUEIDENTIFIER NULL,
    IsDeleted   BIT NOT NULL CONSTRAINT DF_Buildings_IsDeleted DEFAULT 0,
    RowVersion  ROWVERSION NOT NULL,
    CONSTRAINT PK_Buildings PRIMARY KEY (Id),
    CONSTRAINT FK_Buildings_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT CK_Buildings_Status CHECK (Status IN ('Active', 'UnderConstruction', 'Inactive')),
    CONSTRAINT CK_Buildings_Floors CHECK (TotalFloors > 0),
    CONSTRAINT CK_Buildings_Year CHECK (YearBuilt IS NULL OR YearBuilt BETWEEN 1900 AND 2100),
    CONSTRAINT CK_Buildings_Lat CHECK (Latitude IS NULL OR Latitude BETWEEN -90 AND 90),
    CONSTRAINT CK_Buildings_Lng CHECK (Longitude IS NULL OR Longitude BETWEEN -180 AND 180)
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_Buildings_Tenant_Name
    ON dbo.Buildings (TenantId, Name) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_Buildings_Tenant ON dbo.Buildings (TenantId) WHERE IsDeleted = 0;
GO

/* ========================== FLOORS ========================= */
CREATE TABLE dbo.Floors (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Floors_Id DEFAULT NEWSEQUENTIALID(),
    TenantId    UNIQUEIDENTIFIER NOT NULL,
    BuildingId  UNIQUEIDENTIFIER NOT NULL,
    FloorNumber INT NOT NULL,
    Name        NVARCHAR(50) NULL,
    CreatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_Floors_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_Floors_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy   UNIQUEIDENTIFIER NULL,
    UpdatedBy   UNIQUEIDENTIFIER NULL,
    IsDeleted   BIT NOT NULL CONSTRAINT DF_Floors_IsDeleted DEFAULT 0,
    RowVersion  ROWVERSION NOT NULL,
    CONSTRAINT PK_Floors PRIMARY KEY (Id),
    CONSTRAINT FK_Floors_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Floors_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (Id),
    CONSTRAINT CK_Floors_Number CHECK (FloorNumber BETWEEN -5 AND 200)
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_Floors_Building_Number
    ON dbo.Floors (BuildingId, FloorNumber) WHERE IsDeleted = 0;
GO

/* ======================== APARTMENTS ======================= */
CREATE TABLE dbo.Apartments (
    Id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Apartments_Id DEFAULT NEWSEQUENTIALID(),
    TenantId       UNIQUEIDENTIFIER NOT NULL,
    BuildingId     UNIQUEIDENTIFIER NOT NULL,
    FloorId        UNIQUEIDENTIFIER NOT NULL,
    UnitNumber     VARCHAR(20) NOT NULL,
    Bedrooms       INT NOT NULL CONSTRAINT DF_Apartments_Bedrooms DEFAULT 1,
    Bathrooms      INT NOT NULL CONSTRAINT DF_Apartments_Bathrooms DEFAULT 1,
    AreaSqm        DECIMAL(8,2) NULL,
    BaseRentAmount DECIMAL(12,2) NULL,
    Currency       CHAR(3) NOT NULL CONSTRAINT DF_Apartments_Currency DEFAULT 'JOD',
    Status         VARCHAR(20) NOT NULL CONSTRAINT DF_Apartments_Status DEFAULT 'Available',
    OwnerId        UNIQUEIDENTIFIER NULL,          -- FK added after Owners is created
    Description    NVARCHAR(500) NULL,
    CreatedAt      DATETIME2(0) NOT NULL CONSTRAINT DF_Apartments_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt      DATETIME2(0) NOT NULL CONSTRAINT DF_Apartments_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy      UNIQUEIDENTIFIER NULL,
    UpdatedBy      UNIQUEIDENTIFIER NULL,
    IsDeleted      BIT NOT NULL CONSTRAINT DF_Apartments_IsDeleted DEFAULT 0,
    RowVersion     ROWVERSION NOT NULL,
    CONSTRAINT PK_Apartments PRIMARY KEY (Id),
    CONSTRAINT FK_Apartments_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Apartments_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (Id),
    CONSTRAINT FK_Apartments_Floors FOREIGN KEY (FloorId) REFERENCES dbo.Floors (Id),
    CONSTRAINT CK_Apartments_Status CHECK (Status IN ('Available','Leased','OwnerOccupied','UnderMaintenance','Reserved')),
    CONSTRAINT CK_Apartments_Rooms CHECK (Bedrooms >= 0 AND Bathrooms >= 0),
    CONSTRAINT CK_Apartments_Area CHECK (AreaSqm IS NULL OR AreaSqm > 0),
    CONSTRAINT CK_Apartments_Rent CHECK (BaseRentAmount IS NULL OR BaseRentAmount >= 0)
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_Apartments_Building_Unit
    ON dbo.Apartments (BuildingId, UnitNumber) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_Apartments_Tenant_Building
    ON dbo.Apartments (TenantId, BuildingId) INCLUDE (Status) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_Apartments_Owner
    ON dbo.Apartments (OwnerId) WHERE OwnerId IS NOT NULL AND IsDeleted = 0;
GO

/* ====================== PARKING SPACES ===================== */
CREATE TABLE dbo.ParkingSpaces (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ParkingSpaces_Id DEFAULT NEWSEQUENTIALID(),
    TenantId    UNIQUEIDENTIFIER NOT NULL,
    BuildingId  UNIQUEIDENTIFIER NOT NULL,
    SpaceNumber VARCHAR(20) NOT NULL,
    SpaceType   VARCHAR(20) NOT NULL CONSTRAINT DF_ParkingSpaces_Type DEFAULT 'Standard',
    ApartmentId UNIQUEIDENTIFIER NULL,             -- assigned apartment (optional)
    MonthlyFee  DECIMAL(12,2) NULL,
    CreatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_ParkingSpaces_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_ParkingSpaces_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy   UNIQUEIDENTIFIER NULL,
    UpdatedBy   UNIQUEIDENTIFIER NULL,
    IsDeleted   BIT NOT NULL CONSTRAINT DF_ParkingSpaces_IsDeleted DEFAULT 0,
    RowVersion  ROWVERSION NOT NULL,
    CONSTRAINT PK_ParkingSpaces PRIMARY KEY (Id),
    CONSTRAINT FK_ParkingSpaces_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_ParkingSpaces_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (Id),
    CONSTRAINT FK_ParkingSpaces_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (Id),
    CONSTRAINT CK_ParkingSpaces_Type CHECK (SpaceType IN ('Standard','Covered','Accessible','Visitor')),
    CONSTRAINT CK_ParkingSpaces_Fee CHECK (MonthlyFee IS NULL OR MonthlyFee >= 0)
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_ParkingSpaces_Building_Number
    ON dbo.ParkingSpaces (BuildingId, SpaceNumber) WHERE IsDeleted = 0;
GO

/* ======================= STORAGE UNITS ===================== */
CREATE TABLE dbo.StorageUnits (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_StorageUnits_Id DEFAULT NEWSEQUENTIALID(),
    TenantId    UNIQUEIDENTIFIER NOT NULL,
    BuildingId  UNIQUEIDENTIFIER NOT NULL,
    UnitNumber  VARCHAR(20) NOT NULL,
    AreaSqm     DECIMAL(8,2) NULL,
    ApartmentId UNIQUEIDENTIFIER NULL,
    MonthlyFee  DECIMAL(12,2) NULL,
    CreatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_StorageUnits_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_StorageUnits_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy   UNIQUEIDENTIFIER NULL,
    UpdatedBy   UNIQUEIDENTIFIER NULL,
    IsDeleted   BIT NOT NULL CONSTRAINT DF_StorageUnits_IsDeleted DEFAULT 0,
    RowVersion  ROWVERSION NOT NULL,
    CONSTRAINT PK_StorageUnits PRIMARY KEY (Id),
    CONSTRAINT FK_StorageUnits_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_StorageUnits_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (Id),
    CONSTRAINT FK_StorageUnits_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (Id),
    CONSTRAINT CK_StorageUnits_Area CHECK (AreaSqm IS NULL OR AreaSqm > 0),
    CONSTRAINT CK_StorageUnits_Fee CHECK (MonthlyFee IS NULL OR MonthlyFee >= 0)
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_StorageUnits_Building_Number
    ON dbo.StorageUnits (BuildingId, UnitNumber) WHERE IsDeleted = 0;
GO

/* ========================== OWNERS ========================= */
CREATE TABLE dbo.Owners (
    Id                       UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Owners_Id DEFAULT NEWSEQUENTIALID(),
    TenantId                 UNIQUEIDENTIFIER NOT NULL,
    OwnerType                VARCHAR(20) NOT NULL CONSTRAINT DF_Owners_Type DEFAULT 'Individual',
    UserId                   UNIQUEIDENTIFIER NULL,   -- optional app account link
    FullName                 NVARCHAR(200) NOT NULL,
    CompanyName              NVARCHAR(200) NULL,
    NationalIdOrRegistration VARCHAR(30) NULL,
    Email                    VARCHAR(255) NULL,
    PhoneNumber              VARCHAR(20) NULL,
    Address                  NVARCHAR(300) NULL,
    CreatedAt                DATETIME2(0) NOT NULL CONSTRAINT DF_Owners_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt                DATETIME2(0) NOT NULL CONSTRAINT DF_Owners_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy                UNIQUEIDENTIFIER NULL,
    UpdatedBy                UNIQUEIDENTIFIER NULL,
    IsDeleted                BIT NOT NULL CONSTRAINT DF_Owners_IsDeleted DEFAULT 0,
    RowVersion               ROWVERSION NOT NULL,
    CONSTRAINT PK_Owners PRIMARY KEY (Id),
    CONSTRAINT FK_Owners_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Owners_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id),
    CONSTRAINT CK_Owners_Type CHECK (OwnerType IN ('Individual','Company')),
    CONSTRAINT CK_Owners_Company CHECK (OwnerType <> 'Company' OR CompanyName IS NOT NULL)
);
GO
CREATE NONCLUSTERED INDEX IX_Owners_Tenant ON dbo.Owners (TenantId) WHERE IsDeleted = 0;
GO

/* Apartments → Owners (deferred FK, Owners created after Apartments) */
ALTER TABLE dbo.Apartments
    ADD CONSTRAINT FK_Apartments_Owners FOREIGN KEY (OwnerId) REFERENCES dbo.Owners (Id);
GO

/* ========================= RESIDENTS ======================= */
CREATE TABLE dbo.Residents (
    Id                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Residents_Id DEFAULT NEWSEQUENTIALID(),
    TenantId              UNIQUEIDENTIFIER NOT NULL,
    ApartmentId           UNIQUEIDENTIFIER NOT NULL,
    UserId                UNIQUEIDENTIFIER NULL,    -- optional app account link
    FullName              NVARCHAR(200) NOT NULL,
    PhoneNumber           VARCHAR(20) NOT NULL,
    Email                 VARCHAR(255) NULL,
    ResidencyType         VARCHAR(20) NOT NULL,
    MoveInDate            DATE NOT NULL,
    MoveOutDate           DATE NULL,
    EmergencyContactName  NVARCHAR(150) NULL,
    EmergencyContactPhone VARCHAR(20) NULL,
    CreatedAt             DATETIME2(0) NOT NULL CONSTRAINT DF_Residents_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt             DATETIME2(0) NOT NULL CONSTRAINT DF_Residents_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy             UNIQUEIDENTIFIER NULL,
    UpdatedBy             UNIQUEIDENTIFIER NULL,
    IsDeleted             BIT NOT NULL CONSTRAINT DF_Residents_IsDeleted DEFAULT 0,
    RowVersion            ROWVERSION NOT NULL,
    CONSTRAINT PK_Residents PRIMARY KEY (Id),
    CONSTRAINT FK_Residents_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Residents_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (Id),
    CONSTRAINT FK_Residents_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id),
    CONSTRAINT CK_Residents_Type CHECK (ResidencyType IN ('OwnerOccupant','LeaseTenant','FamilyMember')),
    CONSTRAINT CK_Residents_Dates CHECK (MoveOutDate IS NULL OR MoveOutDate >= MoveInDate)
);
GO
CREATE NONCLUSTERED INDEX IX_Residents_Tenant_Apartment
    ON dbo.Residents (TenantId, ApartmentId) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_Residents_User
    ON dbo.Residents (UserId) WHERE UserId IS NOT NULL AND IsDeleted = 0;
GO

/* ====================== LEASE CONTRACTS ==================== */
CREATE TABLE dbo.LeaseContracts (
    Id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_LeaseContracts_Id DEFAULT NEWSEQUENTIALID(),
    TenantId          UNIQUEIDENTIFIER NOT NULL,
    ContractNumber    VARCHAR(30) NOT NULL,
    ApartmentId       UNIQUEIDENTIFIER NOT NULL,
    OwnerId           UNIQUEIDENTIFIER NOT NULL,     -- lessor
    ResidentId        UNIQUEIDENTIFIER NOT NULL,     -- lessee
    StartDate         DATE NOT NULL,
    EndDate           DATE NOT NULL,
    MonthlyRent       DECIMAL(12,2) NOT NULL,
    Currency          CHAR(3) NOT NULL CONSTRAINT DF_LeaseContracts_Currency DEFAULT 'JOD',
    DepositAmount     DECIMAL(12,2) NOT NULL CONSTRAINT DF_LeaseContracts_Deposit DEFAULT 0,
    PaymentFrequency  VARCHAR(20) NOT NULL CONSTRAINT DF_LeaseContracts_Freq DEFAULT 'Monthly',
    LateFeePercent    DECIMAL(5,2) NOT NULL CONSTRAINT DF_LeaseContracts_LateFee DEFAULT 0,
    GraceDays         INT NOT NULL CONSTRAINT DF_LeaseContracts_Grace DEFAULT 5,
    Status            VARCHAR(20) NOT NULL CONSTRAINT DF_LeaseContracts_Status DEFAULT 'Draft',
    TerminatedAt      DATETIME2(0) NULL,
    TerminationReason NVARCHAR(500) NULL,
    CreatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_LeaseContracts_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_LeaseContracts_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy         UNIQUEIDENTIFIER NULL,
    UpdatedBy         UNIQUEIDENTIFIER NULL,
    IsDeleted         BIT NOT NULL CONSTRAINT DF_LeaseContracts_IsDeleted DEFAULT 0,
    RowVersion        ROWVERSION NOT NULL,
    CONSTRAINT PK_LeaseContracts PRIMARY KEY (Id),
    CONSTRAINT FK_LeaseContracts_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_LeaseContracts_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (Id),
    CONSTRAINT FK_LeaseContracts_Owners FOREIGN KEY (OwnerId) REFERENCES dbo.Owners (Id),
    CONSTRAINT FK_LeaseContracts_Residents FOREIGN KEY (ResidentId) REFERENCES dbo.Residents (Id),
    CONSTRAINT CK_LeaseContracts_Dates CHECK (EndDate > StartDate),
    CONSTRAINT CK_LeaseContracts_Rent CHECK (MonthlyRent > 0),
    CONSTRAINT CK_LeaseContracts_Deposit CHECK (DepositAmount >= 0),
    CONSTRAINT CK_LeaseContracts_Freq CHECK (PaymentFrequency IN ('Monthly','Quarterly','SemiAnnual','Annual')),
    CONSTRAINT CK_LeaseContracts_LateFee CHECK (LateFeePercent BETWEEN 0 AND 100),
    CONSTRAINT CK_LeaseContracts_Grace CHECK (GraceDays BETWEEN 0 AND 30),
    CONSTRAINT CK_LeaseContracts_Status CHECK (Status IN ('Draft','Active','Expired','Terminated','Cancelled'))
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_LeaseContracts_Tenant_Number
    ON dbo.LeaseContracts (TenantId, ContractNumber) WHERE IsDeleted = 0;
/* Business invariant: at most ONE active lease per apartment */
CREATE UNIQUE NONCLUSTERED INDEX UQ_LeaseContracts_ActivePerApartment
    ON dbo.LeaseContracts (ApartmentId) WHERE Status = 'Active' AND IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_LeaseContracts_Tenant_Status
    ON dbo.LeaseContracts (TenantId, Status) INCLUDE (EndDate) WHERE IsDeleted = 0;
GO

/* ================== MAINTENANCE CATEGORIES ================= */
CREATE TABLE dbo.MaintenanceCategories (
    Id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_MaintenanceCategories_Id DEFAULT NEWSEQUENTIALID(),
    TenantId   UNIQUEIDENTIFIER NOT NULL,
    Name       NVARCHAR(100) NOT NULL,
    NameAr     NVARCHAR(100) NOT NULL,
    IsActive   BIT NOT NULL CONSTRAINT DF_MaintenanceCategories_Active DEFAULT 1,
    CreatedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_MaintenanceCategories_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_MaintenanceCategories_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy  UNIQUEIDENTIFIER NULL,
    UpdatedBy  UNIQUEIDENTIFIER NULL,
    IsDeleted  BIT NOT NULL CONSTRAINT DF_MaintenanceCategories_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_MaintenanceCategories PRIMARY KEY (Id),
    CONSTRAINT FK_MaintenanceCategories_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id)
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_MaintenanceCategories_Tenant_Name
    ON dbo.MaintenanceCategories (TenantId, Name) WHERE IsDeleted = 0;
GO

/* ==================== BUILDING EMPLOYEES =================== */
CREATE TABLE dbo.BuildingEmployees (
    Id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_BuildingEmployees_Id DEFAULT NEWSEQUENTIALID(),
    TenantId   UNIQUEIDENTIFIER NOT NULL,
    BuildingId UNIQUEIDENTIFIER NOT NULL,
    UserId     UNIQUEIDENTIFIER NOT NULL,
    Position   VARCHAR(20) NOT NULL,
    HiredOn    DATE NULL,
    EndedOn    DATE NULL,
    CreatedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_BuildingEmployees_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_BuildingEmployees_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy  UNIQUEIDENTIFIER NULL,
    UpdatedBy  UNIQUEIDENTIFIER NULL,
    IsDeleted  BIT NOT NULL CONSTRAINT DF_BuildingEmployees_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_BuildingEmployees PRIMARY KEY (Id),
    CONSTRAINT FK_BuildingEmployees_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_BuildingEmployees_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (Id),
    CONSTRAINT FK_BuildingEmployees_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id),
    CONSTRAINT CK_BuildingEmployees_Position CHECK (Position IN ('Manager','Maintenance','Security','Cleaning','Concierge','Other')),
    CONSTRAINT CK_BuildingEmployees_Dates CHECK (EndedOn IS NULL OR HiredOn IS NULL OR EndedOn >= HiredOn)
);
GO
/* One active assignment per user/building/position */
CREATE UNIQUE NONCLUSTERED INDEX UQ_BuildingEmployees_Active
    ON dbo.BuildingEmployees (BuildingId, UserId, Position) WHERE EndedOn IS NULL AND IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_BuildingEmployees_User
    ON dbo.BuildingEmployees (UserId) WHERE IsDeleted = 0;
GO

/* ==================== MAINTENANCE REQUESTS ================= */
CREATE TABLE dbo.MaintenanceRequests (
    Id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_MaintenanceRequests_Id DEFAULT NEWSEQUENTIALID(),
    TenantId             UNIQUEIDENTIFIER NOT NULL,
    BuildingId           UNIQUEIDENTIFIER NOT NULL,
    ApartmentId          UNIQUEIDENTIFIER NULL,        -- NULL = common area
    CategoryId           UNIQUEIDENTIFIER NOT NULL,
    RequestedByUserId    UNIQUEIDENTIFIER NOT NULL,
    Title                NVARCHAR(200) NOT NULL,
    Description          NVARCHAR(2000) NULL,
    Priority             VARCHAR(10) NOT NULL CONSTRAINT DF_MaintenanceRequests_Priority DEFAULT 'Medium',
    Status               VARCHAR(20) NOT NULL CONSTRAINT DF_MaintenanceRequests_Status DEFAULT 'Open',
    AssignedToEmployeeId UNIQUEIDENTIFIER NULL,
    ScheduledFor         DATETIME2(0) NULL,
    StartedAt            DATETIME2(0) NULL,
    CompletedAt          DATETIME2(0) NULL,
    CompletionNotes      NVARCHAR(2000) NULL,
    Rating               INT NULL,
    RatingComment        NVARCHAR(500) NULL,
    CreatedAt            DATETIME2(0) NOT NULL CONSTRAINT DF_MaintenanceRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt            DATETIME2(0) NOT NULL CONSTRAINT DF_MaintenanceRequests_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy            UNIQUEIDENTIFIER NULL,
    UpdatedBy            UNIQUEIDENTIFIER NULL,
    IsDeleted            BIT NOT NULL CONSTRAINT DF_MaintenanceRequests_IsDeleted DEFAULT 0,
    RowVersion           ROWVERSION NOT NULL,
    CONSTRAINT PK_MaintenanceRequests PRIMARY KEY (Id),
    CONSTRAINT FK_MaintenanceRequests_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_MaintenanceRequests_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (Id),
    CONSTRAINT FK_MaintenanceRequests_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (Id),
    CONSTRAINT FK_MaintenanceRequests_Categories FOREIGN KEY (CategoryId) REFERENCES dbo.MaintenanceCategories (Id),
    CONSTRAINT FK_MaintenanceRequests_RequestedBy FOREIGN KEY (RequestedByUserId) REFERENCES dbo.Users (Id),
    CONSTRAINT FK_MaintenanceRequests_AssignedTo FOREIGN KEY (AssignedToEmployeeId) REFERENCES dbo.BuildingEmployees (Id),
    CONSTRAINT CK_MaintenanceRequests_Priority CHECK (Priority IN ('Low','Medium','High','Emergency')),
    CONSTRAINT CK_MaintenanceRequests_Status CHECK (Status IN ('Open','Assigned','InProgress','OnHold','Completed','Cancelled','Rejected')),
    CONSTRAINT CK_MaintenanceRequests_Rating CHECK (Rating IS NULL OR Rating BETWEEN 1 AND 5)
);
GO
CREATE NONCLUSTERED INDEX IX_MaintenanceRequests_Tenant_Building_Status
    ON dbo.MaintenanceRequests (TenantId, BuildingId, Status) INCLUDE (Priority, CreatedAt) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_MaintenanceRequests_AssignedTo
    ON dbo.MaintenanceRequests (AssignedToEmployeeId) WHERE AssignedToEmployeeId IS NOT NULL AND IsDeleted = 0;
GO

/* ======================= ANNOUNCEMENTS ===================== */
CREATE TABLE dbo.Announcements (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Announcements_Id DEFAULT NEWSEQUENTIALID(),
    TenantId    UNIQUEIDENTIFIER NOT NULL,
    BuildingId  UNIQUEIDENTIFIER NULL,               -- NULL = tenant-wide
    Title       NVARCHAR(200) NOT NULL,
    Body        NVARCHAR(4000) NOT NULL,
    Audience    VARCHAR(20) NOT NULL CONSTRAINT DF_Announcements_Audience DEFAULT 'All',
    IsPinned    BIT NOT NULL CONSTRAINT DF_Announcements_Pinned DEFAULT 0,
    PublishedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Announcements_PublishedAt DEFAULT SYSUTCDATETIME(),
    ExpiresAt   DATETIME2(0) NULL,
    CreatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_Announcements_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_Announcements_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy   UNIQUEIDENTIFIER NULL,
    UpdatedBy   UNIQUEIDENTIFIER NULL,
    IsDeleted   BIT NOT NULL CONSTRAINT DF_Announcements_IsDeleted DEFAULT 0,
    RowVersion  ROWVERSION NOT NULL,
    CONSTRAINT PK_Announcements PRIMARY KEY (Id),
    CONSTRAINT FK_Announcements_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Announcements_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (Id),
    CONSTRAINT CK_Announcements_Audience CHECK (Audience IN ('All','Residents','Owners','Staff')),
    CONSTRAINT CK_Announcements_Expiry CHECK (ExpiresAt IS NULL OR ExpiresAt > PublishedAt)
);
GO
CREATE NONCLUSTERED INDEX IX_Announcements_Tenant_Building
    ON dbo.Announcements (TenantId, BuildingId, PublishedAt DESC) WHERE IsDeleted = 0;
GO

/* ======================= NOTIFICATIONS ===================== */
CREATE TABLE dbo.Notifications (
    Id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Notifications_Id DEFAULT NEWSEQUENTIALID(),
    TenantId          UNIQUEIDENTIFIER NOT NULL,
    RecipientUserId   UNIQUEIDENTIFIER NOT NULL,
    Title             NVARCHAR(200) NOT NULL,
    Body              NVARCHAR(1000) NULL,
    Category          VARCHAR(20) NOT NULL CONSTRAINT DF_Notifications_Category DEFAULT 'System',
    RelatedEntityType VARCHAR(50) NULL,
    RelatedEntityId   UNIQUEIDENTIFIER NULL,
    IsRead            BIT NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT 0,
    ReadAt            DATETIME2(0) NULL,
    CreatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Notifications_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy         UNIQUEIDENTIFIER NULL,
    UpdatedBy         UNIQUEIDENTIFIER NULL,
    IsDeleted         BIT NOT NULL CONSTRAINT DF_Notifications_IsDeleted DEFAULT 0,
    RowVersion        ROWVERSION NOT NULL,
    CONSTRAINT PK_Notifications PRIMARY KEY (Id),
    CONSTRAINT FK_Notifications_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Notifications_Users FOREIGN KEY (RecipientUserId) REFERENCES dbo.Users (Id),
    CONSTRAINT CK_Notifications_Category CHECK (Category IN ('Payment','Maintenance','Complaint','Visitor','Announcement','Security','System'))
);
GO
CREATE NONCLUSTERED INDEX IX_Notifications_Recipient_Read
    ON dbo.Notifications (RecipientUserId, IsRead) INCLUDE (CreatedAt) WHERE IsDeleted = 0;
GO

/* ========================= VISITORS ======================== */
CREATE TABLE dbo.Visitors (
    Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Visitors_Id DEFAULT NEWSEQUENTIALID(),
    TenantId     UNIQUEIDENTIFIER NOT NULL,
    ApartmentId  UNIQUEIDENTIFIER NOT NULL,
    HostUserId   UNIQUEIDENTIFIER NOT NULL,
    FullName     NVARCHAR(150) NOT NULL,
    PhoneNumber  VARCHAR(20) NULL,
    NationalId   VARCHAR(30) NULL,
    VehiclePlate VARCHAR(20) NULL,
    Purpose      NVARCHAR(200) NULL,
    CreatedAt    DATETIME2(0) NOT NULL CONSTRAINT DF_Visitors_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt    DATETIME2(0) NOT NULL CONSTRAINT DF_Visitors_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy    UNIQUEIDENTIFIER NULL,
    UpdatedBy    UNIQUEIDENTIFIER NULL,
    IsDeleted    BIT NOT NULL CONSTRAINT DF_Visitors_IsDeleted DEFAULT 0,
    RowVersion   ROWVERSION NOT NULL,
    CONSTRAINT PK_Visitors PRIMARY KEY (Id),
    CONSTRAINT FK_Visitors_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Visitors_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (Id),
    CONSTRAINT FK_Visitors_Host FOREIGN KEY (HostUserId) REFERENCES dbo.Users (Id)
);
GO
CREATE NONCLUSTERED INDEX IX_Visitors_Tenant_Apartment
    ON dbo.Visitors (TenantId, ApartmentId) WHERE IsDeleted = 0;
GO

/* ====================== VISITOR ACCESS ===================== */
CREATE TABLE dbo.VisitorAccesses (
    Id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_VisitorAccesses_Id DEFAULT NEWSEQUENTIALID(),
    TenantId           UNIQUEIDENTIFIER NOT NULL,
    VisitorId          UNIQUEIDENTIFIER NOT NULL,
    AccessCode         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_VisitorAccesses_Code DEFAULT NEWID(), -- QR payload
    ValidFrom          DATETIME2(0) NOT NULL,
    ValidUntil         DATETIME2(0) NOT NULL,
    Status             VARCHAR(20) NOT NULL CONSTRAINT DF_VisitorAccesses_Status DEFAULT 'Pending',
    ApprovedByUserId   UNIQUEIDENTIFIER NULL,
    CheckedInAt        DATETIME2(0) NULL,
    CheckedInByUserId  UNIQUEIDENTIFIER NULL,
    CheckedOutAt       DATETIME2(0) NULL,
    CheckedOutByUserId UNIQUEIDENTIFIER NULL,
    CreatedAt          DATETIME2(0) NOT NULL CONSTRAINT DF_VisitorAccesses_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt          DATETIME2(0) NOT NULL CONSTRAINT DF_VisitorAccesses_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy          UNIQUEIDENTIFIER NULL,
    UpdatedBy          UNIQUEIDENTIFIER NULL,
    IsDeleted          BIT NOT NULL CONSTRAINT DF_VisitorAccesses_IsDeleted DEFAULT 0,
    RowVersion         ROWVERSION NOT NULL,
    CONSTRAINT PK_VisitorAccesses PRIMARY KEY (Id),
    CONSTRAINT FK_VisitorAccesses_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_VisitorAccesses_Visitors FOREIGN KEY (VisitorId) REFERENCES dbo.Visitors (Id),
    CONSTRAINT FK_VisitorAccesses_ApprovedBy FOREIGN KEY (ApprovedByUserId) REFERENCES dbo.Users (Id),
    CONSTRAINT FK_VisitorAccesses_CheckedInBy FOREIGN KEY (CheckedInByUserId) REFERENCES dbo.Users (Id),
    CONSTRAINT FK_VisitorAccesses_CheckedOutBy FOREIGN KEY (CheckedOutByUserId) REFERENCES dbo.Users (Id),
    CONSTRAINT CK_VisitorAccesses_Window CHECK (ValidUntil > ValidFrom),
    CONSTRAINT CK_VisitorAccesses_Status CHECK (Status IN ('Pending','Approved','Denied','CheckedIn','CheckedOut','Expired','Cancelled'))
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_VisitorAccesses_Code ON dbo.VisitorAccesses (AccessCode);
CREATE NONCLUSTERED INDEX IX_VisitorAccesses_Visitor ON dbo.VisitorAccesses (VisitorId) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_VisitorAccesses_Tenant_Status
    ON dbo.VisitorAccesses (TenantId, Status) INCLUDE (ValidFrom, ValidUntil) WHERE IsDeleted = 0;
GO

/* ========================= INVOICES ======================== */
CREATE TABLE dbo.Invoices (
    Id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Invoices_Id DEFAULT NEWSEQUENTIALID(),
    TenantId        UNIQUEIDENTIFIER NOT NULL,
    InvoiceNumber   VARCHAR(30) NOT NULL,
    LeaseContractId UNIQUEIDENTIFIER NULL,
    ApartmentId     UNIQUEIDENTIFIER NOT NULL,
    ResidentId      UNIQUEIDENTIFIER NULL,           -- billed party: resident XOR owner
    OwnerId         UNIQUEIDENTIFIER NULL,
    InvoiceType     VARCHAR(20) NOT NULL CONSTRAINT DF_Invoices_Type DEFAULT 'Rent',
    PeriodStart     DATE NULL,
    PeriodEnd       DATE NULL,
    IssueDate       DATE NOT NULL,
    DueDate         DATE NOT NULL,
    Amount          DECIMAL(12,2) NOT NULL,
    LateFee         DECIMAL(12,2) NOT NULL CONSTRAINT DF_Invoices_LateFee DEFAULT 0,
    Currency        CHAR(3) NOT NULL CONSTRAINT DF_Invoices_Currency DEFAULT 'JOD',
    Status          VARCHAR(20) NOT NULL CONSTRAINT DF_Invoices_Status DEFAULT 'Draft',
    Notes           NVARCHAR(500) NULL,
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Invoices_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Invoices_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy       UNIQUEIDENTIFIER NULL,
    UpdatedBy       UNIQUEIDENTIFIER NULL,
    IsDeleted       BIT NOT NULL CONSTRAINT DF_Invoices_IsDeleted DEFAULT 0,
    RowVersion      ROWVERSION NOT NULL,
    CONSTRAINT PK_Invoices PRIMARY KEY (Id),
    CONSTRAINT FK_Invoices_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Invoices_LeaseContracts FOREIGN KEY (LeaseContractId) REFERENCES dbo.LeaseContracts (Id),
    CONSTRAINT FK_Invoices_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (Id),
    CONSTRAINT FK_Invoices_Residents FOREIGN KEY (ResidentId) REFERENCES dbo.Residents (Id),
    CONSTRAINT FK_Invoices_Owners FOREIGN KEY (OwnerId) REFERENCES dbo.Owners (Id),
    CONSTRAINT CK_Invoices_BilledParty CHECK ((ResidentId IS NULL) <> (OwnerId IS NULL)), -- exactly one
    CONSTRAINT CK_Invoices_Type CHECK (InvoiceType IN ('Rent','Maintenance','Utility','Service','LateFee','Deposit','Other')),
    CONSTRAINT CK_Invoices_Status CHECK (Status IN ('Draft','Issued','PartiallyPaid','Paid','Overdue','Cancelled')),
    CONSTRAINT CK_Invoices_Amount CHECK (Amount >= 0),
    CONSTRAINT CK_Invoices_LateFee CHECK (LateFee >= 0),
    CONSTRAINT CK_Invoices_Dates CHECK (DueDate >= IssueDate),
    CONSTRAINT CK_Invoices_Period CHECK (PeriodEnd IS NULL OR PeriodStart IS NULL OR PeriodEnd >= PeriodStart)
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_Invoices_Tenant_Number
    ON dbo.Invoices (TenantId, InvoiceNumber) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_Invoices_Tenant_Status_Due
    ON dbo.Invoices (TenantId, Status, DueDate) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_Invoices_Apartment ON dbo.Invoices (ApartmentId) WHERE IsDeleted = 0;
GO

/* ========================= PAYMENTS ======================== */
CREATE TABLE dbo.Payments (
    Id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Payments_Id DEFAULT NEWSEQUENTIALID(),
    TenantId         UNIQUEIDENTIFIER NOT NULL,
    InvoiceId        UNIQUEIDENTIFIER NOT NULL,
    Amount           DECIMAL(12,2) NOT NULL,
    Currency         CHAR(3) NOT NULL CONSTRAINT DF_Payments_Currency DEFAULT 'JOD',
    Method           VARCHAR(20) NOT NULL,
    ReferenceNumber  VARCHAR(100) NULL,
    Status           VARCHAR(20) NOT NULL CONSTRAINT DF_Payments_Status DEFAULT 'Pending',
    PaidAt           DATETIME2(0) NOT NULL,
    ReceivedByUserId UNIQUEIDENTIFIER NULL,
    Notes            NVARCHAR(500) NULL,
    CreatedAt        DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt        DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy        UNIQUEIDENTIFIER NULL,
    UpdatedBy        UNIQUEIDENTIFIER NULL,
    IsDeleted        BIT NOT NULL CONSTRAINT DF_Payments_IsDeleted DEFAULT 0,
    RowVersion       ROWVERSION NOT NULL,
    CONSTRAINT PK_Payments PRIMARY KEY (Id),
    CONSTRAINT FK_Payments_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Payments_Invoices FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoices (Id),
    CONSTRAINT FK_Payments_ReceivedBy FOREIGN KEY (ReceivedByUserId) REFERENCES dbo.Users (Id),
    CONSTRAINT CK_Payments_Amount CHECK (Amount > 0),
    CONSTRAINT CK_Payments_Method CHECK (Method IN ('Cash','BankTransfer','Card','Cheque')),
    CONSTRAINT CK_Payments_Status CHECK (Status IN ('Pending','Confirmed','Rejected'))
);
GO
CREATE NONCLUSTERED INDEX IX_Payments_Invoice ON dbo.Payments (InvoiceId) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_Payments_Tenant_PaidAt
    ON dbo.Payments (TenantId, PaidAt DESC) INCLUDE (Amount, Status) WHERE IsDeleted = 0;
GO

/* ======================== COMPLAINTS ======================= */
CREATE TABLE dbo.Complaints (
    Id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Complaints_Id DEFAULT NEWSEQUENTIALID(),
    TenantId          UNIQUEIDENTIFIER NOT NULL,
    BuildingId        UNIQUEIDENTIFIER NOT NULL,
    ApartmentId       UNIQUEIDENTIFIER NULL,
    SubmittedByUserId UNIQUEIDENTIFIER NULL,          -- NULL when anonymous
    IsAnonymous       BIT NOT NULL CONSTRAINT DF_Complaints_Anonymous DEFAULT 0,
    Category          VARCHAR(20) NOT NULL,
    Subject           NVARCHAR(200) NOT NULL,
    Description       NVARCHAR(2000) NULL,
    Status            VARCHAR(20) NOT NULL CONSTRAINT DF_Complaints_Status DEFAULT 'Open',
    Resolution        NVARCHAR(2000) NULL,
    ResolvedByUserId  UNIQUEIDENTIFIER NULL,
    ResolvedAt        DATETIME2(0) NULL,
    CreatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Complaints_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Complaints_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy         UNIQUEIDENTIFIER NULL,
    UpdatedBy         UNIQUEIDENTIFIER NULL,
    IsDeleted         BIT NOT NULL CONSTRAINT DF_Complaints_IsDeleted DEFAULT 0,
    RowVersion        ROWVERSION NOT NULL,
    CONSTRAINT PK_Complaints PRIMARY KEY (Id),
    CONSTRAINT FK_Complaints_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Complaints_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (Id),
    CONSTRAINT FK_Complaints_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (Id),
    CONSTRAINT FK_Complaints_SubmittedBy FOREIGN KEY (SubmittedByUserId) REFERENCES dbo.Users (Id),
    CONSTRAINT FK_Complaints_ResolvedBy FOREIGN KEY (ResolvedByUserId) REFERENCES dbo.Users (Id),
    CONSTRAINT CK_Complaints_Category CHECK (Category IN ('Noise','Cleanliness','Security','Neighbor','Staff','Facility','Parking','Other')),
    CONSTRAINT CK_Complaints_Status CHECK (Status IN ('Open','InReview','Resolved','Dismissed','Escalated')),
    CONSTRAINT CK_Complaints_Anonymous CHECK (IsAnonymous = 0 OR SubmittedByUserId IS NULL)
);
GO
CREATE NONCLUSTERED INDEX IX_Complaints_Tenant_Building_Status
    ON dbo.Complaints (TenantId, BuildingId, Status) INCLUDE (CreatedAt) WHERE IsDeleted = 0;
GO

/* ======================== ATTACHMENTS ====================== */
CREATE TABLE dbo.Attachments (
    Id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Attachments_Id DEFAULT NEWSEQUENTIALID(),
    TenantId         UNIQUEIDENTIFIER NOT NULL,
    EntityType       VARCHAR(50) NOT NULL,            -- e.g. 'MaintenanceRequest','Complaint'
    EntityId         UNIQUEIDENTIFIER NOT NULL,       -- polymorphic reference (app-enforced)
    FileName         NVARCHAR(255) NOT NULL,
    FileUrl          VARCHAR(500) NOT NULL,           -- Firebase Storage URL
    ContentType      VARCHAR(100) NOT NULL,
    SizeBytes        BIGINT NULL,
    UploadedByUserId UNIQUEIDENTIFIER NOT NULL,
    CreatedAt        DATETIME2(0) NOT NULL CONSTRAINT DF_Attachments_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt        DATETIME2(0) NOT NULL CONSTRAINT DF_Attachments_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy        UNIQUEIDENTIFIER NULL,
    UpdatedBy        UNIQUEIDENTIFIER NULL,
    IsDeleted        BIT NOT NULL CONSTRAINT DF_Attachments_IsDeleted DEFAULT 0,
    RowVersion       ROWVERSION NOT NULL,
    CONSTRAINT PK_Attachments PRIMARY KEY (Id),
    CONSTRAINT FK_Attachments_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Attachments_UploadedBy FOREIGN KEY (UploadedByUserId) REFERENCES dbo.Users (Id),
    CONSTRAINT CK_Attachments_Size CHECK (SizeBytes IS NULL OR SizeBytes > 0)
);
GO
CREATE NONCLUSTERED INDEX IX_Attachments_Entity
    ON dbo.Attachments (EntityType, EntityId) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_Attachments_Tenant ON dbo.Attachments (TenantId) WHERE IsDeleted = 0;
GO

/* ========================= DOCUMENTS ======================= */
CREATE TABLE dbo.Documents (
    Id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Documents_Id DEFAULT NEWSEQUENTIALID(),
    TenantId           UNIQUEIDENTIFIER NOT NULL,
    Category           VARCHAR(20) NOT NULL,
    Title              NVARCHAR(200) NOT NULL,
    FileUrl            VARCHAR(500) NOT NULL,
    ContentType        VARCHAR(100) NOT NULL,
    SizeBytes          BIGINT NULL,
    OwnerUserId        UNIQUEIDENTIFIER NOT NULL,
    BuildingId         UNIQUEIDENTIFIER NULL,
    ApartmentId        UNIQUEIDENTIFIER NULL,
    Version            INT NOT NULL CONSTRAINT DF_Documents_Version DEFAULT 1,
    PreviousDocumentId UNIQUEIDENTIFIER NULL,         -- version chain
    CreatedAt          DATETIME2(0) NOT NULL CONSTRAINT DF_Documents_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt          DATETIME2(0) NOT NULL CONSTRAINT DF_Documents_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy          UNIQUEIDENTIFIER NULL,
    UpdatedBy          UNIQUEIDENTIFIER NULL,
    IsDeleted          BIT NOT NULL CONSTRAINT DF_Documents_IsDeleted DEFAULT 0,
    RowVersion         ROWVERSION NOT NULL,
    CONSTRAINT PK_Documents PRIMARY KEY (Id),
    CONSTRAINT FK_Documents_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Documents_Owner FOREIGN KEY (OwnerUserId) REFERENCES dbo.Users (Id),
    CONSTRAINT FK_Documents_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (Id),
    CONSTRAINT FK_Documents_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (Id),
    CONSTRAINT FK_Documents_Previous FOREIGN KEY (PreviousDocumentId) REFERENCES dbo.Documents (Id),
    CONSTRAINT CK_Documents_Category CHECK (Category IN ('LeaseContract','Identity','Invoice','Receipt','Policy','Other')),
    CONSTRAINT CK_Documents_Version CHECK (Version >= 1)
);
GO
CREATE NONCLUSTERED INDEX IX_Documents_Tenant_Category
    ON dbo.Documents (TenantId, Category) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_Documents_Owner ON dbo.Documents (OwnerUserId) WHERE IsDeleted = 0;
GO

/* ========================== SERVICES ======================= */
CREATE TABLE dbo.Services (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Services_Id DEFAULT NEWSEQUENTIALID(),
    TenantId    UNIQUEIDENTIFIER NOT NULL,
    BuildingId  UNIQUEIDENTIFIER NULL,                -- NULL = offered tenant-wide
    Name        NVARCHAR(150) NOT NULL,
    NameAr      NVARCHAR(150) NULL,
    Description NVARCHAR(500) NULL,
    MonthlyFee  DECIMAL(12,2) NULL,
    Currency    CHAR(3) NOT NULL CONSTRAINT DF_Services_Currency DEFAULT 'JOD',
    IsActive    BIT NOT NULL CONSTRAINT DF_Services_Active DEFAULT 1,
    CreatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_Services_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_Services_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy   UNIQUEIDENTIFIER NULL,
    UpdatedBy   UNIQUEIDENTIFIER NULL,
    IsDeleted   BIT NOT NULL CONSTRAINT DF_Services_IsDeleted DEFAULT 0,
    RowVersion  ROWVERSION NOT NULL,
    CONSTRAINT PK_Services PRIMARY KEY (Id),
    CONSTRAINT FK_Services_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_Services_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (Id),
    CONSTRAINT CK_Services_Fee CHECK (MonthlyFee IS NULL OR MonthlyFee >= 0)
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_Services_Tenant_Name
    ON dbo.Services (TenantId, Name) WHERE IsDeleted = 0;
GO

/* ======================== ACTIVITY LOGS ====================
   Business-facing activity feed (who did what, per tenant).
   AuditLogs (migration 0001) remains the security/audit trail. */
CREATE TABLE dbo.ActivityLogs (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ActivityLogs_Id DEFAULT NEWSEQUENTIALID(),
    TenantId    UNIQUEIDENTIFIER NOT NULL,
    ActorUserId UNIQUEIDENTIFIER NULL,
    Action      VARCHAR(60) NOT NULL,                 -- e.g. LEASE_ACTIVATED, REQUEST_COMPLETED
    EntityType  VARCHAR(50) NULL,
    EntityId    UNIQUEIDENTIFIER NULL,
    Summary     NVARCHAR(300) NOT NULL,
    Metadata    NVARCHAR(MAX) NULL,                   -- JSON
    OccurredAt  DATETIME2(0) NOT NULL CONSTRAINT DF_ActivityLogs_OccurredAt DEFAULT SYSUTCDATETIME(),
    CreatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_ActivityLogs_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_ActivityLogs_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CreatedBy   UNIQUEIDENTIFIER NULL,
    UpdatedBy   UNIQUEIDENTIFIER NULL,
    IsDeleted   BIT NOT NULL CONSTRAINT DF_ActivityLogs_IsDeleted DEFAULT 0,
    RowVersion  ROWVERSION NOT NULL,
    CONSTRAINT PK_ActivityLogs PRIMARY KEY (Id),
    CONSTRAINT FK_ActivityLogs_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants (Id),
    CONSTRAINT FK_ActivityLogs_Actor FOREIGN KEY (ActorUserId) REFERENCES dbo.Users (Id)
);
GO
CREATE NONCLUSTERED INDEX IX_ActivityLogs_Tenant_Time
    ON dbo.ActivityLogs (TenantId, OccurredAt DESC) WHERE IsDeleted = 0;
CREATE NONCLUSTERED INDEX IX_ActivityLogs_Entity
    ON dbo.ActivityLogs (EntityType, EntityId) WHERE IsDeleted = 0;
GO
