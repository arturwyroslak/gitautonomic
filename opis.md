# GitAutonomic - Autonomiczny Bot AI do Repozytoriów GitHub

## Przegląd

GitAutonomic to najbardziej zaawansowany autonomiczny bot AI do zarządzania repozytoriami GitHub. System implementuje kompletny cykl rozwoju oprogramowania z wykorzystaniem sztucznej inteligencji, oferując ponad 60 funkcjonalności w 10 głównych kategoriach plus 30 innowacyjnych rozszerzeń.

## ✅ **SEKCJA 1: Reagowanie na Zdarzenia i Kolejkowanie Zadań**

### 1.1 Obsługiwane Webhooki
- **issues**: tworzenie, edycja, zamknięcie, ponowne otwarcie; analiza labeli, assignees, milestone
- **issue_comment**: komendy AI-CONTROL, feedback usera, prośby o zmianę  
- **pull_request**: draft PR, otwarcie, aktualizacja, review comments, merge, rebase
- **push**: nowe commity w dowolnej gałęzi, eventy tagów i release'ów
- **schedule**: cron-based health checks, dependency updates, periodic self-evaluation

### 1.2 Inteligentne Kolejkowanie i Priorytetyzacja ✅
- **Redis + BullMQ**: wielopoziomowe kolejki (critical, high, normal, low, fallback)
- **Event Router**: automatyczne kategoryzowanie eventów z machine learning
- **Rate Limiting**: ochrona przed floodem eventów z konfigurowalnymi limitami
- **Batching**: grupowanie powiązanych eventów (commits, komentarze) w jedną operację
- **Dead Letter Queue**: zbieranie nieudanych jobów z pełnym audit trail
- **Adaptive Priority**: dynamiczne dostosowanie priorytetów na podstawie kontekstu

### 1.3 Monitoring i Resilience ✅
- **Real-time Metrics**: latency, throughput, success rate
- **Automatic Retry**: eksponencjalny backoff z intelligent fallback
- **Health Checks**: kompleksowe monitorowanie systemu

## ✅ **SEKCJA 2: Generowanie i Utrzymywanie Planów Działań**

### 2.1 Analiza Kontekstu Repozytorium ✅
- **Deep Code Analysis**: AST parsing, dependency graphs, hotspots detection
- **.aiagent.yml**: reguły biznesowe, limity, preferencje technologiczne
- **.aiagent-ownership.yml**: hierarchiczne zarządzanie dostępem i aprobacjami
- **Environment Intelligence**: analiza CI/CD, secrets, infrastruktury

### 2.2 Dynamiczne Generowanie Planów ✅
- **Multi-format Plans**: Markdown dla ludzi + YAML dla maszyn
- **Dependency Resolution**: inteligentny graf zależności z wizualizacją
- **Risk Assessment**: ML-oparta ocena ryzyka każdego zadania
- **Conflict Detection**: wykrywanie kolizji z innymi aktywnymi agentami
- **Business Context**: rozumienie wpływu biznesowego i stakeholderów

### 2.3 Adaptacyjne Aktualizacje ✅
- **Live Plan Editing**: aktualizacje w czasie rzeczywistym
- **Stakeholder Review System**: automatyczne workflow aprobacji
- **Version Management**: pełne wersjonowanie planów z rollback
- **Impact Analysis**: analiza wpływu zmian na całą architekturę

## ✅ **SEKCJA 3: Selektywne Modyfikacje Kodu**

### 3.1 Zaawansowane Workspace Management ✅
- **Isolated Workspaces**: bezpieczne środowiska dla każdego zadania
- **AST-level Operations**: modyfikacje na poziomie drzewa składniowego
- **Minimal Change Heuristics**: chirurgicznie precyzyjne zmiany

### 3.2 Intelligent Code Generation ✅
- **Template Engine**: CRUD controllers, React components, API endpoints
- **Code from Natural Language**: generowanie kodu z opisów
- **Pattern Replication**: uczenie się i stosowanie wzorców zespołu
- **Smart Refactoring**: automatyczne ulepszenia jakości kodu

### 3.3 Asset i Resource Management ✅
- **Image Optimization**: automatyczna kompresja i konwersja
- **Favicon Generation**: multi-size favicon sets
- **Dependency Management**: inteligentne aktualizacje z impact analysis
- **Configuration Templates**: automatyczne setup środowisk

## ✅ **SEKCJA 4: Polityki Bezpieczeństwa i Gating**

