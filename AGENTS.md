# Coding Guidelines

Diese Regeln gelten für Änderungen im gesamten Repository. Lies bei fachlichen Änderungen auch die passende Dokumentation unter `docs/` und die Projektübersicht in `README.md`.

## Projektstruktur und Code

- Das Repository verwendet npm-Workspaces: `apps/api` enthält die Fastify-API und den Apache-AGE-Zugriff, `apps/web` die React/Vite-Oberfläche. `e2e` enthält Playwright-Tests.
- Verwende Node.js 24 und installiere Abhängigkeiten vom Repository-Root mit `npm ci`. Führe die unten genannten Befehle ebenfalls dort aus.
- Schreibe neuen Anwendungscode in TypeScript und halte die vorhandenen `strict`-TypeScript-Einstellungen ein. Verwende konkrete Typen statt `any` und prüfe Eingaben an API- und Datenbankgrenzen.
- Halte HTTP-Routen, AGE-spezifischen Datenbankzugriff und UI-Zustand in ihren bestehenden Schichten. Neue Store-spezifische Logik gehört nicht in React-Komponenten.
- Orientiere dich bei Benennung, Imports und Formatierung an den benachbarten Dateien. Vermeide ungefragte Umformatierungen und Änderungen an generierten Dateien (`dist/`, `node_modules/`, Test-Reports).
- Ergänze bei Verhaltensänderungen passende Tests und aktualisiere betroffene Dokumentation oder Beispiele.

## Tests

- `npm test` führt die API-Unit- und Routentests sowie die Web-Komponententests aus. Führe den Befehl nach Codeänderungen aus.
- `npm run test:age` führt die Tests gegen eine echte Apache-AGE-Datenbank aus. Dafür muss `AGE_TEST_DATABASE_URL` auf eine laufende Testdatenbank zeigen. Führe diese Tests bei Änderungen an AGE-Zugriff, Cypher-Verarbeitung oder Migrationen aus; verwende eine entbehrliche Datenbank, da Tests Daten anlegen oder ändern können.
- `npm run test:e2e` führt den Chromium-Flow mit gemockten API-Antworten aus. Installiere Chromium bei Bedarf einmalig mit `npx playwright install chromium`. Führe den Flow bei Änderungen an der Bedienoberfläche oder am Query-Ablauf aus. Playwright startet den Web-Entwicklungsserver selbst.
- Lege API-Tests unter `apps/api/tests/`, AGE-Integrationstests unter `apps/api/integration/`, Web-Tests unter `apps/web/tests/` und Browser-Tests unter `e2e/` ab. Prüfe beobachtbares Verhalten und Fehlerfälle statt Implementierungsdetails zu spiegeln.

## Lint, Typen und Build

- `npm run lint` prüft API, Web, E2E und die Playwright-Konfiguration mit ESLint.
- `npm run check` umfasst Lint und TypeScript-Prüfungen aller Workspaces. Führe diesen Befehl vor Abschluss jeder Codeänderung aus.
- `npm run build` erstellt die API und das Web-Bundle. Führe ihn bei Änderungen an Build-Konfiguration, Abhängigkeiten, API/Web-Integration oder Auslieferung aus.
- Behebe neue Lint-, Typ- und Testfehler, bevor du eine Änderung abschließt. Melde nicht ausführbare Prüfungen samt Grund und bereits ausgeführten Alternativen.

## Abschluss

Beschreibe kurz die Änderung und nenne die tatsächlich ausgeführten Prüfungen mit ihrem Ergebnis. Die CI in `.github/workflows/build.yml` führt zusätzlich AGE-Integrationstests, Build und Playwright aus.
