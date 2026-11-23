import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const SENIORITIES = ['lead', 'manager', 'senior_developer', 'junior_developer', 'intern', 'qa'] as const;

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Was `@IsIn(ROLE_IDS)` — a fixed 12-role compile-time list. Now that
  // admins can create custom roles at runtime (roles/roles.service.ts),
  // that would wrongly reject assigning a user to any role created after
  // server boot. UsersService checks existence against the live role cache
  // instead (roleExists()), which is dynamic.
  @IsString()
  baseRoleId: string;

  @IsOptional()
  @IsIn(SENIORITIES)
  seniority?: string;
}
