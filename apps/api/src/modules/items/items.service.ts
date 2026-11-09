import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { CreateItemInput, ListQuery } from '@digitalni-asistent/shared';

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
}
