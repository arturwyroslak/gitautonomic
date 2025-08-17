# GitAutonomic - Kompletna Instrukcja Wdrożenia

## Przegląd

Ten przewodnik zawiera pełną instrukcję wdrożenia aplikacji GitAutonomic wraz z konfiguracją GitHub App zgodnie ze specyfikacją dla domeny `gitautonomic.bizneszai.eu`.

## Spis Treści

1. [Wymagania Systemowe](#wymagania-systemowe)
2. [Tworzenie GitHub App](#tworzenie-github-app)
3. [Konfiguracja Środowiska](#konfiguracja-środowiska)
4. [Instalacja Aplikacji](#instalacja-aplikacji)
5. [Konfiguracja Bazy Danych](#konfiguracja-bazy-danych)
6. [Uruchomienie Serwisów](#uruchomienie-serwisów)
7. [Weryfikacja Instalacji](#weryfikacja-instalacji)
8. [Troubleshooting](#troubleshooting)

## Wymagania Systemowe

### Minimalne Wymagania
- **System Operacyjny**: Linux (Ubuntu 20.04+), macOS 10.15+, lub Windows 10 z WSL2
- **CPU**: 2+ rdzenie (zalecane 4+)
- **RAM**: 4GB (zalecane 8GB+)
- **Dysk**: 10GB wolnego miejsca (zalecane SSD)
- **Sieć**: Stabilne połączenie internetowe

### Wymagane Oprogramowanie
- **Node.js**: Wersja 20.10.0 lub wyższa
- **PostgreSQL**: Wersja 14+
- **Redis**: Wersja 6+
- **Git**: Wersja 2.30+
- **Docker** (opcjonalnie): Wersja 20+

### Instalacja Zależności

**Ubuntu/Debian:**
```bash
# Aktualizacja systemu
sudo apt update && sudo apt upgrade -y

# Instalacja Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalacja PostgreSQL
sudo apt install postgresql postgresql-contrib

# Instalacja Redis
sudo apt install redis-server

# Instalacja Git
sudo apt install git
```

**macOS (używając Homebrew):**
```bash
# Instalacja Homebrew jeśli nie jest zainstalowane
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalacja zależności
brew install node@20 postgresql redis git
```

## Tworzenie GitHub App

### Krok 1: Przejście do Ustawień GitHub

1. Zaloguj się na GitHub
2. Przejdź do **Settings** → **Developer settings** → **GitHub Apps**
3. Kliknij **"New GitHub App"**

### Krok 2: Podstawowe Informacje

Wypełnij następujące pola:

```
GitHub App name: gitautonomic
```
*Nazwa Twojej aplikacji GitHub (musi być unikalna)*

**Opis (Description):**
```
Autonomous AI DevOps Engineer for GitHub repositories
```

**Homepage URL:**
```
https://gitautonomic.bizneszai.eu
```

### Krok 3: Identyfikacja i Autoryzacja Użytkowników

**Callback URL:**
```
https://gitautonomic.bizneszai.eu/api/auth/github/callback
```

**Opcje do zaznaczenia:**
- ☐ Expire user authorization tokens
- ☐ Request user authorization (OAuth) during installation
- ☐ Enable Device Flow

### Krok 4: Konfiguracja Post-Installation

**Setup URL (opcjonalne):**
```
https://gitautonomic.bizneszai.eu/setup
```

- ☐ Redirect on update

### Krok 5: Webhook

**Ustawienia Webhook:**
- ✅ **Active** - zaznaczone

**Webhook URL:**
```
https://gitautonomic.bizneszai.eu/webhook
```

**Secret:**
Wygeneruj bezpieczny secret (zachowaj go do późniejszej konfiguracji)

### Krok 6: Uprawnienia (Permissions)

#### Repository permissions (8 wybranych + 1 obowiązkowe):

- ✅ **Actions** - Read & Write
  *Workflows, workflow runs and artifacts*

- ✅ **Administration** - Read & Write
  *Repository creation, deletion, settings, teams, and collaborators*

- ✅ **Attestations** - Read & Write
  *Create and retrieve attestations for a repository*

- ✅ **Checks** - Read & Write
  *Checks on code*

- ✅ **Code scanning alerts** - Read & Write
  *View and manage code scanning alerts*

- ✅ **Codespaces** - Read & Write
  *Create, edit, delete and list Codespaces*

- ✅ **Codespaces lifecycle admin** - Read & Write
  *Manage the lifecycle of Codespaces*

- ✅ **Codespaces metadata** - Read
  *Access Codespaces metadata*

- 🔒 **Metadata** - Read (Obowiązkowe)
  *Search repositories, list collaborators, and access repository metadata*

**Pozostałe uprawnienia (opcjonalne, ale zalecane):**
- **Contents** - Read & Write
- **Issues** - Read & Write
- **Pull requests** - Read & Write
- **Commit statuses** - Read & Write
- **Deployments** - Read & Write
- **Environments** - Read & Write
- **Packages** - Read & Write
- **Pages** - Read & Write
- **Projects** - Read & Write
- **Secrets** - Read & Write
- **Variables** - Read & Write
- **Webhooks** - Read & Write
- **Workflows** - Read & Write

#### Organization permissions (opcjonalne):
- **Administration** - Read
- **Members** - Read
- **Projects** - Read & Write
- **Secrets** - Read & Write
- **Variables** - Read & Write
- **Webhooks** - Read & Write

#### Account permissions:
- **Email addresses** - Read
- **Events** - Read
- **Profile** - Read

### Krok 7: Subskrypcja Eventów

Zaznacz następujące eventy:

**Repository Events:**
- ✅ **Branch protection configuration**
- ✅ **Branch protection rule**
- ✅ **Code scanning alert**
- ✅ **Check run**
- ✅ **Check suite**
- ✅ **Dismissal request code scanning**
- ✅ **Label**
- ✅ **Member**
- ✅ **Public**
- ✅ **Repository**
- ✅ **Repository ruleset**
- ✅ **Security and analysis**
- ✅ **Star**
- ✅ **Watch**
- ✅ **Workflow job**
- ✅ **Workflow run**

**System Events:**
- ✅ **Installation target**
- ✅ **Meta**
- ✅ **Security advisory**

### Krok 8: Cel Instalacji

**Where can this GitHub App be installed?**

Wybierz jedną z opcji:
- ⚪ **Only on this account** - Tylko na koncie @arturwyroslak
- ⚪ **Any account** - Na dowolnym koncie użytkownika lub organizacji

### Krok 9: Finalizacja

1. Kliknij **"Create GitHub App"**
2. Zapisz następujące informacje:
   - **App ID**
   - **Client ID**
   - **Client Secret**
3. Wygeneruj i pobierz **Private Key** (plik .pem)
4. Przejdź do zakładki **"Install App"** i zainstaluj aplikację na wybranych repozytoriach

## Konfiguracja Środowiska

### Krok 1: Klonowanie Repozytorium

```bash
git clone https://github.com/arturwyroslak/gitautonomic.git
cd gitautonomic
```

### Krok 2: Instalacja Zależności

```bash
npm install
```

### Krok 3: Konfiguracja Zmiennych Środowiskowych

Skopiuj przykładowy plik konfiguracyjny:
```bash
cp .env.example .env
```

Edytuj plik `.env` z Twoją konfiguracją:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456                    # Twój GitHub App ID
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
-----END PRIVATE KEY-----"             # Klucz prywatny GitHub App (format PEM)
GITHUB_WEBHOOK_SECRET=your_webhook_secret    # Secret dla webhook

# GitHub OAuth (Dashboard)
GITHUB_CLIENT_ID=oauth_client_id             # Client ID z OAuth App
GITHUB_CLIENT_SECRET=oauth_client_secret     # Client Secret z OAuth App
GITHUB_REDIRECT_URI=https://gitautonomic.bizneszai.eu/api/auth/github/callback

# Authentication
JWT_SECRET=your_super_secure_jwt_secret      # Klucz do podpisywania JWT

# Database
DATABASE_URL=postgresql://gitautonomic_user:password@localhost:5432/gitautonomic
REDIS_URL=redis://localhost:6379

# AI Providers
OPENAI_API_KEY=sk-...                        # Klucz API OpenAI
CUSTOM_LLM_ENDPOINT=                         # URL własnego endpoint LLM
CUSTOM_LLM_API_KEY=                          # Klucz API własnego LLM

# System Configuration
RISK_HIGH_THRESHOLD=0.7                      # Próg ryzyka (0.0-1.0)
COVERAGE_MIN_LINES=0.75                      # Minimalne pokrycie testami
AGENT_WORK_ROOT=/tmp/ai-agent-work           # Katalog roboczy
LOG_LEVEL=info                               # Poziom logowania
PORT=3000                                    # Port serwera
NODE_ENV=production                          # Środowisko
```

## Konfiguracja Bazy Danych

### Krok 1: Tworzenie Bazy PostgreSQL

```bash
# Przełącz się na użytkownika postgres
sudo -u postgres psql

# Utwórz bazę danych i użytkownika
CREATE DATABASE gitautonomic;
CREATE USER gitautonomic_user WITH ENCRYPTED PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE gitautonomic TO gitautonomic_user;
\q
```

### Krok 2: Konfiguracja Redis

Upewnij się, że Redis jest uruchomiony:
```bash
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Krok 3: Migracja Bazy Danych

```bash
# Generowanie klienta Prisma
npm run prisma:gen

# Aplikowanie migracji
npm run migrate
```

## Instalacja Aplikacji

### Krok 1: Budowanie Aplikacji

```bash
npm run build
```

### Krok 2: Konfiguracja Serwisu (systemd)

Utwórz plik serwisu:
```bash
sudo nano /etc/systemd/system/gitautonomic.service
```

Zawartość pliku:
```ini
[Unit]
Description=GitAutonomic AI DevOps Agent
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=gitautonomic
WorkingDirectory=/opt/gitautonomic
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Utwórz plik serwisu dla worker:
```bash
sudo nano /etc/systemd/system/gitautonomic-worker.service
```

Zawartość pliku:
```ini
[Unit]
Description=GitAutonomic Worker
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=gitautonomic
WorkingDirectory=/opt/gitautonomic
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/worker.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Krok 3: Konfiguracja Nginx

Utwórz konfigurację Nginx:
```bash
sudo nano /etc/nginx/sites-available/gitautonomic
```

Zawartość pliku:
```nginx
server {
    listen 80;
    server_name gitautonomic.bizneszai.eu;
    
    # Przekierowanie na HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name gitautonomic.bizneszai.eu;
    
    # Konfiguracja SSL
    ssl_certificate /etc/letsencrypt/live/gitautonomic.bizneszai.eu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gitautonomic.bizneszai.eu/privkey.pem;
    
    # Opcje SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Proxy do aplikacji
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Webhook endpoint
    location /webhook {
        proxy_pass http://localhost:3000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Zwiększenie limitów dla payloadów GitHub
        client_max_body_size 10M;
    }
}
```

Aktywuj konfigurację:
```bash
sudo ln -s /etc/nginx/sites-available/gitautonomic /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Krok 4: Konfiguracja SSL (Certbot)

```bash
# Instalacja Certbot
sudo apt install certbot python3-certbot-nginx

# Uzyskanie certyfikatu SSL
sudo certbot --nginx -d gitautonomic.bizneszai.eu

# Automatyczne odnawianie
sudo crontab -e
# Dodaj linię:
0 12 * * * /usr/bin/certbot renew --quiet
```

## Uruchomienie Serwisów

### Krok 1: Uruchomienie Serwisów Systemowych

```bash
# Przeładowanie konfiguracji systemd
sudo systemctl daemon-reload

# Uruchomienie serwisów
sudo systemctl start gitautonomic
sudo systemctl start gitautonomic-worker

# Włączenie automatycznego startu
sudo systemctl enable gitautonomic
sudo systemctl enable gitautonomic-worker

# Sprawdzenie statusu
sudo systemctl status gitautonomic
sudo systemctl status gitautonomic-worker
```

### Krok 2: Weryfikacja Logów

```bash
# Logi aplikacji głównej
sudo journalctl -u gitautonomic -f

# Logi workera
sudo journalctl -u gitautonomic-worker -f
```

## Weryfikacja Instalacji

### Krok 1: Test Connectivity

```bash
# Test aplikacji
curl https://gitautonomic.bizneszai.eu/healthz

# Oczekiwana odpowiedź:
# {"ok":true}
```

### Krok 2: Test Webhook

```bash
# Test endpoint webhook
curl -X POST https://gitautonomic.bizneszai.eu/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen":"GitHub zen message"}'
```

### Krok 3: Weryfikacja Dashboard

Otwórz w przeglądarce:
```
https://gitautonomic.bizneszai.eu/dashboard
```

### Krok 4: Test GitHub App

1. Przejdź do repozytorium gdzie zainstalowano aplikację
2. Utwórz nowe issue
3. Sprawdź czy bot reaguje w logach:
```bash
sudo journalctl -u gitautonomic -f | grep "issue"
```

## Konfiguracja OAuth App (dla Dashboard)

### Krok 1: Tworzenie OAuth App

1. Przejdź do **GitHub Settings** → **Developer settings** → **OAuth Apps**
2. Kliknij **"New OAuth App"**
3. Wypełnij:
   - **Application name**: `GitAutonomic Dashboard`
   - **Homepage URL**: `https://gitautonomic.bizneszai.eu`
   - **Callback URL**: `https://gitautonomic.bizneszai.eu/api/auth/github/callback`

### Krok 2: Aktualizacja .env

Dodaj do pliku `.env`:
```bash
GITHUB_CLIENT_ID=your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_client_secret
```

### Krok 3: Restart Serwisów

```bash
sudo systemctl restart gitautonomic
sudo systemctl restart gitautonomic-worker
```

## Troubleshooting

### Problem: Bot nie reaguje na eventy

**Rozwiązanie:**
1. Sprawdź logi:
```bash
sudo journalctl -u gitautonomic -f
```

2. Zweryfikuj konfigurację webhook w GitHub App
3. Sprawdź czy secret webhook jest poprawny w `.env`

### Problem: Błędy autoryzacji

**Rozwiązanie:**
1. Sprawdź czy klucz prywatny jest poprawnie sformatowany
2. Zweryfikuj App ID
3. Upewnij się, że aplikacja jest zainstalowana na repozytorium

### Problem: Błędy bazy danych

**Rozwiązanie:**
1. Sprawdź połączenie z bazą:
```bash
psql $DATABASE_URL -c "SELECT 1;"
```

2. Uruchom ponownie migracje:
```bash
npm run migrate
```

### Problem: Błędy Redis

**Rozwiązanie:**
1. Sprawdź status Redis:
```bash
sudo systemctl status redis-server
```

2. Test połączenia:
```bash
redis-cli ping
```

### Monitoring i Logi

**Logi aplikacji:**
```bash
# Logi w czasie rzeczywistym
sudo journalctl -u gitautonomic -f

# Logi z ostatniej godziny
sudo journalctl -u gitautonomic --since "1 hour ago"
```

**Logi workera:**
```bash
sudo journalctl -u gitautonomic-worker -f
```

**Logi Nginx:**
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Konserwacja

### Aktualizacja Aplikacji

```bash
# Przejdź do katalogu aplikacji
cd /opt/gitautonomic

# Pobierz najnowsze zmiany
git pull origin main

# Zainstaluj zależności
npm install

# Uruchom migracje
npm run migrate

# Przebuduj aplikację
npm run build

# Restart serwisów
sudo systemctl restart gitautonomic
sudo systemctl restart gitautonomic-worker
```

### Backup Bazy Danych

```bash
# Tworzenie backupu
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Przywracanie z backupu
psql $DATABASE_URL < backup_file.sql
```

### Monitorowanie Zasobów

```bash
# Użycie CPU i pamięci
htop

# Miejsce na dysku
df -h

# Logi systemowe
sudo journalctl --disk-usage
```

## Bezpieczeństwo

### Rekomendacje

1. **Regularne aktualizacje systemu**:
```bash
sudo apt update && sudo apt upgrade
```

2. **Konfiguracja firewalla**:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

3. **Monitoring logów bezpieczeństwa**:
```bash
sudo grep "authentication failure" /var/log/auth.log
```

4. **Rotacja kluczy** (co 90 dni):
   - Wygeneruj nowy private key w GitHub App
   - Zaktualizuj `.env`
   - Restart serwisów

## Wsparcie

W przypadku problemów:

1. Sprawdź dokumentację: `/docs/troubleshooting.md`
2. Przejrzyj logi systemowe
3. Skontaktuj się z zespołem deweloperskim
4. Utwórz issue w repozytorium GitHub

---

**Gratulacje!** GitAutonomic został pomyślnie wdrożony i skonfigurowany dla domeny `gitautonomic.bizneszai.eu`.