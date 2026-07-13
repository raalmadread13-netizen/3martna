/* ============================================================
   3martna (عمارتنا) — Tables
   38 normalized tables: identity, property, finance, operations,
   communication, and audit domains.
   ============================================================ */
USE Amartna;
GO

/* ---------------------------------------------------------
   IDENTITY & ACCESS
   --------------------------------------------------------- */

CREATE TABLE dbo.Roles (
    RoleId        INT IDENTITY(1,1) NOT NULL,
    Name          VARCHAR(50)   NOT NULL,
    NameAr        NVARCHAR(50)  NOT NULL,
    Description   NVARCHAR(255) NULL,
    CONSTRAINT PK_Roles PRIMARY KEY (RoleId),
    CONSTRAINT UQ_Roles_Name UNIQUE (Name)
);
GO

CREATE TABLE dbo.Users (
    UserId            INT IDENTITY(1,1) NOT NULL,
    PublicId          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Users_PublicId DEFAULT NEWID(),
    FullName          NVARCHAR(150) NOT NULL,
    Email             VARCHAR(255)  NULL,
    Phone             VARCHAR(20)   NOT NULL,
    PasswordHash      VARCHAR(255)  NOT NULL,
    NationalId        VARCHAR(20)   NULL,
    ProfileImageUrl   VARCHAR(500)  NULL,
    Address           NVARCHAR(300) NULL,
    DateOfBirth       DATE          NULL,
    Gender            VARCHAR(10)   NULL,
    PreferredLanguage VARCHAR(2)    NOT NULL CONSTRAINT DF_Users_Lang DEFAULT 'ar',
    FirebaseUid       VARCHAR(128)  NULL,
    IsPhoneVerified   BIT NOT NULL CONSTRAINT DF_Users_PhoneVerified DEFAULT 0,
    IsEmailVerified   BIT NOT NULL CONSTRAINT DF_Users_EmailVerified DEFAULT 0,
    IsActive          BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
    IsDeleted         BIT NOT NULL CONSTRAINT DF_Users_IsDeleted DEFAULT 0,
    DeletedAt         DATETIME2(0) NULL,
    LastLoginAt       DATETIME2(0) NULL,
    CreatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Users PRIMARY KEY (UserId),
    CONSTRAINT UQ_Users_PublicId UNIQUE (PublicId),
    CONSTRAINT CK_Users_Gender CHECK (Gender IS NULL OR Gender IN ('Male','Female')),
    CONSTRAINT CK_Users_Lang CHECK (PreferredLanguage IN ('ar','en'))
);
GO

CREATE TABLE dbo.UserRoles (
    UserId     INT NOT NULL,
    RoleId     INT NOT NULL,
    BuildingId INT NULL,               -- optional scope: staff assigned to a building
    AssignedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserRoles_AssignedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles (RoleId)
);
GO

CREATE TABLE dbo.RefreshTokens (
    TokenId       INT IDENTITY(1,1) NOT NULL,
    UserId        INT NOT NULL,
    TokenHash     VARCHAR(255) NOT NULL,
    ExpiresAt     DATETIME2(0) NOT NULL,
    CreatedAt     DATETIME2(0) NOT NULL CONSTRAINT DF_RefreshTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
    CreatedByIp   VARCHAR(45)  NULL,
    RevokedAt     DATETIME2(0) NULL,
    ReplacedByTokenHash VARCHAR(255) NULL,
    CONSTRAINT PK_RefreshTokens PRIMARY KEY (TokenId),
    CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.PasswordResetTokens (
    Id        INT IDENTITY(1,1) NOT NULL,
    UserId    INT NOT NULL,
    TokenHash VARCHAR(255) NOT NULL,
    ExpiresAt DATETIME2(0) NOT NULL,
    UsedAt    DATETIME2(0) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PwdReset_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PasswordResetTokens PRIMARY KEY (Id),
    CONSTRAINT FK_PwdReset_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.UserDevices (
    DeviceId   INT IDENTITY(1,1) NOT NULL,
    UserId     INT NOT NULL,
    DeviceKey  VARCHAR(128) NOT NULL,   -- installation/device identifier
    FcmToken   VARCHAR(512) NULL,
    Platform   VARCHAR(10)  NOT NULL,
    AppVersion VARCHAR(20)  NULL,
    LastSeenAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserDevices_LastSeen DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_UserDevices PRIMARY KEY (DeviceId),
    CONSTRAINT UQ_UserDevices UNIQUE (UserId, DeviceKey),
    CONSTRAINT FK_UserDevices_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId) ON DELETE CASCADE,
    CONSTRAINT CK_UserDevices_Platform CHECK (Platform IN ('ios','android','web'))
);
GO

CREATE TABLE dbo.UserSettings (
    UserId             INT NOT NULL,
    PushNotifications  BIT NOT NULL CONSTRAINT DF_UserSettings_Push  DEFAULT 1,
    EmailNotifications BIT NOT NULL CONSTRAINT DF_UserSettings_Email DEFAULT 1,
    SmsNotifications   BIT NOT NULL CONSTRAINT DF_UserSettings_Sms   DEFAULT 0,
    Theme              VARCHAR(10) NOT NULL CONSTRAINT DF_UserSettings_Theme DEFAULT 'system',
    BiometricEnabled   BIT NOT NULL CONSTRAINT DF_UserSettings_Bio   DEFAULT 0,
    UpdatedAt          DATETIME2(0) NOT NULL CONSTRAINT DF_UserSettings_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_UserSettings PRIMARY KEY (UserId),
    CONSTRAINT FK_UserSettings_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId) ON DELETE CASCADE,
    CONSTRAINT CK_UserSettings_Theme CHECK (Theme IN ('light','dark','system'))
);
GO

