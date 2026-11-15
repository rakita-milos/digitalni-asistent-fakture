import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { CreateItemInput, ListQuery, UpdateItemInput } from '@digitalni-asistent/shared';
import {
  createItemSchema,
  listQuerySchema,
  updateItemSchema,
  uuidV7Schema,
} from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ItemsService } from './items.service';

@ApiTags('items')
@ApiBearerAuth()
@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  @ApiOperation({ summary: 'Katalog artikala' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ) {
    return this.items.list(user.companyId, query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'worker')
  @ApiOperation({ summary: 'Dodavanje artikla' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createItemSchema)) body: CreateItemInput,
  ) {
    return this.items.create(user.companyId, body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'worker')
  @ApiOperation({ summary: 'Izmjena artikla (arhiviranje kroz archivedAt)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidV7Schema)) id: string,
    @Body(new ZodValidationPipe(updateItemSchema)) body: UpdateItemInput,
  ) {
    return this.items.update(user.companyId, id, body);
  }
}
