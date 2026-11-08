import { describe, expect, it } from 'vitest';

import { ERROR_CODES, apiErrorSchema } from './errors';

describe('apiErrorSchema (MASTER PROMPT §6)', () => {
  it('prihvata { code, message }', () => {
    const parsed = apiErrorSchema.parse({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Neispravan unos',
    });
    expect(parsed.code).toBe('VALIDATION_ERROR');
    expect(parsed.details).toBeUndefined();
  });

  it('prihvata details kao listu', () => {
    const parsed = apiErrorSchema.parse({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Neispravan unos',
      details: [{ field: 'jib', message: 'Mora imati 13 cifara' }],
    });
    expect(parsed.details).toHaveLength(1);
  });

  it('odbija prazan code ili message', () => {
    expect(apiErrorSchema.safeParse({ code: '', message: 'x' }).success).toBe(false);
    expect(apiErrorSchema.safeParse({ code: 'X', message: '' }).success).toBe(false);
  });
});
