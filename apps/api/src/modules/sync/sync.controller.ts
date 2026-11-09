import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { SyncPullQuery, SyncPushInput } from '@digitalni-asistent/shared';
import { syncPullQuerySchema, syncPushSchema } from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('push')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('owner', 'worker')
  @ApiOperation({ summary: 'Batch offline operacija (idempotentno po entityId)' })
  push(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(syncPushSchema)) body: SyncPushInput,
  ) {
    return this.sync.push(user.companyId, user.id, user.deviceId, body);
  }

  @Get('pull')
  @ApiOperation({ summary: 'Delta za uređaj (kupci + fakture od `since`)' })
  pull(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(syncPullQuerySchema)) query: SyncPullQuery,
  ) {
    return this.sync.pull(user.companyId, query);
  }
}
