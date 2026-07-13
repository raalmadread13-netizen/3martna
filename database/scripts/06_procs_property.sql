/* ============================================================
   3martna (عمارتنا) — Stored Procedures: Property
   Buildings, Floors, Apartments, Parking, Storage, Meters,
   Residents, Contracts
   ============================================================ */
USE Amartna;
GO

/* --------------------- BUILDINGS ---------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Building_Create
    @OwnerUserId INT, @Name NVARCHAR(150), @NameAr NVARCHAR(150) = NULL,
    @Address NVARCHAR(300), @City NVARCHAR(100), @District NVARCHAR(100) = NULL,
    @Latitude DECIMAL(9,6) = NULL, @Longitude DECIMAL(9,6) = NULL,
    @TotalFloors INT = 1, @YearBuilt INT = NULL, @ImageUrl VARCHAR(500) = NULL,
    @Notes NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    INSERT INTO dbo.Buildings (OwnerUserId, Name, NameAr, Address, City, District,
                               Latitude, Longitude, TotalFloors, YearBuilt, ImageUrl, Notes)
    VALUES (@OwnerUserId, @Name, @NameAr, @Address, @City, @District,
            @Latitude, @Longitude, @TotalFloors, @YearBuilt, @ImageUrl, @Notes);

    DECLARE @BuildingId INT = SCOPE_IDENTITY();

    -- Auto-create floors 0..N-1 (0 = ground floor)
    ;WITH n AS (SELECT TOP (@TotalFloors) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS FloorNumber
                FROM sys.objects)
    INSERT INTO dbo.Floors (BuildingId, FloorNumber, Name)
    SELECT @BuildingId, FloorNumber,
           CASE WHEN FloorNumber = 0 THEN N'Ground' ELSE CONCAT(N'Floor ', FloorNumber) END
    FROM n;

    COMMIT TRANSACTION;
    EXEC dbo.sp_Building_GetById @BuildingId = @BuildingId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Building_GetById @BuildingId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT b.BuildingId, b.OwnerUserId, u.FullName AS OwnerName, b.Name, b.NameAr,
           b.Address, b.City, b.District, b.Latitude, b.Longitude, b.TotalFloors,
           b.YearBuilt, b.ImageUrl, b.Notes, b.IsActive, b.CreatedAt,
           (SELECT COUNT(*) FROM dbo.Apartments a WHERE a.BuildingId = b.BuildingId) AS ApartmentCount,
           (SELECT COUNT(*) FROM dbo.Apartments a WHERE a.BuildingId = b.BuildingId
              AND a.Status IN ('Rented','OwnerOccupied')) AS OccupiedCount
    FROM dbo.Buildings b
    JOIN dbo.Users u ON u.UserId = b.OwnerUserId
    WHERE b.BuildingId = @BuildingId;

    SELECT FloorId, FloorNumber, Name FROM dbo.Floors
    WHERE BuildingId = @BuildingId ORDER BY FloorNumber;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Building_List
    @Page INT = 1, @PageSize INT = 20, @Search NVARCHAR(150) = NULL,
    @OwnerUserId INT = NULL, @City NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT b.BuildingId, b.OwnerUserId, u.FullName AS OwnerName, b.Name, b.NameAr,
           b.Address, b.City, b.District, b.TotalFloors, b.ImageUrl, b.IsActive, b.CreatedAt,
           (SELECT COUNT(*) FROM dbo.Apartments a WHERE a.BuildingId = b.BuildingId) AS ApartmentCount,
           o.OccupancyRate,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.Buildings b
    JOIN dbo.Users u ON u.UserId = b.OwnerUserId
    LEFT JOIN dbo.vw_OccupancySummary o ON o.BuildingId = b.BuildingId
    WHERE b.IsActive = 1
      AND (@OwnerUserId IS NULL OR b.OwnerUserId = @OwnerUserId)
      AND (@City IS NULL OR b.City = @City)
      AND (@Search IS NULL OR b.Name LIKE '%' + @Search + '%'
           OR b.NameAr LIKE '%' + @Search + '%' OR b.Address LIKE '%' + @Search + '%')
    ORDER BY b.CreatedAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Building_Update
    @BuildingId INT, @Name NVARCHAR(150) = NULL, @NameAr NVARCHAR(150) = NULL,
    @Address NVARCHAR(300) = NULL, @City NVARCHAR(100) = NULL, @District NVARCHAR(100) = NULL,
    @Latitude DECIMAL(9,6) = NULL, @Longitude DECIMAL(9,6) = NULL,
    @YearBuilt INT = NULL, @ImageUrl VARCHAR(500) = NULL, @Notes NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Buildings SET
        Name = ISNULL(@Name, Name), NameAr = ISNULL(@NameAr, NameAr),
        Address = ISNULL(@Address, Address), City = ISNULL(@City, City),
        District = ISNULL(@District, District),
        Latitude = ISNULL(@Latitude, Latitude), Longitude = ISNULL(@Longitude, Longitude),
        YearBuilt = ISNULL(@YearBuilt, YearBuilt), ImageUrl = ISNULL(@ImageUrl, ImageUrl),
        Notes = ISNULL(@Notes, Notes), UpdatedAt = SYSUTCDATETIME()
    WHERE BuildingId = @BuildingId;
    EXEC dbo.sp_Building_GetById @BuildingId = @BuildingId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Building_Deactivate @BuildingId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Buildings SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
    WHERE BuildingId = @BuildingId;
END;
GO

/* Verify a user may manage a building (owner or scoped staff) */
CREATE OR ALTER PROCEDURE dbo.sp_Building_CheckAccess @BuildingId INT, @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT CASE WHEN EXISTS (
        SELECT 1 FROM dbo.Buildings b WHERE b.BuildingId = @BuildingId AND b.OwnerUserId = @UserId
        UNION ALL
        SELECT 1 FROM dbo.UserRoles ur WHERE ur.UserId = @UserId AND ur.BuildingId = @BuildingId
        UNION ALL
        SELECT 1 FROM dbo.UserRoles ur JOIN dbo.Roles r ON r.RoleId = ur.RoleId
        WHERE ur.UserId = @UserId AND r.Name = 'SystemAdmin'
    ) THEN 1 ELSE 0 END AS HasAccess;
