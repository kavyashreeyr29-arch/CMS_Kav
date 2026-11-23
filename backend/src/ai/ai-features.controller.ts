import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';
import { CategorizeInput, SummarizeInput } from './ai-adapter.interface';

// prd.md §13.3 — feature endpoints. All AI output here is advisory only
// (§13.4): the frontend must show these as suggestions a human confirms,
// never as an auto-applied change.
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiFeaturesController {
  constructor(private readonly aiService: AiService) {}

  @Post('categorize-suggestion')
  categorize(@CurrentUser() user: AuthenticatedUser, @Body() input: CategorizeInput) {
    return this.aiService.categorizeSuggestion(user.orgId, user.id, input);
  }

  @Post('summarize/:ticketId')
  summarize(
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: SummarizeInput,
  ) {
    return this.aiService.summarizeTicket(user.orgId, user.id, ticketId, { ...input, ticketId });
  }
}
