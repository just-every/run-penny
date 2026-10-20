export interface AppBindings {
  PENNY_AI?: string
  PENNY_LEARNING?: string
  PENNY_LEARNING_EGRESS?: import('../features/learning/configuration').LearningEgress
  PENNY_EGRESS?: import('../features/integrations/transport').EnforcingEgress
  WORKSPACE_TIMEZONE?: string
  OPERATOR_EMAIL?: string
  SETUP_TOKEN?: string
  MAIL_PROVIDER?: string
  MAIL_API_KEY?: string
  MAIL_RELAY_URL?: string
  SENDGRID_EVENT_PUBLIC_KEY?: string
  RESEND_WEBHOOK_SECRET?: string
  RER_DEPLOY_SOURCE?: string
  RER_DEPLOY_FINGERPRINT?: string
  RER_VERSION?: { id: string }
  DB: D1Database
  ASSETS?: Fetcher
  FILES: R2Bucket
  JOBS: Queue
  PENNY_ENVIRONMENT?: string
  RER_DEV_ORIGIN?: string
  /** Local runtimes only: the checkout's key gate (`rer deploy` refuses it). */
  RER_DEV_KEY?: string
  RER_DEV_IDENTITY?: string
  /** Demo mode (`rer demo`, hosted demo): `rer deploy` refuses it. The hosted demo's front
   * also sets Base's names for the owner and session secret (src/demo.ts). */
  RER_DEMO?: string
  OWNER_EMAIL?: string
  SESSION_SECRET?: string
  APP_ORIGIN?: string
  AUTH_SECRET?: string
  MAIL_FROM?: string
  IDENTITY_PROVIDER?: string
  RER_OWNER_CLAIM_ISSUER?: string
  RER_OWNER_CLAIM_PUBLIC_KEYS?: string
  RER_OWNER_CLAIM_INSTALLATION_ID?: string
  RER_INSTALLATION_ID?: string
  RER_MANAGEMENT_ORIGIN?: string
  PORTAL_FRAME_ORIGINS?: string
  PORTAL_IDENTITY_SECRET?: string
}
