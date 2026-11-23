import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.labelsService.findAll(user.orgId);
  }

  @RequirePermission('manageLabels')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLabelDto) {
    return this.labelsService.create(user.orgId, user.id, dto);
  }

  @RequirePermission('manageLabels')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.labelsService.remove(id);
  }
}
