import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { PasswordResetService } from './password-reset.service';
import { SmsService } from './sms.service';

@Module({
  imports: [JwtModule.register({ global: true })],
  controllers: [AuthController],
  providers: [AuthService, SmsService, EmailService, PasswordResetService],
  exports: [JwtModule, SmsService, EmailService],
})
export class AuthModule {}
