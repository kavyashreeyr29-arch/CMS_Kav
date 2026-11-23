import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SlaPoliciesService } from './sla-policies.service';
import { CreateSlaPolicyDto } from './dto/create-sla-policy.dto';
import { UpdateSlaPolicyDto } from './dto/update-sla-policy.dto';
import { BulkUploadSlaPoliciesDto } from './dto/bulk-upload.dto';
import { AttachDocumentDto } from './dto/attach-document.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

// prd.md §9 — everyone with dashboard access can view; Admin only for writes.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sla-policies')
export class SlaPoliciesController {
  constructor(private readonly slaPoliciesService: SlaPoliciesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.slaPoliciesService.findAll(user.orgId);
  }

  @RequirePermission('manageSLA')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSlaPolicyDto) {
    return this.slaPoliciesService.create(user.orgId, user.id, dto);
  }

  @RequirePermission('manageSLA')
  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSlaPolicyDto) {
    return this.slaPoliciesService.update(id, user.id, dto);
  }

  @RequirePermission('manageSLA')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.slaPoliciesService.remove(id);
  }

  @RequirePermission('manageSLA')
  @Post('bulk-upload')
  bulkUpload(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkUploadSlaPoliciesDto) {
    return this.slaPoliciesService.bulkUpload(user.orgId, user.id, dto);
  }

  @RequirePermission('manageSLA')
  @Get(':id/document/upload-url')
  requestDocumentUploadUrl(@Param('id') id: string, @Query('fileName') fileName: string) {
    return this.slaPoliciesService.requestDocumentUploadUrl(id, fileName);
  }

  @RequirePermission('manageSLA')
  @Post(':id/document')
  attachDocument(@Param('id') id: string, @Body() dto: AttachDocumentDto) {
    return this.slaPoliciesService.attachDocument(id, dto);
  }

  @Get(':id/document/download-url')
  getDocumentDownloadUrl(@Param('id') id: string) {
    return this.slaPoliciesService.getDocumentDownloadUrl(id);
  }
}
