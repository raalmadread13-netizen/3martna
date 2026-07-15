/* ============================================================
   Seed 0001 — Identity reference data: roles & permissions ONLY.
   Idempotent: safe to run repeatedly.

   ⚠ There is intentionally NO seeded admin account (ADR-0005).
   The first SuperAdmin is created interactively with:
       npm run bootstrap:admin
   ============================================================ */

/* ------------------------- ROLES ------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = 'SuperAdmin')
    INSERT INTO dbo.Roles (Name, NameAr, Description) VALUES
     ('SuperAdmin',          N'مدير النظام',   'Full platform administration'),
     ('BuildingManager',     N'مدير العمارة',  'Manages buildings, residents and operations'),
     ('Resident',            N'ساكن',          'Building resident (owner or tenant)'),
     ('MaintenanceEmployee', N'موظف صيانة',    'Executes maintenance tasks'),
     ('SecurityGuard',       N'حارس أمن',      'Gate control and security');
GO

/* ---------------------- PERMISSIONS ----------------------
   Database-driven catalog. Feature sprints append rows here —
   application code never hardcodes this list. */
IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = 'users.read')
    INSERT INTO dbo.Permissions (Code, Name, Category) VALUES
     ('users.read',        N'View users',                'Identity'),
     ('users.manage',      N'Create, update and disable users', 'Identity'),
     ('roles.read',        N'View roles and permissions', 'Identity'),
     ('roles.manage',      N'Assign roles and permissions', 'Identity'),
     ('audit.read',        N'View the audit trail',       'Identity'),
     ('profile.manage',    N'Edit own profile',           'Identity');
GO

/* SuperAdmin → every permission (including future ones on re-seed) */
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.Roles r
CROSS JOIN dbo.Permissions p
WHERE r.Name = 'SuperAdmin'
  AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp
                  WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
GO

/* Everyone may manage their own profile */
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.Roles r
JOIN dbo.Permissions p ON p.Code = 'profile.manage'
WHERE NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp
                  WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
GO
