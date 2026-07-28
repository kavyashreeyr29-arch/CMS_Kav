import { IsArray, IsBoolean, IsOptional } from 'class-validator';

export class BulkUploadRow {
  priority?: string;
  project?: string; // project code
  client?: string;
  responseTarget?: number; // minutes
  resolutionTarget?: number; // minutes
}

export class BulkUploadSlaPoliciesDto {
  @IsArray()
  rows: BulkUploadRow[];

  // false (default) = return a validation preview only, don't persist yet.
  @IsOptional()
  @IsBoolean()
  commit?: boolean;
}
