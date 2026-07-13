/* ============================================================
   3martna (عمارتنا) — Seed Data
   Roles & lookup data (required in ALL environments) +
   demo data for development/staging.
   All demo accounts use the password: Password123!
   ============================================================ */
USE Amartna;
GO

/* ------------------ REQUIRED LOOKUPS ------------------ */

IF NOT EXISTS (SELECT 1 FROM dbo.Roles)
INSERT INTO dbo.Roles (Name, NameAr, Description) VALUES
 ('SystemAdmin',        N'مدير النظام',      'Full platform administration'),
 ('BuildingOwner',      N'مالك العمارة',     'Owns and manages buildings'),
 ('ApartmentOwner',     N'مالك شقة',         'Owns individual apartments'),
 ('Tenant',             N'مستأجر',           'Rents an apartment'),
 ('MaintenanceEmployee',N'موظف صيانة',       'Handles maintenance tasks'),
 ('SecurityGuard',      N'حارس أمن',         'Gate control and security'),
 ('CleaningStaff',      N'عامل نظافة',       'Cleaning schedules and tasks'),
 ('Accountant',         N'محاسب',            'Financial management and reports');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ExpenseCategories)
INSERT INTO dbo.ExpenseCategories (Name, NameAr) VALUES
 ('Electricity',  N'كهرباء'),
 ('Water',        N'مياه'),
 ('Cleaning',     N'نظافة'),
 ('Maintenance',  N'صيانة'),
 ('Elevator',     N'مصعد'),
 ('Security',     N'أمن وحراسة'),
 ('Salaries',     N'رواتب'),
 ('Insurance',    N'تأمين'),
 ('Taxes',        N'ضرائب ورسوم'),
 ('Other',        N'أخرى');
GO

/* --------------------- DEMO DATA ----------------------
   Remove this section for production deployments.
   Password for every demo user: Password123!
   ------------------------------------------------------- */

DECLARE @Hash VARCHAR(255) = '$2b$10$UHJ7nSvCbuxs5GxL/ImjPOAdqy/4I9rN7ZNdkbpJcaM1ZwZ4mWXMe';

IF EXISTS (SELECT 1 FROM dbo.Users WHERE Phone = '+962790000001')
BEGIN
    PRINT 'Demo data already seeded — skipping.';
    RETURN;
END

/* Users */
INSERT INTO dbo.Users (FullName, Email, Phone, PasswordHash, NationalId, PreferredLanguage, IsPhoneVerified, IsEmailVerified) VALUES
 (N'أحمد النظام',      'admin@3martna.jo',      '+962790000001', @Hash, '9901000001', 'ar', 1, 1),  -- 1 SystemAdmin
 (N'خالد المالك',      'owner@3martna.jo',      '+962790000002', @Hash, '9901000002', 'ar', 1, 1),  -- 2 BuildingOwner
 (N'سارة المستأجرة',   'tenant@3martna.jo',     '+962790000003', @Hash, '9901000003', 'ar', 1, 1),  -- 3 Tenant
 (N'محمد الفني',       'tech@3martna.jo',       '+962790000004', @Hash, '9901000004', 'ar', 1, 1),  -- 4 Maintenance
 (N'عمر الحارس',       'guard@3martna.jo',      '+962790000005', @Hash, '9901000005', 'ar', 1, 1),  -- 5 SecurityGuard
 (N'ليلى المحاسبة',    'accountant@3martna.jo', '+962790000006', @Hash, '9901000006', 'ar', 1, 1),  -- 6 Accountant
 (N'يوسف مالك الشقة',  'aptowner@3martna.jo',   '+962790000007', @Hash, '9901000007', 'ar', 1, 1),  -- 7 ApartmentOwner
 (N'فاطمة النظافة',    'cleaner@3martna.jo',    '+962790000008', @Hash, '9901000008', 'ar', 1, 1),  -- 8 CleaningStaff
 (N'رامي المستأجر',    'tenant2@3martna.jo',    '+962790000009', @Hash, '9901000009', 'en', 1, 1);  -- 9 Tenant

