import { Global, Module } from '@nestjs/common';
import { TimersGateway } from './timers.gateway';

@Global()
@Module({
  providers: [TimersGateway],
  exports: [TimersGateway],
})
export class RealtimeModule {}
