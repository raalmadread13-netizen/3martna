export interface MaintenanceCategoryDto {
  id: string;
  tenantId: string;
  name: string;
  nameAr: string;
  isActive: boolean;
}

export interface MaintenanceRequestDto {
  id: string;
  tenantId: string;
  buildingId: string;
  apartmentId: string | null;
  categoryId: string;
  requestedByUserId: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assignedToEmployeeId: string | null;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  completionNotes: string | null;
  rating: number | null;
  ratingComment: string | null;
  createdAt: string;
}

export interface ComplaintDto {
  id: string;
  tenantId: string;
  buildingId: string;
  apartmentId: string | null;
  submittedByUserId: string | null;
  isAnonymous: boolean;
  category: string;
  subject: string;
  description: string | null;
  status: string;
  resolution: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface VisitorDto {
  id: string;
  tenantId: string;
  apartmentId: string;
  hostUserId: string;
  fullName: string;
  phoneNumber: string | null;
  nationalId: string | null;
  vehiclePlate: string | null;
  purpose: string | null;
}

export interface VisitorAccessDto {
  id: string;
  tenantId: string;
  visitorId: string;
  accessCode: string;
  validFrom: string;
  validUntil: string;
  status: string;
  approvedByUserId: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
}

export interface AnnouncementDto {
  id: string;
  tenantId: string;
  buildingId: string | null;
  title: string;
  body: string;
  audience: string;
  isPinned: boolean;
  publishedAt: string;
  expiresAt: string | null;
}

export interface NotificationDto {
  id: string;
  tenantId: string;
  recipientUserId: string;
  title: string;
  body: string | null;
  category: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface AttachmentDto {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number | null;
  uploadedByUserId: string;
}

export interface DocumentDto {
  id: string;
  tenantId: string;
  category: string;
  title: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number | null;
  ownerUserId: string;
  buildingId: string | null;
  apartmentId: string | null;
  version: number;
  previousDocumentId: string | null;
  createdAt: string;
}

export interface ServiceDto {
  id: string;
  tenantId: string;
  buildingId: string | null;
  name: string;
  nameAr: string | null;
  description: string | null;
  monthlyFee: number | null;
  currency: string;
  isActive: boolean;
}

export interface BuildingEmployeeDto {
  id: string;
  tenantId: string;
  buildingId: string;
  userId: string;
  position: string;
  hiredOn: string | null;
  endedOn: string | null;
  isActive: boolean;
}

export interface TenantDto {
  id: string;
  name: string;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  createdAt: string;
}

export interface ActivityLogDto {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  occurredAt: string;
}
