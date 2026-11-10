import { buildLocalDraftDetail } from './localInvoiceDetail';

describe('localInvoiceDetail — offline keš detalja (M-08)', () => {
  it('građuje DRAFT detalj sa istim obračunom kao API', () => {
    const detail = buildLocalDraftDetail({
      id: '01a1c08c-fe91-7442-aa91-42b45feec4f3',
      customerId: 'customer-1',
      customerName: 'Petar Petrović',
      issueDate: '2026-11-10T12:00:00.000Z',
      dueDate: '2026-11-25T12:00:00.000Z',
      lines: [
        {
          description: 'Kabl',
          qtyMilli: 1500,
          unitPriceFening: 1000,
          discountBp: 0,
          taxRateBp: 1700,
        },
      ],
    });

    expect(detail.status).toBe('DRAFT');
    expect(detail.type).toBe('SALE');
    expect(detail.number).toMatch(/^DRAFT-/);
    expect(detail.customer).toEqual({ id: 'customer-1', name: 'Petar Petrović' });
    expect(detail.lines).toHaveLength(1);
    expect(detail.lines[0]?.lineTotalFening).toBe(1755);
    expect(detail.subtotalFening).toBe(1500);
    expect(detail.taxFening).toBe(255);
    expect(detail.totalFening).toBe(1755);
    expect(detail.paidFening).toBe(0);
    expect(detail.payments).toEqual([]);
  });

  it('sabira više stavki u ukupne iznose', () => {
    const detail = buildLocalDraftDetail({
      id: '01a1c08c-fe91-7442-aa91-42b45feec4f3',
      customerId: 'c1',
      customerName: 'Kupac',
      issueDate: '2026-11-10T12:00:00.000Z',
      dueDate: '2026-11-25T12:00:00.000Z',
      lines: [
        { description: 'A', qtyMilli: 1000, unitPriceFening: 1000, discountBp: 0, taxRateBp: 1700 },
        { description: 'B', qtyMilli: 2000, unitPriceFening: 500, discountBp: 0, taxRateBp: 0 },
      ],
    });

    expect(detail.subtotalFening).toBe(2000);
    expect(detail.taxFening).toBe(170);
    expect(detail.totalFening).toBe(2170);
  });
});
