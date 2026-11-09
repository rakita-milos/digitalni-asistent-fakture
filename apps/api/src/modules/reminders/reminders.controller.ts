import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { ListQuery } from '@digitalni-asistent/shared';
import { listQuerySchema, uuidV7Schema } from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RemindersService } from './reminders.service';

@ApiTags('reminders')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get('reminders')
  @ApiOperation({ summary: 'Lista podsjetnika firme' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ) {
    return this.reminders.list(user.companyId, query);
  }

  @Post('invoices/:id/remind')
  @UseGuards(RolesGuard)
  @Roles('owner', 'worker')
  @ApiOperation({ summary: 'Ručni podsjetnik kupcu (SMS)' })
  remind(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
  ) {
    return this.reminders.sendManual(user.companyId, id);
  }
}
