import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ProjectNotesService } from './project-notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

@UseGuards(JwtAuthGuard)
@Controller('project-notes')
export class ProjectNotesController {
  constructor(private readonly projectNotesService: ProjectNotesService) {}

  @Get()
  findAllForProject(@Query('projectCode') projectCode: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectNotesService.findAllForProject(projectCode.toUpperCase(), user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateNoteDto) {
    return this.projectNotesService.create(user, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectNotesService.remove(id, user);
  }
}
