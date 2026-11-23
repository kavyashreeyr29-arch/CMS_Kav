import { IsOptional, IsString } from 'class-validator';

export class LinkParentDto {
  @IsOptional()
  @IsString()
  parentTicketId?: string | null;
}
