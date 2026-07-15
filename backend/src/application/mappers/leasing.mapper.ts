import { Invoice, Payment } from '@domain/business/Billing';
import { LeaseContract } from '@domain/business/LeaseContract';
import { InvoiceDto, LeaseContractDto, PaymentDto } from '@application/dtos/leasing.dto';
import { iso, isoRequired } from './common';

export const toLeaseContractDto = (lease: LeaseContract): LeaseContractDto => {
  const p = lease.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    contractNumber: p.contractNumber,
    apartmentId: p.apartmentId,
    ownerId: p.ownerId,
    residentId: p.residentId,
    startDate: isoRequired(p.startDate),
    endDate: isoRequired(p.endDate),
    monthlyRent: p.monthlyRent,
    currency: p.currency,
    depositAmount: p.depositAmount,
    paymentFrequency: p.paymentFrequency,
    lateFeePercent: p.lateFeePercent,
    graceDays: p.graceDays,
    status: p.status,
    terminatedAt: iso(p.terminatedAt),
    terminationReason: p.terminationReason,
    createdAt: isoRequired(p.createdAt),
  };
};

export const toInvoiceDto = (invoice: Invoice): InvoiceDto => {
  const p = invoice.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    invoiceNumber: p.invoiceNumber,
    leaseContractId: p.leaseContractId,
    apartmentId: p.apartmentId,
    residentId: p.residentId,
    ownerId: p.ownerId,
    invoiceType: p.invoiceType,
    periodStart: iso(p.periodStart),
    periodEnd: iso(p.periodEnd),
    issueDate: isoRequired(p.issueDate),
    dueDate: isoRequired(p.dueDate),
    amount: p.amount,
    lateFee: p.lateFee,
    total: invoice.total.amount,
    paidAmount: invoice.paidAmount.amount,
    balance: invoice.balance.amount,
    currency: p.currency,
    status: p.status,
    notes: p.notes,
  };
};

export const toPaymentDto = (payment: Payment): PaymentDto => {
  const p = payment.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    invoiceId: p.invoiceId,
    amount: p.amount,
    currency: p.currency,
    method: p.method,
    referenceNumber: p.referenceNumber,
    status: p.status,
    paidAt: isoRequired(p.paidAt),
    receivedByUserId: p.receivedByUserId,
    notes: p.notes,
  };
};
