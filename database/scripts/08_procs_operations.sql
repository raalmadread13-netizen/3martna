/* ============================================================
   3martna (عمارتنا) — Stored Procedures: Operations
   Maintenance, Complaints, Visitors, Security, Announcements,
   Notifications, Documents, Chat, Schedules, Global Search
   ============================================================ */
USE Amartna;
GO

/* -------------------- MAINTENANCE --------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Maintenance_Create
    @BuildingId INT, @ApartmentId INT = NULL, @RequestedByUserId INT,
    @Title NVARCHAR(200), @Description NVARCHAR(2000) = NULL,
    @Category VARCHAR(20), @Priority VARCHAR(10) = 'Medium'
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.MaintenanceRequests (BuildingId, ApartmentId, RequestedByUserId,
                                         Title, Description, Category, Priority)
    VALUES (@BuildingId, @ApartmentId, @RequestedByUserId, @Title, @Description, @Category, @Priority);
    DECLARE @RequestId INT = SCOPE_IDENTITY();
    EXEC dbo.sp_Maintenance_GetById @RequestId = @RequestId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Maintenance_GetById @RequestId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT m.RequestId, m.BuildingId, b.Name AS BuildingName, b.Address AS BuildingAddress,
           b.Latitude, b.Longitude,
           m.ApartmentId, a.ApartmentNumber,
           m.RequestedByUserId, ru.FullName AS RequestedByName, ru.Phone AS RequestedByPhone,
           m.Title, m.Description, m.Category, m.Priority, m.Status,
           m.ScheduledAt, m.StartedAt, m.CompletedAt, m.CompletionNotes,
           m.Rating, m.RatingComment, m.CreatedAt, m.UpdatedAt,
           ma.AssignedToUserId, tu.FullName AS TechnicianName, tu.Phone AS TechnicianPhone,
           ma.AssignmentId, ma.CheckInAt, ma.CheckOutAt
    FROM dbo.MaintenanceRequests m
    JOIN dbo.Buildings b ON b.BuildingId = m.BuildingId
    LEFT JOIN dbo.Apartments a ON a.ApartmentId = m.ApartmentId
    JOIN dbo.Users ru ON ru.UserId = m.RequestedByUserId
    LEFT JOIN dbo.MaintenanceAssignments ma ON ma.RequestId = m.RequestId AND ma.UnassignedAt IS NULL
    LEFT JOIN dbo.Users tu ON tu.UserId = ma.AssignedToUserId
    WHERE m.RequestId = @RequestId;

    SELECT AttachmentId, FileUrl, FileType, Stage, UploadedByUserId, CreatedAt
    FROM dbo.MaintenanceAttachments WHERE RequestId = @RequestId ORDER BY CreatedAt;

    SELECT mc.CommentId, mc.UserId, u.FullName, u.ProfileImageUrl, mc.Comment, mc.CreatedAt
    FROM dbo.MaintenanceComments mc JOIN dbo.Users u ON u.UserId = mc.UserId
    WHERE mc.RequestId = @RequestId ORDER BY mc.CreatedAt;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Maintenance_List
    @Page INT = 1, @PageSize INT = 20, @BuildingId INT = NULL,
    @RequestedByUserId INT = NULL, @AssignedToUserId INT = NULL,
    @Status VARCHAR(20) = NULL, @Priority VARCHAR(10) = NULL,
    @Category VARCHAR(20) = NULL, @Search NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT m.RequestId, m.BuildingId, b.Name AS BuildingName,
           m.ApartmentId, a.ApartmentNumber,
           m.RequestedByUserId, ru.FullName AS RequestedByName,
           m.Title, m.Category, m.Priority, m.Status, m.ScheduledAt, m.CreatedAt,
           ma.AssignedToUserId, tu.FullName AS TechnicianName,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.MaintenanceRequests m
    JOIN dbo.Buildings b ON b.BuildingId = m.BuildingId
    LEFT JOIN dbo.Apartments a ON a.ApartmentId = m.ApartmentId
    JOIN dbo.Users ru ON ru.UserId = m.RequestedByUserId
    LEFT JOIN dbo.MaintenanceAssignments ma ON ma.RequestId = m.RequestId AND ma.UnassignedAt IS NULL
    LEFT JOIN dbo.Users tu ON tu.UserId = ma.AssignedToUserId
    WHERE (@BuildingId IS NULL OR m.BuildingId = @BuildingId)
      AND (@RequestedByUserId IS NULL OR m.RequestedByUserId = @RequestedByUserId)
      AND (@AssignedToUserId IS NULL OR ma.AssignedToUserId = @AssignedToUserId)
      AND (@Status IS NULL OR m.Status = @Status)
      AND (@Priority IS NULL OR m.Priority = @Priority)
      AND (@Category IS NULL OR m.Category = @Category)
      AND (@Search IS NULL OR m.Title LIKE '%' + @Search + '%')
    ORDER BY CASE m.Priority WHEN 'Emergency' THEN 0 WHEN 'High' THEN 1
                             WHEN 'Medium' THEN 2 ELSE 3 END, m.CreatedAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Maintenance_Assign
    @RequestId INT, @AssignedToUserId INT, @AssignedByUserId INT, @ScheduledAt DATETIME2(0) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    UPDATE dbo.MaintenanceAssignments SET UnassignedAt = SYSUTCDATETIME()
    WHERE RequestId = @RequestId AND UnassignedAt IS NULL;

    INSERT INTO dbo.MaintenanceAssignments (RequestId, AssignedToUserId, AssignedByUserId)
    VALUES (@RequestId, @AssignedToUserId, @AssignedByUserId);

    UPDATE dbo.MaintenanceRequests
    SET Status = 'Assigned', ScheduledAt = ISNULL(@ScheduledAt, ScheduledAt), UpdatedAt = SYSUTCDATETIME()
    WHERE RequestId = @RequestId;

    COMMIT TRANSACTION;
    EXEC dbo.sp_Maintenance_GetById @RequestId = @RequestId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Maintenance_UpdateStatus
    @RequestId INT, @Status VARCHAR(20), @CompletionNotes NVARCHAR(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.MaintenanceRequests SET
        Status = @Status,
        StartedAt = CASE WHEN @Status = 'InProgress' AND StartedAt IS NULL
                         THEN SYSUTCDATETIME() ELSE StartedAt END,
        CompletedAt = CASE WHEN @Status = 'Completed' THEN SYSUTCDATETIME() ELSE CompletedAt END,
        CompletionNotes = ISNULL(@CompletionNotes, CompletionNotes),
        UpdatedAt = SYSUTCDATETIME()
    WHERE RequestId = @RequestId;
    EXEC dbo.sp_Maintenance_GetById @RequestId = @RequestId;
END;
GO

/* GPS check-in by the assigned technician */
CREATE OR ALTER PROCEDURE dbo.sp_Maintenance_CheckIn
    @RequestId INT, @UserId INT, @Latitude DECIMAL(9,6), @Longitude DECIMAL(9,6)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @AssignmentId INT;
    SELECT @AssignmentId = AssignmentId FROM dbo.MaintenanceAssignments
    WHERE RequestId = @RequestId AND AssignedToUserId = @UserId AND UnassignedAt IS NULL;

    IF @AssignmentId IS NULL THROW 50060, 'NOT_ASSIGNED_TO_REQUEST', 1;

    UPDATE dbo.MaintenanceAssignments
    SET CheckInAt = SYSUTCDATETIME(), CheckInLatitude = @Latitude, CheckInLongitude = @Longitude
    WHERE AssignmentId = @AssignmentId;

    UPDATE dbo.MaintenanceRequests
    SET Status = 'InProgress', StartedAt = ISNULL(StartedAt, SYSUTCDATETIME()), UpdatedAt = SYSUTCDATETIME()
    WHERE RequestId = @RequestId AND Status = 'Assigned';

    EXEC dbo.sp_Maintenance_GetById @RequestId = @RequestId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Maintenance_CheckOut @RequestId INT, @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.MaintenanceAssignments SET CheckOutAt = SYSUTCDATETIME()
    WHERE RequestId = @RequestId AND AssignedToUserId = @UserId AND UnassignedAt IS NULL;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Maintenance_AddAttachment
    @RequestId INT, @UploadedByUserId INT, @FileUrl VARCHAR(500),
    @FileType VARCHAR(20) = 'image', @Stage VARCHAR(10) = 'Before'
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.MaintenanceAttachments (RequestId, UploadedByUserId, FileUrl, FileType, Stage)
    VALUES (@RequestId, @UploadedByUserId, @FileUrl, @FileType, @Stage);
    SELECT AttachmentId, RequestId, FileUrl, FileType, Stage, CreatedAt
    FROM dbo.MaintenanceAttachments WHERE AttachmentId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Maintenance_AddComment
    @RequestId INT, @UserId INT, @Comment NVARCHAR(1000)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.MaintenanceComments (RequestId, UserId, Comment)
    VALUES (@RequestId, @UserId, @Comment);
    SELECT mc.CommentId, mc.RequestId, mc.UserId, u.FullName, mc.Comment, mc.CreatedAt
    FROM dbo.MaintenanceComments mc JOIN dbo.Users u ON u.UserId = mc.UserId
    WHERE mc.CommentId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Maintenance_Rate
    @RequestId INT, @UserId INT, @Rating INT, @RatingComment NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.MaintenanceRequests
    SET Rating = @Rating, RatingComment = @RatingComment, UpdatedAt = SYSUTCDATETIME()
    WHERE RequestId = @RequestId AND RequestedByUserId = @UserId AND Status = 'Completed';
    IF @@ROWCOUNT = 0 THROW 50061, 'CANNOT_RATE_REQUEST', 1;
