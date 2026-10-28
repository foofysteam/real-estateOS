-- Runs once when the Postgres volume is first created.
-- The app database (salesos) is created by POSTGRES_DB; this adds the test database.
CREATE DATABASE salesos_test OWNER salesos;
