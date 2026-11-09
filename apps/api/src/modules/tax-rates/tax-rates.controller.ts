import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { CreateTaxRateInput } from '@digitalni-asistent/shared';
import { createTaxRateSchema } from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TaxRatesService } from './tax-rates.service';

@ApiTags('tax-rates')
@ApiBearerAuth()
@Controller('tax-rates')
@UseGuards(JwtAuthGuard)
export class TaxRatesController {
  constructor(private readonly taxRates: TaxRatesService) {}

  @Get()
  @ApiOperation({ summary: 'Porezne stope firme' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.taxRates.list(user.companyId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner')
  @ApiOperation({ summary: 'Dodavanje porezne stope (owner) — §6 nema POST, dodato u Sprintu 1' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTaxRateSchema)) body: CreateTaxRateInput,
  ) {
    return this.taxRates.create(user.companyId, body);
  }
}
