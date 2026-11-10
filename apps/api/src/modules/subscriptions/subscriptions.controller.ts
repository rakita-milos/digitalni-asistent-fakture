import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { UpsertSubscriptionInput } from '@digitalni-asistent/shared';
import { upsertSubscriptionSchema } from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'Pretplata firme (owner) — subscription: null ako nije evidentirana' })
  async get(@CurrentUser() user: AuthenticatedUser) {
    return { subscription: await this.subscriptions.get(user.companyId) };
  }

  @Post()
  @ApiOperation({ summary: 'Evidencija/izmjena pretplate (owner) — bez naplate u MVP-u' })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(upsertSubscriptionSchema)) body: UpsertSubscriptionInput,
  ) {
    return this.subscriptions.upsert(user.companyId, body);
  }
}
