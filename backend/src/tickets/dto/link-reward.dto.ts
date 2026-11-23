import { IsOptional, IsString } from 'class-validator';

export class LinkRewardDto {
  @IsOptional()
  @IsString()
  rewardId?: string | null;
}