END;
GO

/* --------------------- APARTMENTS --------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Apartment_Create
    @BuildingId INT, @FloorId INT, @ApartmentNumber VARCHAR(20),
    @Bedrooms INT = 1, @Bathrooms INT = 1, @AreaSqm DECIMAL(8,2) = NULL,
    @RentAmount DECIMAL(12,2) = NULL, @OwnerUserId INT = NULL,
    @Description NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.Apartments WHERE BuildingId = @BuildingId AND ApartmentNumber = @ApartmentNumber)
        THROW 50020, 'APARTMENT_NUMBER_EXISTS', 1;

    INSERT INTO dbo.Apartments (BuildingId, FloorId, ApartmentNumber, Bedrooms, Bathrooms,
                                AreaSqm, RentAmount, OwnerUserId, Description)
    VALUES (@BuildingId, @FloorId, @ApartmentNumber, @Bedrooms, @Bathrooms,
            @AreaSqm, @RentAmount, @OwnerUserId, @Description);

    DECLARE @ApartmentId INT = SCOPE_IDENTITY();
    EXEC dbo.sp_Apartment_GetById @ApartmentId = @ApartmentId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Apartment_GetById @ApartmentId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.vw_ApartmentDetails WHERE ApartmentId = @ApartmentId;

    SELECT ParkingSpotId, SpotNumber, SpotType, MonthlyFee
    FROM dbo.ParkingSpots WHERE ApartmentId = @ApartmentId;

    SELECT StorageRoomId, RoomNumber, AreaSqm, MonthlyFee
    FROM dbo.StorageRooms WHERE ApartmentId = @ApartmentId;

    SELECT MeterId, MeterType, MeterNumber, LastReading, LastReadingDate
    FROM dbo.UtilityMeters WHERE ApartmentId = @ApartmentId;

    SELECT r.ResidentId, r.UserId, u.FullName, u.Phone, r.ResidencyType, r.MoveInDate
    FROM dbo.Residents r JOIN dbo.Users u ON u.UserId = r.UserId
    WHERE r.ApartmentId = @ApartmentId AND r.MoveOutDate IS NULL;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Apartment_List
    @Page INT = 1, @PageSize INT = 20, @BuildingId INT = NULL,
    @Status VARCHAR(20) = NULL, @Search NVARCHAR(100) = NULL,
    @OwnerUserId INT = NULL, @MinRent DECIMAL(12,2) = NULL, @MaxRent DECIMAL(12,2) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT v.*, COUNT(*) OVER() AS TotalCount
    FROM dbo.vw_ApartmentDetails v
    WHERE (@BuildingId IS NULL OR v.BuildingId = @BuildingId)
      AND (@Status IS NULL OR v.Status = @Status)
      AND (@OwnerUserId IS NULL OR v.OwnerUserId = @OwnerUserId)
      AND (@MinRent IS NULL OR v.RentAmount >= @MinRent)
      AND (@MaxRent IS NULL OR v.RentAmount <= @MaxRent)
      AND (@Search IS NULL OR v.ApartmentNumber LIKE '%' + @Search + '%'
           OR v.BuildingName LIKE '%' + @Search + '%'
           OR v.TenantName LIKE '%' + @Search + '%')
    ORDER BY v.BuildingId, v.FloorNumber, v.ApartmentNumber
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Apartment_Update
    @ApartmentId INT, @Bedrooms INT = NULL, @Bathrooms INT = NULL,
    @AreaSqm DECIMAL(8,2) = NULL, @RentAmount DECIMAL(12,2) = NULL,
    @Status VARCHAR(20) = NULL, @OwnerUserId INT = NULL, @Description NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Apartments SET
        Bedrooms = ISNULL(@Bedrooms, Bedrooms), Bathrooms = ISNULL(@Bathrooms, Bathrooms),
        AreaSqm = ISNULL(@AreaSqm, AreaSqm), RentAmount = ISNULL(@RentAmount, RentAmount),
        Status = ISNULL(@Status, Status), OwnerUserId = ISNULL(@OwnerUserId, OwnerUserId),
        Description = ISNULL(@Description, Description), UpdatedAt = SYSUTCDATETIME()
    WHERE ApartmentId = @ApartmentId;
    EXEC dbo.sp_Apartment_GetById @ApartmentId = @ApartmentId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Apartment_Delete @ApartmentId INT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.Contracts WHERE ApartmentId = @ApartmentId AND Status = 'Active')
        THROW 50021, 'APARTMENT_HAS_ACTIVE_CONTRACT', 1;
    IF EXISTS (SELECT 1 FROM dbo.Residents WHERE ApartmentId = @ApartmentId AND MoveOutDate IS NULL)
        THROW 50022, 'APARTMENT_HAS_ACTIVE_RESIDENTS', 1;
    DELETE FROM dbo.Apartments WHERE ApartmentId = @ApartmentId;
END;
GO

/* ------------------ PARKING / STORAGE ----------------- */