END;
GO

/* --------------------- COMPLAINTS --------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Complaint_Create
    @BuildingId INT, @ApartmentId INT = NULL, @SubmittedByUserId INT = NULL,
    @IsAnonymous BIT = 0, @Category VARCHAR(20), @Subject NVARCHAR(200),
    @Description NVARCHAR(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Complaints (BuildingId, ApartmentId, SubmittedByUserId, IsAnonymous,
                                Category, Subject, Description)
    VALUES (@BuildingId, @ApartmentId,
            CASE WHEN @IsAnonymous = 1 THEN NULL ELSE @SubmittedByUserId END,
            @IsAnonymous, @Category, @Subject, @Description);
    DECLARE @ComplaintId INT = SCOPE_IDENTITY();
    EXEC dbo.sp_Complaint_GetById @ComplaintId = @ComplaintId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Complaint_GetById @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.ComplaintId, c.BuildingId, b.Name AS BuildingName,
           c.ApartmentId, a.ApartmentNumber,
           c.SubmittedByUserId,
           CASE WHEN c.IsAnonymous = 1 THEN NULL ELSE u.FullName END AS SubmittedByName,
           c.IsAnonymous, c.Category, c.Subject, c.Description, c.Status,
           c.Resolution, c.ResolvedByUserId, ru.FullName AS ResolvedByName,
           c.ResolvedAt, c.CreatedAt, c.UpdatedAt
    FROM dbo.Complaints c
    JOIN dbo.Buildings b ON b.BuildingId = c.BuildingId
    LEFT JOIN dbo.Apartments a ON a.ApartmentId = c.ApartmentId
    LEFT JOIN dbo.Users u ON u.UserId = c.SubmittedByUserId
    LEFT JOIN dbo.Users ru ON ru.UserId = c.ResolvedByUserId
    WHERE c.ComplaintId = @ComplaintId;

    SELECT cc.CommentId, cc.UserId, u.FullName, u.ProfileImageUrl,
           cc.Comment, cc.IsInternal, cc.CreatedAt
    FROM dbo.ComplaintComments cc JOIN dbo.Users u ON u.UserId = cc.UserId
    WHERE cc.ComplaintId = @ComplaintId ORDER BY cc.CreatedAt;

    SELECT AttachmentId, FileUrl, FileType, CreatedAt
    FROM dbo.ComplaintAttachments WHERE ComplaintId = @ComplaintId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Complaint_List
    @Page INT = 1, @PageSize INT = 20, @BuildingId INT = NULL,
    @SubmittedByUserId INT = NULL, @Status VARCHAR(20) = NULL,
    @Category VARCHAR(20) = NULL, @Search NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.ComplaintId, c.BuildingId, b.Name AS BuildingName,
           c.ApartmentId, a.ApartmentNumber,
           CASE WHEN c.IsAnonymous = 1 THEN NULL ELSE u.FullName END AS SubmittedByName,
           c.IsAnonymous, c.Category, c.Subject, c.Status, c.CreatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.Complaints c
    JOIN dbo.Buildings b ON b.BuildingId = c.BuildingId
    LEFT JOIN dbo.Apartments a ON a.ApartmentId = c.ApartmentId
    LEFT JOIN dbo.Users u ON u.UserId = c.SubmittedByUserId
    WHERE (@BuildingId IS NULL OR c.BuildingId = @BuildingId)
      AND (@SubmittedByUserId IS NULL OR c.SubmittedByUserId = @SubmittedByUserId)
      AND (@Status IS NULL OR c.Status = @Status)
      AND (@Category IS NULL OR c.Category = @Category)
      AND (@Search IS NULL OR c.Subject LIKE '%' + @Search + '%')
    ORDER BY c.CreatedAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Complaint_UpdateStatus
    @ComplaintId INT, @Status VARCHAR(20), @Resolution NVARCHAR(2000) = NULL,
    @ResolvedByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Complaints SET
        Status = @Status,
        Resolution = ISNULL(@Resolution, Resolution),
        ResolvedByUserId = CASE WHEN @Status IN ('Resolved','Dismissed')
                                THEN @ResolvedByUserId ELSE ResolvedByUserId END,
        ResolvedAt = CASE WHEN @Status IN ('Resolved','Dismissed')
                          THEN SYSUTCDATETIME() ELSE ResolvedAt END,
        UpdatedAt = SYSUTCDATETIME()
    WHERE ComplaintId = @ComplaintId;
    EXEC dbo.sp_Complaint_GetById @ComplaintId = @ComplaintId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Complaint_AddComment
    @ComplaintId INT, @UserId INT, @Comment NVARCHAR(1000), @IsInternal BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.ComplaintComments (ComplaintId, UserId, Comment, IsInternal)
    VALUES (@ComplaintId, @UserId, @Comment, @IsInternal);
    SELECT cc.CommentId, cc.ComplaintId, cc.UserId, u.FullName, cc.Comment, cc.IsInternal, cc.CreatedAt
    FROM dbo.ComplaintComments cc JOIN dbo.Users u ON u.UserId = cc.UserId
    WHERE cc.CommentId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Complaint_AddAttachment
    @ComplaintId INT, @FileUrl VARCHAR(500), @FileType VARCHAR(20) = 'image'
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.ComplaintAttachments (ComplaintId, FileUrl, FileType)
    VALUES (@ComplaintId, @FileUrl, @FileType);
    SELECT AttachmentId, ComplaintId, FileUrl, FileType, CreatedAt
    FROM dbo.ComplaintAttachments WHERE AttachmentId = SCOPE_IDENTITY();
END;
GO

/* ---------------------- VISITORS ---------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Visitor_Create
    @ApartmentId INT, @HostUserId INT, @VisitorName NVARCHAR(150),
    @VisitorPhone VARCHAR(20) = NULL, @VisitorNationalId VARCHAR(20) = NULL,
    @VehiclePlate VARCHAR(20) = NULL, @Purpose NVARCHAR(200) = NULL,
    @ExpectedAt DATETIME2(0), @ExpectedUntil DATETIME2(0) = NULL,
    @AutoApprove BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Visitors (ApartmentId, HostUserId, VisitorName, VisitorPhone,
        VisitorNationalId, VehiclePlate, Purpose, ExpectedAt, ExpectedUntil, Status, ApprovedByUserId)
    VALUES (@ApartmentId, @HostUserId, @VisitorName, @VisitorPhone,
        @VisitorNationalId, @VehiclePlate, @Purpose, @ExpectedAt, @ExpectedUntil,
        CASE WHEN @AutoApprove = 1 THEN 'Approved' ELSE 'Pending' END,
        CASE WHEN @AutoApprove = 1 THEN @HostUserId ELSE NULL END);

    SELECT * FROM dbo.vw_VisitorDetails WHERE VisitorId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Visitor_GetById @VisitorId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.vw_VisitorDetails WHERE VisitorId = @VisitorId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Visitor_List
    @Page INT = 1, @PageSize INT = 20, @BuildingId INT = NULL,
    @HostUserId INT = NULL, @Status VARCHAR(20) = NULL,
    @FromDate DATE = NULL, @ToDate DATE = NULL, @Search NVARCHAR(150) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT v.*, COUNT(*) OVER() AS TotalCount
    FROM dbo.vw_VisitorDetails v
    WHERE (@BuildingId IS NULL OR v.BuildingId = @BuildingId)
      AND (@HostUserId IS NULL OR v.HostUserId = @HostUserId)
      AND (@Status IS NULL OR v.Status = @Status)
      AND (@FromDate IS NULL OR CAST(v.ExpectedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(v.ExpectedAt AS DATE) <= @ToDate)
      AND (@Search IS NULL OR v.VisitorName LIKE '%' + @Search + '%'
           OR v.HostName LIKE '%' + @Search + '%')
    ORDER BY v.ExpectedAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Visitor_UpdateStatus
    @VisitorId INT, @Status VARCHAR(20), @ActionByUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Visitors SET
        Status = @Status,
        ApprovedByUserId = CASE WHEN @Status IN ('Approved','Denied')
                                THEN @ActionByUserId ELSE ApprovedByUserId END
    WHERE VisitorId = @VisitorId;
    SELECT * FROM dbo.vw_VisitorDetails WHERE VisitorId = @VisitorId;
END;
GO

/* Guard scans QR: validate + check in (transactional, logs gate entry) */
CREATE OR ALTER PROCEDURE dbo.sp_Visitor_CheckInByQr
    @QrCode UNIQUEIDENTIFIER, @GuardUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    DECLARE @VisitorId INT, @Status VARCHAR(20), @BuildingId INT, @VisitorName NVARCHAR(150),
            @ExpectedUntil DATETIME2(0);
    SELECT @VisitorId = v.VisitorId, @Status = v.Status, @VisitorName = v.VisitorName,
           @ExpectedUntil = v.ExpectedUntil, @BuildingId = a.BuildingId
    FROM dbo.Visitors v JOIN dbo.Apartments a ON a.ApartmentId = v.ApartmentId
    WHERE v.QrCode = @QrCode;

    IF @VisitorId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50070, 'INVALID_QR_CODE', 1;
    END
    IF @Status <> 'Approved'
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50071, 'VISITOR_NOT_APPROVED', 1;
    END
    IF @ExpectedUntil IS NOT NULL AND @ExpectedUntil < SYSUTCDATETIME()
    BEGIN
        UPDATE dbo.Visitors SET Status = 'Expired' WHERE VisitorId = @VisitorId;
        COMMIT TRANSACTION;
        THROW 50072, 'VISITOR_PASS_EXPIRED', 1;
    END

    UPDATE dbo.Visitors
    SET Status = 'CheckedIn', CheckedInAt = SYSUTCDATETIME(), CheckedInByUserId = @GuardUserId
    WHERE VisitorId = @VisitorId;

    INSERT INTO dbo.GateLogs (BuildingId, VisitorId, LoggedByUserId, EntryType, PersonName)
    VALUES (@BuildingId, @VisitorId, @GuardUserId, 'VisitorIn', @VisitorName);

    COMMIT TRANSACTION;
    SELECT * FROM dbo.vw_VisitorDetails WHERE VisitorId = @VisitorId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Visitor_CheckOut @VisitorId INT, @GuardUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    DECLARE @BuildingId INT, @VisitorName NVARCHAR(150);
    SELECT @BuildingId = a.BuildingId, @VisitorName = v.VisitorName
    FROM dbo.Visitors v JOIN dbo.Apartments a ON a.ApartmentId = v.ApartmentId
    WHERE v.VisitorId = @VisitorId AND v.Status = 'CheckedIn';

    IF @BuildingId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50073, 'VISITOR_NOT_CHECKED_IN', 1;
    END

    UPDATE dbo.Visitors
    SET Status = 'CheckedOut', CheckedOutAt = SYSUTCDATETIME(), CheckedOutByUserId = @GuardUserId
    WHERE VisitorId = @VisitorId;

    INSERT INTO dbo.GateLogs (BuildingId, VisitorId, LoggedByUserId, EntryType, PersonName)
    VALUES (@BuildingId, @VisitorId, @GuardUserId, 'VisitorOut', @VisitorName);

    COMMIT TRANSACTION;
    SELECT * FROM dbo.vw_VisitorDetails WHERE VisitorId = @VisitorId;
