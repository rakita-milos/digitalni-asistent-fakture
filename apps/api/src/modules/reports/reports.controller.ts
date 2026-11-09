import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  MonthlyReportQuery,
  ReceivablesQuery,
} from '@digitalni-asistent/shared';
import { monthlyReportQuerySchema, receivablesQuerySchema } from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('receivables')
  @ApiOperation({ summary: 'Aging potraživanja (current, 1-30, 31-60, 61-90, 90+)' })
  receivables(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(receivablesQuerySchema)) query: ReceivablesQuery,
  ) {
    return this.reports.receivables(user.companyId, query);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Mjesečni izvještaj (izdato / naplaćeno)' })
  monthly(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(monthlyReportQuerySchema)) query: MonthlyReportQuery,
  ) {
    return this.reports.monthly(user.companyId, query);
  }
}