CREATE OR ALTER PROCEDURE dbo.sp_ParkingSpot_Upsert
    @ParkingSpotId INT = NULL, @BuildingId INT, @SpotNumber VARCHAR(20),
    @ApartmentId INT = NULL, @SpotType VARCHAR(20) = 'Standard', @MonthlyFee DECIMAL(12,2) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @ParkingSpotId IS NULL
        INSERT INTO dbo.ParkingSpots (BuildingId, SpotNumber, ApartmentId, SpotType, MonthlyFee)
        VALUES (@BuildingId, @SpotNumber, @ApartmentId, @SpotType, @MonthlyFee);
    ELSE
        UPDATE dbo.ParkingSpots
        SET SpotNumber = @SpotNumber, ApartmentId = @ApartmentId,
            SpotType = @SpotType, MonthlyFee = @MonthlyFee
        WHERE ParkingSpotId = @ParkingSpotId;

    SELECT p.ParkingSpotId, p.BuildingId, p.SpotNumber, p.ApartmentId, a.ApartmentNumber,
           p.SpotType, p.MonthlyFee
    FROM dbo.ParkingSpots p
    LEFT JOIN dbo.Apartments a ON a.ApartmentId = p.ApartmentId
    WHERE p.ParkingSpotId = ISNULL(@ParkingSpotId, SCOPE_IDENTITY());
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ParkingSpot_List @BuildingId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.ParkingSpotId, p.SpotNumber, p.SpotType, p.MonthlyFee,
           p.ApartmentId, a.ApartmentNumber
    FROM dbo.ParkingSpots p
    LEFT JOIN dbo.Apartments a ON a.ApartmentId = p.ApartmentId
    WHERE p.BuildingId = @BuildingId ORDER BY p.SpotNumber;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ParkingSpot_Delete @ParkingSpotId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.ParkingSpots WHERE ParkingSpotId = @ParkingSpotId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_StorageRoom_Upsert
    @StorageRoomId INT = NULL, @BuildingId INT, @RoomNumber VARCHAR(20),
    @ApartmentId INT = NULL, @AreaSqm DECIMAL(8,2) = NULL, @MonthlyFee DECIMAL(12,2) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @StorageRoomId IS NULL
        INSERT INTO dbo.StorageRooms (BuildingId, RoomNumber, ApartmentId, AreaSqm, MonthlyFee)
        VALUES (@BuildingId, @RoomNumber, @ApartmentId, @AreaSqm, @MonthlyFee);
    ELSE
        UPDATE dbo.StorageRooms
        SET RoomNumber = @RoomNumber, ApartmentId = @ApartmentId,
            AreaSqm = @AreaSqm, MonthlyFee = @MonthlyFee
        WHERE StorageRoomId = @StorageRoomId;

    SELECT s.StorageRoomId, s.BuildingId, s.RoomNumber, s.ApartmentId, a.ApartmentNumber,
           s.AreaSqm, s.MonthlyFee
    FROM dbo.StorageRooms s
    LEFT JOIN dbo.Apartments a ON a.ApartmentId = s.ApartmentId
    WHERE s.StorageRoomId = ISNULL(@StorageRoomId, SCOPE_IDENTITY());
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_StorageRoom_List @BuildingId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT s.StorageRoomId, s.RoomNumber, s.AreaSqm, s.MonthlyFee,
           s.ApartmentId, a.ApartmentNumber
    FROM dbo.StorageRooms s
    LEFT JOIN dbo.Apartments a ON a.ApartmentId = s.ApartmentId
    WHERE s.BuildingId = @BuildingId ORDER BY s.RoomNumber;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_StorageRoom_Delete @StorageRoomId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.StorageRooms WHERE StorageRoomId = @StorageRoomId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_UtilityMeter_Upsert
    @ApartmentId INT, @MeterType VARCHAR(20), @MeterNumber VARCHAR(50),
    @LastReading DECIMAL(12,2) = NULL, @LastReadingDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    MERGE dbo.UtilityMeters AS t
    USING (SELECT @ApartmentId AS ApartmentId, @MeterType AS MeterType) AS s
        ON t.ApartmentId = s.ApartmentId AND t.MeterType = s.MeterType
    WHEN MATCHED THEN UPDATE SET
        MeterNumber = @MeterNumber,
        LastReading = ISNULL(@LastReading, t.LastReading),
        LastReadingDate = ISNULL(@LastReadingDate, t.LastReadingDate)
    WHEN NOT MATCHED THEN
        INSERT (ApartmentId, MeterType, MeterNumber, LastReading, LastReadingDate)
        VALUES (@ApartmentId, @MeterType, @MeterNumber, @LastReading, @LastReadingDate);
