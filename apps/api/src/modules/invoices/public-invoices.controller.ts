import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { uuidV7Schema } from '@digitalni-asistent/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { pdfObjectKey } from '../storage/pdf-object-key';
import { R2StorageService } from '../storage/r2-storage.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { verifyPdfLinkToken } from './pdf-link';

/**
 * Javni PDF link iz e-mail/SMS poruke (§6: e-mail/SMS link).
 * Pristup je dozvoljen samo sa kratkotrajnim HMAC tokenom vezanim za fakturu (TTL ≤ 15 min).
 */
@ApiTags('public')
@Controller('public/invoices')
@UseGuards(RateLimitGuard)
export class PublicInvoicesController {
  private readonly logger = new Logger(PublicInvoicesController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: InvoicePdfService,
    private readonly r2: R2StorageService,
  ) {}

  @Get(':id/pdf')
  @RateLimit({ key: 'public-invoice-pdf', limit: 30, windowSeconds: 60 })
  @ApiOperation({ summary: 'PDF fakture preko kratkotrajnog tokena iz poruke' })
  async pdfDocument(
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
    @Query('t') token: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (typeof token !== 'string' || !verifyPdfLinkToken(id, token)) {
      throw new UnauthorizedException('Link je istekao ili nije valjan');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { companyId: true, number: true },
    });
    if (!invoice) {
      throw new NotFoundException('Faktura nije pronađena');
    }

    const buffer = await this.pdf.render(invoice.companyId, id);

    if (this.r2.isConfigured()) {
      try {
        const key = pdfObjectKey(invoice.companyId, id, buffer);
        await this.r2.ensureObject(key, buffer);
        response.redirect(await this.r2.signedUrl(key));
        return;
      } catch (error) {
        this.logger.warn(
          `R2 javni PDF nije uspio (${error instanceof Error ? error.message : String(error)}) — stream fallback`,
        );
      }
    }

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `inline; filename="faktura-${invoice.number}.pdf"`);
    response.setHeader('Content-Length', buffer.length.toString());
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(buffer);
  }
}
