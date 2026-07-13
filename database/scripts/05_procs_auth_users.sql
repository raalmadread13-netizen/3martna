/* ============================================================
   3martna (عمارتنا) — Stored Procedures: Auth, Users, Roles,
   Tokens, Devices, Settings, Emergency Contacts, Audit
   Conventions:
     - List procs take @Page/@PageSize and return TotalCount column.
     - All access from the API goes through these procedures.
   ============================================================ */
USE Amartna;
GO

/* ----------------------- USERS ----------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_User_Create
    @FullName NVARCHAR(150), @Email VARCHAR(255) = NULL, @Phone VARCHAR(20),
    @PasswordHash VARCHAR(255), @NationalId VARCHAR(20) = NULL,
    @PreferredLanguage VARCHAR(2) = 'ar', @FirebaseUid VARCHAR(128) = NULL,
    @RoleName VARCHAR(50) = 'Tenant'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Phone = @Phone AND IsDeleted = 0)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50001, 'PHONE_ALREADY_EXISTS', 1;
    END
    IF @Email IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email AND IsDeleted = 0)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50002, 'EMAIL_ALREADY_EXISTS', 1;
    END

    DECLARE @RoleId INT = (SELECT RoleId FROM dbo.Roles WHERE Name = @RoleName);
    IF @RoleId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50003, 'ROLE_NOT_FOUND', 1;
    END

    INSERT INTO dbo.Users (FullName, Email, Phone, PasswordHash, NationalId, PreferredLanguage, FirebaseUid)
    VALUES (@FullName, @Email, @Phone, @PasswordHash, @NationalId, @PreferredLanguage, @FirebaseUid);

    DECLARE @UserId INT = SCOPE_IDENTITY();
    INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@UserId, @RoleId);
    INSERT INTO dbo.UserSettings (UserId) VALUES (@UserId);

    COMMIT TRANSACTION;

    EXEC dbo.sp_User_GetById @UserId = @UserId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_GetById @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.PublicId, u.FullName, u.Email, u.Phone, u.NationalId,
           u.ProfileImageUrl, u.Address, u.DateOfBirth, u.Gender, u.PreferredLanguage,
           u.FirebaseUid, u.IsPhoneVerified, u.IsEmailVerified, u.IsActive,
           u.LastLoginAt, u.CreatedAt,
           (SELECT STRING_AGG(r.Name, ',') FROM dbo.UserRoles ur
            JOIN dbo.Roles r ON r.RoleId = ur.RoleId WHERE ur.UserId = u.UserId) AS Roles
    FROM dbo.Users u
    WHERE u.UserId = @UserId AND u.IsDeleted = 0;
END;
GO

/* Login lookup by email OR phone — includes password hash */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetForLogin @Identifier VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 u.UserId, u.PublicId, u.FullName, u.Email, u.Phone, u.PasswordHash,
           u.PreferredLanguage, u.IsActive, u.IsPhoneVerified, u.ProfileImageUrl,
           (SELECT STRING_AGG(r.Name, ',') FROM dbo.UserRoles ur
            JOIN dbo.Roles r ON r.RoleId = ur.RoleId WHERE ur.UserId = u.UserId) AS Roles
    FROM dbo.Users u
    WHERE (u.Email = @Identifier OR u.Phone = @Identifier) AND u.IsDeleted = 0;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_List
    @Page INT = 1, @PageSize INT = 20,
    @Search NVARCHAR(150) = NULL, @Role VARCHAR(50) = NULL,
    @IsActive BIT = NULL, @SortBy VARCHAR(20) = 'CreatedAt', @SortDir VARCHAR(4) = 'DESC'
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.PublicId, u.FullName, u.Email, u.Phone, u.NationalId,
           u.ProfileImageUrl, u.IsActive, u.IsPhoneVerified, u.LastLoginAt, u.CreatedAt,
           (SELECT STRING_AGG(r.Name, ',') FROM dbo.UserRoles ur
            JOIN dbo.Roles r ON r.RoleId = ur.RoleId WHERE ur.UserId = u.UserId) AS Roles,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.Users u
    WHERE u.IsDeleted = 0
      AND (@IsActive IS NULL OR u.IsActive = @IsActive)
      AND (@Search IS NULL OR u.FullName LIKE '%' + @Search + '%'
           OR u.Email LIKE '%' + @Search + '%' OR u.Phone LIKE '%' + @Search + '%')
      AND (@Role IS NULL OR EXISTS (
            SELECT 1 FROM dbo.UserRoles ur JOIN dbo.Roles r ON r.RoleId = ur.RoleId
            WHERE ur.UserId = u.UserId AND r.Name = @Role))
    ORDER BY
        CASE WHEN @SortBy = 'FullName' AND @SortDir = 'ASC'  THEN u.FullName END ASC,
        CASE WHEN @SortBy = 'FullName' AND @SortDir = 'DESC' THEN u.FullName END DESC,
        CASE WHEN @SortBy = 'CreatedAt' AND @SortDir = 'ASC' THEN u.CreatedAt END ASC,
        u.CreatedAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_Update
    @UserId INT, @FullName NVARCHAR(150) = NULL, @Email VARCHAR(255) = NULL,
    @NationalId VARCHAR(20) = NULL, @ProfileImageUrl VARCHAR(500) = NULL,
    @Address NVARCHAR(300) = NULL, @DateOfBirth DATE = NULL, @Gender VARCHAR(10) = NULL,
    @PreferredLanguage VARCHAR(2) = NULL, @FirebaseUid VARCHAR(128) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @Email IS NOT NULL AND EXISTS
        (SELECT 1 FROM dbo.Users WHERE Email = @Email AND UserId <> @UserId AND IsDeleted = 0)
        THROW 50002, 'EMAIL_ALREADY_EXISTS', 1;

    UPDATE dbo.Users SET
        FullName          = ISNULL(@FullName, FullName),
        Email             = ISNULL(@Email, Email),
        NationalId        = ISNULL(@NationalId, NationalId),
        ProfileImageUrl   = ISNULL(@ProfileImageUrl, ProfileImageUrl),
        Address           = ISNULL(@Address, Address),
        DateOfBirth       = ISNULL(@DateOfBirth, DateOfBirth),
        Gender            = ISNULL(@Gender, Gender),
        PreferredLanguage = ISNULL(@PreferredLanguage, PreferredLanguage),
        FirebaseUid       = ISNULL(@FirebaseUid, FirebaseUid),
        UpdatedAt         = SYSUTCDATETIME()
    WHERE UserId = @UserId AND IsDeleted = 0;

    EXEC dbo.sp_User_GetById @UserId = @UserId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_UpdatePassword @UserId INT, @PasswordHash VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users SET PasswordHash = @PasswordHash, UpdatedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId AND IsDeleted = 0;
    -- Invalidate all sessions after a password change
    UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId AND RevokedAt IS NULL;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_SetActive @UserId INT, @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users SET IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME() WHERE UserId = @UserId;
    IF @IsActive = 0
        UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME()
        WHERE UserId = @UserId AND RevokedAt IS NULL;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_SoftDelete @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users
    SET IsDeleted = 1, IsActive = 0, DeletedAt = SYSUTCDATETIME(),
        Email = CONCAT('deleted_', UserId, '_', Email),
        Phone = CONCAT('del_', UserId, '_', Phone),
        UpdatedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId AND IsDeleted = 0;

    UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId AND RevokedAt IS NULL;
    DELETE FROM dbo.UserDevices WHERE UserId = @UserId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_UpdateLastLogin @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users SET LastLoginAt = SYSUTCDATETIME() WHERE UserId = @UserId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_MarkPhoneVerified @UserId INT, @FirebaseUid VARCHAR(128) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users
    SET IsPhoneVerified = 1, FirebaseUid = ISNULL(@FirebaseUid, FirebaseUid), UpdatedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId;
