import { Injectable } from '@nestjs/common';

import type { UpsertSubscriptionInput } from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Pretplata firme (§6, §19) — MVP evidencija plana i statusa dok se ne izabere
 * provajder naplate u RS (plan/status su zato slobodni stringovi, bez enuma u §5).
 */
@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  get(companyId: string) {
    return this.prisma.subscription.findUnique({ where: { companyId } });
  }

  async upsert(companyId: string, input: UpsertSubscriptionInput) {
    const data = {
      plan: input.plan,
      status: input.status,
      ...(input.trialEndsAt !== undefined
        ? { trialEndsAt: input.trialEndsAt ? new Date(input.trialEndsAt) : null }
        : {}),
      ...(input.currentPeriodEnd !== undefined
        ? { currentPeriodEnd: input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null }
        : {}),
      ...(input.providerRef !== undefined ? { providerRef: input.providerRef } : {}),
    };

    return this.prisma.subscription.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
  }
}
