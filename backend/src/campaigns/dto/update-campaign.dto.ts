import { CampaignStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