INSERT INTO dbo.UserSettings (UserId) SELECT UserId FROM dbo.Users;

INSERT INTO dbo.UserRoles (UserId, RoleId)
SELECT u.UserId, r.RoleId FROM (VALUES
 ('+962790000001','SystemAdmin'), ('+962790000002','BuildingOwner'),
 ('+962790000003','Tenant'),      ('+962790000004','MaintenanceEmployee'),
 ('+962790000005','SecurityGuard'),('+962790000006','Accountant'),
 ('+962790000007','ApartmentOwner'),('+962790000008','CleaningStaff'),
 ('+962790000009','Tenant')) AS m(Phone, RoleName)
JOIN dbo.Users u ON u.Phone = m.Phone
JOIN dbo.Roles r ON r.Name = m.RoleName;

/* Building + floors + apartments */
DECLARE @OwnerId INT = (SELECT UserId FROM dbo.Users WHERE Phone = '+962790000002');
DECLARE @Tenant1 INT = (SELECT UserId FROM dbo.Users WHERE Phone = '+962790000003');
DECLARE @Tenant2 INT = (SELECT UserId FROM dbo.Users WHERE Phone = '+962790000009');
DECLARE @AptOwner INT = (SELECT UserId FROM dbo.Users WHERE Phone = '+962790000007');
DECLARE @Tech INT    = (SELECT UserId FROM dbo.Users WHERE Phone = '+962790000004');
DECLARE @Guard INT   = (SELECT UserId FROM dbo.Users WHERE Phone = '+962790000005');
DECLARE @Cleaner INT = (SELECT UserId FROM dbo.Users WHERE Phone = '+962790000008');

INSERT INTO dbo.Buildings (OwnerUserId, Name, NameAr, Address, City, District, Latitude, Longitude, TotalFloors, YearBuilt)
VALUES (@OwnerId, N'Al-Rabieh Tower', N'برج الرابية', N'شارع الملكة رانيا، بجانب دوار الرابية', N'Amman', N'Al-Rabieh', 31.984500, 35.869600, 4, 2018);

DECLARE @B1 INT = SCOPE_IDENTITY();

INSERT INTO dbo.Floors (BuildingId, FloorNumber, Name) VALUES
 (@B1, 0, N'Ground'), (@B1, 1, N'Floor 1'), (@B1, 2, N'Floor 2'), (@B1, 3, N'Floor 3');

DECLARE @F0 INT = (SELECT FloorId FROM dbo.Floors WHERE BuildingId = @B1 AND FloorNumber = 0);
DECLARE @F1 INT = (SELECT FloorId FROM dbo.Floors WHERE BuildingId = @B1 AND FloorNumber = 1);
DECLARE @F2 INT = (SELECT FloorId FROM dbo.Floors WHERE BuildingId = @B1 AND FloorNumber = 2);

INSERT INTO dbo.Apartments (BuildingId, FloorId, ApartmentNumber, Bedrooms, Bathrooms, AreaSqm, RentAmount, Status, OwnerUserId) VALUES
 (@B1, @F0, 'G1', 2, 1, 110, 350, 'Available', NULL),
 (@B1, @F1, '101', 3, 2, 150, 450, 'Rented', NULL),
 (@B1, @F1, '102', 2, 2, 130, 400, 'Available', NULL),
 (@B1, @F2, '201', 3, 2, 150, 470, 'Rented', NULL),
 (@B1, @F2, '202', 4, 3, 180, 550, 'OwnerOccupied', @AptOwner);

DECLARE @Apt101 INT = (SELECT ApartmentId FROM dbo.Apartments WHERE BuildingId = @B1 AND ApartmentNumber = '101');
DECLARE @Apt201 INT = (SELECT ApartmentId FROM dbo.Apartments WHERE BuildingId = @B1 AND ApartmentNumber = '201');
DECLARE @Apt202 INT = (SELECT ApartmentId FROM dbo.Apartments WHERE BuildingId = @B1 AND ApartmentNumber = '202');

