import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  findAll() {
    return this.teamsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @RequirePermission('userManagement')
  @Post()
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto, actor);
  }

  @RequirePermission('userManagement')
  @Patch(':id')
  update(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto, actor);
  }
}
