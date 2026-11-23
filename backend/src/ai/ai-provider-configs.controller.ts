import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AiProviderConfigsService } from './ai-provider-configs.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

// prd.md §13.2 — Admin-only AI provider configuration + usage dashboard.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('manageAI')
@Controller('ai-providers')
export class AiProviderConfigsController {
  constructor(private readonly service: AiProviderConfigsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.orgId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProviderDto) {
    return this.service.create(user.orgId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get('usage')
  usage(@CurrentUser() user: AuthenticatedUser) {
    return this.service.usage(user.orgId);
  }
}
