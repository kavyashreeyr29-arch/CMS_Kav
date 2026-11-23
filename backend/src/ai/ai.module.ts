import { Module } from '@nestjs/common';
import { AiProviderConfigsController } from './ai-provider-configs.controller';
import { AiProviderConfigsService } from './ai-provider-configs.service';
import { AiFeaturesController } from './ai-features.controller';
import { AiService } from './ai.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [AiProviderConfigsController, AiFeaturesController],
  providers: [AiProviderConfigsService, AiService],
  exports: [AiService],
})
export class AiModule {}
