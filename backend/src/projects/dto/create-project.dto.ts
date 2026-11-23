import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { Priority, ProjectStatus } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  client: string;

  @IsString()
  pmUserId: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsEnum(ProjectStatus)
  status: ProjectStatus;

  @IsEnum(Priority)
  priority: Priority;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  description?: string;

  // docs/prd-phase2.md §11 — who gets access when the project isn't fully
  // open to their tier by default; empty/omitted means "everyone the
  // role-scope model already allows" (see ProjectsService.findAll).
  @IsOptional()
  @IsArray()
  memberUserIds?: string[];
}