INSERT INTO dbo.ParkingSpots (BuildingId, SpotNumber, ApartmentId, SpotType, MonthlyFee) VALUES
 (@B1, 'P1', @Apt101, 'Covered', 25), (@B1, 'P2', @Apt201, 'Standard', 15),
 (@B1, 'P3', NULL, 'Visitor', NULL);

INSERT INTO dbo.StorageRooms (BuildingId, RoomNumber, ApartmentId, AreaSqm, MonthlyFee) VALUES
 (@B1, 'S1', @Apt101, 6, 10), (@B1, 'S2', NULL, 8, 15);

INSERT INTO dbo.UtilityMeters (ApartmentId, MeterType, MeterNumber, LastReading, LastReadingDate) VALUES
 (@Apt101, 'Electricity', 'ELE-88410', 15230, '2026-06-30'),
 (@Apt101, 'Water', 'WTR-33120', 890, '2026-06-30');

/* Residents */
INSERT INTO dbo.Residents (ApartmentId, UserId, ResidencyType, MoveInDate) VALUES
 (@Apt101, @Tenant1, 'Tenant', '2025-09-01'),
 (@Apt201, @Tenant2, 'Tenant', '2026-01-15'),
 (@Apt202, @AptOwner, 'Owner', '2024-05-01');

/* Contracts */
INSERT INTO dbo.Contracts (ContractNumber, ApartmentId, TenantUserId, LandlordUserId, StartDate, EndDate,
                           MonthlyRent, DepositAmount, PaymentFrequency, LateFeePercent, GraceDays, Status)
VALUES
 ('CTR-2025-000001', @Apt101, @Tenant1, @OwnerId, '2025-09-01', '2026-08-31', 450, 450, 'Monthly', 5, 5, 'Active'),
 ('CTR-2026-000002', @Apt201, @Tenant2, @OwnerId, '2026-01-15', '2027-01-14', 470, 470, 'Monthly', 5, 5, 'Active');

DECLARE @C1 INT = (SELECT ContractId FROM dbo.Contracts WHERE ContractNumber = 'CTR-2025-000001');
DECLARE @C2 INT = (SELECT ContractId FROM dbo.Contracts WHERE ContractNumber = 'CTR-2026-000002');

/* Invoices: paid (last month) + unpaid (this month) */
INSERT INTO dbo.Invoices (InvoiceNumber, ContractId, ApartmentId, IssuedToUserId, InvoiceType,
                          PeriodStart, PeriodEnd, DueDate, Amount, Status) VALUES
 ('INV-2026-000001', @C1, @Apt101, @Tenant1, 'Rent', '2026-06-01', '2026-06-30', '2026-06-05', 450, 'Paid'),
 ('INV-2026-000002', @C1, @Apt101, @Tenant1, 'Rent', '2026-07-01', '2026-07-31', '2026-07-05', 450, 'Overdue'),
 ('INV-2026-000003', @C2, @Apt201, @Tenant2, 'Rent', '2026-07-01', '2026-07-31', '2026-07-05', 470, 'Unpaid');

DECLARE @Inv1 INT = (SELECT InvoiceId FROM dbo.Invoices WHERE InvoiceNumber = 'INV-2026-000001');

INSERT INTO dbo.Payments (InvoiceId, PaidByUserId, Amount, Method, Status, ReceivedByUserId, PaidAt)
VALUES (@Inv1, @Tenant1, 450, 'Cash', 'Confirmed', @OwnerId, '2026-06-03T10:30:00');

INSERT INTO dbo.Receipts (PaymentId, ReceiptNumber)
VALUES (SCOPE_IDENTITY(), 'RCP-2026-000001');

/* Expenses */
INSERT INTO dbo.Expenses (BuildingId, CategoryId, Amount, ExpenseDate, Description, VendorName, CreatedByUserId)
SELECT @B1, CategoryId, m.Amount, m.ExpenseDate, m.Description, m.Vendor, @OwnerId
FROM (VALUES
 ('Electricity', 120.50, CAST('2026-06-15' AS DATE), N'فاتورة كهرباء المناطق المشتركة', N'شركة الكهرباء الأردنية'),
 ('Cleaning',     80.00, CAST('2026-06-20' AS DATE), N'مواد تنظيف شهرية', N'مؤسسة النظافة الحديثة'),
 ('Elevator',    150.00, CAST('2026-07-01' AS DATE), N'صيانة دورية للمصعد', N'شركة المصاعد المتحدة')
) AS m(Category, Amount, ExpenseDate, Description, Vendor)
JOIN dbo.ExpenseCategories ec ON ec.Name = m.Category;

