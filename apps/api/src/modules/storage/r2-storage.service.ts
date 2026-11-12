import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { R2Config } from './r2.config';
import { R2_CONFIG } from './r2.config';

/**
 * Cloudflare R2 (S3 API) — PDF faktura se čuva jednom i servira preko kratkotrajnog
 * signed URL-a (§21: TTL ≤ 15 min). Ako R2 nije konfigurisan, pozivalac streamuje PDF.
 */
@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client | null;
  private readonly config: R2Config | null;

  constructor(@Inject(R2_CONFIG) config: R2Config | null) {
    this.config = config;
    this.client = config
      ? new S3Client({
          region: 'auto',
          endpoint: config.endpoint,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          forcePathStyle: true,
        })
      : null;
  }

  isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  /** Uploaduje objekat samo ako već ne postoji (HEAD); PDF je content-addressed ključem. */
  async ensureObject(key: string, body: Buffer, contentType = 'application/pdf'): Promise<void> {
    const client = this.client;
    const config = this.config;
    if (!client || !config) {
      throw new Error('R2 nije konfigurisan');
    }

    try {
      await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
      return;
    } catch {
      // Nema objekta (404) ili HEAD nije dozvoljen — pokušavamo upload.
      this.logger.debug(`R2: upload objekta ${key}`);
    }

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async signedUrl(key: string, ttlSeconds: number = this.config?.ttlSeconds ?? 900): Promise<string> {
    const client = this.client;
    const config = this.config;
    if (!client || !config) {
      throw new Error('R2 nije konfigurisan');
    }

    return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
      expiresIn: ttlSeconds,
    });
  }
}
