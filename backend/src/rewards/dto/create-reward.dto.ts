import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateRewardDto {
  @IsString()
  projectCode: string;

  @IsString()
  name: string;

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
