import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { TeamsModule } from './teams/teams.module';
import { ProjectsModule } from './projects/projects.module';
import { TicketsModule } from './tickets/tickets.module';
import { LabelsModule } from './labels/labels.module';
import { BusinessCategoriesModule } from './business-categories/business-categories.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { SlaPoliciesModule } from './sla-policies/sla-policies.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { AiModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SearchModule } from './search/search.module';
import { EmailIntakeModule } from './email-intake/email-intake.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { RewardsModule } from './rewards/rewards.module';
import { ProjectTodosModule } from './project-todos/project-todos.module';
import { ProjectNotesModule } from './project-notes/project-notes.module';
import { WorkflowModule } from './workflow/workflow.module';
import { GithubModule } from './github/github.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    RolesModule,
    TeamsModule,
    ProjectsModule,
    TicketsModule,
    LabelsModule,
    BusinessCategoriesModule,
    TimeEntriesModule,
    SlaPoliciesModule,
    NotificationsModule,
    ActivityLogModule,
    AiModule,
    AnalyticsModule,
    SearchModule,
    EmailIntakeModule,
    AuditLogModule,
    CampaignsModule,
    RewardsModule,
    ProjectTodosModule,
    ProjectNotesModule,
    WorkflowModule,
    GithubModule,
    ApprovalsModule,
  ],
})
export class AppModule {}
