import { IsEmail, IsOptional, IsString } from 'class-validator';

// Provider-agnostic shape — whatever email provider is wired up (SES/SNS,
// SendGrid Inbound Parse, Mailgun Routes) needs its own thin adapter in
// front of this that maps its native payload to these four fields before
// calling POST /email-intake/inbound. See README.md "Email-to-ticket".
export class InboundEmailDto {
  @IsEmail()
  from: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  // A raw email has no ticket-project routing info in it — omit to fall
  // back to EMAIL_INTAKE_DEFAULT_PROJECT_CODE.
  @IsOptional()
  @IsString()
  projectCode?: string;
}
