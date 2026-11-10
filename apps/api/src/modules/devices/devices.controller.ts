import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RegisterDeviceInput } from '@digitalni-asistent/shared';
import { registerDeviceSchema } from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DevicesService } from './devices.service';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registracija push tokena trenutnog uređaja (§6)' })
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(registerDeviceSchema)) body: RegisterDeviceInput,
  ) {
    return this.devices.register(user.id, user.deviceId, body);
  }
}
