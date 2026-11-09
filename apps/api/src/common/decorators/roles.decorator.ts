import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Dozvole po ulozi — §7.10 (owner, worker, accountant, agency). */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
