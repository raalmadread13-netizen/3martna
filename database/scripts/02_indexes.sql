/* ============================================================
   3martna (عمارتنا) — Indexes
   Non-clustered indexes covering hot query paths.
   ============================================================ */
USE Amartna;
GO

-- Identity
CREATE NONCLUSTERED INDEX IX_Users_FirebaseUid       ON dbo.Users (FirebaseUid) WHERE FirebaseUid IS NOT NULL;
CREATE NONCLUSTERED INDEX IX_Users_FullName          ON dbo.Users (FullName);
CREATE NONCLUSTERED INDEX IX_RefreshTokens_UserId    ON dbo.RefreshTokens (UserId) INCLUDE (ExpiresAt, RevokedAt);
CREATE NONCLUSTERED INDEX IX_RefreshTokens_TokenHash ON dbo.RefreshTokens (TokenHash);
CREATE NONCLUSTERED INDEX IX_PwdReset_UserId         ON dbo.PasswordResetTokens (UserId);
CREATE NONCLUSTERED INDEX IX_UserRoles_RoleId        ON dbo.UserRoles (RoleId);
CREATE NONCLUSTERED INDEX IX_UserDevices_UserId      ON dbo.UserDevices (UserId) INCLUDE (FcmToken);

-- Property
CREATE NONCLUSTERED INDEX IX_Buildings_Owner         ON dbo.Buildings (OwnerUserId) WHERE IsActive = 1;
CREATE NONCLUSTERED INDEX IX_Apartments_Building     ON dbo.Apartments (BuildingId) INCLUDE (Status, ApartmentNumber);
CREATE NONCLUSTERED INDEX IX_Apartments_Owner        ON dbo.Apartments (OwnerUserId) WHERE OwnerUserId IS NOT NULL;
CREATE NONCLUSTERED INDEX IX_Apartments_Status       ON dbo.Apartments (Status);
CREATE NONCLUSTERED INDEX IX_Residents_Apartment     ON dbo.Residents (ApartmentId) INCLUDE (MoveOutDate);
CREATE NONCLUSTERED INDEX IX_Residents_User          ON dbo.Residents (UserId) INCLUDE (MoveOutDate);
CREATE NONCLUSTERED INDEX IX_Contracts_Apartment     ON dbo.Contracts (ApartmentId) INCLUDE (Status);
CREATE NONCLUSTERED INDEX IX_Contracts_Tenant        ON dbo.Contracts (TenantUserId) INCLUDE (Status);
CREATE NONCLUSTERED INDEX IX_Contracts_Status_End    ON dbo.Contracts (Status, EndDate);

-- Finance
CREATE NONCLUSTERED INDEX IX_Invoices_IssuedTo       ON dbo.Invoices (IssuedToUserId, Status) INCLUDE (DueDate, Amount, LateFee);
CREATE NONCLUSTERED INDEX IX_Invoices_Apartment      ON dbo.Invoices (ApartmentId) INCLUDE (Status);
CREATE NONCLUSTERED INDEX IX_Invoices_Status_DueDate ON dbo.Invoices (Status, DueDate);
CREATE NONCLUSTERED INDEX IX_Invoices_Contract       ON dbo.Invoices (ContractId) WHERE ContractId IS NOT NULL;
CREATE NONCLUSTERED INDEX IX_Payments_Invoice        ON dbo.Payments (InvoiceId) INCLUDE (Amount, Status);
CREATE NONCLUSTERED INDEX IX_Payments_PaidBy         ON dbo.Payments (PaidByUserId, PaidAt DESC);
CREATE NONCLUSTERED INDEX IX_Payments_PaidAt         ON dbo.Payments (PaidAt) INCLUDE (Amount, Status);
CREATE NONCLUSTERED INDEX IX_Expenses_Building_Date  ON dbo.Expenses (BuildingId, ExpenseDate) INCLUDE (Amount, CategoryId);

-- Maintenance
CREATE NONCLUSTERED INDEX IX_Maint_Building_Status   ON dbo.MaintenanceRequests (BuildingId, Status) INCLUDE (Priority, CreatedAt);
CREATE NONCLUSTERED INDEX IX_Maint_RequestedBy       ON dbo.MaintenanceRequests (RequestedByUserId, CreatedAt DESC);
CREATE NONCLUSTERED INDEX IX_MaintAssign_AssignedTo  ON dbo.MaintenanceAssignments (AssignedToUserId) INCLUDE (RequestId, UnassignedAt);
CREATE NONCLUSTERED INDEX IX_MaintAssign_Request     ON dbo.MaintenanceAssignments (RequestId) WHERE UnassignedAt IS NULL;
CREATE NONCLUSTERED INDEX IX_StaffSchedules_User     ON dbo.StaffSchedules (UserId, ScheduledDate);

-- Complaints
CREATE NONCLUSTERED INDEX IX_Complaints_Building     ON dbo.Complaints (BuildingId, Status) INCLUDE (CreatedAt);
CREATE NONCLUSTERED INDEX IX_Complaints_SubmittedBy  ON dbo.Complaints (SubmittedByUserId) WHERE SubmittedByUserId IS NOT NULL;

-- Visitors & security
CREATE NONCLUSTERED INDEX IX_Visitors_Host           ON dbo.Visitors (HostUserId, ExpectedAt DESC);
CREATE NONCLUSTERED INDEX IX_Visitors_Apartment      ON dbo.Visitors (ApartmentId) INCLUDE (Status, ExpectedAt);
CREATE NONCLUSTERED INDEX IX_Visitors_Status         ON dbo.Visitors (Status, ExpectedAt);
CREATE NONCLUSTERED INDEX IX_GateLogs_Building_Time  ON dbo.GateLogs (BuildingId, LoggedAt DESC);
CREATE NONCLUSTERED INDEX IX_Incidents_Building      ON dbo.IncidentReports (BuildingId, Status) INCLUDE (Severity, OccurredAt);

-- Communication
CREATE NONCLUSTERED INDEX IX_Announcements_Building  ON dbo.Announcements (BuildingId, PublishedAt DESC);
CREATE NONCLUSTERED INDEX IX_Notifications_User_Read ON dbo.Notifications (UserId, IsRead) INCLUDE (CreatedAt);
CREATE NONCLUSTERED INDEX IX_ChatMembers_User        ON dbo.ChatThreadMembers (UserId);

-- Documents
CREATE NONCLUSTERED INDEX IX_Documents_Owner         ON dbo.Documents (OwnerUserId, Category) WHERE IsArchived = 0;
CREATE NONCLUSTERED INDEX IX_Documents_Apartment     ON dbo.Documents (ApartmentId) WHERE ApartmentId IS NOT NULL;

-- Audit
CREATE NONCLUSTERED INDEX IX_AuditLogs_User_Time     ON dbo.AuditLogs (UserId, CreatedAt DESC);
CREATE NONCLUSTERED INDEX IX_AuditLogs_Entity        ON dbo.AuditLogs (EntityType, EntityId);
CREATE NONCLUSTERED INDEX IX_AuditLogs_CreatedAt     ON dbo.AuditLogs (CreatedAt);
GO

PRINT 'Indexes created.';
GO
