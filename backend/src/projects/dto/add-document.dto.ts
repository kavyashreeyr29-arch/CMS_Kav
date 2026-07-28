import { IsEnum, IsIn, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { MimeKind } from '@prisma/client';

export class AddDocumentDto {
  @IsString()
  fileName: string;

  @IsInt()
  @IsPositive()
  fileSize: number;

  @IsEnum(MimeKind)
  mimeKind: MimeKind;

  @IsString()
  storageKey: string;

  // Which Basecamp-style folder this file was uploaded from — omitted/absent
  // means the main Docs & Files list.
  @IsOptional()
  @IsIn(['campaign', 'communication', 'reward', 'todo'])
  section?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  rewardId?: string;
}