END;
GO

/* ----------------------- ROLES ----------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Role_List
AS
BEGIN
    SET NOCOUNT ON;
    SELECT RoleId, Name, NameAr, Description FROM dbo.Roles ORDER BY RoleId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_UserRole_Assign @UserId INT, @RoleName VARCHAR(50), @BuildingId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @RoleId INT = (SELECT RoleId FROM dbo.Roles WHERE Name = @RoleName);
    IF @RoleId IS NULL THROW 50003, 'ROLE_NOT_FOUND', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserId AND RoleId = @RoleId)
        INSERT INTO dbo.UserRoles (UserId, RoleId, BuildingId) VALUES (@UserId, @RoleId, @BuildingId);
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_UserRole_Remove @UserId INT, @RoleName VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    DELETE ur FROM dbo.UserRoles ur
    JOIN dbo.Roles r ON r.RoleId = ur.RoleId
    WHERE ur.UserId = @UserId AND r.Name = @RoleName;
END;
GO

/* ------------------- REFRESH TOKENS ------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_RefreshToken_Create
    @UserId INT, @TokenHash VARCHAR(255), @ExpiresAt DATETIME2(0), @CreatedByIp VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.RefreshTokens (UserId, TokenHash, ExpiresAt, CreatedByIp)
    VALUES (@UserId, @TokenHash, @ExpiresAt, @CreatedByIp);
    SELECT SCOPE_IDENTITY() AS TokenId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_RefreshToken_GetValid @TokenHash VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT rt.TokenId, rt.UserId, rt.TokenHash, rt.ExpiresAt, rt.RevokedAt,
           u.IsActive, u.IsDeleted
    FROM dbo.RefreshTokens rt
    JOIN dbo.Users u ON u.UserId = rt.UserId
    WHERE rt.TokenHash = @TokenHash;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_RefreshToken_Rotate
    @OldTokenHash VARCHAR(255), @NewTokenHash VARCHAR(255),
    @ExpiresAt DATETIME2(0), @CreatedByIp VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    DECLARE @UserId INT;
    SELECT @UserId = UserId FROM dbo.RefreshTokens
    WHERE TokenHash = @OldTokenHash AND RevokedAt IS NULL AND ExpiresAt > SYSUTCDATETIME();

    IF @UserId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50010, 'INVALID_REFRESH_TOKEN', 1;
    END

    UPDATE dbo.RefreshTokens
    SET RevokedAt = SYSUTCDATETIME(), ReplacedByTokenHash = @NewTokenHash
    WHERE TokenHash = @OldTokenHash;

    INSERT INTO dbo.RefreshTokens (UserId, TokenHash, ExpiresAt, CreatedByIp)
    VALUES (@UserId, @NewTokenHash, @ExpiresAt, @CreatedByIp);

    COMMIT TRANSACTION;
    SELECT @UserId AS UserId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_RefreshToken_Revoke @TokenHash VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME()
    WHERE TokenHash = @TokenHash AND RevokedAt IS NULL;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_RefreshToken_RevokeAllForUser @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId AND RevokedAt IS NULL;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_RefreshToken_Cleanup
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.RefreshTokens WHERE ExpiresAt < DATEADD(DAY, -30, SYSUTCDATETIME());
END;
GO

/* ------------------ PASSWORD RESET ------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_PasswordReset_Create
    @UserId INT, @TokenHash VARCHAR(255), @ExpiresAt DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.PasswordResetTokens SET UsedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId AND UsedAt IS NULL;
    INSERT INTO dbo.PasswordResetTokens (UserId, TokenHash, ExpiresAt)
    VALUES (@UserId, @TokenHash, @ExpiresAt);
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_PasswordReset_GetValid @TokenHash VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Id, UserId, ExpiresAt, UsedAt
    FROM dbo.PasswordResetTokens
    WHERE TokenHash = @TokenHash AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_PasswordReset_MarkUsed @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.PasswordResetTokens SET UsedAt = SYSUTCDATETIME() WHERE Id = @Id;
END;
GO

/* --------------------- DEVICES ----------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_UserDevice_Register
    @UserId INT, @DeviceKey VARCHAR(128), @FcmToken VARCHAR(512) = NULL,
    @Platform VARCHAR(10), @AppVersion VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    MERGE dbo.UserDevices AS t
    USING (SELECT @UserId AS UserId, @DeviceKey AS DeviceKey) AS s
        ON t.UserId = s.UserId AND t.DeviceKey = s.DeviceKey
    WHEN MATCHED THEN UPDATE SET
        FcmToken = ISNULL(@FcmToken, t.FcmToken),
        Platform = @Platform, AppVersion = @AppVersion, LastSeenAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (UserId, DeviceKey, FcmToken, Platform, AppVersion)
        VALUES (@UserId, @DeviceKey, @FcmToken, @Platform, @AppVersion);
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_UserDevice_Remove @UserId INT, @DeviceKey VARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.UserDevices WHERE UserId = @UserId AND DeviceKey = @DeviceKey;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_UserDevice_GetTokens @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT FcmToken FROM dbo.UserDevices
    WHERE UserId = @UserId AND FcmToken IS NOT NULL;
END;
GO

/* --------------------- SETTINGS ---------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_UserSettings_Get @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.UserSettings WHERE UserId = @UserId)
        INSERT INTO dbo.UserSettings (UserId) VALUES (@UserId);
    SELECT UserId, PushNotifications, EmailNotifications, SmsNotifications,
           Theme, BiometricEnabled, UpdatedAt
    FROM dbo.UserSettings WHERE UserId = @UserId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_UserSettings_Update
    @UserId INT, @PushNotifications BIT = NULL, @EmailNotifications BIT = NULL,
    @SmsNotifications BIT = NULL, @Theme VARCHAR(10) = NULL, @BiometricEnabled BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.UserSettings WHERE UserId = @UserId)
        INSERT INTO dbo.UserSettings (UserId) VALUES (@UserId);
    UPDATE dbo.UserSettings SET
        PushNotifications  = ISNULL(@PushNotifications, PushNotifications),
        EmailNotifications = ISNULL(@EmailNotifications, EmailNotifications),
        SmsNotifications   = ISNULL(@SmsNotifications, SmsNotifications),
        Theme              = ISNULL(@Theme, Theme),
        BiometricEnabled   = ISNULL(@BiometricEnabled, BiometricEnabled),
        UpdatedAt          = SYSUTCDATETIME()
    WHERE UserId = @UserId;
    EXEC dbo.sp_UserSettings_Get @UserId = @UserId;
END;
GO

/* ---------------- EMERGENCY CONTACTS ------------------ */

