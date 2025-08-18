DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gitautonomic') THEN
    CREATE ROLE gitautonomic WITH LOGIN PASSWORD '12345678';
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
