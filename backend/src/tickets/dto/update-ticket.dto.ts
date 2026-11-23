import { Priority } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

// PRD Phase 2 §3.2 — only reachable while the ticket is Open/Reopened; the
// service enforces this, not just the DTO shape.
export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  // Was `@IsEnum(BusinessCategory)` against a fixed 3-value Prisma enum —
  // now a plain string checked against the admin-managed list at the
  // service layer (BusinessCategoriesService.exists()), since valid values
  // can change at runtime. See CHANGELOG.md "admin-manageable categories".
  @IsOptional()
  @IsString()
  businessCategory?: string;

  @IsOptional()
  @IsString()
  labelId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;
}