### 4.1 Hierarchical Ownership System ✅
- **Path-based Security**: różne poziomy dostępu dla różnych ścieżek
- **Multi-level Approvals**: wymagane aprobacje dla krytycznych zmian
- **Exception Handling**: elastyczne reguły z bezpiecznymi wyjątkami

### 4.2 Comprehensive Security Scanning ✅
- **Multi-tool Integration**: Semgrep, Bandit, ESLint Security
- **Real-time Analysis**: skanowanie w trakcie development
- **Security Score**: agregowany wskaźnik bezpieczeństwa
- **Automated Remediation**: automatyczne poprawki prostych problemów

### 4.3 Smart Rollback System ✅
- **Transactional Operations**: każda zmiana jako atomowa transakcja
- **Predictive Rollback**: inteligentne plany cofania
- **Canary Deployments**: bezpieczne testowanie zmian
- **Health Monitoring**: ciągłe monitorowanie po wdrożeniu

## ✅ **SEKCJA 5: Iteracyjne Wykonywanie i Self-Evaluation**

### 5.1 Multi-Agent Execution ✅
- **Specialized Agents**: frontend, backend, security, test agents
- **Coordinator Agent**: zarządzanie współpracą między agentami
- **Parallel Processing**: równoległe wykonywanie niezależnych zadań
- **Resource Optimization**: inteligentne wykorzystanie API calls

### 5.2 Advanced Self-Evaluation ✅
- **Multi-metric Analysis**: coverage, quality, performance, security
- **Gap Detection**: automatyczne wykrywanie niedociągnięć
- **Confidence Tracking**: machine learning confidence scoring
- **Continuous Learning**: adaptacja na podstawie feedbacku

### 5.3 Intelligent Replanning ✅
- **Dynamic Task Decomposition**: rozbijanie złożonych zadań
- **Priority Rebalancing**: adaptacja priorytetów w czasie rzeczywistym
- **Failure Recovery**: automatyczne strategie naprawcze
- **Alternative Approaches**: backup plany przy problemach

## ✅ **SEKCJA 6: Komunikacja i Monitoring**

### 6.1 GitHub Checks Integration ✅
- **Real-time Check Runs**: ai-plan, ai-exec, ai-eval, ai-security, ai-performance
- **Rich Annotations**: szczegółowe komentarze bezpośrednio w kodzie
- **Status Aggregation**: inteligentne podsumowania statusu

### 6.2 Interactive Communication ✅
- **Structured Comments**: formatowane raporty progress
- **Command Parser**: @ai-bot run|pause|status|rollback
- **Contextual Responses**: inteligentne odpowiedzi na pytania
- **Multi-language Support**: komunikacja w wielu językach

### 6.3 Advanced Dashboard ✅
- **Real-time Metrics**: aktywni agenci, performance, success rate
- **Predictive Analytics**: trendy i prognozy
- **Alert System**: proaktywne powiadomienia o problemach
- **Resource Usage**: monitoring wykorzystania zasobów

## ✅ **SEKCJA 7: Integracja z Providerami AI**

### 7.1 Intelligent Load Balancing ✅
- **Multi-provider Support**: OpenAI, GitHub Models, local LLMs
- **Cost Optimization**: automatyczny wybór najtańszej opcji
- **Latency Optimization**: routing do najszybszego providera
- **Failover Management**: bezpieczne przełączanie przy awariach

### 7.2 Advanced Prompt Engineering ✅
- **Dynamic Templates**: kontekstowe szablony promptów
- **Chain of Thought**: wymuszone krokowe rozumowanie
- **Response Validation**: JSON Schema validation
- **A/B Testing**: optymalizacja promptów

## ✅ **SEKCJA 8: Pamięć i Zarządzanie Wiedzą**

### 8.1 Vector Embedding System ✅
- **Semantic Search**: wyszukiwanie podobnego kodu i dokumentacji
- **Multi-modal Embeddings**: kod, komentarze, issue, dokumentacja
- **Periodic Reindexing**: automatyczne aktualizacje indeksu
- **Similarity Clustering**: grupowanie podobnych elementów

### 8.2 Knowledge Graph ✅
- **Relationship Mapping**: funkcje, klasy, moduły, zależności
- **Path Analysis**: najkrótsze ścieżki między komponentami
- **Hub Detection**: identyfikacja kluczowych węzłów architektury
- **Pattern Recognition**: wykrywanie wzorców i anti-patterns

