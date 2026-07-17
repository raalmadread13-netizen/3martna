/* ============================================================
   3martna DEMO DATA (Sprint 6.5)

   Populates a SQL Server database with the pilot demo portfolio.
   Prerequisites: all migrations applied (npm run db:migrate) and all
   seeds applied (npm run db:seed).

   Idempotent: guarded by the demo tenant id — running twice is a no-op.

   Demo accounts (password for both: Demo123!):
     manager@demo.3martna.jo  → BuildingManager
     admin@demo.3martna.jo    → SuperAdmin

   Dates are relative to the run time so the dashboard always shows a
   live-looking portfolio (one lease expiring within 30 days, one
   historical move-out).
   ============================================================ */

DECLARE @Tenant  UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000001';
IF EXISTS (SELECT 1 FROM dbo.Tenants WHERE Id = @Tenant)
BEGIN
    PRINT 'Demo data already present — nothing to do.';
    RETURN;
END

DECLARE @Now     DATETIME2(0) = SYSUTCDATETIME();
/* bcrypt("Demo123!", 10) */
DECLARE @Hash    VARCHAR(100) = '$2a$10$w0tPCrxlGbyuNGGZWTuTNehccHWELBO7XZMRxcE/2KUED4zWRykc2';

DECLARE @Manager UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000101';
DECLARE @Admin   UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000102';
DECLARE @Heights UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000201';
DECLARE @Petra   UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000202';
DECLARE @FloorG  UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000301';
DECLARE @Floor1  UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000302';
DECLARE @FloorP  UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000303';
DECLARE @Apt101  UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000401';
DECLARE @Apt102  UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000402';
DECLARE @Apt103  UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000403';
DECLARE @Apt201  UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000404';
DECLARE @Apt202  UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000405';
DECLARE @Layla   UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000501';
DECLARE @Acme    UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000502';
DECLARE @Sara    UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000601';
DECLARE @Omar    UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000602';
DECLARE @Rania   UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000603';
DECLARE @Bilal   UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000604';
DECLARE @Lease1  UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000701';
DECLARE @Lease2  UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000702';
DECLARE @Lease3  UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000703';
DECLARE @Stay1   UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000801';
DECLARE @Stay2   UNIQUEIDENTIFIER = 'D0000000-0000-4000-8000-000000000802';

/* ------------------------- tenant + users ------------------------ */
INSERT INTO dbo.Tenants (Id, Name, LegalName, ContactEmail, Status)
VALUES (@Tenant, N'Demo Property Management', N'Demo Property Management LLC',
        'manager@demo.3martna.jo', 'Active');

INSERT INTO dbo.Users (Id, TenantId, FirstName, LastName, Email, PhoneNumber, PasswordHash,
                       PreferredLanguage, Status, EmailVerified, PhoneVerified)
VALUES
 (@Manager, @Tenant, N'Maha', N'Manager', 'manager@demo.3martna.jo', '+962790000100', @Hash, 'en', 'Active', 1, 1),
 (@Admin,   @Tenant, N'Adel', N'Admin',   'admin@demo.3martna.jo',   '+962790000101', @Hash, 'en', 'Active', 1, 1);

INSERT INTO dbo.UserRoles (UserId, RoleId)
SELECT @Manager, Id FROM dbo.Roles WHERE Name = 'BuildingManager'
UNION ALL
SELECT @Admin, Id FROM dbo.Roles WHERE Name = 'SuperAdmin';

/* --------------------------- buildings --------------------------- */
INSERT INTO dbo.Buildings (Id, TenantId, Name, Address, City, District, TotalFloors, YearBuilt,
                           Status, CreatedBy)
VALUES
 (@Heights, @Tenant, N'Amman Heights',   N'12 Rainbow Street', N'Amman', N'Jabal Amman', 6, 2018, 'Active', @Manager),
 (@Petra,   @Tenant, N'Petra Residence', N'5 Wakalat Street',  N'Amman', N'Sweifieh',    4, 2021, 'Active', @Manager);

INSERT INTO dbo.Floors (Id, TenantId, BuildingId, FloorNumber, Name, CreatedBy)
VALUES
 (@FloorG, @Tenant, @Heights, 0, N'Ground', @Manager),
 (@Floor1, @Tenant, @Heights, 1, NULL,      @Manager),
 (@FloorP, @Tenant, @Petra,   1, NULL,      @Manager);

