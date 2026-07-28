import { Module } from '@nestjs/common';
import { ProjectNotesController } from './project-notes.controller';
import { ProjectNotesService } from './project-notes.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  controllers: [ProjectNotesController],
  providers: [ProjectNotesService],
  exports: [ProjectNotesService],
})
export class ProjectNotesModule {}
