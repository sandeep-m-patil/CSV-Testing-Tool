-- Removes the leftover TicketGo (movie booking) tables from this project's Neon
-- database. None of them is used by the testing platform: no platform table
-- references them and no code reads them (checked 2026-10-10).
--
-- BEFORE RUNNING: create a backup branch in the Neon console
-- (Branches -> Create branch from "production"), so this can be undone.
--
-- Run:  psql "$DATABASE_URL" -f scripts/neon-cleanup/drop-ticketgo-tables.sql
BEGIN;

-- Abort if any table outside this list depends on one of them.
DO $$
DECLARE
  ticketgo text[] := ARRAY['cinemas','cities','movies','screens','seats','seat_inventory','showtimes','orders','order_items','payments','profiles','refresh_tokens'];
  outside int;
BEGIN
  SELECT count(*) INTO outside
  FROM pg_constraint c
  JOIN pg_class child ON child.oid = c.conrelid
  JOIN pg_class parent ON parent.oid = c.confrelid
  WHERE c.contype = 'f'
    AND parent.relname = ANY (ticketgo)
    AND NOT child.relname = ANY (ticketgo);
  IF outside > 0 THEN
    RAISE EXCEPTION 'Aborted: % foreign key(s) from other tables point at TicketGo tables', outside;
  END IF;
END $$;

DROP TABLE IF EXISTS
  "order_items", "payments", "orders",
  "seat_inventory", "showtimes", "seats", "screens", "cinemas", "cities",
  "movies", "profiles", "refresh_tokens";

COMMIT;