END;
GO

/* ---------------------- SECURITY ----------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_GateLog_Create
    @BuildingId INT, @LoggedByUserId INT, @EntryType VARCHAR(20),
    @PersonName NVARCHAR(150) = NULL, @Notes NVARCHAR(500) = NULL, @VisitorId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.GateLogs (BuildingId, VisitorId, LoggedByUserId, EntryType, PersonName, Notes)
    VALUES (@BuildingId, @VisitorId, @LoggedByUserId, @EntryType, @PersonName, @Notes);
    SELECT g.GateLogId, g.BuildingId, g.VisitorId, g.EntryType, g.PersonName, g.Notes,
           g.LoggedAt, u.FullName AS LoggedByName
    FROM dbo.GateLogs g JOIN dbo.Users u ON u.UserId = g.LoggedByUserId
    WHERE g.GateLogId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GateLog_List
    @Page INT = 1, @PageSize INT = 50, @BuildingId INT,
    @FromDate DATETIME2(0) = NULL, @ToDate DATETIME2(0) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT g.GateLogId, g.BuildingId, g.VisitorId, g.EntryType, g.PersonName, g.Notes,
           g.LoggedAt, u.FullName AS LoggedByName,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.GateLogs g JOIN dbo.Users u ON u.UserId = g.LoggedByUserId
    WHERE g.BuildingId = @BuildingId
      AND (@FromDate IS NULL OR g.LoggedAt >= @FromDate)
      AND (@ToDate IS NULL OR g.LoggedAt <= @ToDate)
    ORDER BY g.LoggedAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Incident_Create
    @BuildingId INT, @ReportedByUserId INT, @Severity VARCHAR(10),
    @Title NVARCHAR(200), @Description NVARCHAR(2000) = NULL,
    @Location NVARCHAR(200) = NULL, @OccurredAt DATETIME2(0), @AttachmentUrl VARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.IncidentReports (BuildingId, ReportedByUserId, Severity, Title,
                                     Description, Location, OccurredAt, AttachmentUrl)
    VALUES (@BuildingId, @ReportedByUserId, @Severity, @Title,
            @Description, @Location, @OccurredAt, @AttachmentUrl);

    SELECT i.IncidentId, i.BuildingId, b.Name AS BuildingName, i.Severity, i.Title,
           i.Description, i.Location, i.OccurredAt, i.Status, i.AttachmentUrl,
           u.FullName AS ReportedByName, i.CreatedAt
    FROM dbo.IncidentReports i
    JOIN dbo.Buildings b ON b.BuildingId = i.BuildingId
    JOIN dbo.Users u ON u.UserId = i.ReportedByUserId
    WHERE i.IncidentId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Incident_List
    @Page INT = 1, @PageSize INT = 20, @BuildingId INT = NULL,
    @Status VARCHAR(25) = NULL, @Severity VARCHAR(10) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT i.IncidentId, i.BuildingId, b.Name AS BuildingName, i.Severity, i.Title,
           i.Location, i.OccurredAt, i.Status, u.FullName AS ReportedByName, i.CreatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.IncidentReports i
    JOIN dbo.Buildings b ON b.BuildingId = i.BuildingId
    JOIN dbo.Users u ON u.UserId = i.ReportedByUserId
    WHERE (@BuildingId IS NULL OR i.BuildingId = @BuildingId)
      AND (@Status IS NULL OR i.Status = @Status)
      AND (@Severity IS NULL OR i.Severity = @Severity)
    ORDER BY i.OccurredAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Incident_UpdateStatus
    @IncidentId INT, @Status VARCHAR(25), @ResolutionNotes NVARCHAR(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.IncidentReports SET
        Status = @Status,
        ResolutionNotes = ISNULL(@ResolutionNotes, ResolutionNotes),
        ResolvedAt = CASE WHEN @Status IN ('Resolved','Closed') THEN SYSUTCDATETIME() ELSE ResolvedAt END
    WHERE IncidentId = @IncidentId;
END;
GO

/* -------------------- ANNOUNCEMENTS -------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Announcement_Create
    @BuildingId INT = NULL, @CreatedByUserId INT, @Title NVARCHAR(200),
    @Body NVARCHAR(4000), @Audience VARCHAR(20) = 'All',
    @IsPinned BIT = 0, @ExpiresAt DATETIME2(0) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Announcements (BuildingId, CreatedByUserId, Title, Body, Audience, IsPinned, ExpiresAt)
    VALUES (@BuildingId, @CreatedByUserId, @Title, @Body, @Audience, @IsPinned, @ExpiresAt);

    SELECT an.AnnouncementId, an.BuildingId, b.Name AS BuildingName, an.Title, an.Body,
           an.Audience, an.IsPinned, an.PublishedAt, an.ExpiresAt, u.FullName AS CreatedByName
    FROM dbo.Announcements an
    LEFT JOIN dbo.Buildings b ON b.BuildingId = an.BuildingId
    JOIN dbo.Users u ON u.UserId = an.CreatedByUserId
    WHERE an.AnnouncementId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Announcement_List
    @Page INT = 1, @PageSize INT = 20, @BuildingId INT = NULL, @IncludeExpired BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT an.AnnouncementId, an.BuildingId, b.Name AS BuildingName, an.Title, an.Body,
           an.Audience, an.IsPinned, an.PublishedAt, an.ExpiresAt, u.FullName AS CreatedByName,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.Announcements an
    LEFT JOIN dbo.Buildings b ON b.BuildingId = an.BuildingId
    JOIN dbo.Users u ON u.UserId = an.CreatedByUserId
    WHERE (an.BuildingId IS NULL OR @BuildingId IS NULL OR an.BuildingId = @BuildingId)
      AND (@IncludeExpired = 1 OR an.ExpiresAt IS NULL OR an.ExpiresAt > SYSUTCDATETIME())
    ORDER BY an.IsPinned DESC, an.PublishedAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Announcement_Delete @AnnouncementId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.Announcements WHERE AnnouncementId = @AnnouncementId;
END;
GO

/* -------------------- NOTIFICATIONS -------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Notification_Create
    @UserId INT, @Title NVARCHAR(200), @Body NVARCHAR(1000) = NULL,
    @NotifType VARCHAR(20) = 'System', @EntityType VARCHAR(30) = NULL, @EntityId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Notifications (UserId, Title, Body, NotifType, EntityType, EntityId)
    VALUES (@UserId, @Title, @Body, @NotifType, @EntityType, @EntityId);
    SELECT NotificationId, UserId, Title, Body, NotifType, EntityType, EntityId, IsRead, CreatedAt
    FROM dbo.Notifications WHERE NotificationId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Notification_List
    @UserId INT, @Page INT = 1, @PageSize INT = 20, @UnreadOnly BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT NotificationId, Title, Body, NotifType, EntityType, EntityId, IsRead, ReadAt, CreatedAt,
           COUNT(*) OVER() AS TotalCount,
           SUM(CASE WHEN IsRead = 0 THEN 1 ELSE 0 END) OVER() AS UnreadCount
    FROM dbo.Notifications
    WHERE UserId = @UserId AND (@UnreadOnly = 0 OR IsRead = 0)
    ORDER BY CreatedAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Notification_MarkRead
    @UserId INT, @NotificationId BIGINT = NULL   -- NULL = mark all
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Notifications SET IsRead = 1, ReadAt = SYSUTCDATETIME()
    WHERE UserId = @UserId AND IsRead = 0
      AND (@NotificationId IS NULL OR NotificationId = @NotificationId);
END;
GO

/* --------------------- DOCUMENTS ----------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_Document_Create
    @OwnerUserId INT, @BuildingId INT = NULL, @ApartmentId INT = NULL,
    @Category VARCHAR(20), @Title NVARCHAR(200), @FileUrl VARCHAR(500),
    @FileType VARCHAR(20), @FileSizeBytes BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    INSERT INTO dbo.Documents (OwnerUserId, BuildingId, ApartmentId, Category, Title,
                               FileUrl, FileType, FileSizeBytes)
    VALUES (@OwnerUserId, @BuildingId, @ApartmentId, @Category, @Title,
            @FileUrl, @FileType, @FileSizeBytes);

    DECLARE @DocumentId INT = SCOPE_IDENTITY();
    INSERT INTO dbo.DocumentVersions (DocumentId, VersionNumber, FileUrl, UploadedByUserId)
    VALUES (@DocumentId, 1, @FileUrl, @OwnerUserId);

    COMMIT TRANSACTION;
    SELECT DocumentId, OwnerUserId, BuildingId, ApartmentId, Category, Title,
           FileUrl, FileType, FileSizeBytes, CreatedAt
    FROM dbo.Documents WHERE DocumentId = @DocumentId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Document_AddVersion
    @DocumentId INT, @FileUrl VARCHAR(500), @UploadedByUserId INT, @ChangeNote NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    DECLARE @NextVersion INT = ISNULL(
        (SELECT MAX(VersionNumber) FROM dbo.DocumentVersions WHERE DocumentId = @DocumentId), 0) + 1;

    INSERT INTO dbo.DocumentVersions (DocumentId, VersionNumber, FileUrl, UploadedByUserId, ChangeNote)
    VALUES (@DocumentId, @NextVersion, @FileUrl, @UploadedByUserId, @ChangeNote);

    UPDATE dbo.Documents SET FileUrl = @FileUrl, UpdatedAt = SYSUTCDATETIME()
    WHERE DocumentId = @DocumentId;

    COMMIT TRANSACTION;
    SELECT VersionId, DocumentId, VersionNumber, FileUrl, ChangeNote, CreatedAt
    FROM dbo.DocumentVersions
    WHERE DocumentId = @DocumentId AND VersionNumber = @NextVersion;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Document_List
    @Page INT = 1, @PageSize INT = 20, @OwnerUserId INT = NULL,
    @BuildingId INT = NULL, @ApartmentId INT = NULL,
    @Category VARCHAR(20) = NULL, @Search NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT d.DocumentId, d.OwnerUserId, u.FullName AS OwnerName, d.BuildingId, d.ApartmentId,
           d.Category, d.Title, d.FileUrl, d.FileType, d.FileSizeBytes, d.CreatedAt, d.UpdatedAt,
           (SELECT COUNT(*) FROM dbo.DocumentVersions dv WHERE dv.DocumentId = d.DocumentId) AS VersionCount,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.Documents d
    JOIN dbo.Users u ON u.UserId = d.OwnerUserId
    WHERE d.IsArchived = 0
      AND (@OwnerUserId IS NULL OR d.OwnerUserId = @OwnerUserId)
      AND (@BuildingId IS NULL OR d.BuildingId = @BuildingId)
      AND (@ApartmentId IS NULL OR d.ApartmentId = @ApartmentId)
      AND (@Category IS NULL OR d.Category = @Category)
      AND (@Search IS NULL OR d.Title LIKE '%' + @Search + '%')
    ORDER BY d.UpdatedAt DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Document_Versions @DocumentId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT dv.VersionId, dv.VersionNumber, dv.FileUrl, dv.ChangeNote, dv.CreatedAt,
           u.FullName AS UploadedByName
    FROM dbo.DocumentVersions dv JOIN dbo.Users u ON u.UserId = dv.UploadedByUserId
    WHERE dv.DocumentId = @DocumentId ORDER BY dv.VersionNumber DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Document_Archive @DocumentId INT, @OwnerUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Documents SET IsArchived = 1, UpdatedAt = SYSUTCDATETIME()
    WHERE DocumentId = @DocumentId AND OwnerUserId = @OwnerUserId;
END;
GO

/* ------------------------ CHAT ------------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_ChatThread_Create
    @FirebaseKey VARCHAR(128), @ThreadType VARCHAR(10), @Title NVARCHAR(150) = NULL,
    @BuildingId INT = NULL, @CreatedByUserId INT, @MemberIds NVARCHAR(MAX)   -- JSON int array
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    INSERT INTO dbo.ChatThreads (FirebaseKey, ThreadType, Title, BuildingId, CreatedByUserId)
    VALUES (@FirebaseKey, @ThreadType, @Title, @BuildingId, @CreatedByUserId);

    DECLARE @ThreadId INT = SCOPE_IDENTITY();

    INSERT INTO dbo.ChatThreadMembers (ThreadId, UserId, MemberRole)
    SELECT DISTINCT @ThreadId, CAST(value AS INT),
           CASE WHEN CAST(value AS INT) = @CreatedByUserId THEN 'Admin' ELSE 'Member' END
    FROM OPENJSON(@MemberIds);

    COMMIT TRANSACTION;
    EXEC dbo.sp_ChatThread_GetById @ThreadId = @ThreadId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ChatThread_GetById @ThreadId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT t.ThreadId, t.FirebaseKey, t.ThreadType, t.Title, t.BuildingId, t.CreatedByUserId, t.CreatedAt
    FROM dbo.ChatThreads t WHERE t.ThreadId = @ThreadId;

    SELECT m.UserId, u.FullName, u.ProfileImageUrl, m.MemberRole, m.JoinedAt
    FROM dbo.ChatThreadMembers m JOIN dbo.Users u ON u.UserId = m.UserId
    WHERE m.ThreadId = @ThreadId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ChatThread_ListForUser @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT t.ThreadId, t.FirebaseKey, t.ThreadType, t.Title, t.BuildingId, t.CreatedAt,
           (SELECT STRING_AGG(CAST(m2.UserId AS VARCHAR(10)), ',')
            FROM dbo.ChatThreadMembers m2 WHERE m2.ThreadId = t.ThreadId) AS MemberIds
    FROM dbo.ChatThreads t
    JOIN dbo.ChatThreadMembers m ON m.ThreadId = t.ThreadId
    WHERE m.UserId = @UserId
    ORDER BY t.CreatedAt DESC;
END;
GO

/* --------------------- SCHEDULES ----------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_StaffSchedule_Create
    @UserId INT, @BuildingId INT, @TaskType VARCHAR(20), @Title NVARCHAR(200),
    @ScheduledDate DATE, @StartTime TIME(0) = NULL, @EndTime TIME(0) = NULL,
    @Notes NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.StaffSchedules (UserId, BuildingId, TaskType, Title, ScheduledDate,
                                    StartTime, EndTime, Notes)
    VALUES (@UserId, @BuildingId, @TaskType, @Title, @ScheduledDate, @StartTime, @EndTime, @Notes);

    SELECT s.ScheduleId, s.UserId, u.FullName, s.BuildingId, b.Name AS BuildingName,
           s.TaskType, s.Title, s.ScheduledDate, s.StartTime, s.EndTime, s.Status, s.Notes
    FROM dbo.StaffSchedules s
    JOIN dbo.Users u ON u.UserId = s.UserId
    JOIN dbo.Buildings b ON b.BuildingId = s.BuildingId
    WHERE s.ScheduleId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_StaffSchedule_List
    @UserId INT = NULL, @BuildingId INT = NULL,
    @FromDate DATE = NULL, @ToDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT s.ScheduleId, s.UserId, u.FullName, s.BuildingId, b.Name AS BuildingName,
           s.TaskType, s.Title, s.ScheduledDate, s.StartTime, s.EndTime, s.Status, s.Notes
    FROM dbo.StaffSchedules s
    JOIN dbo.Users u ON u.UserId = s.UserId
    JOIN dbo.Buildings b ON b.BuildingId = s.BuildingId
    WHERE (@UserId IS NULL OR s.UserId = @UserId)
      AND (@BuildingId IS NULL OR s.BuildingId = @BuildingId)
      AND (@FromDate IS NULL OR s.ScheduledDate >= @FromDate)
      AND (@ToDate IS NULL OR s.ScheduledDate <= @ToDate)
    ORDER BY s.ScheduledDate, s.StartTime;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_StaffSchedule_UpdateStatus @ScheduleId INT, @Status VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.StaffSchedules SET Status = @Status WHERE ScheduleId = @ScheduleId;
END;
GO

/* -------------------- GLOBAL SEARCH -------------------- */