/* ---------------------------- owners ----------------------------- */
INSERT INTO dbo.Owners (Id, TenantId, OwnerType, FullName, CompanyName, Email, PhoneNumber, CreatedBy)
VALUES
 (@Layla, @Tenant, 'Individual', N'Layla Haddad', NULL,                 'layla@example.com', '+962790000200', @Manager),
 (@Acme,  @Tenant, 'Company',    N'Kareem Odeh',  N'ACME Real Estate',  NULL,                NULL,            @Manager);

/* -------------------------- apartments --------------------------- */
INSERT INTO dbo.Apartments (Id, TenantId, BuildingId, FloorId, UnitNumber, Bedrooms, Bathrooms,
                            BaseRentAmount, Status, OwnerId, CreatedBy)
VALUES
 (@Apt101, @Tenant, @Heights, @FloorG, '101', 2, 1, 450, 'Leased',    @Layla, @Manager),
 (@Apt102, @Tenant, @Heights, @Floor1, '102', 2, 1, 480, 'Available', @Layla, @Manager),
 (@Apt103, @Tenant, @Heights, @Floor1, '103', 2, 1, 520, 'Available', @Acme,  @Manager),
 (@Apt201, @Tenant, @Petra,   @FloorP, '201', 2, 1, 600, 'Available', @Acme,  @Manager),
 (@Apt202, @Tenant, @Petra,   @FloorP, '202', 2, 1, 580, 'Available', @Acme,  @Manager);

/* --------------------------- residents --------------------------- */
INSERT INTO dbo.Residents (Id, TenantId, ApartmentId, FullName, PhoneNumber, Email, ResidencyType,
                           MoveInDate, MoveOutDate, CreatedBy)
VALUES
 (@Sara,  @Tenant, @Apt101, N'Sara Khalil', '+962790000301', 'sara@example.com', 'LeaseTenant',
          DATEADD(DAY, -90, @Now), NULL, @Manager),
 (@Omar,  @Tenant, NULL,    N'Omar Nassar', '+962790000302', NULL, 'LeaseTenant', NULL, NULL, @Manager),
 (@Rania, @Tenant, NULL,    N'Rania Aloul', '+962790000303', NULL, 'LeaseTenant', NULL, NULL, @Manager),
 (@Bilal, @Tenant, @Apt201, N'Bilal Odeh',  '+962790000304', NULL, 'LeaseTenant',
          DATEADD(DAY, -400, @Now), DATEADD(DAY, -40, @Now), @Manager);

/* ----------------------------- leases ---------------------------- */
INSERT INTO dbo.LeaseContracts (Id, TenantId, ContractNumber, ApartmentId, OwnerId, ResidentId,
                                StartDate, EndDate, MonthlyRent, Status, TerminatedAt,
                                TerminationReason, CreatedBy)
VALUES
 /* current lease, Sara in 101 */
 (@Lease1, @Tenant, 'LC-DEMO-000101', @Apt101, @Layla, @Sara,
  DATEADD(DAY, -90, @Now), DATEADD(DAY, 275, @Now), 450, 'Active', NULL, NULL, @Manager),
 /* signed lease expiring within 30 days — Omar not moved in yet */
 (@Lease2, @Tenant, 'LC-DEMO-000102', @Apt102, @Layla, @Omar,
  DATEADD(DAY, -350, @Now), DATEADD(DAY, 12, @Now), 480, 'Active', NULL, NULL, @Manager),
 /* historical, terminated lease — Bilal moved out */
 (@Lease3, @Tenant, 'LC-DEMO-000201', @Apt201, @Acme, @Bilal,
  DATEADD(DAY, -400, @Now), DATEADD(DAY, -35, @Now), 600, 'Terminated',
  DATEADD(DAY, -40, @Now), N'Tenant relocated abroad', @Manager);

/* --------------------------- occupancy --------------------------- */
INSERT INTO dbo.Occupancies (Id, TenantId, ApartmentId, ResidentId, LeaseContractId,
                             MoveInDate, MoveOutDate, MoveOutReason, CreatedBy)
VALUES
 (@Stay1, @Tenant, @Apt101, @Sara, @Lease1, DATEADD(DAY, -90, @Now), NULL, NULL, @Manager),
 (@Stay2, @Tenant, @Apt201, @Bilal, @Lease3, DATEADD(DAY, -400, @Now),
  DATEADD(DAY, -40, @Now), N'Lease terminated: tenant relocated', @Manager);

PRINT 'Demo data seeded: 1 tenant, 2 users, 2 buildings, 5 apartments, 2 owners, 4 residents, 3 leases, 2 occupancy records.';