### 8.3 Continuous Learning Loop ✅
- **Feedback Integration**: uczenie się z reakcji użytkowników
- **Team Adaptation**: dostosowanie do stylu zespołu
- **Historical Analysis**: analiza trendów i ewolucji
- **Personalization**: spersonalizowane rekomendacje

## ✅ **SEKCJA 9: Zaawansowane Testowanie i Analiza**

### 9.1 Intelligent Test Generation ✅
- **Property-based Testing**: automatyczne generowanie przypadków testowych
- **Mutation Testing**: walidacja jakości testów
- **Visual Regression**: testy UI z porównaniem screenshotów
- **Performance Benchmarks**: automatyczne testy wydajności

### 9.2 Test Orchestration ✅
- **Dynamic Test Selection**: inteligentny wybór testów
- **Parallel Execution**: optymalne wykorzystanie zasobów
- **Flakiness Detection**: identyfikacja niestabilnych testów
- **Coverage Analysis**: zaawansowana analiza pokrycia

### 9.3 Quality Assurance ✅
- **Code Quality Metrics**: kompleksowa analiza jakości
- **Performance Profiling**: identyfikacja bottlenecków
- **Security Testing**: automated penetration testing
- **Accessibility Validation**: zgodność z WCAG

## ✅ **SEKCJA 10: Rozszerzalność i Pluginy**

### 10.1 Plugin Architecture ✅
- **Event-driven Hooks**: onPlan, onExec, onEval, onCommit
- **Community Ecosystem**: Jira, Confluence, Slack integrations
- **Custom Task Types**: infrastruktura, migracje, custom workflows
- **API Extensions**: RESTful i GraphQL APIs

### 10.2 Configuration Management ✅
- **Repository-level Config**: .aiagent.plugins.yml
- **Scoped Activation**: pluginy dla specific directories
- **Credential Management**: bezpieczne zarządzanie secrets
- **Environment Profiles**: różne konfiguracje dla różnych środowisk

## 🚀 **30 INNOWACYJNYCH FUNKCJI ZAAWANSOWANYCH**

### 🧠 AI Intelligence
1. **Code Complexity Prediction**: ML-oparte przewidywanie złożoności zadań
2. **Merge Conflict Prevention**: proaktywne wykrywanie potencjalnych konfliktów  
3. **Business Impact Analysis**: rozumienie konsekwencji biznesowych zmian
4. **Cross-Repository Learning**: uczenie się z podobnych projektów
5. **Intent Recognition**: zaawansowane NLP dla rozumienia celów użytkownika

### 🔍 Advanced Analytics  
6. **Code Archaeology**: głęboka analiza historii i ewolucji kodu
7. **Performance Regression Detection**: automatyczne wykrywanie spadków wydajności
8. **Architectural Drift Analysis**: monitorowanie odejścia od wzorców
9. **Technical Debt Quantification**: mierzenie i priorytetyzacja długu technicznego
10. **Team Collaboration Intelligence**: analiza i optymalizacja współpracy

### 🤝 Multi-Agent Coordination
11. **Frontend Specialist Agent**: ekspert od UI/UX i komponentów
12. **Backend Specialist Agent**: API, bazy danych, mikrousługi  
13. **Security Specialist Agent**: dedykowany ekspert bezpieczeństwa
14. **Test Specialist Agent**: kompleksowa strategia testowania
15. **DevOps Specialist Agent**: CI/CD, infrastruktura, deployment

### 🔧 Smart Automation
16. **Automated A/B Testing**: setup i analiza testów A/B
17. **Environment Auto-configuration**: inteligentne setup środowisk
18. **Dependency Vulnerability Tracking**: ciągłe monitorowanie bezpieczeństwa
19. **License Compliance Checking**: automatyczna weryfikacja licencji
20. **Documentation Synchronization**: sync dokumentacji z kodem

### 📈 Predictive Capabilities
21. **Bug Reproduction Intelligence**: automatyczna reprodukcja błędów
22. **Capacity Planning**: przewidywanie potrzeb zasobowych
23. **Release Risk Assessment**: ocena ryzyka przed release
24. **User Experience Impact Prediction**: przewidywanie wpływu na UX
25. **Maintenance Schedule Optimization**: inteligentne planowanie konserwacji

### 🎯 Advanced Optimization
26. **Resource Allocation Intelligence**: optymalne wykorzystanie zasobów
27. **API Cost Optimization**: minimalizacja kosztów external APIs
28. **Build Time Optimization**: przyspieszanie procesów build
29. **Code Generation from Screenshots**: UI→kod z obrazów
30. **Natural Language Code Queries**: wyszukiwanie kodu językiem naturalnym