CREATE TABLE dbo.EmergencyContacts (
    ContactId    INT IDENTITY(1,1) NOT NULL,
    UserId       INT NOT NULL,
    Name         NVARCHAR(150) NOT NULL,
    Phone        VARCHAR(20)   NOT NULL,
    Relationship NVARCHAR(50)  NULL,
    CreatedAt    DATETIME2(0) NOT NULL CONSTRAINT DF_EmergencyContacts_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_EmergencyContacts PRIMARY KEY (ContactId),
    CONSTRAINT FK_EmergencyContacts_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId) ON DELETE CASCADE
);
GO

/* ---------------------------------------------------------
   PROPERTY
   --------------------------------------------------------- */

CREATE TABLE dbo.Buildings (
    BuildingId  INT IDENTITY(1,1) NOT NULL,
    OwnerUserId INT NOT NULL,
    Name        NVARCHAR(150) NOT NULL,
    NameAr      NVARCHAR(150) NULL,
    Address     NVARCHAR(300) NOT NULL,
    City        NVARCHAR(100) NOT NULL,
    District    NVARCHAR(100) NULL,
    Latitude    DECIMAL(9,6)  NULL,
    Longitude   DECIMAL(9,6)  NULL,
    TotalFloors INT NOT NULL CONSTRAINT DF_Buildings_Floors DEFAULT 1,
    YearBuilt   INT NULL,
    ImageUrl    VARCHAR(500)  NULL,
    Notes       NVARCHAR(500) NULL,
    IsActive    BIT NOT NULL CONSTRAINT DF_Buildings_IsActive DEFAULT 1,
    CreatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_Buildings_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_Buildings_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Buildings PRIMARY KEY (BuildingId),
    CONSTRAINT FK_Buildings_Owner FOREIGN KEY (OwnerUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Buildings_Floors CHECK (TotalFloors > 0)
);
GO

CREATE TABLE dbo.Floors (
    FloorId     INT IDENTITY(1,1) NOT NULL,
    BuildingId  INT NOT NULL,
    FloorNumber INT NOT NULL,
    Name        NVARCHAR(50) NULL,
    CONSTRAINT PK_Floors PRIMARY KEY (FloorId),
    CONSTRAINT UQ_Floors UNIQUE (BuildingId, FloorNumber),
    CONSTRAINT FK_Floors_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.Apartments (
    ApartmentId     INT IDENTITY(1,1) NOT NULL,
    BuildingId      INT NOT NULL,
    FloorId         INT NOT NULL,
    ApartmentNumber VARCHAR(20) NOT NULL,
    Bedrooms        INT NOT NULL CONSTRAINT DF_Apartments_Bedrooms DEFAULT 1,
    Bathrooms       INT NOT NULL CONSTRAINT DF_Apartments_Bathrooms DEFAULT 1,
    AreaSqm         DECIMAL(8,2) NULL,
    RentAmount      DECIMAL(12,2) NULL,
    Status          VARCHAR(20) NOT NULL CONSTRAINT DF_Apartments_Status DEFAULT 'Available',
    OwnerUserId     INT NULL,
    Description     NVARCHAR(500) NULL,
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Apartments_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Apartments_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Apartments PRIMARY KEY (ApartmentId),
    CONSTRAINT UQ_Apartments UNIQUE (BuildingId, ApartmentNumber),
    CONSTRAINT FK_Apartments_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId),
    CONSTRAINT FK_Apartments_Floors FOREIGN KEY (FloorId) REFERENCES dbo.Floors (FloorId),
    CONSTRAINT FK_Apartments_Owner FOREIGN KEY (OwnerUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Apartments_Status CHECK (Status IN ('Available','Rented','OwnerOccupied','UnderMaintenance','Reserved'))
);
GO

CREATE TABLE dbo.ParkingSpots (
    ParkingSpotId INT IDENTITY(1,1) NOT NULL,
    BuildingId    INT NOT NULL,
    SpotNumber    VARCHAR(20) NOT NULL,
    ApartmentId   INT NULL,
    SpotType      VARCHAR(20) NOT NULL CONSTRAINT DF_ParkingSpots_Type DEFAULT 'Standard',
    MonthlyFee    DECIMAL(12,2) NULL,
    CONSTRAINT PK_ParkingSpots PRIMARY KEY (ParkingSpotId),
    CONSTRAINT UQ_ParkingSpots UNIQUE (BuildingId, SpotNumber),
    CONSTRAINT FK_ParkingSpots_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId) ON DELETE CASCADE,
    CONSTRAINT FK_ParkingSpots_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (ApartmentId),
    CONSTRAINT CK_ParkingSpots_Type CHECK (SpotType IN ('Standard','Covered','Handicap','Visitor'))
);
GO

CREATE TABLE dbo.StorageRooms (
    StorageRoomId INT IDENTITY(1,1) NOT NULL,
    BuildingId    INT NOT NULL,
    RoomNumber    VARCHAR(20) NOT NULL,
    ApartmentId   INT NULL,
    AreaSqm       DECIMAL(8,2) NULL,
    MonthlyFee    DECIMAL(12,2) NULL,
    CONSTRAINT PK_StorageRooms PRIMARY KEY (StorageRoomId),
    CONSTRAINT UQ_StorageRooms UNIQUE (BuildingId, RoomNumber),
    CONSTRAINT FK_StorageRooms_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId) ON DELETE CASCADE,
    CONSTRAINT FK_StorageRooms_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (ApartmentId)
);
GO

