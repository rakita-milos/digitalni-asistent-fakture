import { Injectable, NotFoundException } from '@nestjs/common';

import type { UpdateCompanyInput } from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });

    if (!company) {
      throw new NotFoundException('Firma nije pronađena');
    }

    return company;
  }

  async update(companyId: string, input: UpdateCompanyInput) {
    await this.get(companyId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: input.name,
        address: input.address,
        city: input.city,
        phone: input.phone,
        email: input.email,
        logoUrl: input.logoUrl,
        efdId: input.efdId,
        numberingPrefix: input.numberingPrefix,
        numberingYear: input.numberingYear,
        numberingNext: input.numberingNext,
        defaultDueDays: input.defaultDueDays,
      },
    });
  }
}
