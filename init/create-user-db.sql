DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gitautonomic') THEN
    CREATE ROLE gitautonomic WITH LOGIN PASSWORD 'change_me_strong_password';
    ALTER ROLE gitautonomic CREATEDB;
  END IF;
END
$$;

DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'gitautonomic') THEN
    CREATE DATABASE gitautonomic OWNER gitautonomic;
  END IF;
END
$$;
