import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { LinkCampaignDto } from './dto/link-campaign.dto';
import { LinkRewardDto } from './dto/link-reward.dto';
import { LinkParentDto } from './dto/link-parent.dto';
import { CreateTestCaseDto, UpdateTestCaseDto } from './dto/test-case.dto';
import { UpdateBacklogRankDto } from './dto/update-backlog-rank.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { AddAttachmentDto } from './dto/add-attachment.dto';
import { AddWatcherDto } from './dto/add-watcher.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser, effectivePermissions } from '../common/permissions/effective-permissions';

@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryTicketsDto) {
    return this.ticketsService.findAll(user, effectivePermissions(user), query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.findOne(id, user, effectivePermissions(user));
  }

  @Get(':id/history')
  history(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.history(id, user, effectivePermissions(user));
  }

  @Get(':id/field-changes')
  fieldChanges(@Param('id') id: string) {
    return this.ticketsService.fieldChangeLog(id);
  }

  @Patch(':id')
  updateFields(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketsService.updateFields(id, user, effectivePermissions(user), dto);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user, effectivePermissions(user), dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.ticketsService.updateStatus(id, user, effectivePermissions(user), dto.status);
  }

  @Patch(':id/campaign')
  linkCampaign(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: LinkCampaignDto) {
    return this.ticketsService.linkCampaign(id, user, effectivePermissions(user), dto.campaignId ?? null);
  }

  @Patch(':id/reward')
  linkReward(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: LinkRewardDto) {
    return this.ticketsService.linkReward(id, user, effectivePermissions(user), dto.rewardId ?? null);
  }

  @Patch(':id/parent')
  linkParent(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: LinkParentDto) {
    return this.ticketsService.linkParent(id, user, effectivePermissions(user), dto.parentTicketId ?? null);
  }

  @Patch(':id/backlog-rank')
  updateBacklogRank(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBacklogRankDto,
  ) {
    return this.ticketsService.updateBacklogRank(id, user, effectivePermissions(user), dto.backlogRank);
  }

  @Post(':id/reopen')
  reopen(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.reopen(id, user, effectivePermissions(user));
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddCommentDto,
  ) {
    return this.ticketsService.addComment(id, user, effectivePermissions(user), dto);
  }

  @Get(':id/attachments/upload-url')
  requestAttachmentUploadUrl(@Param('id') id: string, @Query('fileName') fileName: string) {
    return this.ticketsService.requestAttachmentUploadUrl(id, fileName);
  }

  @Post(':id/attachments')
  addAttachment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddAttachmentDto,
  ) {
    return this.ticketsService.addAttachment(id, user, effectivePermissions(user), dto);
  }

  @Get(':id/attachments/:attachmentId/download-url')
  getAttachmentDownloadUrl(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.getAttachmentDownloadUrl(id, attachmentId, user, effectivePermissions(user));
  }

  @Post(':id/watchers')
  addWatcher(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddWatcherDto,
  ) {
    return this.ticketsService.addWatcher(id, user, effectivePermissions(user), dto.userId);
  }

  @Post(':id/timer/start')
  startTimer(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.startTimer(id, user, effectivePermissions(user));
  }

  @Post(':id/timer/stop')
  stopTimer(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.stopTimer(id, user, effectivePermissions(user));
  }

  @Get(':id/test-cases')
  testCases(@Param('id') id: string) {
    return this.ticketsService.testCases(id);
  }

  @Post(':id/test-cases')
  addTestCase(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTestCaseDto,
  ) {
    return this.ticketsService.addTestCase(id, user, effectivePermissions(user), dto);
  }

  @Patch(':id/test-cases/:testCaseId')
  updateTestCase(
    @Param('id') id: string,
    @Param('testCaseId') testCaseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTestCaseDto,
  ) {
    return this.ticketsService.updateTestCase(id, testCaseId, user, effectivePermissions(user), dto);
  }

  @Delete(':id/test-cases/:testCaseId')
  removeTestCase(
    @Param('id') id: string,
    @Param('testCaseId') testCaseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.removeTestCase(id, testCaseId, user, effectivePermissions(user));
  }
}
