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
  workHours(@CurrentUser() user: AuthenticatedUser, @Query() query: WorkHoursQueryDto) {
    const perms = effectivePermissions(user);
    if (perms.workHoursVisibility === 'none') {
      throw new ForbiddenException('Your role cannot view work-hours reports');
    }
    const teamIds = query.team?.split(',').filter(Boolean);
    // Only org/team-visibility roles get a real date range or a member
    // filter — 'own'-visibility roles (Developer/QA/PM) are pinned to today,
    // regardless of what the client sends, same as the existing 'own' gate
    // on scopedUserIds inside the service.
    const canUseRangeAndMember = perms.workHoursVisibility === 'org' || perms.workHoursVisibility === 'team';
    const startDate = canUseRangeAndMember ? query.startDate ?? query.date : undefined;
    const endDate = canUseRangeAndMember ? query.endDate ?? query.date : undefined;
    const memberUserId = canUseRangeAndMember ? query.userId : undefined;
    return this.timeEntriesService.workHours(user, perms, startDate, endDate, teamIds, memberUserId);
  }

  @Get('daily')
  daily(@CurrentUser() user: AuthenticatedUser, @Query() query: WorkHoursQueryDto) {
    const perms = effectivePermissions(user);
    if (perms.workHoursVisibility === 'none') {
      throw new ForbiddenException('Your role cannot view work-hours reports');
    }
    const teamIds = query.team?.split(',').filter(Boolean);
    const canUseRangeAndMember = perms.workHoursVisibility === 'org' || perms.workHoursVisibility === 'team';
    const startDate = canUseRangeAndMember ? query.startDate ?? query.date : undefined;
    const endDate = canUseRangeAndMember ? query.endDate ?? query.date : undefined;
    const memberUserId = canUseRangeAndMember ? query.userId : undefined;
    return this.timeEntriesService.dailyBreakdown(user, perms, startDate, endDate, teamIds, memberUserId);
  }

  @Get(':userId/tickets')
  drillDown(
    @Param('userId') userId: string,
    @Query('date') date: string,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const perms = effectivePermissions(user);
    if (perms.workHoursVisibility === 'none') {
      throw new ForbiddenException('Your role cannot view work-hours reports');
    }
    if (perms.workHoursVisibility === 'own' && userId !== user.id) {
      throw new ForbiddenException('You can only drill into your own hours');
    }
    return this.timeEntriesService.drillDown(userId, startDate ?? date, endDate);
  }
}