CREATE TABLE dbo.UtilityMeters (
    MeterId         INT IDENTITY(1,1) NOT NULL,
    ApartmentId     INT NOT NULL,
    MeterType       VARCHAR(20) NOT NULL,
    MeterNumber     VARCHAR(50) NOT NULL,
    LastReading     DECIMAL(12,2) NULL,
    LastReadingDate DATE NULL,
    CONSTRAINT PK_UtilityMeters PRIMARY KEY (MeterId),
    CONSTRAINT UQ_UtilityMeters UNIQUE (ApartmentId, MeterType),
    CONSTRAINT FK_UtilityMeters_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (ApartmentId) ON DELETE CASCADE,
    CONSTRAINT CK_UtilityMeters_Type CHECK (MeterType IN ('Electricity','Water','Gas'))
);
GO

CREATE TABLE dbo.Residents (
    ResidentId    INT IDENTITY(1,1) NOT NULL,
    ApartmentId   INT NOT NULL,
    UserId        INT NOT NULL,
    ResidencyType VARCHAR(20) NOT NULL,
    MoveInDate    DATE NOT NULL,
    MoveOutDate   DATE NULL,
    Notes         NVARCHAR(500) NULL,
    CreatedAt     DATETIME2(0) NOT NULL CONSTRAINT DF_Residents_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Residents PRIMARY KEY (ResidentId),
    CONSTRAINT FK_Residents_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (ApartmentId),
    CONSTRAINT FK_Residents_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Residents_Type CHECK (ResidencyType IN ('Owner','Tenant','FamilyMember')),
    CONSTRAINT CK_Residents_Dates CHECK (MoveOutDate IS NULL OR MoveOutDate >= MoveInDate)
);
GO

