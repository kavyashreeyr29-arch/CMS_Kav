import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

// Gated on `userManagement` — the same capability that lets an admin
// create/disable users and manage roles/teams in the first place, so
// whoever can make these changes can also see the trail of who else made
// them.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @RequirePermission('userManagement')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryAuditLogDto) {
    return this.auditLogService.list(user.orgId, query);
  }
}
