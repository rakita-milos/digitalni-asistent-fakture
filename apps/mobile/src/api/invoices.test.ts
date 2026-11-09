import type { CreateInvoiceInput, CreatePaymentInput } from '@digitalni-asistent/shared';

import {
  cancelInvoice,
  createInvoice,
  createPayment,
  getInvoice,
  issueInvoice,
  listInvoices,
  refundInvoice,
} from './invoices';
import { apiRequest } from './client';

jest.mock('./client', () => ({
  apiRequest: jest.fn(),
}));

const apiRequestMock = apiRequest as jest.MockedFunction<typeof apiRequest>;

const invoiceInput: CreateInvoiceInput = {
  customerId: 'customer-1',
  type: 'SALE',
  issueDate: '2026-11-01T12:00:00.000Z',
  dueDate: '2026-11-16T12:00:00.000Z',
  currency: 'BAM',
  lines: [{ description: 'Kabl', qtyMilli: 1500, unitPriceFening: 1000, discountBp: 0, taxRateBp: 1700 }],
};

const paymentInput: CreatePaymentInput = {
  amountFening: 1755,
  method: 'CASH',
};

describe('invoices API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('građuje query string sa statusom i limitom', async () => {
    apiRequestMock.mockResolvedValue({ items: [], total: 0 } as never);

    await listInvoices({ status: 'DRAFT', limit: 100 });

    expect(apiRequestMock).toHaveBeenCalledWith('/invoices?status=DRAFT&limit=100');
  });

  it('poziva /invoices bez filtera', async () => {
    apiRequestMock.mockResolvedValue({ items: [], total: 0 } as never);

    await listInvoices();

    expect(apiRequestMock).toHaveBeenCalledWith('/invoices');
  });

  it('učitava detalj fakture', async () => {
    apiRequestMock.mockResolvedValue({ id: 'invoice-1' } as never);

    await getInvoice('invoice-1');

    expect(apiRequestMock).toHaveBeenCalledWith('/invoices/invoice-1');
  });

  it('kreira fakturu (POST /invoices)', async () => {
    apiRequestMock.mockResolvedValue({ id: 'invoice-1' } as never);

    await createInvoice(invoiceInput);

    expect(apiRequestMock).toHaveBeenCalledWith('/invoices', {
      method: 'POST',
      body: invoiceInput,
    });
  });

  it('izdaje fakturu (POST /invoices/:id/issue)', async () => {
    apiRequestMock.mockResolvedValue({ id: 'invoice-1' } as never);

    await issueInvoice('invoice-1');

    expect(apiRequestMock).toHaveBeenCalledWith('/invoices/invoice-1/issue', {
      method: 'POST',
      body: {},
    });
  });

  it('naplaćuje fakturu (POST /invoices/:id/payments)', async () => {
    apiRequestMock.mockResolvedValue({ payment: {}, invoice: {} } as never);

    await createPayment('invoice-1', paymentInput);

    expect(apiRequestMock).toHaveBeenCalledWith('/invoices/invoice-1/payments', {
      method: 'POST',
      body: paymentInput,
    });
  });

  it('poništava fakturu (POST /invoices/:id/cancel)', async () => {
    apiRequestMock.mockResolvedValue({ id: 'void-1' } as never);

    await cancelInvoice('invoice-1');

    expect(apiRequestMock).toHaveBeenCalledWith('/invoices/invoice-1/cancel', {
      method: 'POST',
      body: {},
    });
  });

  it('refundira fakturu (POST /invoices/:id/refund)', async () => {
    apiRequestMock.mockResolvedValue({ id: 'refund-1' } as never);

    await refundInvoice('invoice-1', { amountFening: 500, note: 'Djelimično' });

    expect(apiRequestMock).toHaveBeenCalledWith('/invoices/invoice-1/refund', {
      method: 'POST',
      body: { amountFening: 500, note: 'Djelimično' },
    });
  });
});
