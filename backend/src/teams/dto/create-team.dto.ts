import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  leadUserId?: string;

  @IsOptional()
  @IsArray()
  memberUserIds?: string[];

  // Admin-configurable "team hours" access beyond this team's own Lead —
  // specific people and/or whole roles. See common/permissions/team-access.ts.
  @IsOptional()
  @IsArray()
  hoursViewerUserIds?: string[];

  @IsOptional()
  @IsArray()
  hoursViewerRoleIds?: string[];
}
