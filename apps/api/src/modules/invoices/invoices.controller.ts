import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  CreateInvoiceInput,
  InvoiceListQuery,
  UpdateInvoiceInput,
} from '@digitalni-asistent/shared';
import {
  createInvoiceSchema,
  invoiceListQuerySchema,
  updateInvoiceSchema,
  uuidV7Schema,
} from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

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
}
