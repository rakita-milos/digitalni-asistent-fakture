import { listCustomers } from './customers';
import { apiRequest } from './client';

jest.mock('./client', () => ({
  apiRequest: jest.fn(),
}));

const apiRequestMock = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('customers API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('građuje query string sa pretragom i paginacijom', async () => {
    apiRequestMock.mockResolvedValue({ items: [], total: 0 });

    await listCustomers({ q: 'petar', limit: 10, offset: 20 });

    expect(apiRequestMock).toHaveBeenCalledWith('/customers?q=petar&limit=10&offset=20');
  });

  it('poziva /customers bez query stringa kada nema filtera', async () => {
    apiRequestMock.mockResolvedValue({ items: [], total: 0 });

    await listCustomers();

    expect(apiRequestMock).toHaveBeenCalledWith('/customers');
  });
});
