import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  // Backs the Role & Permission Matrix modal (prd.md §3.3 / designsystem.md §7.8).
  @Get('permission-matrix')
  permissionMatrix() {
    return this.rolesService.permissionMatrix();
  }

  // Admin-configurable RBAC — create a custom role with its own permission
  // set. Gated by `manageRoles`, currently true only for the built-in admin
  // role, so a custom role can't grant itself this capability.
  @RequirePermission('manageRoles')
  @Post()
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto, actor);
  }

  @RequirePermission('manageRoles')
  @Patch(':id/permissions')
  updatePermissions(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRolePermissionsDto) {
    return this.rolesService.updatePermissions(id, dto.permissions, actor, dto.source);
  }
}
