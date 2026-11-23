import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

// Who sees the org-wide "tickets raised against a campaign" summary — not a
// RolePermissions field (this is a narrow, specific view, not a general
// capability), same pattern as tickets.service.ts's
// BUSINESS_CATEGORY_REQUIRED_ROLES. "Manager" in the user's ask maps to the
// existing `pm` (Project Manager) role — see projects.service.ts's
// isLeadershipTier comment, which already uses "Manager" the same way.
const CAMPAIGN_SUMMARY_ROLES = ['admin', 'director', 'lead', 'pm', 'customersuccess'];

@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAllForProject(@Query('projectCode') projectCode: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.findAllForProject(projectCode.toUpperCase(), user);
  }

  @Get('summary')
  ticketSummary(@CurrentUser() user: AuthenticatedUser) {
    if (!CAMPAIGN_SUMMARY_ROLES.includes(user.baseRoleId)) {
      throw new ForbiddenException('Your role cannot view the campaign summary');
    }
    return this.campaignsService.ticketSummary();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(user, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(id, dto);
  }
}
