# gitautonomic – Autonomous GitHub AI Agent (Private)

Bootstrap wersja – minimalne elementy:
- Webhook serwer (Express)
- Kolejki (BullMQ) – plan/exec/eval (placeholder)
- Prisma schema
- Provider OpenAI (mock jeśli brak klucza)

## Quick Start
1. Skonfiguruj `.env` według `.env.example`
2. `npm install`
3. `npx prisma migrate dev --name init`
4. `npm run build`
5. Uruchom:
   - API: `npm start`
   - Worker: `npm run start:worker`
6. Utwórz GitHub App z eventami: issues, pull_request, pull_request.closed, issue_comment (na przyszłe sterowanie).
7. Skieruj webhook do `/webhook`.

Następne commity: execution engine, diff applier, test runner, evaluation loop, Semgrep integracja.
