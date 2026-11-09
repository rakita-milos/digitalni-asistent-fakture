import { Injectable } from '@nestjs/common';

import type { CreateTaxRateInput } from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaxRatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    const items = await this.prisma.taxRate.findMany({
      where: { companyId },
      orderBy: { rateBp: 'desc' },
    });

    return { items, total: items.length };
  }

  async create(companyId: string, input: CreateTaxRateInput) {
    return this.prisma.taxRate.create({
      data: {
        companyId,
        name: input.name,
        rateBp: input.rateBp,
        sufCode: input.sufCode,
        active: input.active,
      },
    });
  }
}
