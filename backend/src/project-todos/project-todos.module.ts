import { Module } from '@nestjs/common';
import { ProjectTodosController } from './project-todos.controller';
import { ProjectTodosService } from './project-todos.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  controllers: [ProjectTodosController],
  providers: [ProjectTodosService],
  exports: [ProjectTodosService],
})
export class ProjectTodosModule {}
