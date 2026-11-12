import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import type {
  CreateInvoiceInput,
  InvoiceListQuery,
  RefundInvoiceInput,
  SendInvoiceInput,
  UpdateInvoiceInput,
} from '@digitalni-asistent/shared';
import {
  createInvoiceSchema,
  invoiceListQuerySchema,
  refundInvoiceSchema,
  sendInvoiceSchema,
  updateInvoiceSchema,
  uuidV7Schema,
} from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly pdf: InvoicePdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista faktura (status, period, kupac, pretraga broja)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(invoiceListQuerySchema)) query: InvoiceListQuery,
  ) {
    return this.invoices.list(user.companyId, query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'worker')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Nova faktura (DRAFT)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceInput,
  ) {
    return this.invoices.create(user.companyId, user.id, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalj fakture' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
  ) {
    return this.invoices.get(user.companyId, id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'worker')
  @ApiOperation({ summary: 'Izmjena DRAFT fakture' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
    @Body(new ZodValidationPipe(updateInvoiceSchema)) body: UpdateInvoiceInput,
  ) {
    return this.invoices.update(user.companyId, id, body);
  }

  @Post(':id/issue')
  @UseGuards(RolesGuard)
  @Roles('owner', 'worker')
  @ApiOperation({ summary: 'Izdavanje: fiskalizacija (ESIR adapter) + dodjela broja' })
  issue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
  ) {
    return this.invoices.issue(user.companyId, user.id, id);
  }

  @Post(':id/convert')
  @UseGuards(RolesGuard)
  @Roles('owner', 'worker')
  @ApiOperation({ summary: 'Konverzija PRAČUNA u draft račun (M-09)' })
  convert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
  ) {
    return this.invoices.convert(user.companyId, user.id, id);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('owner', 'worker')
  @ApiOperation({ summary: 'Poništenje: novi VOID zapis + original prelazi u CANCELLED' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
  ) {
    return this.invoices.cancel(user.companyId, user.id, id);
  }

  @Post(':id/refund')
  @UseGuards(RolesGuard)
  @Roles('owner', 'worker')
  @ApiOperation({ summary: 'Refundacija: novi REFUND zapis (iznos ≤ naplaćeno)' })
  refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
    @Body(new ZodValidationPipe(refundInvoiceSchema)) body: RefundInvoiceInput,
  ) {
    return this.invoices.refund(user.companyId, user.id, id, body);
  }

  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles('owner', 'worker')
  @ApiOperation({ summary: 'Slanje fakture e-mailom (PDF) ili SMS-om (kratkotrajni link)' })
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
    @Body(new ZodValidationPipe(sendInvoiceSchema)) body: SendInvoiceInput,
  ) {
    return this.invoices.send(user.companyId, user.id, id, body);
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'QR kod fiskalnog računa (PNG) — za prikaz na mobilnom' })
  async qr(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const buffer = await this.pdf.renderQr(user.companyId, id);

    response.setHeader('Content-Type', 'image/png');
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.setHeader('Content-Length', buffer.length.toString());
    response.send(buffer);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'PDF računa (A4, PFR + QR)' })
  async pdfDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const buffer = await this.pdf.render(user.companyId, id);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `inline; filename="faktura-${id}.pdf"`);
    response.setHeader('Content-Length', buffer.length.toString());
    response.send(buffer);
  }
}
