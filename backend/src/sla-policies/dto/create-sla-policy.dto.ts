import { Priority } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateSlaPolicyDto {
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsInt()
  @IsPositive()
  firstResponseTargetMinutes: number;

  @IsInt()
  @IsPositive()
  resolutionTargetMinutes: number;
}
