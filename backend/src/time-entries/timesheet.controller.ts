import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { CreateManualTimeEntryDto } from './dto/create-manual-time-entry.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser, effectivePermissions } from '../common/permissions/effective-permissions';

// My Timesheet (CHANGELOG.md) — a personal view of one's own logged time,
// distinct from reports/work-hours (the manager rollup across people).
// Combines timer-derived entries with manual ones a person fills in for
// time they forgot to start a timer for.
@UseGuards(JwtAuthGuard)
@Controller('time-entries')
export class TimesheetController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser, @Query('startDate') startDate: string, @Query('endDate') endDate?: string) {
    const perms = effectivePermissions(user);
    if (!perms.timeTracking) throw new ForbiddenException('Your role does not track time');
    return this.timeEntriesService.listMine(user.id, startDate, endDate);
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
