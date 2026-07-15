# Entity–Relationship Diagram

Microsoft SQL Server schema after migrations `0001_identity` and
`0002_core_domain`. Every table also carries the standard columns
(`CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`, `IsDeleted`, `RowVersion`)
and — for business tables — `TenantId`; these are omitted from the diagram for
readability. All primary keys are `UNIQUEIDENTIFIER` (GUID, ADR-0003).

## Identity domain (migration 0001)

```mermaid
erDiagram
    Tenants   ||--o{ Users            : "scopes"
    Users     ||--o{ UserRoles        : "has"
    Roles     ||--o{ UserRoles        : "granted via"
    Roles     ||--o{ RolePermissions  : "has"
    Permissions ||--o{ RolePermissions : "granted via"
    Users     ||--o{ RefreshTokens    : "owns"
    Users     ||--o{ VerificationCodes : "owns"
    Users     ||--o{ AuditLogs        : "acts in"

    Users {
        guid Id PK
        guid TenantId FK "nullable (platform users)"
        string FirstName
        string LastName
        string Email "unique per tenant, filtered"
        string PhoneNumber "unique, filtered"
        string PasswordHash
        string Status "Active|Suspended"
        bool EmailVerified
        bool PhoneVerified
        int FailedLoginCount
        datetime LockedUntil
    }
    Roles { guid Id PK  string Name "unique" }
    Permissions { guid Id PK  string Code "unique" }
    RolePermissions { guid Id PK  guid RoleId FK  guid PermissionId FK }
    UserRoles { guid Id PK  guid UserId FK  guid RoleId FK }
    RefreshTokens { guid Id PK  guid UserId FK  string TokenHash "SHA-256"  datetime ExpiresAt  datetime RevokedAt }
    VerificationCodes { guid Id PK  guid UserId FK  string CodeHash  string Purpose  datetime ExpiresAt }
    AuditLogs { guid Id PK  guid UserId FK  string Action }
```

## Property & leasing (migration 0002)

```mermaid
erDiagram
    Tenants        ||--o{ Buildings      : "owns"
    Buildings      ||--o{ Floors         : "has"
    Buildings      ||--o{ Apartments     : "contains"
    Floors         ||--o{ Apartments     : "holds"
    Buildings      ||--o{ ParkingSpaces  : "has"
    Buildings      ||--o{ StorageUnits   : "has"
    Apartments     ||--o| ParkingSpaces  : "assigned"
    Apartments     ||--o| StorageUnits   : "assigned"
    Owners         ||--o{ Apartments     : "owns"
    Apartments     ||--o{ Residents      : "houses"
    Users          ||--o| Residents      : "linked"
    Users          ||--o| Owners         : "linked"
    Apartments     ||--o{ LeaseContracts : "leased via"
    Owners         ||--o{ LeaseContracts : "lessor"
    Residents      ||--o{ LeaseContracts : "lessee"
    LeaseContracts ||--o{ Invoices       : "bills"
    Apartments     ||--o{ Invoices       : "for"
    Invoices       ||--o{ Payments       : "settled by"

    Buildings   { guid Id PK  guid TenantId FK  string Name  int TotalFloors  string Status }
    Floors      { guid Id PK  guid BuildingId FK  int FloorNumber }
    Apartments  { guid Id PK  guid BuildingId FK  guid FloorId FK  guid OwnerId FK  string UnitNumber  string Status }
    ParkingSpaces { guid Id PK  guid BuildingId FK  guid ApartmentId FK  string SpaceNumber }
    StorageUnits  { guid Id PK  guid BuildingId FK  guid ApartmentId FK  string UnitNumber }
    Owners      { guid Id PK  guid TenantId FK  guid UserId FK  string OwnerType  string FullName }
    Residents   { guid Id PK  guid ApartmentId FK  guid UserId FK  string ResidencyType  date MoveInDate  date MoveOutDate }
    LeaseContracts { guid Id PK  guid ApartmentId FK  guid OwnerId FK  guid ResidentId FK  decimal MonthlyRent  string Status "one Active per apartment" }
    Invoices    { guid Id PK  guid ApartmentId FK  guid ResidentId FK  guid OwnerId FK  decimal Amount  string Status }
    Payments    { guid Id PK  guid InvoiceId FK  decimal Amount  string Method  string Status }
```

## Operations & communication (migration 0002)

```mermaid
erDiagram
    Tenants               ||--o{ MaintenanceCategories : "defines"
    Buildings             ||--o{ BuildingEmployees     : "staffs"
    Users                 ||--o{ BuildingEmployees     : "assigned as"
    Buildings             ||--o{ MaintenanceRequests   : "for"
    Apartments            ||--o| MaintenanceRequests   : "about"
    MaintenanceCategories ||--o{ MaintenanceRequests   : "categorizes"
    BuildingEmployees     ||--o| MaintenanceRequests   : "handles"
    Buildings             ||--o{ Complaints            : "about"
    Apartments            ||--o{ Visitors              : "expected at"
    Users                 ||--o{ Visitors              : "hosts"
    Visitors              ||--o{ VisitorAccesses       : "granted"
    Buildings             ||--o{ Announcements         : "targets"
    Users                 ||--o{ Notifications         : "receives"
    Users                 ||--o{ Documents             : "owns"
    Documents             ||--o| Documents             : "previous version"

    MaintenanceCategories { guid Id PK  guid TenantId FK  string Name }
    BuildingEmployees { guid Id PK  guid BuildingId FK  guid UserId FK  string Position  date EndedOn }
    MaintenanceRequests { guid Id PK  guid BuildingId FK  guid CategoryId FK  guid AssignedToEmployeeId FK  string Status  string Priority }
    Complaints { guid Id PK  guid BuildingId FK  guid SubmittedByUserId FK "null if anonymous"  string Status }
    Visitors { guid Id PK  guid ApartmentId FK  guid HostUserId FK  string FullName }
    VisitorAccesses { guid Id PK  guid VisitorId FK  guid AccessCode "QR"  datetime ValidFrom  datetime ValidUntil  string Status }
    Announcements { guid Id PK  guid TenantId FK  guid BuildingId FK "null = tenant-wide"  string Audience }
    Notifications { guid Id PK  guid RecipientUserId FK  bool IsRead }
    Attachments { guid Id PK  guid TenantId FK  string EntityType  guid EntityId  string FileUrl }
    Documents { guid Id PK  guid OwnerUserId FK  guid PreviousDocumentId FK  int Version  string Category }
    Services { guid Id PK  guid TenantId FK  guid BuildingId FK  string Name  decimal MonthlyFee }
    ActivityLogs { guid Id PK  guid TenantId FK  guid ActorUserId FK  string Action }
```

## Key constraints & indexes

| Kind | Example | Purpose |
|---|---|---|
| Tenant-scoped unique | `UQ_Buildings_Tenant_Name (TenantId, Name)` filtered on `IsDeleted=0` | Names unique within a tenant, deleted rows free the value |
| Business invariant | `UQ_LeaseContracts_ActivePerApartment (ApartmentId) WHERE Status='Active'` | At most one active lease per apartment |
| Billed-party XOR | `CK_Invoices_BilledParty ((ResidentId IS NULL) <> (OwnerId IS NULL))` | An invoice bills exactly one party |
| Anonymity | `CK_Complaints_Anonymous (IsAnonymous=0 OR SubmittedByUserId IS NULL)` | Anonymous complaints never store a submitter |
| Hot-path index | `IX_*_Tenant_* (TenantId, …)` leading column | Partition-aligned tenant queries |
| Concurrency | `RowVersion ROWVERSION` on every table | Optimistic concurrency |
