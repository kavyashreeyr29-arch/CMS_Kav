import {
  Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { GithubService } from './github.service';
import { UpsertIntegrationDto } from './dto/upsert-integration.dto';
import { GithubWebhookGuard } from './github-webhook.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

@Controller('github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  // ---- webhook (machine-to-machine, HMAC-verified, no JWT) ----------------
  @UseGuards(GithubWebhookGuard)
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Req() req: { githubOrgId: string },
    @Headers('x-github-event') event: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.githubService.handleWebhook(req.githubOrgId, event, payload);
  }

  // ---- admin config -------------------------------------------------------
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('integration')
  getConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.githubService.getConfig(user.orgId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('manageWorkflow')
  @Put('integration')
  upsert(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertIntegrationDto) {
    return this.githubService.upsert(user.orgId, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('manageWorkflow')
  @Delete('integration')
  remove(@CurrentUser() user: AuthenticatedUser) {
    return this.githubService.remove(user.orgId);
  }

  // ---- ticket dev-links ---------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Get('tickets/:ticketId/pull-requests')
  listForTicket(@Param('ticketId') ticketId: string) {
    return this.githubService.listPullRequests(ticketId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('pull-requests/:id')
  unlink(@Param('id') id: string) {
    return this.githubService.unlinkPullRequest(id);
  }
}
