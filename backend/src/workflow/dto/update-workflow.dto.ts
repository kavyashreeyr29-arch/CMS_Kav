import { TicketStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

export class WorkflowTransitionDto {
  @IsEnum(TicketStatus)
  fromStatus: TicketStatus;

  @IsEnum(TicketStatus)
  toStatus: TicketStatus;

  @IsOptional()
  @IsBoolean()
  requiresAssignee?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresLinkedPr?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresApprovedPr?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresMergedPr?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresQaPass?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedRoleIds?: string[];
}

export class UpdateWorkflowDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionDto)
  transitions: WorkflowTransitionDto[];
}
