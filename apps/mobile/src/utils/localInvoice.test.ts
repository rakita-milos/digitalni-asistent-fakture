import { buildLocalDraftInvoice, formatLocalDraftNumber } from './localInvoice';

describe('localInvoice — offline draft (M-05)', () => {
  it('pravi privremeni DRAFT broj iz UUID-a', () => {
    const number = formatLocalDraftNumber('01a1c08c-fe91-7442-aa91-42b45feec4f3');
    expect(number).toMatch(/^DRAFT-[A-Z0-9]{8}$/);
    expect(number).toContain('5FEEC4F3');
  });

  it('građuje lokalnu draft fakturu sa statusom DRAFT i nulom naplaćeno', () => {
    const invoice = buildLocalDraftInvoice({
      id: '01a1c08c-fe91-7442-aa91-42b45feec4f3',
      customerId: 'customer-1',
      customerName: 'Petar Petrović',
      issueDate: '2026-11-10T12:00:00.000Z',
      dueDate: '2026-11-25T12:00:00.000Z',
      totalFening: 1755,
      updatedAt: '2026-11-10T10:00:00.000Z',
    });

    expect(invoice.status).toBe('DRAFT');
    expect(invoice.paidFening).toBe(0);
    expect(invoice.totalFening).toBe(1755);
    expect(invoice.customerName).toBe('Petar Petrović');
    expect(invoice.number).toMatch(/^DRAFT-/);
  });
});
