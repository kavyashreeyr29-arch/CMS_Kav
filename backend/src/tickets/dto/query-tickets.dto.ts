import { IsIn, IsOptional, IsString } from 'class-validator';

export class QueryTicketsDto {
  @IsOptional()
  @IsString()
  project?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  source?: string;

  // docs/prd-phase2.md §6.1 — ageing-heatmap drill-down: "view tickets aged
  // past their SLA" reuses the SLA-sweep cron's already-computed flag rather
  // than reinventing an ageing-vs-SLA cross-reference client-side.
  @IsOptional()
  @IsIn(['true', 'false'])
  slaBreached?: string;

  @IsOptional()
  @IsString()
  label?: string;

  // PRD §4.1 — Backlog view filters to Story/Epic types; comma-separated
  // (e.g. "Story,Epic").
  @IsOptional()
  @IsString()
  type?: string;

  // PRD §5 — "My Tasks" default view for Developer/QA base roles.
  @IsOptional()
  @IsIn(['mine', 'all'])
  view?: 'mine' | 'all';

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}
