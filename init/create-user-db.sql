DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gitautonomic') THEN
    CREATE ROLE gitautonomic WITH LOGIN PASSWORD '12345678';
  ELSE
    ALTER ROLE gitautonomic WITH LOGIN PASSWORD '12345678';
  END IF;
END
$$;

-- Zezwól na połączenia do bazy "postgres"
GRANT CONNECT ON DATABASE postgres TO gitautonomic;

-- Przejdź do bazy "postgres" i nadaj uprawnienia do schematu public
\connect postgres
GRANT USAGE, CREATE ON SCHEMA public TO gitautonomic;