CREATE OR ALTER PROCEDURE dbo.sp_EmergencyContact_Create
    @UserId INT, @Name NVARCHAR(150), @Phone VARCHAR(20), @Relationship NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.EmergencyContacts (UserId, Name, Phone, Relationship)
    VALUES (@UserId, @Name, @Phone, @Relationship);
    SELECT ContactId, UserId, Name, Phone, Relationship, CreatedAt
    FROM dbo.EmergencyContacts WHERE ContactId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_EmergencyContact_List @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ContactId, UserId, Name, Phone, Relationship, CreatedAt
    FROM dbo.EmergencyContacts WHERE UserId = @UserId ORDER BY CreatedAt;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_EmergencyContact_Delete @ContactId INT, @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.EmergencyContacts WHERE ContactId = @ContactId AND UserId = @UserId;
END;
GO

/* ----------------------- AUDIT ------------------------ */

CREATE OR ALTER PROCEDURE dbo.sp_Audit_Insert
    @UserId INT = NULL, @Action VARCHAR(50), @EntityType VARCHAR(50) = NULL,
    @EntityId VARCHAR(50) = NULL, @OldValues NVARCHAR(MAX) = NULL,
    @NewValues NVARCHAR(MAX) = NULL, @IpAddress VARCHAR(45) = NULL, @UserAgent VARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.AuditLogs (UserId, Action, EntityType, EntityId, OldValues, NewValues, IpAddress, UserAgent)
    VALUES (@UserId, @Action, @EntityType, @EntityId, @OldValues, @NewValues, @IpAddress, @UserAgent);
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Audit_List
    @Page INT = 1, @PageSize INT = 50, @UserId INT = NULL,
    @Action VARCHAR(50) = NULL, @EntityType VARCHAR(50) = NULL,
    @FromDate DATETIME2(0) = NULL, @ToDate DATETIME2(0) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT al.AuditId, al.UserId, u.FullName AS UserName, al.Action, al.EntityType,
           al.EntityId, al.OldValues, al.NewValues, al.IpAddress, al.UserAgent, al.CreatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.AuditLogs al
    LEFT JOIN dbo.Users u ON u.UserId = al.UserId
    WHERE (@UserId IS NULL OR al.UserId = @UserId)
      AND (@Action IS NULL OR al.Action = @Action)
      AND (@EntityType IS NULL OR al.EntityType = @EntityType)
      AND (@FromDate IS NULL OR al.CreatedAt >= @FromDate)
      AND (@ToDate IS NULL OR al.CreatedAt <= @ToDate)
    ORDER BY al.CreatedAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

PRINT 'Auth/User procedures created.';
GO
