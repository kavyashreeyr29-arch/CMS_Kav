import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BusinessCategoriesService } from './business-categories.service';
import { CreateBusinessCategoryDto } from './dto/create-business-category.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

// Reuses `manageLabels` — the same admin capability that already manages
// the other ticket-categorization list (Labels), rather than adding a new
// permission field for a closely related concept.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('business-categories')
export class BusinessCategoriesController {
  constructor(private readonly businessCategoriesService: BusinessCategoriesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.businessCategoriesService.findAll(user.orgId);
  }

  @RequirePermission('manageLabels')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBusinessCategoryDto) {
    return this.businessCategoriesService.create(user.orgId, user.id, dto);
  }

  @RequirePermission('manageLabels')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.businessCategoriesService.remove(id);
  }
}
