import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProjectTodosService } from './project-todos.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

@UseGuards(JwtAuthGuard)
@Controller('project-todos')
export class ProjectTodosController {
  constructor(private readonly projectTodosService: ProjectTodosService) {}

  @Get()
  findAllForProject(@Query('projectCode') projectCode: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectTodosService.findAllForProject(projectCode.toUpperCase(), user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTodoDto) {
    return this.projectTodosService.create(user, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTodoDto) {
    return this.projectTodosService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectTodosService.remove(id);
  }
}
