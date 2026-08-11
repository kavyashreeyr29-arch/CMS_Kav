import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser, effectivePermissions } from '../common/permissions/effective-permissions';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findAll(user, effectivePermissions(user));
  }

  @Get(':code')
  findOne(@Param('code') code: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findOne(code.toUpperCase(), user);
  }

  @Post(':code/members')
  addMember(@Param('code') code: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: AddMemberDto) {
    return this.projectsService.addMember(code.toUpperCase(), user, dto.userId);
  }

  @Delete(':code/members/:userId')
  removeMember(@Param('code') code: string, @Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.removeMember(code.toUpperCase(), user, userId);
  }

  @RequirePermission('createProject')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto, user.id);
  }

  @RequirePermission('createProject')
  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(code.toUpperCase(), dto);
  }

  @RequirePermission('userManagement')
  @Delete(':code')
  remove(@Param('code') code: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.remove(code.toUpperCase(), user);
  }

  @Get(':code/documents/upload-url')
  requestUploadUrl(@Param('code') code: string, @Query('fileName') fileName: string) {
    return this.projectsService.requestDocumentUploadUrl(fileName, code.toUpperCase());
  }

  @Post(':code/documents')
  addDocument(
    @Param('code') code: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddDocumentDto,
  ) {
    return this.projectsService.addDocument(code.toUpperCase(), user.id, dto);
  }

  @Get(':code/documents/:documentId/download-url')
  getDocumentDownloadUrl(@Param('code') code: string, @Param('documentId') documentId: string) {
    return this.projectsService.getDocumentDownloadUrl(code.toUpperCase(), documentId);
  }
}