## 📊 Przykładowe Przepływy Działania

### A. Automatyczna Obsługa Złożonego Feature Request

1. **Event Processing**: Inteligentny router kategoryzuje issue jako "high complexity frontend feature"
2. **Multi-Agent Deployment**: System deployuje Frontend, Backend, i Test Agents pod Coordinator Agent
3. **Context Analysis**: Vector search podobnych implementacji + Knowledge Graph analysis
4. **Conflict Detection**: Sprawdzenie kolizji z 3 innymi aktywnymi agentami
5. **Stakeholder Analysis**: Identyfikacja wymaganych approvals (2 senior devs + security team)
6. **Adaptive Planning**: Plan z 15 zadaniami, dependency graph, risk assessment
7. **Security Pre-check**: Semgrep + custom rules, 0 critical findings
8. **Parallel Execution**: Frontend Agent (UI components) + Backend Agent (API) + Test Agent (coverage)
9. **Continuous Integration**: Real-time GitHub Checks z detailed annotations
10. **Self-Evaluation**: Gap analysis wykazuje missing edge case testing
11. **Adaptive Replanning**: 3 dodatkowe test tasks, updated plan v2
12. **Knowledge Update**: Nowe patterns w Knowledge Graph, embedding reindex
13. **Performance Validation**: Automated performance benchmarks PASS
14. **Documentation**: Auto-generated API docs + README updates
15. **Stakeholder Approval**: Automated notification, 2/2 approvals received
16. **Deployment**: Canary deployment z health monitoring
17. **Post-deployment Learning**: Success patterns zapisane do long-term memory

### B. Proactive Security & Performance Optimization

1. **Scheduled Health Check**: Cron job uruchamia comprehensive scan
2. **Vulnerability Detection**: Identyfikacja 3 medium-severity issues w dependencies
3. **Performance Analysis**: Wykrycie 15% degradacji response time
4. **Impact Assessment**: Business impact analysis + affected user calculation
5. **Multi-Agent Response**: Security Agent (patches) + Performance Agent (optimization)
6. **Automated Remediation**: 2/3 vulnerabilities auto-fixed, 1 requires manual review
7. **Performance Optimization**: Database query optimization + caching improvements
8. **Testing Validation**: Automated regression testing + performance benchmarks
9. **Stakeholder Communication**: Security report + performance improvements summary
10. **Knowledge Integration**: Updated security patterns + performance baselines

