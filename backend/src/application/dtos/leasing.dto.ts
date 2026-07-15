export interface LeaseContractDto {
  id: string;
  tenantId: string;
  contractNumber: string;
  apartmentId: string;
  ownerId: string;
  residentId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  currency: string;
  depositAmount: number;
  paymentFrequency: string;
  lateFeePercent: number;
  graceDays: number;
  status: string;
  terminatedAt: string | null;
  terminationReason: string | null;
  createdAt: string;
}

export interface CreateLeaseContractDto {
  contractNumber: string;
  apartmentId: string;
  ownerId: string;
  residentId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  currency?: string;
  depositAmount?: number;
  paymentFrequency?: string;
  lateFeePercent?: number;
  graceDays?: number;
}

export interface InvoiceDto {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  leaseContractId: string | null;
  apartmentId: string;
  residentId: string | null;
  ownerId: string | null;
  invoiceType: string;
  periodStart: string | null;
  periodEnd: string | null;
  issueDate: string;
  dueDate: string;
  amount: number;
  lateFee: number;
  total: number;
  paidAmount: number;
  balance: number;
  currency: string;
  status: string;
  notes: string | null;
}

export interface PaymentDto {
  id: string;
  tenantId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: string;
  referenceNumber: string | null;
  status: string;
  paidAt: string;
  receivedByUserId: string | null;
  notes: string | null;
}
