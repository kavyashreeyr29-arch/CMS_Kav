import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // Readable by anyone signed in — the ticket status picker needs to know the
  // allowed transitions; only editing is gated by manageWorkflow.
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.workflowService.list(user.orgId);
  }

  @RequirePermission('manageWorkflow')
  @Put()
  replace(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateWorkflowDto) {
    return this.workflowService.replace(user.orgId, dto);
  }
}
