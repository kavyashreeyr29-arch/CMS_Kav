import { Controller, ForbiddenException, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { WorkHoursQueryDto } from './dto/work-hours-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser, effectivePermissions } from '../common/permissions/effective-permissions';

// PRD §8.5 / LLD §4.6 — Team Hours panel. Audience: Admin, Director, PM,
// Lead (team-scoped); Developer/QA/PM see their own hours only.
@UseGuards(JwtAuthGuard)
@Controller('reports/work-hours')
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Get()
  async workHours(@CurrentUser() user: AuthenticatedUser, @Query() query: WorkHoursQueryDto) {
    const perms = effectivePermissions(user);
    // Own default plus any Team.hoursViewerUserIds/hoursViewerRoleIds grant
    // (common/permissions/team-access.ts) — a role that otherwise sees none
    // or only its own hours can be granted team-level access to a specific
    // team without its role changing anywhere else.
    const effectiveVisibility = await this.timeEntriesService.effectiveWorkHoursVisibility(user, perms);
    if (effectiveVisibility === 'none') {
      throw new ForbiddenException('Your role cannot view work-hours reports');
    }
    const teamIds = query.team?.split(',').filter(Boolean);
    // Only org/team-visibility roles get a real date range or a member
    // filter — 'own'-visibility roles (Developer/QA/PM) are pinned to today,
    // regardless of what the client sends, same as the existing 'own' gate
    // on scopedUserIds inside the service.
    const canUseRangeAndMember = effectiveVisibility === 'org' || effectiveVisibility === 'team';
    const startDate = canUseRangeAndMember ? query.startDate ?? query.date : undefined;
    const endDate = canUseRangeAndMember ? query.endDate ?? query.date : undefined;
    const memberUserId = canUseRangeAndMember ? query.userId : undefined;
    return this.timeEntriesService.workHours(user, perms, startDate, endDate, teamIds, memberUserId);
  }

  @Get('daily')
  async daily(@CurrentUser() user: AuthenticatedUser, @Query() query: WorkHoursQueryDto) {
    const perms = effectivePermissions(user);
    const effectiveVisibility = await this.timeEntriesService.effectiveWorkHoursVisibility(user, perms);
    if (effectiveVisibility === 'none') {
      throw new ForbiddenException('Your role cannot view work-hours reports');
    }
    const teamIds = query.team?.split(',').filter(Boolean);
    const canUseRangeAndMember = effectiveVisibility === 'org' || effectiveVisibility === 'team';
    const startDate = canUseRangeAndMember ? query.startDate ?? query.date : undefined;
    const endDate = canUseRangeAndMember ? query.endDate ?? query.date : undefined;
    const memberUserId = canUseRangeAndMember ? query.userId : undefined;
    return this.timeEntriesService.dailyBreakdown(user, perms, startDate, endDate, teamIds, memberUserId);
  }

  @Get(':userId/tickets')
  async drillDown(
    @Param('userId') userId: string,
    @Query('date') date: string,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const perms = effectivePermissions(user);
    // Reuses canViewUser (also grant-aware) rather than a separate
    // 'own'-only check — that previously let any org/team-visibility role
    // drill into literally anyone by id, not just people in their actual
    // scope.
    if (!(await this.timeEntriesService.canViewUser(user, perms, userId))) {
      throw new ForbiddenException('You cannot view this person\'s hours');
    }
    return this.timeEntriesService.drillDown(userId, startDate ?? date, endDate);
  }
}