CREATE OR ALTER PROCEDURE dbo.sp_GlobalSearch
    @Query NVARCHAR(150), @UserId INT, @IsAdmin BIT = 0, @MaxPerType INT = 5
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Q NVARCHAR(160) = '%' + @Query + '%';

    SELECT 'apartment' AS ResultType, ApartmentId AS Id,
           CONCAT(BuildingName, N' — ', ApartmentNumber) AS Title, Status AS Subtitle
    FROM (SELECT TOP (@MaxPerType) v.* FROM dbo.vw_ApartmentDetails v
          JOIN dbo.Buildings b ON b.BuildingId = v.BuildingId
          WHERE (v.ApartmentNumber LIKE @Q OR v.BuildingName LIKE @Q OR v.TenantName LIKE @Q)
            AND (@IsAdmin = 1 OR b.OwnerUserId = @UserId)
          ORDER BY v.ApartmentId DESC) x

    UNION ALL
    SELECT 'maintenance', RequestId, Title, Status
    FROM (SELECT TOP (@MaxPerType) m.* FROM dbo.MaintenanceRequests m
          JOIN dbo.Buildings b ON b.BuildingId = m.BuildingId
          WHERE m.Title LIKE @Q
            AND (@IsAdmin = 1 OR b.OwnerUserId = @UserId OR m.RequestedByUserId = @UserId)
          ORDER BY m.CreatedAt DESC) x

    UNION ALL
    SELECT 'complaint', ComplaintId, Subject, Status
    FROM (SELECT TOP (@MaxPerType) c.* FROM dbo.Complaints c
          JOIN dbo.Buildings b ON b.BuildingId = c.BuildingId
          WHERE c.Subject LIKE @Q
            AND (@IsAdmin = 1 OR b.OwnerUserId = @UserId OR c.SubmittedByUserId = @UserId)
          ORDER BY c.CreatedAt DESC) x

    UNION ALL
    SELECT 'invoice', InvoiceId, InvoiceNumber, Status
    FROM (SELECT TOP (@MaxPerType) i.* FROM dbo.Invoices i
          JOIN dbo.Apartments a ON a.ApartmentId = i.ApartmentId
          JOIN dbo.Buildings b ON b.BuildingId = a.BuildingId
          WHERE i.InvoiceNumber LIKE @Q
            AND (@IsAdmin = 1 OR b.OwnerUserId = @UserId OR i.IssuedToUserId = @UserId)
          ORDER BY i.CreatedAt DESC) x

    UNION ALL
    SELECT 'user', UserId, FullName, Phone
    FROM (SELECT TOP (@MaxPerType) u.* FROM dbo.Users u
          WHERE u.IsDeleted = 0 AND (u.FullName LIKE @Q OR u.Phone LIKE @Q OR u.Email LIKE @Q)
            AND @IsAdmin = 1
          ORDER BY u.CreatedAt DESC) x;
END;
GO

PRINT 'Operations procedures created.';
GO
