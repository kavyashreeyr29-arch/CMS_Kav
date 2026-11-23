import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateRewardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  rewardType?: string;

  @IsOptional()
  @IsNumber()
  value?: number;
}
