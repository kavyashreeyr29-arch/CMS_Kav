import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalRequestDto, DecideApprovalDto } from './dto/create-approval-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  listForTicket(@Query('ticketId') ticketId: string) {
    return this.approvalsService.listForTicket(ticketId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateApprovalRequestDto) {
    return this.approvalsService.create(user, dto);
  }

  @Patch(':id/decide')
  decide(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: DecideApprovalDto) {
    return this.approvalsService.decide(id, user, dto);
  }
}
