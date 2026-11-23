import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateApprovalRequestDto {
  @IsString()
  ticketId: string;

  @IsString()
  label: string;

  // Exactly one of approverUserId / approverRoleId must be set — enforced in
  // the service (not expressible as a DB constraint across two nullable FKs).
  @ValidateIf((o) => !o.approverRoleId)
  @IsString()
  approverUserId?: string;

  @ValidateIf((o) => !o.approverUserId)
  @IsString()
  approverRoleId?: string;

  @IsOptional()
  @IsString()
  requestNote?: string;
}

export class DecideApprovalDto {
  @IsIn(['approved', 'rejected', 'changes_requested'])
  decision: 'approved' | 'rejected' | 'changes_requested';

  @IsOptional()
  @IsString()
  comment?: string;
}
