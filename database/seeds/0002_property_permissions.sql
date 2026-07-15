/* ============================================================
   Seed 0002 — Sprint 4: Building & Apartment Management permissions.
   Idempotent: safe to run repeatedly.

   Permission codes are database-driven (never hardcoded in app code);
   routes reference the codes below via requirePermission().
   ============================================================ */

/* ---------------------- PERMISSIONS ---------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = 'buildings.read')
    INSERT INTO dbo.Permissions (Code, Name, Category) VALUES
     ('buildings.read',    N'View buildings and floors',            'Property'),
     ('buildings.manage',  N'Create, update and archive buildings', 'Property'),
     ('apartments.read',   N'View apartments',                      'Property'),
     ('apartments.manage', N'Create, update and archive apartments','Property'),
     ('owners.read',       N'View apartment owners',                'Property'),
     ('owners.manage',     N'Create and update apartment owners',   'Property');
GO

/* SuperAdmin → every permission (cross join picks up the new rows) */
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.Roles r
CROSS JOIN dbo.Permissions p
WHERE r.Name = 'SuperAdmin'
  AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp
                  WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
GO

/* BuildingManager → full property management */
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.Roles r
JOIN dbo.Permissions p ON p.Code IN
    ('buildings.read', 'buildings.manage',
     'apartments.read', 'apartments.manage',
     'owners.read', 'owners.manage')
WHERE r.Name = 'BuildingManager'
  AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp
                  WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
GO

/* Residents may view their building's public data */
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.Roles r
JOIN dbo.Permissions p ON p.Code IN ('buildings.read', 'apartments.read')
WHERE r.Name = 'Resident'
  AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp
                  WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
GO