/* Maintenance */
INSERT INTO dbo.MaintenanceRequests (BuildingId, ApartmentId, RequestedByUserId, Title, Description, Category, Priority, Status)
VALUES
 (@B1, @Apt101, @Tenant1, N'تسريب ماء في الحمام', N'يوجد تسريب ماء أسفل المغسلة في الحمام الرئيسي', 'Plumbing', 'High', 'Assigned'),
 (@B1, NULL, @OwnerId, N'عطل في إنارة المدخل', N'إنارة المدخل الرئيسي لا تعمل', 'Electrical', 'Medium', 'Open');

DECLARE @M1 INT = (SELECT TOP 1 RequestId FROM dbo.MaintenanceRequests WHERE Title = N'تسريب ماء في الحمام');
INSERT INTO dbo.MaintenanceAssignments (RequestId, AssignedToUserId, AssignedByUserId)
VALUES (@M1, @Tech, @OwnerId);

/* Complaints */
INSERT INTO dbo.Complaints (BuildingId, ApartmentId, SubmittedByUserId, IsAnonymous, Category, Subject, Description, Status)
VALUES
 (@B1, @Apt201, @Tenant2, 0, 'Noise', N'إزعاج متكرر ليلاً', N'أصوات مرتفعة من الشقة المجاورة بعد منتصف الليل', 'Open'),
 (@B1, NULL, NULL, 1, 'Cleanliness', N'نظافة الدرج', N'الدرج بحاجة إلى تنظيف أفضل', 'InReview');

/* Visitor */
INSERT INTO dbo.Visitors (ApartmentId, HostUserId, VisitorName, VisitorPhone, Purpose, ExpectedAt, ExpectedUntil, Status, ApprovedByUserId)
VALUES (@Apt101, @Tenant1, N'زيد الزائر', '+962795551234', N'زيارة عائلية',
        DATEADD(HOUR, 3, SYSUTCDATETIME()), DATEADD(HOUR, 8, SYSUTCDATETIME()), 'Approved', @Tenant1);

/* Announcement */
INSERT INTO dbo.Announcements (BuildingId, CreatedByUserId, Title, Body, Audience, IsPinned)
VALUES (@B1, @OwnerId, N'صيانة خزانات المياه',
        N'سيتم إجراء صيانة دورية لخزانات المياه يوم السبت القادم من الساعة 9 صباحاً حتى 12 ظهراً. يرجى تخزين كمية كافية من المياه.',
        'All', 1);

/* Staff schedules */
INSERT INTO dbo.StaffSchedules (UserId, BuildingId, TaskType, Title, ScheduledDate, StartTime, EndTime)
VALUES
 (@Cleaner, @B1, 'Cleaning', N'تنظيف الممرات والدرج', CAST(SYSUTCDATETIME() AS DATE), '08:00', '11:00'),
 (@Tech, @B1, 'Inspection', N'فحص دوري للمولد الاحتياطي', DATEADD(DAY, 2, CAST(SYSUTCDATETIME() AS DATE)), '10:00', '12:00');

/* Notifications */
INSERT INTO dbo.Notifications (UserId, Title, Body, NotifType, EntityType, EntityId)
VALUES
 (@Tenant1, N'فاتورة إيجار جديدة', N'تم إصدار فاتورة إيجار شهر تموز بقيمة 450 دينار', 'Payment', 'Invoice', 2),
 (@Tech, N'مهمة صيانة جديدة', N'تم تعيينك لمعالجة: تسريب ماء في الحمام', 'Maintenance', 'MaintenanceRequest', @M1);

PRINT 'Seed data inserted.';
GO