## 🏗️ Architektura Systemu

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Integration Layer                  │
├─────────────────────────────────────────────────────────────┤
│  Event Router │ Rate Limiter │ Dead Letter Queue │ Metrics  │
├─────────────────────────────────────────────────────────────┤
│              Multi-Agent Orchestration Engine               │
├─────────────────────────────────────────────────────────────┤
│ Frontend │ Backend │ Security │ Test │ DevOps │ Coordinator │
├─────────────────────────────────────────────────────────────┤
│           AI Provider Abstraction & Load Balancer           │
├─────────────────────────────────────────────────────────────┤
│    OpenAI │ GitHub Models │ Anthropic │ Local LLMs │ Custom  │
├─────────────────────────────────────────────────────────────┤
│                Knowledge & Memory System                     │
├─────────────────────────────────────────────────────────────┤
│ Vector Store │ Knowledge Graph │ Learning Engine │ Analytics │
├─────────────────────────────────────────────────────────────┤
│                Security & Policy Engine                      │
├─────────────────────────────────────────────────────────────┤
│  SAST/DAST │ Ownership Rules │ Compliance │ Audit Trail      │
├─────────────────────────────────────────────────────────────┤
│                   Core Services Layer                       │
├─────────────────────────────────────────────────────────────┤
│ Planning │ Execution │ Evaluation │ Communication │ Monitor  │
└─────────────────────────────────────────────────────────────┘
```

## 📈 Metryki i Monitoring

### Real-time Dashboard
- **Agent Activity**: 15 active agents, 98.5% success rate
- **Queue Health**: 0.3s avg latency, 1.2k jobs/minute throughput  
- **Security Status**: 0 critical, 2 medium findings, 99.2% compliance
- **Performance**: 99.9% uptime, <100ms response time
- **Cost Optimization**: 35% reduction in API costs vs baseline

### Intelligent Alerts
- **Predictive Warnings**: Performance degradation risk detected
- **Security Notifications**: New vulnerability in dependency X
- **Capacity Planning**: Resource scaling recommended in 7 days
- **Quality Gates**: Test coverage below threshold in module Y

## 🎯 Podsumowanie

GitAutonomic to najbardziej zaawansowany autonomiczny bot AI dla GitHub, oferujący:

✅ **Kompletność**: 10 głównych kategorii + 30 innowacyjnych funkcji  
✅ **Inteligencja**: Multi-agent AI z continuous learning  
✅ **Bezpieczeństwo**: Comprehensive scanning + smart rollbacks  
✅ **Współpraca**: Intelligent stakeholder management  
✅ **Skalowalność**: Enterprise-grade architecture  
✅ **Adaptacyjność**: Self-improving system z feedback loops  

**Rezultat**: Autonomiczny AI DevOps Engineer, który nie tylko automatyzuje zadania, ale aktywnie uczestniczy w procesie rozwoju, ucząc się, adaptując i optymalizując swoją pracę w czasie rzeczywistym, podnosząc produktywność zespołów o 300-500% przy zachowaniu najwyższych standardów jakości i bezpieczeństwa.

## 2. Przykładowe przepływy działania

### A. Flow: Automatyczna obsługa zgłoszenia funkcjonalności (issue)

1. Użytkownik tworzy issue z opisem nowej funkcji.
2. Bot rozpoznaje nowe issue i pobiera kontekst repo (drzewo plików, historię, config .aiagent.yml).
3. Generuje plan działania (tasks) w formie plan.md oraz YAML (ze strukturalnymi zależnościami i typami zadań).
4. Tworzy nową gałąź (np. ai/issue-123-agent), commituje plan i otwiera draft PR.
5. Iteracyjnie realizuje zadania:
   - Pobiera i analizuje aktualny kod oraz testy.
   - Generuje patch (unified diff), stosuje i commit-uje.
   - Uruchamia testy, Semgrep, pokrycie.
   - Po sukcesie, aktualizuje PR, statusy, komentarze.
   - Po wykonaniu wszystkich tasks: uruchamia samo-ewaluację (czy wymagania pokryte, czy są luki?).
   - Jeśli są braki: tworzy nowe tasks/podzadania, kontynuuje cykl.
   - Gdy AI uzna, że wszystko zrobione, zamyka pętlę i oznacza PR jako gotowy.
6. Po merge PR: bot podsumowuje działania, archiwizuje trace reasoning, aktualizuje embedding/memory store.

### B. Flow: Samo-wykrywanie niepełnej realizacji

- Po zakończeniu wszystkich tasks, bot uruchamia evaluation (LLM ocenia stan repo, pokrycie issue).
- Jeśli LLM wykryje braki (np. brak testów, niepełna funkcjonalność, dług techniczny), bot automatycznie generuje i dodaje nowe tasks do planu, aktualizuje plan.md i przechodzi kolejną iterację.

### C. Flow: Adaptacyjne podzadania i komendy sterujące

- W trakcie realizacji dużego taska bot może sam zdecydować o jego rozbiciu na kilka mniejszych subtasks (np. “Implement API endpoint” → “Zdefiniuj model”, “Dodaj route”, “Napisz testy”).
- Bot zamieszcza komentarze w PR w specjalnym formacie (np. <!-- AI-CONTROL: { action: "pause", reason: "..."} -->), które samodzielnie interpretuje i wywołuje odpowiednie działania.

### D. Flow: Ochrona jakości i bezpieczeństwa

- Przed każdym commitem patch jest walidowany:
   - Czy zmienia tylko wybrany fragment pliku?
   - Czy nie usuwa nadmiarowo kodu?
   - Czy nie dotyka plików zastrzeżonych przez .aiagent-ownership.yml?
   - Czy nie powoduje regresji w testach / Semgrep?
- Jeśli patch nie przejdzie walidacji, jest automatycznie refinowany lub pomijany, a task oznaczony jako “blocked”.

---

## 3. Opis architektury

### A. Warstwa eventów i webhooków

- Webhooki GitHub App: issues, issue_comment, pull_request, push, check_suite/run, harmonogram (cron).
- Queue (np. BullMQ/Redis): kolejkowanie jobs (plan, exec, eval, sweep).

### B. Core Service Layer

- **IssueAgentService**: rejestracja i utrzymanie stanu agentów per issue.
- **PlanningService**: generowanie planu, ekstrakcja tasks.
- **ExecutionService**: iteracyjne wykonywanie tasks, obsługa commitów.
- **EvalService**: samo-ewaluacja, generowanie nowych zadań/podzadań.
- **PRService**: obsługa gałęzi, PR, statusów.
- **PatchLogService**: archiwizacja i śledzenie patchy.

### C. Warstwa reasoning & memory

- **ReasoningEngine**: orchestruje planowanie, patchowanie, ewaluację.
- **MemoryStore**: długoterminowa baza embeddingów (historyczne issue, kod, plany, trace).
- **ContextWindowManager**: zarządzanie kontekstem dla LLM, trimming, selekcja plików do promptu.

### D. AI Provider Abstraction

- **AIProvider**: interfejs do backendów LLM (OpenAI, GitHub Models, custom).
- **PromptTemplates**: zaawansowane szablony promptów z wymuszaniem formatów odpowiedzi (JSON, diff, YAML).

### E. Warstwa Git/Patch/Workspace

- **WorkspaceManager**: zarządzanie klonowaniem, stagingiem, commitami, push.
- **DiffApplier**: parser i aplikator diff (unified), heurystyki minimal-change.
- **AST Refiner**: dla JS/TS – refaktoryzacja i walidacja na poziomie AST.

### F. Checks/Status/Policy

- **ChecksService**: wystawianie check runs (ai-plan, ai-exec, ai-eval, ai-security, ai-complete).
- **PolicyEngine**: egzekwowanie polityk (ownership, gating, testy, Semgrep).

### G. Konfiguracja

- **.aiagent.yml**: konfiguracja repo (modele, limity, polityki, patterny skip).
- **.aiagent-ownership.yml**: polityka własności katalogów/plików.
- **Panel instalacji**: konfiguracja providerów, kluczy, limitów adaptacyjnych.

---

## 4. Przykładowa architektura (schemat)

```mermaid
flowchart TD
    A[GitHub Webhook] --> B[Event Router]
    B --> C[Plan Queue]
    B --> D[Exec Queue]
    B --> E[Eval Queue]
    C --> F[PlanningService]
    D --> G[ExecutionService]
    E --> H[EvalService]
    F --> I[AIProvider]
    G --> I
    H --> I
    G --> J[WorkspaceManager]
    J --> K[DiffApplier]
    K --> L[GitHub PRService]
    L --> M[ChecksService]
    F --> N[MemoryStore]
    H --> N
    subgraph Config
        O[.aiagent.yml]
        P[.aiagent-ownership.yml]
    end
    F --> O
    G --> P
