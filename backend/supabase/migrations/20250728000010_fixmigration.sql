BEGIN;

ALTER TABLE workflows DROP CONSTRAINT IF EXISTS workflows_image_url_valid_url;

COMMIT;