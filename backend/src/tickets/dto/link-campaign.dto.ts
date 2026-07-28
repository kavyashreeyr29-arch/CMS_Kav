import { IsOptional, IsString } from 'class-validator';

export class LinkCampaignDto {
  @IsOptional()
  @IsString()
  campaignId?: string | null;
}
