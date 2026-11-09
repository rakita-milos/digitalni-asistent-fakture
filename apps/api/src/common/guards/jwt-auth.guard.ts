import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { env } from '../../config/env';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

export interface AccessTokenPayload {
  sub: string;
  companyId: string;
  role: string;
  deviceId: string;
  type: 'access';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Nedostaje access token');
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(header.slice(7), {
        secret: env.JWT_ACCESS_SECRET,
      });

      if (payload.type !== 'access') {
        throw new Error('Pogrešan tip tokena');
      }

      request.user = {
        id: payload.sub,
        companyId: payload.companyId,
        role: payload.role,
        deviceId: payload.deviceId,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Neispravan ili istekao access token');
    }
  }
}
