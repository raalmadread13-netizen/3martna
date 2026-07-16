/* ============================================================
   Seed 0003 — Sprint 5: Occupancy Management permissions.
   Idempotent: safe to run repeatedly.
   ============================================================ */

/* ---------------------- PERMISSIONS ---------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = 'residents.read')
    INSERT INTO dbo.Permissions (Code, Name, Category) VALUES
     ('residents.read',   N'View residents',                        'Occupancy'),
     ('residents.manage', N'Register and update residents',         'Occupancy'),
     ('leases.read',      N'View lease contracts',                  'Occupancy'),
     ('leases.manage',    N'Create, update and terminate leases',   'Occupancy'),
     ('occupancy.read',   N'View occupancy and its history',        'Occupancy'),
     ('occupancy.manage', N'Move residents in and out',             'Occupancy');
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

/* BuildingManager → full occupancy management */
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.Roles r
JOIN dbo.Permissions p ON p.Code IN
    ('residents.read', 'residents.manage',
     'leases.read', 'leases.manage',
     'occupancy.read', 'occupancy.manage')
WHERE r.Name = 'BuildingManager'
  AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp
                  WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
GO
