import { Body, Controller, Get, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { UpdateReminderSettingsInput } from '@digitalni-asistent/shared';
import { updateReminderSettingsSchema } from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReminderSettingsService } from './reminder-settings.service';

@ApiTags('reminder-settings')
@ApiBearerAuth()
@Controller('reminder-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner')
export class ReminderSettingsController {
  constructor(private readonly settings: ReminderSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Plan i šabloni podsjetnika (owner)' })
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.get(user.companyId);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Izmjena plana i šablona podsjetnika (owner)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateReminderSettingsSchema)) body: UpdateReminderSettingsInput,
  ) {
    return this.settings.update(user.companyId, body);
  }
}