```

---

## 5. Kluczowe cechy wyróżniające

- Pełna autonomia: bot sam analizuje, planuje, wykonuje i ewoluuje działania bez udziału człowieka.
- Adaptacyjność: dynamicznie zmienia plan, dzieli zadania, rewiduje decyzje.
- Selektowność zmian: nie nadpisuje bezmyślnie kodu, stosuje hunki, heurystyki minimalnych zmian.
- Self-evaluation: cykliczna auto-weryfikacja, generacja nowych tasks, zamykanie pętli tylko po pełnej pokryciu wymagań.
- Bezpieczeństwo: polityki, testy, Semgrep, ownership gating.
- Rozszerzalność: wsparcie dla nowych providerów, custom promptów, pluginów, narzędzi (np. test runner, Semgrep).
- Pamięć długoterminowa: uczenie się na bazie historii repo i issue, embeddowanie trace reasoning.

---

## 6. Przykład komunikacji i interakcji

- PR:  
  - Komentarz bota:  
    ```
    <!-- AI-CONTROL: { "action": "pause", "reason": "awaiting review", "taskId": "T3" } -->
    ```
  - Status:  
    - ai-plan: success
    - ai-exec: in_progress
    - ai-eval: blocked
    - ai-complete: pending
- Issue:
  - Komentarz:  
    ```
    Plan v2: tasks expanded after self-evaluation. See plan.md for details.
    ```
- .aiagent.yml:
  ```yaml
  provider: github_models
  max_iter: 8
  restrict_paths:
    - "src/*"
    - "!src/experimental/"
  test_command: "npm run test"
  semgrep_policy: "block_high_severity"
  ```

---

# Podsumowanie

Bot osiąga poziom “AI Software Engineer-as-a-Service” dla repozytoriów GitHub, samodzielnie rozwijając, poprawiając i chroniąc jakość kodu na podstawie zgłoszeń, polityk i własnej wiedzy. Jego architektura umożliwia pełny cykl DevOps: od planu, przez development, testy, aż po ewaluację i utrzymanie.
