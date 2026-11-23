import { TicketStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpsertIntegrationDto {
  @IsString()
  repoOwner: string;

  @IsString()
  repoName: string;

  // Write-only PAT — omit to keep the existing token. Enables REST backfill.
  @IsOptional()
  @IsString()
  token?: string;

  // Omit to auto-generate (returned once so the admin can paste it into GitHub).
  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsBoolean()
  autoTransition?: boolean;

  @IsOptional()
  @IsEnum(TicketStatus)
  onPrOpenedStatus?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketStatus)
  onPrApprovedStatus?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketStatus)
  onPrMergedStatus?: TicketStatus;
}
