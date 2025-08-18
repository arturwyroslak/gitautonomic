-- Idempotentne utworzenie/aktualizacja użytkownika "gitautonomic" z hasłem 12345678
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gitautonomic') THEN
    CREATE ROLE gitautonomic WITH LOGIN PASSWORD '12345678';
  ELSE
    ALTER ROLE gitautonomic WITH LOGIN PASSWORD '12345678';
  END IF;
END
$$;

-- Uprawnienia do bazy "postgres"
GRANT CONNECT ON DATABASE postgres TO gitautonomic;

-- Uprawnienia do schematu public w bazie "postgres"
\connect postgres
GRANT USAGE, CREATE ON SCHEMA public TO gitautonomic;
