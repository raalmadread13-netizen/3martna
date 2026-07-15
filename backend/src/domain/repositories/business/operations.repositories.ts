import { ActivityLog } from '@domain/business/ActivityLog';
import { Announcement, Notification } from '@domain/business/Communication';
import { BuildingEmployee } from '@domain/business/BuildingEmployee';
import { Complaint } from '@domain/business/Complaint';
import { Attachment, Document } from '@domain/business/Files';
import { MaintenanceCategory, MaintenanceRequest } from '@domain/business/Maintenance';
import { Service } from '@domain/business/Service';
import { Visitor, VisitorAccess } from '@domain/business/Visiting';
import { PageRequest, PageResult } from '@shared/types';
import { ITenantRepository } from './ITenantRepository';

export interface IMaintenanceCategoryRepository extends ITenantRepository<MaintenanceCategory> {
  listActive(tenantId: string): Promise<MaintenanceCategory[]>;
  existsByName(tenantId: string, name: string): Promise<boolean>;
}

export interface IMaintenanceRequestRepository extends ITenantRepository<MaintenanceRequest> {
  listByBuilding(
    tenantId: string,
    buildingId: string,
    filter: { status?: string },
    page: PageRequest,
  ): Promise<PageResult<MaintenanceRequest>>;
  listAssignedTo(
    tenantId: string,
    employeeId: string,
    page: PageRequest,
  ): Promise<PageResult<MaintenanceRequest>>;
}

export interface IBuildingEmployeeRepository extends ITenantRepository<BuildingEmployee> {
  listActiveByBuilding(tenantId: string, buildingId: string): Promise<BuildingEmployee[]>;
  findActive(
    tenantId: string,
    buildingId: string,
    userId: string,
    position: string,
  ): Promise<BuildingEmployee | null>;
}

export interface IComplaintRepository extends ITenantRepository<Complaint> {
  listByBuilding(
    tenantId: string,
    buildingId: string,
    filter: { status?: string },
    page: PageRequest,
  ): Promise<PageResult<Complaint>>;
}

export interface IVisitorRepository extends ITenantRepository<Visitor> {
  listByApartment(
    tenantId: string,
    apartmentId: string,
    page: PageRequest,
  ): Promise<PageResult<Visitor>>;
}

export interface IVisitorAccessRepository extends ITenantRepository<VisitorAccess> {
  findByAccessCode(tenantId: string, accessCode: string): Promise<VisitorAccess | null>;
  listByVisitor(tenantId: string, visitorId: string): Promise<VisitorAccess[]>;
  /** Pending/approved passes whose window elapsed (expiry job). */
  listElapsedBefore(tenantId: string, asOf: Date): Promise<VisitorAccess[]>;
}

export interface IAnnouncementRepository extends ITenantRepository<Announcement> {
  listVisible(
    tenantId: string,
    buildingId: string | null,
    page: PageRequest,
  ): Promise<PageResult<Announcement>>;
}

export interface INotificationRepository extends ITenantRepository<Notification> {
  listForRecipient(
    tenantId: string,
    recipientUserId: string,
    unreadOnly: boolean,
    page: PageRequest,
  ): Promise<PageResult<Notification>>;
  countUnread(tenantId: string, recipientUserId: string): Promise<number>;
}

export interface IAttachmentRepository extends ITenantRepository<Attachment> {
  listForEntity(tenantId: string, entityType: string, entityId: string): Promise<Attachment[]>;
}

export interface IDocumentRepository extends ITenantRepository<Document> {
  listByOwner(
    tenantId: string,
    ownerUserId: string,
    page: PageRequest,
  ): Promise<PageResult<Document>>;
  /** Full version chain for a document (follows previousDocumentId). */
  listVersionChain(tenantId: string, documentId: string): Promise<Document[]>;
}

export interface IServiceRepository extends ITenantRepository<Service> {
  listActive(tenantId: string, buildingId: string | null): Promise<Service[]>;
}

export interface IActivityLogRepository {
  /** Append-only feed; no update/delete. */
  append(entry: ActivityLog): Promise<void>;
  listByTenant(tenantId: string, page: PageRequest): Promise<PageResult<ActivityLog>>;
}
