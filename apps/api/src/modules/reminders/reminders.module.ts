import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ReminderSettingsController } from './reminder-settings.controller';
import { ReminderSettingsService } from './reminder-settings.service';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [AuthModule],
  controllers: [ReminderSettingsController, RemindersController],
  providers: [ReminderSettingsService, RemindersService],
})
export class RemindersModule {}
