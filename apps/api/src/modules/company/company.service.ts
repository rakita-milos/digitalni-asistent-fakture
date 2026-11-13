import { Injectable, NotFoundException } from '@nestjs/common';

import type { UpdateCompanyInput } from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

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

  /**
   * POST /company/setup-complete (S11-7): serverski signal da je M-02 setup završen.
   * Idempotentno — ponovni poziv ne mijenja vrijeme i ne emituje novi analitički događaj.
   */
  async markSetupComplete(companyId: string) {
    const company = await this.get(companyId);

    if (company.setupCompletedAt) {
      return { setupCompletedAt: company.setupCompletedAt, alreadyCompleted: true };
    }

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: { setupCompletedAt: new Date() },
    });

    this.analytics.track('setup_completed', { companyId });

    return { setupCompletedAt: updated.setupCompletedAt, alreadyCompleted: false };
  }
}
