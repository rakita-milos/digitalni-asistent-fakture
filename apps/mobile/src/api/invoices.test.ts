import { listInvoices } from './invoices';
import { apiRequest } from './client';

jest.mock('./client', () => ({
  apiRequest: jest.fn(),
}));

const apiRequestMock = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('invoices API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('građuje query string sa statusom i limitom', async () => {
    apiRequestMock.mockResolvedValue({ items: [], total: 0 });

    await listInvoices({ status: 'DRAFT', limit: 100 });

    expect(apiRequestMock).toHaveBeenCalledWith('/invoices?status=DRAFT&limit=100');
  });

  it('poziva /invoices bez filtera', async () => {
    apiRequestMock.mockResolvedValue({ items: [], total: 0 });

    await listInvoices();

    expect(apiRequestMock).toHaveBeenCalledWith('/invoices');
  });
});
