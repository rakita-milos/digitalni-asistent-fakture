import { describe, expect, it } from 'vitest';

import { registerDeviceSchema, upsertSubscriptionSchema } from '../index';

describe('device i subscription šeme (§6)', () => {
  it('validira registraciju uređaja i dozvoljava null push token', () => {
    expect(registerDeviceSchema.safeParse({ pushToken: 'fcm-abc' }).success).toBe(true);
    expect(registerDeviceSchema.safeParse({ pushToken: null }).success).toBe(true);
    expect(registerDeviceSchema.safeParse({ pushToken: '' }).success).toBe(false);
    expect(registerDeviceSchema.safeParse({ platform: 'windows' }).success).toBe(false);
  });

  it('validira pretplatu (plan/status obavezni, datumi ISO)', () => {
    expect(upsertSubscriptionSchema.safeParse({ plan: 'trial', status: 'active' }).success).toBe(
      true,
    );
    expect(upsertSubscriptionSchema.safeParse({ plan: '', status: 'active' }).success).toBe(false);
    expect(
      upsertSubscriptionSchema.safeParse({
        plan: 'trial',
        status: 'active',
        trialEndsAt: '01.11.2026',
      }).success,
    ).toBe(false);
  });
});
