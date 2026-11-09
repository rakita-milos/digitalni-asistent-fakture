import { buildOperations, planResultApplication, type QueueRow } from './syncEngine';
import { uuidv7 } from '../utils/uuid';

const row = (overrides: Partial<QueueRow> = {}): QueueRow => ({
  id: 'queue-1',
  entity: 'customer',
  op: 'create',
  entityId: '01890a5d-ac96-774b-bcce-b302099a8057',
  payload: JSON.stringify({ name: 'Petar' }),
  createdAt: '2026-11-09T10:00:00.000Z',
  status: 'PENDING',
  error: null,
  ...overrides,
});

describe('uuidv7', () => {
  it('proizvodi UUID v7 oblik', () => {
    const value = uuidv7();
    expect(value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('generiše različite vrijednosti', () => {
    expect(uuidv7()).not.toBe(uuidv7());
  });
});

describe('buildOperations', () => {
  it('parsira payload i mapira entity/op/entityId', () => {
    const operations = buildOperations([row()]);
    expect(operations).toEqual([
      {
        entity: 'customer',
        op: 'create',
        entityId: '01890a5d-ac96-774b-bcce-b302099a8057',
        payload: { name: 'Petar' },
      },
    ]);
  });
});

describe('planResultApplication', () => {
  it('briše applied i duplicate, a failed označava', () => {
    const rows = [
      row({ id: 'q1', entityId: 'id-1' }),
      row({ id: 'q2', entityId: 'id-2' }),
      row({ id: 'q3', entityId: 'id-3' }),
    ];

    const plan = planResultApplication(rows, [
      { entity: 'customer', entityId: 'id-1', status: 'applied' },
      { entity: 'customer', entityId: 'id-2', status: 'duplicate' },
      { entity: 'customer', entityId: 'id-3', status: 'failed', error: 'Neispravan JIB' },
    ]);

    expect(plan.deleteIds).toEqual(['q1', 'q2']);
    expect(plan.failures).toEqual([{ id: 'q3', error: 'Neispravan JIB' }]);
  });

  it('preskače redove bez rezultata', () => {
    const plan = planResultApplication([row({ id: 'q1' })], []);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.failures).toEqual([]);
  });
});
