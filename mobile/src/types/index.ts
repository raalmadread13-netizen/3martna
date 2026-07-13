import { Role } from '../config/constants';

export interface User {
  UserId: number;
  PublicId: string;
  FullName: string;
  Email: string | null;
  Phone: string;
  NationalId?: string | null;
  ProfileImageUrl: string | null;
  Address?: string | null;
  PreferredLanguage: 'ar' | 'en';
  IsPhoneVerified: boolean;
  Roles: Role[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
}

export interface Building {
  BuildingId: number;
  Name: string;
  NameAr: string | null;
  Address: string;
  City: string;
  District: string | null;
  TotalFloors: number;
  ImageUrl: string | null;
  ApartmentCount: number;
  OccupancyRate: number | null;
  OwnerName?: string;
  floors?: Floor[];
}

export interface Floor {
  FloorId: number;
  FloorNumber: number;
  Name: string | null;
}

export interface Apartment {
  ApartmentId: number;
  ApartmentNumber: string;
  Bedrooms: number;
  Bathrooms: number;
  AreaSqm: number | null;
  RentAmount: number | null;
  Status: 'Available' | 'Rented' | 'OwnerOccupied' | 'UnderMaintenance' | 'Reserved';
  BuildingId: number;
  BuildingName: string;
  FloorNumber: number;
  OwnerName: string | null;
  TenantName: string | null;
  ContractEndDate: string | null;
}

export interface Contract {
  ContractId: number;
  ContractNumber: string;
  ApartmentNumber: string;
  BuildingName: string;
  TenantName: string;
  StartDate: string;
  EndDate: string;
  MonthlyRent: number;
  PaymentFrequency: string;
  Status: 'Pending' | 'Active' | 'Expired' | 'Terminated';
}

export interface Invoice {
  InvoiceId: number;
  InvoiceNumber: string;
  InvoiceType: string;
  ApartmentNumber: string;
  BuildingName: string;
  IssuedToName: string;
  DueDate: string;
  Amount: number;
  LateFee: number;
  TotalAmount: number;
  PaidAmount: number;
  Status: 'Unpaid' | 'PartiallyPaid' | 'Paid' | 'Overdue' | 'Cancelled';
  payments?: Payment[];
}

export interface Payment {
  PaymentId: number;
  InvoiceNumber: string;
  Amount: number;
  Method: 'Cash' | 'BankTransfer' | 'CreditCard';
  Status: 'Pending' | 'Confirmed' | 'Rejected';
  PaidAt: string;
  ReceiptNumber: string | null;
  PaidByName?: string;
  BuildingName?: string;
  ApartmentNumber?: string;
}

export interface MaintenanceRequest {
  RequestId: number;
  Title: string;
  Description?: string | null;
  Category: string;
  Priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  Status: 'Open' | 'Assigned' | 'InProgress' | 'OnHold' | 'Completed' | 'Cancelled' | 'Rejected';
  BuildingName: string;
  BuildingAddress?: string;
  Latitude?: number | null;
  Longitude?: number | null;
  ApartmentNumber: string | null;
  RequestedByName: string;
  TechnicianName: string | null;
  ScheduledAt: string | null;
  CompletedAt?: string | null;
  Rating?: number | null;
  CreatedAt: string;
  CheckInAt?: string | null;
  attachments?: MaintenanceAttachment[];
  comments?: CommentItem[];
}

export interface MaintenanceAttachment {
  AttachmentId: number;
  FileUrl: string;
  FileType: string;
  Stage: 'Before' | 'During' | 'After' | 'Other';
}

export interface CommentItem {
  CommentId: number;
  UserId: number;
  FullName: string;
  ProfileImageUrl?: string | null;
  Comment: string;
  IsInternal?: boolean;
  CreatedAt: string;
}

export interface Complaint {
  ComplaintId: number;
  Category: string;
  Subject: string;
  Description?: string | null;
  Status: 'Open' | 'InReview' | 'Resolved' | 'Dismissed' | 'Escalated';
  IsAnonymous: boolean;
  BuildingName: string;
  ApartmentNumber: string | null;
  SubmittedByName: string | null;
  Resolution?: string | null;
  CreatedAt: string;
  comments?: CommentItem[];
  attachments?: { AttachmentId: number; FileUrl: string; FileType: string }[];
}

export interface Visitor {
  VisitorId: number;
  VisitorName: string;
  VisitorPhone: string | null;
  VehiclePlate: string | null;
  Purpose: string | null;
  ExpectedAt: string;
  ExpectedUntil: string | null;
  QrCode: string;
  Status: 'Pending' | 'Approved' | 'Denied' | 'CheckedIn' | 'CheckedOut' | 'Expired' | 'Cancelled';
  HostName: string;
  ApartmentNumber: string;
  BuildingName: string;
  CheckedInAt: string | null;
  CheckedOutAt: string | null;
}

export interface Announcement {
  AnnouncementId: number;
  Title: string;
  Body: string;
  BuildingName: string | null;
  IsPinned: boolean;
  PublishedAt: string;
  CreatedByName: string;
}

export interface AppNotification {
  NotificationId: number;
  Title: string;
  Body: string | null;
  NotifType: string;
  EntityType: string | null;
  EntityId: number | null;
  IsRead: boolean;
  CreatedAt: string;
}

export interface ChatThread {
  ThreadId: number;
  FirebaseKey: string;
  ThreadType: 'Private' | 'Group';
  Title: string | null;
  MemberIds: string;
  CreatedAt: string;
}

export interface DocumentItem {
  DocumentId: number;
  Category: string;
  Title: string;
  FileUrl: string;
  FileType: string;
  FileSizeBytes: number | null;
  VersionCount: number;
  UpdatedAt: string;
}
