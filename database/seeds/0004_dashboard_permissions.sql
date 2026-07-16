/* ============================================================
   Seed 0004 — Sprint 6: Admin Dashboard permission.
   Idempotent: safe to run repeatedly.
   ============================================================ */

IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = 'dashboard.read')
    INSERT INTO dbo.Permissions (Code, Name, Category) VALUES
     ('dashboard.read', N'View the admin dashboard and reports', 'Reporting');
GO

/* SuperAdmin → every permission (cross join picks up the new row) */
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.Roles r
CROSS JOIN dbo.Permissions p
WHERE r.Name = 'SuperAdmin'
  AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp
                  WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
GO

/* BuildingManager → dashboard access */
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.Roles r
JOIN dbo.Permissions p ON p.Code = 'dashboard.read'
WHERE r.Name = 'BuildingManager'
  AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp
                  WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
GO
