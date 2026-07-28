import { Module } from '@nestjs/common';
import { EmailIntakeController } from './email-intake.controller';
import { EmailIntakeService } from './email-intake.service';
import { EmailIntakeSecretGuard } from './email-intake-secret.guard';
import { UsersModule } from '../users/users.module';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [UsersModule, TicketsModule],
  controllers: [EmailIntakeController],
  providers: [EmailIntakeService, EmailIntakeSecretGuard],
})
export class EmailIntakeModule {}
