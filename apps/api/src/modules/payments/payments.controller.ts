import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { CreatePaymentInput } from '@digitalni-asistent/shared';
import { createPaymentSchema, uuidV7Schema } from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('invoices/:invoiceId/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'worker')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Naplata fakture (puna ili djelimična)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invoiceId', new ZodValidationPipe(uuidV7Schema)) invoiceId: string,
    @Body(new ZodValidationPipe(createPaymentSchema)) body: CreatePaymentInput,
  ) {
    return this.payments.create(user.companyId, user.id, invoiceId, body);
  }
}
