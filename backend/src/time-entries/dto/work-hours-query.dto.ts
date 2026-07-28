import { IsOptional, IsString } from 'class-validator';

export class WorkHoursQueryDto {
  @IsOptional()
  @IsString()
  date?: string; // YYYY-MM-DD — kept for back-compat; equivalent to startDate=endDate=date

  @IsOptional()
  @IsString()
  startDate?: string; // YYYY-MM-DD, defaults to today

  @IsOptional()
  @IsString()
  endDate?: string; // YYYY-MM-DD, defaults to startDate

  @IsOptional()
  @IsString()
  userId?: string; // filter the rollup to a single member

  @IsOptional()
  @IsString()
  team?: string; // comma-separated team ids

  @IsOptional()
  @IsString()
  seniority?: string; // comma-separated seniority values
}
