import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  AuthSession,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  OtpRequestInput,
  OtpVerifyInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '@digitalni-asistent/shared';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  otpRequestSchema,
  otpVerifySchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@digitalni-asistent/shared';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Odjava — opoziv refresh tokena trenutnog uređaja' })
  logout(@CurrentUser() user: AuthenticatedUser): Promise<{ loggedOut: true }> {
    return this.auth.logout(user.id, user.deviceId);
  }

  @Post('register')
  @RateLimit({ key: 'register', limit: 3, windowSeconds: 3600 })
  @ApiOperation({ summary: 'Registracija firme i vlasnika' })
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<AuthSession> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ key: 'login', limit: 5, windowSeconds: 60 })
  @ApiOperation({ summary: 'Prijava email/telefon + lozinka' })
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthSession> {
    return this.auth.login(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ key: 'refresh', limit: 30, windowSeconds: 60 })
  @ApiOperation({ summary: 'Rotacija refresh tokena' })
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput): Promise<AuthSession> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ key: 'otp-request', limit: 3, windowSeconds: 300 })
  @ApiOperation({ summary: 'Zahtjev za SMS kod' })
  requestOtp(
    @Body(new ZodValidationPipe(otpRequestSchema)) body: OtpRequestInput,
  ): Promise<{ sent: true }> {
    return this.auth.requestOtp(body.phone);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ key: 'otp-verify', limit: 3, windowSeconds: 300 })
  @ApiOperation({ summary: 'Provjera SMS koda' })
  verifyOtp(
    @Body(new ZodValidationPipe(otpVerifySchema)) body: OtpVerifyInput,
  ): Promise<{ verified: true }> {
    return this.auth.verifyOtp(body.phone, body.code);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ key: 'forgot-password', limit: 5, windowSeconds: 900 })
  @ApiOperation({ summary: 'Zahtjev za reset lozinke (link na e-mail)' })
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
  ): Promise<{ sent: true }> {
    return this.auth.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ key: 'reset-password', limit: 10, windowSeconds: 900 })
  @ApiOperation({ summary: 'Postavljanje nove lozinke pomoću tokena iz e-maila' })
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ): Promise<{ reset: true }> {
    return this.auth.resetPassword(body.token, body.password);
  }

  /** M-12: profil prijavljenog korisnika (ruta nije u §6 — vidi PROGRESS, odluka 24). */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RateLimit({ key: 'profile-update', limit: 20, windowSeconds: 3600 })
  @ApiOperation({ summary: 'Izmjena profila (telefon; e-mail uz trenutnu lozinku)' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<{ user: AuthSession['user'] }> {
    return this.auth.updateProfile(user.id, body);
  }

  /** M-12: promjena lozinke iz aplikacije (ruta nije u §6 — vidi PROGRESS, odluka 24). */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RateLimit({ key: 'change-password', limit: 5, windowSeconds: 900 })
  @ApiOperation({ summary: 'Promjena lozinke prijavljenog korisnika (trenutna + nova)' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ): Promise<{ changed: true }> {
    return this.auth.changePassword(user.id, user.deviceId, body);
  }
}