CREATE TABLE dbo.Contracts (
    ContractId        INT IDENTITY(1,1) NOT NULL,
    ContractNumber    VARCHAR(30) NOT NULL,
    ApartmentId       INT NOT NULL,
    TenantUserId      INT NOT NULL,
    LandlordUserId    INT NOT NULL,
    StartDate         DATE NOT NULL,
    EndDate           DATE NOT NULL,
    MonthlyRent       DECIMAL(12,2) NOT NULL,
    DepositAmount     DECIMAL(12,2) NOT NULL CONSTRAINT DF_Contracts_Deposit DEFAULT 0,
    PaymentFrequency  VARCHAR(20) NOT NULL CONSTRAINT DF_Contracts_Freq DEFAULT 'Monthly',
    LateFeePercent    DECIMAL(5,2) NOT NULL CONSTRAINT DF_Contracts_LateFee DEFAULT 0,
    GraceDays         INT NOT NULL CONSTRAINT DF_Contracts_Grace DEFAULT 5,
    Status            VARCHAR(20) NOT NULL CONSTRAINT DF_Contracts_Status DEFAULT 'Pending',
    DocumentUrl       VARCHAR(500) NULL,
    TerminatedAt      DATETIME2(0) NULL,
    TerminationReason NVARCHAR(500) NULL,
    CreatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Contracts_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Contracts_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Contracts PRIMARY KEY (ContractId),
    CONSTRAINT UQ_Contracts_Number UNIQUE (ContractNumber),
    CONSTRAINT FK_Contracts_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (ApartmentId),
    CONSTRAINT FK_Contracts_Tenant FOREIGN KEY (TenantUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Contracts_Landlord FOREIGN KEY (LandlordUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Contracts_Freq CHECK (PaymentFrequency IN ('Monthly','Quarterly','SemiAnnual','Annual')),
    CONSTRAINT CK_Contracts_Status CHECK (Status IN ('Pending','Active','Expired','Terminated')),
    CONSTRAINT CK_Contracts_Dates CHECK (EndDate > StartDate),
    CONSTRAINT CK_Contracts_Rent CHECK (MonthlyRent > 0)
);
GO

/* ---------------------------------------------------------
   FINANCE
   --------------------------------------------------------- */

CREATE TABLE dbo.Invoices (
    InvoiceId      INT IDENTITY(1,1) NOT NULL,
    InvoiceNumber  VARCHAR(30) NOT NULL,
    ContractId     INT NULL,
    ApartmentId    INT NOT NULL,
    IssuedToUserId INT NOT NULL,
    InvoiceType    VARCHAR(20) NOT NULL CONSTRAINT DF_Invoices_Type DEFAULT 'Rent',
    PeriodStart    DATE NULL,
    PeriodEnd      DATE NULL,
    DueDate        DATE NOT NULL,
    Amount         DECIMAL(12,2) NOT NULL,
    LateFee        DECIMAL(12,2) NOT NULL CONSTRAINT DF_Invoices_LateFee DEFAULT 0,
    TotalAmount    AS (Amount + LateFee) PERSISTED,
    Status         VARCHAR(20) NOT NULL CONSTRAINT DF_Invoices_Status DEFAULT 'Unpaid',
    Notes          NVARCHAR(500) NULL,
    CreatedAt      DATETIME2(0) NOT NULL CONSTRAINT DF_Invoices_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt      DATETIME2(0) NOT NULL CONSTRAINT DF_Invoices_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Invoices PRIMARY KEY (InvoiceId),
    CONSTRAINT UQ_Invoices_Number UNIQUE (InvoiceNumber),
    CONSTRAINT FK_Invoices_Contracts FOREIGN KEY (ContractId) REFERENCES dbo.Contracts (ContractId),
    CONSTRAINT FK_Invoices_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (ApartmentId),
    CONSTRAINT FK_Invoices_Users FOREIGN KEY (IssuedToUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Invoices_Type CHECK (InvoiceType IN ('Rent','Maintenance','Utility','LateFee','Deposit','Other')),
    CONSTRAINT CK_Invoices_Status CHECK (Status IN ('Unpaid','PartiallyPaid','Paid','Overdue','Cancelled')),
    CONSTRAINT CK_Invoices_Amount CHECK (Amount >= 0)
);
GO

CREATE TABLE dbo.Payments (
    PaymentId        INT IDENTITY(1,1) NOT NULL,
    InvoiceId        INT NOT NULL,
    PaidByUserId     INT NOT NULL,
    Amount           DECIMAL(12,2) NOT NULL,
    Method           VARCHAR(20) NOT NULL,
    ReferenceNumber  VARCHAR(100) NULL,
    Status           VARCHAR(20) NOT NULL CONSTRAINT DF_Payments_Status DEFAULT 'Confirmed',
    ReceivedByUserId INT NULL,
    Notes            NVARCHAR(500) NULL,
    PaidAt           DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_PaidAt DEFAULT SYSUTCDATETIME(),
    CreatedAt        DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Payments PRIMARY KEY (PaymentId),
    CONSTRAINT FK_Payments_Invoices FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoices (InvoiceId),
    CONSTRAINT FK_Payments_PaidBy FOREIGN KEY (PaidByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Payments_ReceivedBy FOREIGN KEY (ReceivedByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Payments_Method CHECK (Method IN ('Cash','BankTransfer','CreditCard')),
    CONSTRAINT CK_Payments_Status CHECK (Status IN ('Pending','Confirmed','Rejected')),
    CONSTRAINT CK_Payments_Amount CHECK (Amount > 0)
);
GO

CREATE TABLE dbo.Receipts (
    ReceiptId     INT IDENTITY(1,1) NOT NULL,
    PaymentId     INT NOT NULL,
    ReceiptNumber VARCHAR(30) NOT NULL,
    PdfUrl        VARCHAR(500) NULL,
    GeneratedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_Receipts_GeneratedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Receipts PRIMARY KEY (ReceiptId),
    CONSTRAINT UQ_Receipts_Payment UNIQUE (PaymentId),
    CONSTRAINT UQ_Receipts_Number UNIQUE (ReceiptNumber),
    CONSTRAINT FK_Receipts_Payments FOREIGN KEY (PaymentId) REFERENCES dbo.Payments (PaymentId) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.ExpenseCategories (
    CategoryId INT IDENTITY(1,1) NOT NULL,
    Name       VARCHAR(50)  NOT NULL,
    NameAr     NVARCHAR(50) NOT NULL,
    CONSTRAINT PK_ExpenseCategories PRIMARY KEY (CategoryId),
    CONSTRAINT UQ_ExpenseCategories_Name UNIQUE (Name)
);
GO

CREATE TABLE dbo.Expenses (
    ExpenseId       INT IDENTITY(1,1) NOT NULL,
    BuildingId      INT NOT NULL,
    CategoryId      INT NOT NULL,
    Amount          DECIMAL(12,2) NOT NULL,
    ExpenseDate     DATE NOT NULL,
    Description     NVARCHAR(500) NULL,
    VendorName      NVARCHAR(150) NULL,
    ReceiptUrl      VARCHAR(500) NULL,
    CreatedByUserId INT NOT NULL,
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Expenses_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Expenses PRIMARY KEY (ExpenseId),
    CONSTRAINT FK_Expenses_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId),
    CONSTRAINT FK_Expenses_Categories FOREIGN KEY (CategoryId) REFERENCES dbo.ExpenseCategories (CategoryId),
    CONSTRAINT FK_Expenses_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Expenses_Amount CHECK (Amount > 0)
);
GO

/* ---------------------------------------------------------
   MAINTENANCE
   --------------------------------------------------------- */

CREATE TABLE dbo.MaintenanceRequests (
    RequestId         INT IDENTITY(1,1) NOT NULL,
    BuildingId        INT NOT NULL,
    ApartmentId       INT NULL,
    RequestedByUserId INT NOT NULL,
    Title             NVARCHAR(200) NOT NULL,
    Description       NVARCHAR(2000) NULL,
    Category          VARCHAR(20) NOT NULL,
    Priority          VARCHAR(10) NOT NULL CONSTRAINT DF_Maint_Priority DEFAULT 'Medium',
    Status            VARCHAR(20) NOT NULL CONSTRAINT DF_Maint_Status DEFAULT 'Open',
    ScheduledAt       DATETIME2(0) NULL,
    StartedAt         DATETIME2(0) NULL,
    CompletedAt       DATETIME2(0) NULL,
    CompletionNotes   NVARCHAR(2000) NULL,
    Rating            INT NULL,
    RatingComment     NVARCHAR(500) NULL,
    CreatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Maint_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Maint_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_MaintenanceRequests PRIMARY KEY (RequestId),
    CONSTRAINT FK_Maint_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId),
    CONSTRAINT FK_Maint_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (ApartmentId),
    CONSTRAINT FK_Maint_RequestedBy FOREIGN KEY (RequestedByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Maint_Category CHECK (Category IN ('Plumbing','Electrical','HVAC','Carpentry','Painting','Cleaning','Elevator','Appliance','Other')),
    CONSTRAINT CK_Maint_Priority CHECK (Priority IN ('Low','Medium','High','Emergency')),
    CONSTRAINT CK_Maint_Status CHECK (Status IN ('Open','Assigned','InProgress','OnHold','Completed','Cancelled','Rejected')),
    CONSTRAINT CK_Maint_Rating CHECK (Rating IS NULL OR Rating BETWEEN 1 AND 5)
);
GO

CREATE TABLE dbo.MaintenanceAssignments (
    AssignmentId     INT IDENTITY(1,1) NOT NULL,
    RequestId        INT NOT NULL,
    AssignedToUserId INT NOT NULL,
    AssignedByUserId INT NOT NULL,
    AssignedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_MaintAssign_AssignedAt DEFAULT SYSUTCDATETIME(),
    UnassignedAt     DATETIME2(0) NULL,
    CheckInAt        DATETIME2(0) NULL,
    CheckInLatitude  DECIMAL(9,6) NULL,
    CheckInLongitude DECIMAL(9,6) NULL,
    CheckOutAt       DATETIME2(0) NULL,
    CONSTRAINT PK_MaintenanceAssignments PRIMARY KEY (AssignmentId),
    CONSTRAINT FK_MaintAssign_Requests FOREIGN KEY (RequestId) REFERENCES dbo.MaintenanceRequests (RequestId) ON DELETE CASCADE,
    CONSTRAINT FK_MaintAssign_AssignedTo FOREIGN KEY (AssignedToUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_MaintAssign_AssignedBy FOREIGN KEY (AssignedByUserId) REFERENCES dbo.Users (UserId)
);
GO

CREATE TABLE dbo.MaintenanceAttachments (
    AttachmentId     INT IDENTITY(1,1) NOT NULL,
    RequestId        INT NOT NULL,
    UploadedByUserId INT NOT NULL,
    FileUrl          VARCHAR(500) NOT NULL,
    FileType         VARCHAR(20) NOT NULL CONSTRAINT DF_MaintAttach_Type DEFAULT 'image',
    Stage            VARCHAR(10) NOT NULL CONSTRAINT DF_MaintAttach_Stage DEFAULT 'Before',
    CreatedAt        DATETIME2(0) NOT NULL CONSTRAINT DF_MaintAttach_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_MaintenanceAttachments PRIMARY KEY (AttachmentId),
    CONSTRAINT FK_MaintAttach_Requests FOREIGN KEY (RequestId) REFERENCES dbo.MaintenanceRequests (RequestId) ON DELETE CASCADE,
    CONSTRAINT FK_MaintAttach_Users FOREIGN KEY (UploadedByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_MaintAttach_Type CHECK (FileType IN ('image','video','pdf','other')),
    CONSTRAINT CK_MaintAttach_Stage CHECK (Stage IN ('Before','During','After','Other'))
);
GO

CREATE TABLE dbo.MaintenanceComments (
    CommentId INT IDENTITY(1,1) NOT NULL,
    RequestId INT NOT NULL,
    UserId    INT NOT NULL,
    Comment   NVARCHAR(1000) NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MaintComments_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_MaintenanceComments PRIMARY KEY (CommentId),
    CONSTRAINT FK_MaintComments_Requests FOREIGN KEY (RequestId) REFERENCES dbo.MaintenanceRequests (RequestId) ON DELETE CASCADE,
    CONSTRAINT FK_MaintComments_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
);
GO

CREATE TABLE dbo.StaffSchedules (
    ScheduleId    INT IDENTITY(1,1) NOT NULL,
    UserId        INT NOT NULL,
    BuildingId    INT NOT NULL,
    TaskType      VARCHAR(20) NOT NULL,
    Title         NVARCHAR(200) NOT NULL,
    ScheduledDate DATE NOT NULL,
    StartTime     TIME(0) NULL,
    EndTime       TIME(0) NULL,
    Status        VARCHAR(20) NOT NULL CONSTRAINT DF_StaffSchedules_Status DEFAULT 'Scheduled',
    Notes         NVARCHAR(500) NULL,
    CreatedAt     DATETIME2(0) NOT NULL CONSTRAINT DF_StaffSchedules_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_StaffSchedules PRIMARY KEY (ScheduleId),
    CONSTRAINT FK_StaffSchedules_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_StaffSchedules_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId),
    CONSTRAINT CK_StaffSchedules_Type CHECK (TaskType IN ('Maintenance','Cleaning','Security','Inspection','Other')),
    CONSTRAINT CK_StaffSchedules_Status CHECK (Status IN ('Scheduled','InProgress','Completed','Cancelled'))
);
GO

/* ---------------------------------------------------------
   COMPLAINTS
   --------------------------------------------------------- */

CREATE TABLE dbo.Complaints (
    ComplaintId       INT IDENTITY(1,1) NOT NULL,
    BuildingId        INT NOT NULL,
    ApartmentId       INT NULL,
    SubmittedByUserId INT NULL,                -- NULL when anonymous
    IsAnonymous       BIT NOT NULL CONSTRAINT DF_Complaints_Anon DEFAULT 0,
    Category          VARCHAR(20) NOT NULL,
    Subject           NVARCHAR(200) NOT NULL,
    Description       NVARCHAR(2000) NULL,
    Status            VARCHAR(20) NOT NULL CONSTRAINT DF_Complaints_Status DEFAULT 'Open',
    Resolution        NVARCHAR(2000) NULL,
    ResolvedByUserId  INT NULL,
    ResolvedAt        DATETIME2(0) NULL,
    CreatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Complaints_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Complaints_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Complaints PRIMARY KEY (ComplaintId),
    CONSTRAINT FK_Complaints_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId),
    CONSTRAINT FK_Complaints_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (ApartmentId),
    CONSTRAINT FK_Complaints_SubmittedBy FOREIGN KEY (SubmittedByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Complaints_ResolvedBy FOREIGN KEY (ResolvedByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Complaints_Category CHECK (Category IN ('Noise','Cleanliness','Security','Neighbor','Staff','Facility','Parking','Other')),
    CONSTRAINT CK_Complaints_Status CHECK (Status IN ('Open','InReview','Resolved','Dismissed','Escalated'))
);
GO

CREATE TABLE dbo.ComplaintComments (
    CommentId   INT IDENTITY(1,1) NOT NULL,
    ComplaintId INT NOT NULL,
    UserId      INT NOT NULL,
    Comment     NVARCHAR(1000) NOT NULL,
    IsInternal  BIT NOT NULL CONSTRAINT DF_ComplaintComments_Internal DEFAULT 0,
    CreatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_ComplaintComments_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ComplaintComments PRIMARY KEY (CommentId),
    CONSTRAINT FK_ComplaintComments_Complaints FOREIGN KEY (ComplaintId) REFERENCES dbo.Complaints (ComplaintId) ON DELETE CASCADE,
    CONSTRAINT FK_ComplaintComments_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
);
GO

CREATE TABLE dbo.ComplaintAttachments (
    AttachmentId INT IDENTITY(1,1) NOT NULL,
    ComplaintId  INT NOT NULL,
    FileUrl      VARCHAR(500) NOT NULL,
    FileType     VARCHAR(20) NOT NULL CONSTRAINT DF_ComplaintAttach_Type DEFAULT 'image',
    CreatedAt    DATETIME2(0) NOT NULL CONSTRAINT DF_ComplaintAttach_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ComplaintAttachments PRIMARY KEY (AttachmentId),
    CONSTRAINT FK_ComplaintAttach_Complaints FOREIGN KEY (ComplaintId) REFERENCES dbo.Complaints (ComplaintId) ON DELETE CASCADE,
    CONSTRAINT CK_ComplaintAttach_Type CHECK (FileType IN ('image','video','pdf','other'))
);
GO

/* ---------------------------------------------------------
   VISITORS & SECURITY
   --------------------------------------------------------- */

CREATE TABLE dbo.Visitors (
    VisitorId         INT IDENTITY(1,1) NOT NULL,
    ApartmentId       INT NOT NULL,
    HostUserId        INT NOT NULL,
    VisitorName       NVARCHAR(150) NOT NULL,
    VisitorPhone      VARCHAR(20) NULL,
    VisitorNationalId VARCHAR(20) NULL,
    VehiclePlate      VARCHAR(20) NULL,
    Purpose           NVARCHAR(200) NULL,
    ExpectedAt        DATETIME2(0) NOT NULL,
    ExpectedUntil     DATETIME2(0) NULL,
    QrCode            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Visitors_QrCode DEFAULT NEWID(),
    Status            VARCHAR(20) NOT NULL CONSTRAINT DF_Visitors_Status DEFAULT 'Pending',
    ApprovedByUserId  INT NULL,
    CheckedInAt       DATETIME2(0) NULL,
    CheckedInByUserId INT NULL,
    CheckedOutAt      DATETIME2(0) NULL,
    CheckedOutByUserId INT NULL,
    CreatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Visitors_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Visitors PRIMARY KEY (VisitorId),
    CONSTRAINT UQ_Visitors_QrCode UNIQUE (QrCode),
    CONSTRAINT FK_Visitors_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (ApartmentId),
    CONSTRAINT FK_Visitors_Host FOREIGN KEY (HostUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Visitors_ApprovedBy FOREIGN KEY (ApprovedByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Visitors_CheckedInBy FOREIGN KEY (CheckedInByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Visitors_CheckedOutBy FOREIGN KEY (CheckedOutByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Visitors_Status CHECK (Status IN ('Pending','Approved','Denied','CheckedIn','CheckedOut','Expired','Cancelled'))
);
GO

CREATE TABLE dbo.GateLogs (
    GateLogId      BIGINT IDENTITY(1,1) NOT NULL,
    BuildingId     INT NOT NULL,
    VisitorId      INT NULL,
    LoggedByUserId INT NOT NULL,
    EntryType      VARCHAR(20) NOT NULL,
    PersonName     NVARCHAR(150) NULL,
    Notes          NVARCHAR(500) NULL,
    LoggedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_GateLogs_LoggedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_GateLogs PRIMARY KEY (GateLogId),
    CONSTRAINT FK_GateLogs_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId),
    CONSTRAINT FK_GateLogs_Visitors FOREIGN KEY (VisitorId) REFERENCES dbo.Visitors (VisitorId),
    CONSTRAINT FK_GateLogs_LoggedBy FOREIGN KEY (LoggedByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_GateLogs_Type CHECK (EntryType IN ('VisitorIn','VisitorOut','DeliveryIn','DeliveryOut','ContractorIn','ContractorOut','Other'))
);
GO

CREATE TABLE dbo.IncidentReports (
    IncidentId       INT IDENTITY(1,1) NOT NULL,
    BuildingId       INT NOT NULL,
    ReportedByUserId INT NOT NULL,
    Severity         VARCHAR(10) NOT NULL CONSTRAINT DF_Incidents_Severity DEFAULT 'Low',
    Title            NVARCHAR(200) NOT NULL,
    Description      NVARCHAR(2000) NULL,
    Location         NVARCHAR(200) NULL,
    OccurredAt       DATETIME2(0) NOT NULL,
    Status           VARCHAR(25) NOT NULL CONSTRAINT DF_Incidents_Status DEFAULT 'Open',
    ResolutionNotes  NVARCHAR(2000) NULL,
    ResolvedAt       DATETIME2(0) NULL,
    AttachmentUrl    VARCHAR(500) NULL,
    CreatedAt        DATETIME2(0) NOT NULL CONSTRAINT DF_Incidents_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_IncidentReports PRIMARY KEY (IncidentId),
    CONSTRAINT FK_Incidents_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId),
    CONSTRAINT FK_Incidents_ReportedBy FOREIGN KEY (ReportedByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Incidents_Severity CHECK (Severity IN ('Low','Medium','High','Critical')),
    CONSTRAINT CK_Incidents_Status CHECK (Status IN ('Open','UnderInvestigation','Resolved','Closed'))
);
GO

/* ---------------------------------------------------------
   COMMUNICATION
   --------------------------------------------------------- */

CREATE TABLE dbo.Announcements (
    AnnouncementId  INT IDENTITY(1,1) NOT NULL,
    BuildingId      INT NULL,                  -- NULL = platform-wide
    CreatedByUserId INT NOT NULL,
    Title           NVARCHAR(200) NOT NULL,
    Body            NVARCHAR(4000) NOT NULL,
    Audience        VARCHAR(20) NOT NULL CONSTRAINT DF_Announcements_Audience DEFAULT 'All',
    IsPinned        BIT NOT NULL CONSTRAINT DF_Announcements_Pinned DEFAULT 0,
    PublishedAt     DATETIME2(0) NOT NULL CONSTRAINT DF_Announcements_PublishedAt DEFAULT SYSUTCDATETIME(),
    ExpiresAt       DATETIME2(0) NULL,
    CONSTRAINT PK_Announcements PRIMARY KEY (AnnouncementId),
    CONSTRAINT FK_Announcements_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId),
    CONSTRAINT FK_Announcements_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Announcements_Audience CHECK (Audience IN ('All','Tenants','Owners','Staff'))
);
GO

CREATE TABLE dbo.Notifications (
    NotificationId BIGINT IDENTITY(1,1) NOT NULL,
    UserId         INT NOT NULL,
    Title          NVARCHAR(200) NOT NULL,
    Body           NVARCHAR(1000) NULL,
    NotifType      VARCHAR(20) NOT NULL CONSTRAINT DF_Notifications_Type DEFAULT 'System',
    EntityType     VARCHAR(30) NULL,
    EntityId       INT NULL,
    IsRead         BIT NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT 0,
    ReadAt         DATETIME2(0) NULL,
    CreatedAt      DATETIME2(0) NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Notifications PRIMARY KEY (NotificationId),
    CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId) ON DELETE CASCADE,
    CONSTRAINT CK_Notifications_Type CHECK (NotifType IN ('Payment','Maintenance','Complaint','Visitor','Announcement','Chat','Security','Contract','System'))
);
GO

CREATE TABLE dbo.ChatThreads (
    ThreadId        INT IDENTITY(1,1) NOT NULL,
    FirebaseKey     VARCHAR(128) NOT NULL,     -- Firestore document id
    ThreadType      VARCHAR(10) NOT NULL,
    Title           NVARCHAR(150) NULL,
    BuildingId      INT NULL,
    CreatedByUserId INT NOT NULL,
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_ChatThreads_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ChatThreads PRIMARY KEY (ThreadId),
    CONSTRAINT UQ_ChatThreads_FirebaseKey UNIQUE (FirebaseKey),
    CONSTRAINT FK_ChatThreads_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId),
    CONSTRAINT FK_ChatThreads_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_ChatThreads_Type CHECK (ThreadType IN ('Private','Group'))
);
GO

CREATE TABLE dbo.ChatThreadMembers (
    ThreadId   INT NOT NULL,
    UserId     INT NOT NULL,
    MemberRole VARCHAR(10) NOT NULL CONSTRAINT DF_ChatMembers_Role DEFAULT 'Member',
    JoinedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_ChatMembers_JoinedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ChatThreadMembers PRIMARY KEY (ThreadId, UserId),
    CONSTRAINT FK_ChatMembers_Threads FOREIGN KEY (ThreadId) REFERENCES dbo.ChatThreads (ThreadId) ON DELETE CASCADE,
    CONSTRAINT FK_ChatMembers_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_ChatMembers_Role CHECK (MemberRole IN ('Admin','Member'))
);
GO

/* ---------------------------------------------------------
   DOCUMENTS
   --------------------------------------------------------- */

CREATE TABLE dbo.Documents (
    DocumentId    INT IDENTITY(1,1) NOT NULL,
    OwnerUserId   INT NOT NULL,
    BuildingId    INT NULL,
    ApartmentId   INT NULL,
    Category      VARCHAR(20) NOT NULL,
    Title         NVARCHAR(200) NOT NULL,
    FileUrl       VARCHAR(500) NOT NULL,
    FileType      VARCHAR(20) NOT NULL,
    FileSizeBytes BIGINT NULL,
    IsArchived    BIT NOT NULL CONSTRAINT DF_Documents_Archived DEFAULT 0,
    CreatedAt     DATETIME2(0) NOT NULL CONSTRAINT DF_Documents_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt     DATETIME2(0) NOT NULL CONSTRAINT DF_Documents_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Documents PRIMARY KEY (DocumentId),
    CONSTRAINT FK_Documents_Owner FOREIGN KEY (OwnerUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Documents_Buildings FOREIGN KEY (BuildingId) REFERENCES dbo.Buildings (BuildingId),
    CONSTRAINT FK_Documents_Apartments FOREIGN KEY (ApartmentId) REFERENCES dbo.Apartments (ApartmentId),
    CONSTRAINT CK_Documents_Category CHECK (Category IN ('Contract','NationalId','Invoice','Receipt','Image','Report','Other')),
    CONSTRAINT CK_Documents_FileType CHECK (FileType IN ('pdf','image','doc','xls','other'))
);
GO

CREATE TABLE dbo.DocumentVersions (
    VersionId        INT IDENTITY(1,1) NOT NULL,
    DocumentId       INT NOT NULL,
    VersionNumber    INT NOT NULL,
    FileUrl          VARCHAR(500) NOT NULL,
    UploadedByUserId INT NOT NULL,
    ChangeNote       NVARCHAR(300) NULL,
    CreatedAt        DATETIME2(0) NOT NULL CONSTRAINT DF_DocVersions_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_DocumentVersions PRIMARY KEY (VersionId),
    CONSTRAINT UQ_DocumentVersions UNIQUE (DocumentId, VersionNumber),
    CONSTRAINT FK_DocVersions_Documents FOREIGN KEY (DocumentId) REFERENCES dbo.Documents (DocumentId) ON DELETE CASCADE,
    CONSTRAINT FK_DocVersions_Users FOREIGN KEY (UploadedByUserId) REFERENCES dbo.Users (UserId)
);
GO

/* ---------------------------------------------------------
   AUDIT
   --------------------------------------------------------- */

CREATE TABLE dbo.AuditLogs (
    AuditId    BIGINT IDENTITY(1,1) NOT NULL,
    UserId     INT NULL,
    Action     VARCHAR(50) NOT NULL,
    EntityType VARCHAR(50) NULL,
    EntityId   VARCHAR(50) NULL,
    OldValues  NVARCHAR(MAX) NULL,             -- JSON
    NewValues  NVARCHAR(MAX) NULL,             -- JSON
    IpAddress  VARCHAR(45) NULL,
    UserAgent  VARCHAR(300) NULL,
    CreatedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_AuditLogs_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_AuditLogs PRIMARY KEY (AuditId),
    CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
);
GO

/* Sequences for human-readable document numbers */
CREATE SEQUENCE dbo.Seq_InvoiceNumber  AS INT START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE dbo.Seq_ReceiptNumber  AS INT START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE dbo.Seq_ContractNumber AS INT START WITH 1 INCREMENT BY 1;
GO

/* Partial unique indexes: allow multiple NULL/soft-deleted rows */
CREATE UNIQUE NONCLUSTERED INDEX UQ_Users_Email ON dbo.Users (Email) WHERE Email IS NOT NULL AND IsDeleted = 0;
CREATE UNIQUE NONCLUSTERED INDEX UQ_Users_Phone ON dbo.Users (Phone) WHERE IsDeleted = 0;
GO

PRINT 'Tables created.';
GO
