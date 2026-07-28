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
}
