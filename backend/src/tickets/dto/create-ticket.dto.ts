import { Priority, TicketSource, TicketType } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CustomFieldInput {
  @IsString()
  fieldGroup: 'developer' | 'qa' | 'pm';

  @IsString()
  fieldKey: string;

  @IsString()
  fieldValue: string;
}

export class CreateTicketDto {
  @IsString()
  projectCode: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TicketType)
  type: TicketType;

  @IsEnum(Priority)
  priority: Priority;

  @IsEnum(TicketSource)
  source: TicketSource;

  // Was `@IsEnum(BusinessCategory)` — now a plain string checked against the
  // admin-managed list at the service layer. See update-ticket.dto.ts.
  @IsOptional()
  @IsString()
  businessCategory?: string;

  @IsOptional()
  @IsString()
  labelId?: string;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @IsOptional()
  @IsArray()
  watcherUserIds?: string[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  storyPoints?: number;

  @IsOptional()
  @IsNumber()
  estimatedHours?: number;

  @IsOptional()
  @IsString()
  parentTicketId?: string;

  @IsOptional()
  @IsArray()
  customFields?: CustomFieldInput[];
}
