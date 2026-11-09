import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type {
  ReminderScheduleItem,
  ReminderTemplate,
  UpdateReminderSettingsInput,
} from '@digitalni-asistent/shared';
import { DEFAULT_REMINDER_TEMPLATE } from '@digitalni-asistent/shared';

import { PrismaService } from '../../prisma/prisma.service';

export interface ReminderSettingsDto {
  enabled: boolean;
  schedule: ReminderScheduleItem[];
  template: ReminderTemplate;
  senderId: string | null;
}

@Injectable()
export class ReminderSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /reminder-settings — ako firma još nema podešavanja, vraća default (isključeno). */
  async get(companyId: string): Promise<ReminderSettingsDto> {
    const settings = await this.prisma.reminderSetting.findUnique({ where: { companyId } });

    if (!settings) {
      return {
        enabled: false,
        schedule: [],
        template: { text: DEFAULT_REMINDER_TEMPLATE },
        senderId: null,
      };
    }

    return this.toDto(settings);
  }

  /** PUT /reminder-settings (owner) — max 4 automatska podsjetnika (§7.9). */
  async update(
    companyId: string,
    input: UpdateReminderSettingsInput,
  ): Promise<ReminderSettingsDto> {
    const settings = await this.prisma.reminderSetting.upsert({
      where: { companyId },
      create: {
        companyId,
        enabled: input.enabled,
        scheduleJson: input.schedule as unknown as Prisma.InputJsonValue,
        templateJson: input.template as unknown as Prisma.InputJsonValue,
      },
      update: {
        enabled: input.enabled,
        scheduleJson: input.schedule as unknown as Prisma.InputJsonValue,
        templateJson: input.template as unknown as Prisma.InputJsonValue,
      },
    });

    return this.toDto(settings);
  }

  private toDto(settings: {
    enabled: boolean;
    scheduleJson: Prisma.JsonValue;
    templateJson: Prisma.JsonValue;
    senderId: string | null;
  }): ReminderSettingsDto {
    const schedule = Array.isArray(settings.scheduleJson)
      ? (settings.scheduleJson as unknown as ReminderScheduleItem[])
      : [];

    const template =
      settings.templateJson &&
      typeof settings.templateJson === 'object' &&
      'text' in settings.templateJson &&
      typeof (settings.templateJson as { text: unknown }).text === 'string'
        ? { text: (settings.templateJson as { text: string }).text }
        : { text: DEFAULT_REMINDER_TEMPLATE };

    return {
      enabled: settings.enabled,
      schedule,
      template,
      senderId: settings.senderId,
    };
  }
}
