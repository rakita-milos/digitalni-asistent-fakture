import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

export type DependencyStatus = 'ok' | 'error';

export interface HealthResponse {
  /** 'ok' samo ako su i baza i Redis dostupni. */
  status: 'ok' | 'error';
  /** Sekunde rada procesa. */
  uptime: number;
  /** UTC vrijeme (§7.12). */
  timestamp: string;
  /** Stanje zavisnosti — Pre-Deployment Checklist B4. */
  checks: { database: DependencyStatus; redis: DependencyStatus };
}

/**
 * Infra ruta (dogovoreno na kickoff-u) — koristi se za Docker healthcheck i CI smoke test.
 * Pre-Deployment Checklist B: health provjerava i bazu i Redis, ne samo da proces radi.
 * Nije dio poslovnog API-ja iz MASTER PROMPT §6.
 */
@ApiTags('infra')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Readiness provjera API-ja (baza + Redis)' })
  @ApiOkResponse({
    description: 'API i zavisnosti su živi',
    schema: {
      example: {
        status: 'ok',
        uptime: 12.34,
        timestamp: '2026-01-01T00:00:00.000Z',
        checks: { database: 'ok', redis: 'ok' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Barem jedna zavisnost nije dostupna',
  })
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const healthy = database === 'ok' && redis === 'ok';

    if (!healthy) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: healthy ? 'ok' : 'error',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    // ioredis se povezuje asinhrono: prvi PING odmah poslije starta može pasti dok je
    // status još 'connecting' (enableOfflineQueue=false). Jedan kratki retry čini
    // readiness provjeru stabilnom, a pravi pad Redis-a i dalje vraća 503.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.redis.ping();
        return 'ok';
      } catch {
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    }

    return 'error';
  }
}
