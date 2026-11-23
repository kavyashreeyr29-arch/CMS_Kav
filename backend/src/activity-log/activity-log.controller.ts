import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

// Backs the "Comms & tracking" audit log (prd.md §10 / §11) — full-access
// roles only, enforced via the `comms` capability.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @RequirePermission('comms')
  @Get('recent')
  recent(@Query('limit') limit?: string) {
    return this.activityLogService.recent(limit ? parseInt(limit, 10) : undefined);
  }
}
