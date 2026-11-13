import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { UpdateCompanyInput } from '@digitalni-asistent/shared';
import { updateCompanySchema } from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CompanyService } from './company.service';

@ApiTags('company')
@ApiBearerAuth()
@Controller('company')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  @ApiOperation({ summary: 'Profil firme' })
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.get(user.companyId);
  }

  @Post('setup-complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('owner')
  @ApiOperation({ summary: 'Označi da je setup (M-02) završen — idempotentno (owner)' })
  completeSetup(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.markSetupComplete(user.companyId);
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles('owner')
  @ApiOperation({ summary: 'Izmjena profila firme (owner)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateCompanySchema)) body: UpdateCompanyInput,
  ) {
    return this.companyService.update(user.companyId, body);
  }
}
