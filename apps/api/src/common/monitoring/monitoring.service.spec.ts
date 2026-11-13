import { describe, expect, it, vi } from 'vitest';

import { MonitoringService } from './monitoring.service';

describe('MonitoringService (S10-3: no-op bez DSN-a)', () => {
  it('bez DSN-a je isključen i ne baca greške', () => {
    const service = new MonitoringService({
      environment: 'test',
      tracesSampleRate: 0,
    });

    expect(service.isEnabled()).toBe(false);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => service.captureException(new Error('test'))).not.toThrow();
    expect(() => service.captureMessage('test', 'error', { invoiceId: 'i1' })).not.toThrow();
    errorSpy.mockRestore();
  });
});
