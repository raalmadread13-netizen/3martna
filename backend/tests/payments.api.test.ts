import request from 'supertest';

jest.mock('../src/config/db', () => ({
  execProc: jest.fn(),
  execProcOne: jest.fn(),
  getPool: jest.fn(),
  closePool: jest.fn(),
}));
jest.mock('../src/config/firebase', () => ({
  getFirebase: () => null,
  getMessaging: () => null,
  verifyFirebaseIdToken: jest.fn().mockResolvedValue(null),
}));

import { execProc, execProcOne } from '../src/config/db';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/utils/tokens';

const mockExecProc = execProc as jest.Mock;
const mockExecProcOne = execProcOne as jest.Mock;

const app = createApp();
const tenantToken = signAccessToken(7, 'Sara Tenant', ['Tenant']);
const ownerToken = signAccessToken(2, 'Khalid Owner', ['BuildingOwner']);

const paymentRow = {
  PaymentId: 11,
  InvoiceId: 3,
  InvoiceNumber: 'INV-2026-000002',
  PaidByUserId: 7,
  PaidByName: 'Sara Tenant',
  BuildingName: 'Al-Rabieh Tower',
  ApartmentNumber: '101',
  Amount: 450,
  Method: 'Cash',
  Status: 'Confirmed',
  ReferenceNumber: null,
  ReceiptNumber: 'RCP-2026-000002',
  PaidAt: new Date().toISOString(),
};

beforeEach(() => {
  mockExecProc.mockResolvedValue({ recordset: [], recordsets: [[]] });
});

describe('POST /api/v1/payments', () => {
  it('records a confirmed payment when a manager submits it', async () => {
    mockExecProcOne.mockResolvedValueOnce(paymentRow); // sp_Payment_Record
    const response = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ invoiceId: 3, amount: 450, method: 'Cash', paidByUserId: 7 });

    expect(response.status).toBe(201);
    expect(response.body.data.ReceiptNumber).toBe('RCP-2026-000002');
    // Manager-recorded payments are confirmed directly
    expect(mockExecProcOne.mock.calls[0][1]).toMatchObject({ Status: 'Confirmed' });
  });

  it('records tenant self-payments as Pending', async () => {
    mockExecProcOne.mockResolvedValueOnce({ ...paymentRow, Status: 'Pending' });
    const response = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ invoiceId: 3, amount: 450, method: 'BankTransfer', referenceNumber: 'TRX-1' });

    expect(response.status).toBe(201);
    expect(mockExecProcOne.mock.calls[0][1]).toMatchObject({
      Status: 'Pending',
      PaidByUserId: 7, // forced to self even if another id were sent
    });
  });

  it('maps over-payment SQL errors to 400', async () => {
    mockExecProcOne.mockRejectedValueOnce(new Error('AMOUNT_EXCEEDS_BALANCE'));
    const response = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ invoiceId: 3, amount: 99999, method: 'Cash' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('AMOUNT_EXCEEDS_BALANCE');
  });

  it('rejects invalid payment methods', async () => {
    const response = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ invoiceId: 3, amount: 450, method: 'Bitcoin' });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/v1/payments/:id', () => {
  it('blocks a tenant from reading another user\'s payment', async () => {
    mockExecProcOne.mockResolvedValueOnce({ ...paymentRow, PaidByUserId: 999 });
    const response = await request(app)
      .get('/api/v1/payments/11')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(response.status).toBe(403);
  });

  it('lets the payer read their own payment', async () => {
    mockExecProcOne.mockResolvedValueOnce(paymentRow);
    const response = await request(app)
      .get('/api/v1/payments/11')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.PaymentId).toBe(11);
  });
});

describe('GET /api/v1/payments (list scoping)', () => {
  it('forces tenant scope to their own payments', async () => {
    mockExecProc.mockResolvedValueOnce({ recordset: [], recordsets: [[]] });
    await request(app).get('/api/v1/payments').set('Authorization', `Bearer ${tenantToken}`);
    expect(mockExecProc.mock.calls[0][1]).toMatchObject({ PaidByUserId: 7 });
  });
});
