import { Type } from 'class-transformer';
import { IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { RolePermissionsDto } from './role-permissions.dto';

export class CreateRoleDto {
  // Lowercase snake_case, matching the 12 built-in role ids' shape
  // (role-permissions.ts ROLE_IDS) — this becomes both Role.id (PK) and the
  // value stored in User.baseRoleId, so it needs to be a safe, stable slug.
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,39}$/, { message: 'id must be lowercase snake_case, starting with a letter (2-40 chars)' })
  id: string;

  @IsString()
  label: string;

  @IsString()
  group: string;

  @ValidateNested()
  @Type(() => RolePermissionsDto)
  permissions: RolePermissionsDto;

  // Only meaningful when permissions.scope === 'source' — see
  // role-permissions.ts's setSourceForRole(). Optional because most custom
  // roles won't use 'source' scope.
  @IsOptional()
  @IsString()
  source?: string;
}
