import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { CreateItemInput, ListQuery, UpdateItemInput } from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';

function toItemDto(item: {
  id: string;
  companyId: string;
  name: string;
  unit: string;
  priceFening: bigint;
  taxRateBp: number;
  archivedAt: Date | null;
}) {
  // BigInt ne može u JSON — konverzija u number (iznosi su daleko ispod 2^53).
  return { ...item, priceFening: Number(item.priceFening) };
}

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, query: ListQuery) {
    const where: Prisma.ItemWhereInput = { companyId, archivedAt: null };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { unit: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.item.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.item.count({ where }),
    ]);

    return { items: items.map(toItemDto), total };
  }

  async create(companyId: string, input: CreateItemInput) {
    const item = await this.prisma.item.create({
      data: {
        companyId,
        name: input.name,
        unit: input.unit,
        priceFening: BigInt(input.priceFening),
        taxRateBp: input.taxRateBp,
      },
    });

    return toItemDto(item);
  }

  /**
   * PATCH /items/:id — izmjena ili arhiviranje (S11, van §6 kao i `PATCH /customers/:id`).
   * Tuđi artikal se ne razlikuje od nepostojećeg (404, ne 403) da se ne otkrije IDOR.
   */
  async update(companyId: string, id: string, input: UpdateItemInput) {
    const existing = await this.prisma.item.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Artikal nije pronađen');
    }

    const { archivedAt, priceFening, ...rest } = input;

    const item = await this.prisma.item.update({
      where: { id },
      data: {
        ...rest,
        ...(priceFening !== undefined ? { priceFening: BigInt(priceFening) } : {}),
        ...(archivedAt !== undefined
          ? { archivedAt: archivedAt === null ? null : new Date(archivedAt) }
          : {}),
      },
    });

    return toItemDto(item);
  }
}