END;
GO

/* --------------------- RESIDENTS ---------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Resident_MoveIn
    @ApartmentId INT, @UserId INT, @ResidencyType VARCHAR(20),
    @MoveInDate DATE, @Notes NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.Residents
               WHERE ApartmentId = @ApartmentId AND UserId = @UserId AND MoveOutDate IS NULL)
        THROW 50030, 'RESIDENT_ALREADY_ACTIVE', 1;

    INSERT INTO dbo.Residents (ApartmentId, UserId, ResidencyType, MoveInDate, Notes)
    VALUES (@ApartmentId, @UserId, @ResidencyType, @MoveInDate, @Notes);

    IF @ResidencyType = 'Owner'
        UPDATE dbo.Apartments SET Status = 'OwnerOccupied', UpdatedAt = SYSUTCDATETIME()
        WHERE ApartmentId = @ApartmentId AND Status = 'Available';

    SELECT r.ResidentId, r.ApartmentId, r.UserId, u.FullName, u.Phone,
           r.ResidencyType, r.MoveInDate, r.Notes
    FROM dbo.Residents r JOIN dbo.Users u ON u.UserId = r.UserId
    WHERE r.ResidentId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Resident_MoveOut @ResidentId INT, @MoveOutDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Residents SET MoveOutDate = @MoveOutDate
    WHERE ResidentId = @ResidentId AND MoveOutDate IS NULL;

    -- Free the apartment when the last resident leaves and no active contract exists
    DECLARE @ApartmentId INT = (SELECT ApartmentId FROM dbo.Residents WHERE ResidentId = @ResidentId);
    IF NOT EXISTS (SELECT 1 FROM dbo.Residents WHERE ApartmentId = @ApartmentId AND MoveOutDate IS NULL)
       AND NOT EXISTS (SELECT 1 FROM dbo.Contracts WHERE ApartmentId = @ApartmentId AND Status = 'Active')
        UPDATE dbo.Apartments SET Status = 'Available', UpdatedAt = SYSUTCDATETIME()
        WHERE ApartmentId = @ApartmentId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Resident_List
    @Page INT = 1, @PageSize INT = 20, @BuildingId INT = NULL,
    @ApartmentId INT = NULL, @Search NVARCHAR(150) = NULL,
    @ResidencyType VARCHAR(20) = NULL, @IncludeHistory BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT r.ResidentId, r.ApartmentId, a.ApartmentNumber, a.BuildingId, b.Name AS BuildingName,
           r.UserId, u.FullName, u.Phone, u.Email, u.ProfileImageUrl, u.NationalId,
           r.ResidencyType, r.MoveInDate, r.MoveOutDate, r.Notes,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.Residents r
    JOIN dbo.Users u ON u.UserId = r.UserId AND u.IsDeleted = 0
    JOIN dbo.Apartments a ON a.ApartmentId = r.ApartmentId
    JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
    WHERE (@IncludeHistory = 1 OR r.MoveOutDate IS NULL)
      AND (@BuildingId IS NULL OR a.BuildingId = @BuildingId)
      AND (@ApartmentId IS NULL OR r.ApartmentId = @ApartmentId)
      AND (@ResidencyType IS NULL OR r.ResidencyType = @ResidencyType)
      AND (@Search IS NULL OR u.FullName LIKE '%' + @Search + '%'
           OR u.Phone LIKE '%' + @Search + '%' OR a.ApartmentNumber LIKE '%' + @Search + '%')
    ORDER BY r.MoveInDate DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Resident_History @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT r.ResidentId, r.ApartmentId, a.ApartmentNumber, b.Name AS BuildingName,
           r.ResidencyType, r.MoveInDate, r.MoveOutDate
    FROM dbo.Residents r
    JOIN dbo.Apartments a ON a.ApartmentId = r.ApartmentId
    JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
    WHERE r.UserId = @UserId
    ORDER BY r.MoveInDate DESC;
END;
GO

/* --------------------- CONTRACTS ---------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Contract_Create
    @ApartmentId INT, @TenantUserId INT, @LandlordUserId INT,
    @StartDate DATE, @EndDate DATE, @MonthlyRent DECIMAL(12,2),
    @DepositAmount DECIMAL(12,2) = 0, @PaymentFrequency VARCHAR(20) = 'Monthly',
    @LateFeePercent DECIMAL(5,2) = 0, @GraceDays INT = 5,
    @DocumentUrl VARCHAR(500) = NULL, @ActivateNow BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM dbo.Contracts WHERE ApartmentId = @ApartmentId AND Status = 'Active')
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50040, 'APARTMENT_HAS_ACTIVE_CONTRACT', 1;
    END

    DECLARE @Number VARCHAR(30) =
        CONCAT('CTR-', YEAR(SYSUTCDATETIME()), '-',
               RIGHT('000000' + CAST(NEXT VALUE FOR dbo.Seq_ContractNumber AS VARCHAR(10)), 6));

    INSERT INTO dbo.Contracts (ContractNumber, ApartmentId, TenantUserId, LandlordUserId,
        StartDate, EndDate, MonthlyRent, DepositAmount, PaymentFrequency,
        LateFeePercent, GraceDays, Status, DocumentUrl)
    VALUES (@Number, @ApartmentId, @TenantUserId, @LandlordUserId,
        @StartDate, @EndDate, @MonthlyRent, @DepositAmount, @PaymentFrequency,
        @LateFeePercent, @GraceDays, CASE WHEN @ActivateNow = 1 THEN 'Active' ELSE 'Pending' END,
        @DocumentUrl);

    DECLARE @ContractId INT = SCOPE_IDENTITY();

    IF @ActivateNow = 1 AND NOT EXISTS (
        SELECT 1 FROM dbo.Residents
        WHERE ApartmentId = @ApartmentId AND UserId = @TenantUserId AND MoveOutDate IS NULL)
        INSERT INTO dbo.Residents (ApartmentId, UserId, ResidencyType, MoveInDate)
        VALUES (@ApartmentId, @TenantUserId, 'Tenant', @StartDate);

    COMMIT TRANSACTION;
    EXEC dbo.sp_Contract_GetById @ContractId = @ContractId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Contract_GetById @ContractId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.ContractId, c.ContractNumber, c.ApartmentId, a.ApartmentNumber,
           a.BuildingId, b.Name AS BuildingName,
           c.TenantUserId, t.FullName AS TenantName, t.Phone AS TenantPhone,
           c.LandlordUserId, l.FullName AS LandlordName,
           c.StartDate, c.EndDate, c.MonthlyRent, c.DepositAmount, c.PaymentFrequency,
           c.LateFeePercent, c.GraceDays, c.Status, c.DocumentUrl,
           c.TerminatedAt, c.TerminationReason, c.CreatedAt
    FROM dbo.Contracts c
    JOIN dbo.Apartments a ON a.ApartmentId = c.ApartmentId
    JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
    JOIN dbo.Users t ON t.UserId = c.TenantUserId
    JOIN dbo.Users l ON l.UserId = c.LandlordUserId
    WHERE c.ContractId = @ContractId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Contract_List
    @Page INT = 1, @PageSize INT = 20, @BuildingId INT = NULL,
    @ApartmentId INT = NULL, @TenantUserId INT = NULL,
    @LandlordUserId INT = NULL, @Status VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.ContractId, c.ContractNumber, c.ApartmentId, a.ApartmentNumber,
           a.BuildingId, b.Name AS BuildingName,
           c.TenantUserId, t.FullName AS TenantName,
           c.StartDate, c.EndDate, c.MonthlyRent, c.PaymentFrequency, c.Status,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.Contracts c
    JOIN dbo.Apartments a ON a.ApartmentId = c.ApartmentId
    JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
    JOIN dbo.Users t ON t.UserId = c.TenantUserId
    WHERE (@BuildingId IS NULL OR a.BuildingId = @BuildingId)
      AND (@ApartmentId IS NULL OR c.ApartmentId = @ApartmentId)
      AND (@TenantUserId IS NULL OR c.TenantUserId = @TenantUserId)
      AND (@LandlordUserId IS NULL OR c.LandlordUserId = @LandlordUserId)
      AND (@Status IS NULL OR c.Status = @Status)
    ORDER BY c.CreatedAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Contract_Activate @ContractId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    DECLARE @ApartmentId INT, @TenantUserId INT, @StartDate DATE;
    SELECT @ApartmentId = ApartmentId, @TenantUserId = TenantUserId, @StartDate = StartDate
    FROM dbo.Contracts WHERE ContractId = @ContractId AND Status = 'Pending';

    IF @ApartmentId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50041, 'CONTRACT_NOT_PENDING', 1;
    END

    UPDATE dbo.Contracts SET Status = 'Active', UpdatedAt = SYSUTCDATETIME()
    WHERE ContractId = @ContractId;

    IF NOT EXISTS (SELECT 1 FROM dbo.Residents
                   WHERE ApartmentId = @ApartmentId AND UserId = @TenantUserId AND MoveOutDate IS NULL)
        INSERT INTO dbo.Residents (ApartmentId, UserId, ResidencyType, MoveInDate)
        VALUES (@ApartmentId, @TenantUserId, 'Tenant', @StartDate);

    COMMIT TRANSACTION;
    EXEC dbo.sp_Contract_GetById @ContractId = @ContractId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Contract_Terminate
    @ContractId INT, @Reason NVARCHAR(500) = NULL, @MoveOutDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    DECLARE @ApartmentId INT, @TenantUserId INT;
    SELECT @ApartmentId = ApartmentId, @TenantUserId = TenantUserId
    FROM dbo.Contracts WHERE ContractId = @ContractId AND Status = 'Active';

    IF @ApartmentId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50042, 'CONTRACT_NOT_ACTIVE', 1;
    END

    UPDATE dbo.Contracts
    SET Status = 'Terminated', TerminatedAt = SYSUTCDATETIME(),
        TerminationReason = @Reason, UpdatedAt = SYSUTCDATETIME()
    WHERE ContractId = @ContractId;

    UPDATE dbo.Residents SET MoveOutDate = ISNULL(@MoveOutDate, CAST(SYSUTCDATETIME() AS DATE))
    WHERE ApartmentId = @ApartmentId AND UserId = @TenantUserId AND MoveOutDate IS NULL;

    COMMIT TRANSACTION;
    EXEC dbo.sp_Contract_GetById @ContractId = @ContractId;
END;
GO

/* Nightly job: expire contracts past their end date */
CREATE OR ALTER PROCEDURE dbo.sp_Contract_ExpireOverdue
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Contracts SET Status = 'Expired', UpdatedAt = SYSUTCDATETIME()
    WHERE Status = 'Active' AND EndDate < CAST(SYSUTCDATETIME() AS DATE);
    SELECT @@ROWCOUNT AS ExpiredCount;
END;
GO

PRINT 'Property procedures created.';
GO
