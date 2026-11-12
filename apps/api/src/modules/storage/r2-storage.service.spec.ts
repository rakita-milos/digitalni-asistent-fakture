import { describe, expect, it } from 'vitest';

import type { R2Config } from './r2.config';
import { pdfObjectKey } from './pdf-object-key';
import { R2StorageService } from './r2-storage.service';

const config: R2Config = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  bucket: 'digitalni-asistent',
  endpoint: 'https://example.r2.cloudflarestorage.com',
  ttlSeconds: 900,
};

describe('R2StorageService (§21: signed URL TTL ≤ 15 min)', () => {
  it('bez kredencijala nije konfigurisan i odbija potpisivanje', async () => {
    const service = new R2StorageService(null);

    expect(service.isConfigured()).toBe(false);
    await expect(service.signedUrl('pdf/x.pdf')).rejects.toThrow('R2 nije konfigurisan');
    await expect(service.ensureObject('pdf/x.pdf', Buffer.from('x'))).rejects.toThrow(
      'R2 nije konfigurisan',
    );
  });

  it('potpisuje kratkotrajni URL sa zadatim TTL-om (bez mreže)', async () => {
    const service = new R2StorageService(config);

    expect(service.isConfigured()).toBe(true);

    const url = await service.signedUrl('pdf/invoices/c1/i1-abc.pdf');

    expect(url).toContain('example.r2.cloudflarestorage.com');
    expect(url).toContain('digitalni-asistent');
    expect(url).toContain('pdf/invoices/c1/i1-abc.pdf');
    expect(url).toContain('X-Amz-Expires=900');
    expect(url).toContain('X-Amz-Signature=');
  });

  it('ključ PDF-a je content-addressed (izmjena sadržaja mijenja ključ)', () => {
    const companyId = 'c1';
    const invoiceId = 'i1';

    const first = pdfObjectKey(companyId, invoiceId, Buffer.from('pdf-1'));
    const second = pdfObjectKey(companyId, invoiceId, Buffer.from('pdf-2'));

    expect(first).toBe(pdfObjectKey(companyId, invoiceId, Buffer.from('pdf-1')));
    expect(first).not.toBe(second);
    expect(first).toMatch(/^pdf\/invoices\/c1\/i1-[0-9a-f]{16}\.pdf$/);
  });
});
