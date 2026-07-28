import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { RolePermissionsDto } from './role-permissions.dto';

export class UpdateRolePermissionsDto {
  @ValidateNested()
  @Type(() => RolePermissionsDto)
  permissions: RolePermissionsDto;

  @IsOptional()
  @IsString()
  source?: string;
}
