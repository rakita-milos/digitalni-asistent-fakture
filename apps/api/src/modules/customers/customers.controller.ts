import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  CreateCustomerInput,
  ListQuery,
  UpdateCustomerInput,
} from '@digitalni-asistent/shared';
import {
  createCustomerSchema,
  listQuerySchema,
  updateCustomerSchema,
  uuidV7Schema,
} from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista kupaca (pretraga preko ?q)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ) {
    return this.customers.list(user.companyId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Dodavanje kupca' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCustomerSchema)) body: CreateCustomerInput,
  ) {
    return this.customers.create(user.companyId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalj kupca' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
  ) {
    return this.customers.get(user.companyId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Izmjena kupca (arhiviranje kroz archivedAt)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) body: UpdateCustomerInput,
  ) {
    return this.customers.update(user.companyId, id, body);
  }
}
