import { IsEnum, IsIn, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { MimeKind } from '@prisma/client';

export class AddAttachmentDto {
  @IsString()
  fileName: string;

  @IsInt()
  @IsPositive()
  fileSize: number;

  @IsEnum(MimeKind)
  mimeKind: MimeKind;

  @IsString()
  storageKey: string;

  // docs/prd-phase2.md §12 — 'qa' tags evidence uploaded via the QA panel.
  @IsOptional()
  @IsIn(['qa'])
  context?: string;
}
