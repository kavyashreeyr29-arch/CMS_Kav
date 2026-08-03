import { Module } from '@nestjs/common';
import { TimeEntriesController } from './time-entries.controller';
import { TimesheetController } from './timesheet.controller';
import { TimeEntriesService } from './time-entries.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [TimeEntriesController, TimesheetController],
  providers: [TimeEntriesService],
})
export class TimeEntriesModule {}
