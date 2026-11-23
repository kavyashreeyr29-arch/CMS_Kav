import { Module } from '@nestjs/common';
import { SlaPoliciesController } from './sla-policies.controller';
import { SlaPoliciesService } from './sla-policies.service';
import { SlaSweepService } from './sla-sweep.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SlaPoliciesController],
  providers: [SlaPoliciesService, SlaSweepService],
  exports: [SlaPoliciesService],
})
export class SlaPoliciesModule {}
