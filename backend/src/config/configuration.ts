export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  aiEncryptionKey: process.env.AI_ENCRYPTION_KEY,
  // Reuses AI_ENCRYPTION_KEY for at-rest encryption of the GitHub token
  // (same AES-256-GCM scheme, distinct salt — see github/github-crypto.util.ts)
  // so there's one secret to manage. Webhook signatures use a per-org secret
  // stored on GithubIntegration, not this key.
  githubEncryptionKey: process.env.GITHUB_ENCRYPTION_KEY ?? process.env.AI_ENCRYPTION_KEY,
  emailIntake: {
    // Shared secret an inbound-email provider (SES/SNS, SendGrid Inbound
    // Parse, Mailgun Routes) must send back on every webhook call — see
    // README.md "Email-to-ticket" for the provider-side setup this doesn't
    // cover (DNS/mailbox routing is outside what code alone can configure).
    secret: process.env.EMAIL_INTAKE_SECRET,
    // Ticket source is a single mailbox (support.elevatoz@loyalty.com) with
    // no per-project routing info in a raw email — this is where an inbound
    // ticket lands unless the payload explicitly names a projectCode.
    defaultProjectCode: process.env.EMAIL_INTAKE_DEFAULT_PROJECT_CODE,
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'elevatohub',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'elevatohub123',
    bucket: process.env.S3_BUCKET ?? 'elevatohub-attachments',
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  },
});
