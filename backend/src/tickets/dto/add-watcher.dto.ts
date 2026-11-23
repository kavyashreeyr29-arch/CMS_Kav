import { IsString } from 'class-validator';

export class AddWatcherDto {
  @IsString()
  userId: string;
}
