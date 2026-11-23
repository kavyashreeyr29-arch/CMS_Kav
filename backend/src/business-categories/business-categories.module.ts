import { Module } from '@nestjs/common';
import { BusinessCategoriesController } from './business-categories.controller';
import { BusinessCategoriesService } from './business-categories.service';

@Module({
  controllers: [BusinessCategoriesController],
  providers: [BusinessCategoriesService],
  exports: [BusinessCategoriesService],
})
export class BusinessCategoriesModule {}
