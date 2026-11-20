-- Runtime role used by the web app. It does NOT own tables and does NOT have
-- BYPASSRLS, so row-level security always applies to it.
-- Migrations run as clean_owner. See docs/DECISIONS.md (D-002).
CREATE ROLE clean_app LOGIN PASSWORD 'clean_app' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE clean TO clean_app;
CREATE DATABASE clean_test OWNER clean_owner;
GRANT CONNECT ON DATABASE clean_test TO clean_app;
