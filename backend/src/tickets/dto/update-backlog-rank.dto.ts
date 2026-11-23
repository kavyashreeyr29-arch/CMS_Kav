import { IsInt } from 'class-validator';

export class UpdateBacklogRankDto {
  @IsInt()
  backlogRank: number;
}
