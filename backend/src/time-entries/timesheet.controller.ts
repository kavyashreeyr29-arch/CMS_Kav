import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { CreateManualTimeEntryDto } from './dto/create-manual-time-entry.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser, effectivePermissions } from '../common/permissions/effective-permissions';

// My Timesheet (CHANGELOG.md) — a personal view of one's own logged time,
// distinct from reports/work-hours (the manager rollup across people, still
// lumping timer + manual time together). Org/team-visibility roles
// (Admin/Director/PM see everyone, Lead sees their led team) additionally
// get a "Team" overview here, split by automated vs. manual, with a
// drill-down into any one person's entries reusing the same `mine` endpoint.
@UseGuards(JwtAuthGuard)
@Controller('time-entries')
export class TimesheetController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Get('team-summary')
  teamSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('team') team?: string,
    @Query('userId') userId?: string,
  ) {
    const perms = effectivePermissions(user);
    if (perms.workHoursVisibility !== 'org' && perms.workHoursVisibility !== 'team') {
      throw new ForbiddenException('Your role cannot view team timesheet summaries');
    }
    const teamIds = team?.split(',').filter(Boolean);
    return this.timeEntriesService.teamSummary(user, perms, startDate, endDate, teamIds, userId);
  }

  @Get('mine')
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
  ) {
    const perms = effectivePermissions(user);
    const targetUserId = userId || user.id;
    if (targetUserId === user.id) {
      if (!perms.timeTracking) throw new ForbiddenException('Your role does not track time');
    } else if (!(await this.timeEntriesService.canViewUser(user, perms, targetUserId))) {
      throw new ForbiddenException("You cannot view this person's timesheet");
    }
    return this.timeEntriesService.listMine(targetUserId, startDate, endDate);
  }

  @Post()
  createManual(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateManualTimeEntryDto) {
    const perms = effectivePermissions(user);
    if (!perms.timeTracking) throw new ForbiddenException('Your role does not track time');
    return this.timeEntriesService.createManual(user, dto);
  }

  @Delete(':id')
  deleteManual(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.timeEntriesService.deleteManual(id, user);
  }
}
