import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type {
  CreateCustomerInput,
  ListQuery,
  UpdateCustomerInput,
} from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, query: ListQuery) {
    const where: Prisma.CustomerWhereInput = { companyId, archivedAt: null };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { jib: { contains: query.q } },
        { phone: { contains: query.q } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items, total };
  }

  async get(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, companyId } });

    if (!customer) {
      throw new NotFoundException('Kupac nije pronađen');
    }

    return customer;
  }

  async create(companyId: string, input: CreateCustomerInput) {
    return this.prisma.customer.create({
      data: { companyId, ...input },
    });
  }

  async update(companyId: string, id: string, input: UpdateCustomerInput) {
    await this.get(companyId, id);

    const { archivedAt, ...rest } = input;

    return this.prisma.customer.update({
      where: { id },
      data: {
        ...rest,
        ...(archivedAt !== undefined
          ? { archivedAt: archivedAt === null ? null : new Date(archivedAt) }
          : {}),
      },
    });
  }
}
