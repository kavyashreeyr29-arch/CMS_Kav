import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { EmailIntakeService } from './email-intake.service';
import { EmailIntakeSecretGuard } from './email-intake-secret.guard';
import { InboundEmailDto } from './dto/inbound-email.dto';

// "Any email raised to support.elevatoz@loyalty.com should be created as a
// ticket" — this is the webhook a real mailbox provider calls. Connecting
// the actual support.elevatoz@loyalty.com mailbox to this endpoint is
// external setup this repo can't perform (DNS/provider account access) —
// see README.md "Email-to-ticket" for the AWS SES / SendGrid / Mailgun
// options and exactly what to point at this URL.
@UseGuards(EmailIntakeSecretGuard)
@Controller('email-intake')
export class EmailIntakeController {
  constructor(private readonly emailIntakeService: EmailIntakeService) {}

  @Post('inbound')
  inbound(@Body() dto: InboundEmailDto) {
    return this.emailIntakeService.ingest(dto);
  }
}
