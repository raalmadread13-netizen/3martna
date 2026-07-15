import { ActivityLog } from '@domain/business/ActivityLog';
import { Announcement, Notification } from '@domain/business/Communication';
import { BuildingEmployee } from '@domain/business/BuildingEmployee';
import { Complaint } from '@domain/business/Complaint';
import { Attachment, Document } from '@domain/business/Files';
import { MaintenanceCategory, MaintenanceRequest } from '@domain/business/Maintenance';
import { Service } from '@domain/business/Service';
import { Tenant } from '@domain/business/Tenant';
import { Visitor, VisitorAccess } from '@domain/business/Visiting';
import {
  ActivityLogDto,
  AnnouncementDto,
  AttachmentDto,
  BuildingEmployeeDto,
  ComplaintDto,
  DocumentDto,
  MaintenanceCategoryDto,
  MaintenanceRequestDto,
  NotificationDto,
  ServiceDto,
  TenantDto,
  VisitorAccessDto,
  VisitorDto,
} from '@application/dtos/operations.dto';
import { iso, isoRequired } from './common';

export const toTenantDto = (tenant: Tenant): TenantDto => {
  const p = tenant.toProps();
  return {
    id: p.id,
    name: p.name,
    legalName: p.legalName,
    contactEmail: p.contactEmail,
    contactPhone: p.contactPhone,
    status: p.status,
    createdAt: isoRequired(p.createdAt),
  };
};

export const toMaintenanceCategoryDto = (category: MaintenanceCategory): MaintenanceCategoryDto => {
  const p = category.toProps();
  return { id: p.id, tenantId: p.tenantId, name: p.name, nameAr: p.nameAr, isActive: p.isActive };
};

export const toMaintenanceRequestDto = (request: MaintenanceRequest): MaintenanceRequestDto => {
  const p = request.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    buildingId: p.buildingId,
    apartmentId: p.apartmentId,
    categoryId: p.categoryId,
    requestedByUserId: p.requestedByUserId,
    title: p.title,
    description: p.description,
    priority: p.priority,
    status: p.status,
    assignedToEmployeeId: p.assignedToEmployeeId,
    scheduledFor: iso(p.scheduledFor),
    startedAt: iso(p.startedAt),
    completedAt: iso(p.completedAt),
    completionNotes: p.completionNotes,
    rating: p.rating,
    ratingComment: p.ratingComment,
    createdAt: isoRequired(p.createdAt),
  };
};

export const toComplaintDto = (complaint: Complaint): ComplaintDto => {
  const p = complaint.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    buildingId: p.buildingId,
    apartmentId: p.apartmentId,
    submittedByUserId: p.submittedByUserId,
    isAnonymous: p.isAnonymous,
    category: p.category,
    subject: p.subject,
    description: p.description,
    status: p.status,
    resolution: p.resolution,
    resolvedByUserId: p.resolvedByUserId,
    resolvedAt: iso(p.resolvedAt),
    createdAt: isoRequired(p.createdAt),
  };
};

export const toVisitorDto = (visitor: Visitor): VisitorDto => {
  const p = visitor.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    apartmentId: p.apartmentId,
    hostUserId: p.hostUserId,
    fullName: p.fullName,
    phoneNumber: p.phoneNumber,
    nationalId: p.nationalId,
    vehiclePlate: p.vehiclePlate,
    purpose: p.purpose,
  };
};

export const toVisitorAccessDto = (access: VisitorAccess): VisitorAccessDto => {
  const p = access.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    visitorId: p.visitorId,
    accessCode: p.accessCode,
    validFrom: isoRequired(p.validFrom),
    validUntil: isoRequired(p.validUntil),
    status: p.status,
    approvedByUserId: p.approvedByUserId,
    checkedInAt: iso(p.checkedInAt),
    checkedOutAt: iso(p.checkedOutAt),
  };
};

export const toAnnouncementDto = (announcement: Announcement): AnnouncementDto => {
  const p = announcement.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    buildingId: p.buildingId,
    title: p.title,
    body: p.body,
    audience: p.audience,
    isPinned: p.isPinned,
    publishedAt: isoRequired(p.publishedAt),
    expiresAt: iso(p.expiresAt),
  };
};

export const toNotificationDto = (notification: Notification): NotificationDto => {
  const p = notification.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    recipientUserId: p.recipientUserId,
    title: p.title,
    body: p.body,
    category: p.category,
    relatedEntityType: p.relatedEntityType,
    relatedEntityId: p.relatedEntityId,
    isRead: p.isRead,
    readAt: iso(p.readAt),
    createdAt: isoRequired(p.createdAt),
  };
};

export const toAttachmentDto = (attachment: Attachment): AttachmentDto => {
  const p = attachment.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    entityType: p.entityType,
    entityId: p.entityId,
    fileName: p.fileName,
    fileUrl: p.fileUrl,
    contentType: p.contentType,
    sizeBytes: p.sizeBytes,
    uploadedByUserId: p.uploadedByUserId,
  };
};

export const toDocumentDto = (document: Document): DocumentDto => {
  const p = document.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    category: p.category,
    title: p.title,
    fileUrl: p.fileUrl,
    contentType: p.contentType,
    sizeBytes: p.sizeBytes,
    ownerUserId: p.ownerUserId,
    buildingId: p.buildingId,
    apartmentId: p.apartmentId,
    version: p.version,
    previousDocumentId: p.previousDocumentId,
    createdAt: isoRequired(p.createdAt),
  };
};

export const toServiceDto = (service: Service): ServiceDto => {
  const p = service.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    buildingId: p.buildingId,
    name: p.name,
    nameAr: p.nameAr,
    description: p.description,
    monthlyFee: p.monthlyFee,
    currency: p.currency,
    isActive: p.isActive,
  };
};

export const toBuildingEmployeeDto = (employee: BuildingEmployee): BuildingEmployeeDto => {
  const p = employee.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    buildingId: p.buildingId,
    userId: p.userId,
    position: p.position,
    hiredOn: iso(p.hiredOn),
    endedOn: iso(p.endedOn),
    isActive: employee.isActive,
  };
};

export const toActivityLogDto = (log: ActivityLog): ActivityLogDto => {
  const p = log.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    actorUserId: p.actorUserId,
    action: p.action,
    entityType: p.entityType,
    entityId: p.entityId,
    summary: p.summary,
    occurredAt: isoRequired(p.occurredAt),
  };
};
