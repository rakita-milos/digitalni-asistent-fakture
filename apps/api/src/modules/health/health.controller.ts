import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

export interface HealthResponse {
  status: 'ok';
  /** Sekunde rada procesa. */
  uptime: number;
  /** UTC vrijeme (§7.12). */
  timestamp: string;
}

/**
 * Infra ruta (dogovoreno na kickoff-u) — koristi se za Docker healthcheck i CI smoke test.
 * Nije dio poslovnog API-ja iz MASTER PROMPT §6.
 */
@ApiTags('infra')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness provjera API-ja' })
  @ApiOkResponse({
    description: 'API je živ',
    schema: {
      example: { status: 'ok', uptime: 12.34, timestamp: '2026-01-01T00:00:00.000Z' },
    },
  })
  check(): HealthResponse {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
