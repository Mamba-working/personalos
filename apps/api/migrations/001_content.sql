-- PersonalOS content demo schema. Generated from POSTGRES_SCHEMA, verified by tests.
CREATE TABLE IF NOT EXISTS content_records (
  collection text NOT NULL, id text NOT NULL, payload jsonb NOT NULL,
  PRIMARY KEY(collection,id)
);
CREATE TABLE IF NOT EXISTS content_jobs (
  id text PRIMARY KEY, state text NOT NULL CHECK(state IN ('queued','running','validating','succeeded','failed')),
  available_at bigint NOT NULL, lease_until bigint, fence integer NOT NULL, payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS content_jobs_claim ON content_jobs(state,available_at,lease_until);
CREATE OR REPLACE FUNCTION reject_immutable_content_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.collection IN ('sourceVersions','revisions','assets','publications','conversationMessages') THEN
    RAISE EXCEPTION 'immutable content record';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS content_immutable_records ON content_records;
CREATE TRIGGER content_immutable_records BEFORE UPDATE OR DELETE ON content_records FOR EACH ROW EXECUTE FUNCTION reject_immutable_content_mutation();
