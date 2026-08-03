import { IsDateString, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateManualTimeEntryDto {
  @IsDateString()
  date: string; // YYYY-MM-DD

  @Matches(/^\d{2}:\d{2}$/, { message: 'fromTime must be HH:mm' })
  fromTime: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'toTime must be HH:mm' })
  toTime: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  taskName: string;

  @IsOptional()
  @IsString()
  ticketId?: string;
}
