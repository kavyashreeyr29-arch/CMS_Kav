-- Enforces "one active timer per person per ticket" at the database level
-- (LLD §2.2). Prisma's schema DSL cannot express a partial unique index, so
-- this runs as a one-off after `prisma db push` / `prisma migrate deploy`.
--
-- Run manually:
--   psql "$DATABASE_URL" -f prisma/sql/active_timer_constraint.sql
-- or via the npm script:
--   npm run prisma:apply-constraints

CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_active_per_user_ticket
  ON time_entries (ticket_id, user_id)
  WHERE ended_at IS NULL;
