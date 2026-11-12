import { Body, Controller, Delete, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { DeleteAccountInput } from '@digitalni-asistent/shared';
import { deleteAccountSchema } from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AccountService } from './account.service';

@ApiTags('account')
@ApiBearerAuth()
@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('export')
  @UseGuards(RolesGuard)
  @Roles('owner')
  @ApiOperation({ summary: 'Izvoz svih podataka firme (JSON, GDPR)' })
  exportData(@CurrentUser() user: AuthenticatedUser) {
    return this.account.export(user.id, user.companyId);
  }

  @Delete()
  @UseGuards(RolesGuard)
  @Roles('owner')
  @ApiOperation({ summary: 'Brisanje naloga — anonimizacija, fiskalni podaci ostaju (GDPR)' })
  deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
  ) {
    return this.account.delete(user.id, user.companyId, body);
  }
}
