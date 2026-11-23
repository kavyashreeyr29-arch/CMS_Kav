import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { effectivePermissions } from '../permissions/effective-permissions';
import { RolePermissions } from '../permissions/role-permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<keyof RolePermissions | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    const perms = effectivePermissions(user);
    request.permissions = perms;

    if (!perms[required]) {
      throw new ForbiddenException(`Role does not have the '${required}' capability`);
    }
    return true;
  }
}
