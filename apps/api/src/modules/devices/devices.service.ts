import { Injectable, NotFoundException } from '@nestjs/common';

import type { RegisterDeviceInput } from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';

/** Uređaj je kreiran pri prijavi; ovdje se evidentira push token (§6). */
@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, deviceId: string | undefined, input: RegisterDeviceInput) {
    if (!deviceId) {
      throw new NotFoundException('Uređaj nije evidentiran u sesiji');
    }

    const device = await this.prisma.device.findFirst({ where: { id: deviceId, userId } });

    if (!device) {
      throw new NotFoundException('Uređaj nije pronađen');
    }

    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        ...(input.pushToken !== undefined ? { pushToken: input.pushToken } : {}),
        ...(input.platform ? { platform: input.platform } : {}),
        ...(input.appVersion ? { appVersion: input.appVersion } : {}),
        lastSeenAt: new Date(),
      },
    });

    return {
      id: updated.id,
      platform: updated.platform,
      pushToken: updated.pushToken,
      appVersion: updated.appVersion,
      lastSeenAt: updated.lastSeenAt,
    };
  }
}
