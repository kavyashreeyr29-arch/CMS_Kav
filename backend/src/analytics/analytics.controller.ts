import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser, effectivePermissions } from '../common/permissions/effective-permissions';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @RequirePermission('adminAnalytics')
  @Get('project-wise')
  projectWise(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.projectWise(user, effectivePermissions(user));
  }

  @RequirePermission('adminAnalytics')
  @Get('productivity')
  productivity(@CurrentUser() user: AuthenticatedUser, @Query('sinceDays') sinceDays?: string) {
    return this.analyticsService.productivity(user, effectivePermissions(user), sinceDays ? parseInt(sinceDays, 10) : undefined);
  }

  @Get('trend')
  trend(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period') period: 'month' | 'quarter' | 'year' = 'month',
    @Query('project') project?: string,
  ) {
    return this.analyticsService.trend(user, effectivePermissions(user), period, project);
  }

  @RequirePermission('adminAnalytics')
  @Get('cycle-time')
  cycleTime(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.cycleTime(user, effectivePermissions(user));
  }
}
