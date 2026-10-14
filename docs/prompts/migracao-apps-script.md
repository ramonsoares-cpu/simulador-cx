# Contexto da migração (Apps Script → Node/Express)

Origem: `Código.gs` (`doGet`, `getInitialData`, `runSimulation`) + `Simulador.html` (página única).

| Apps Script | Node |
|---|---|
| `doGet` | `GET /` → `public/index.html` |
| `google.script.run.getInitialData` | `GET /api/simulador/initial-data` |
| `google.script.run.runSimulation` | `POST /api/simulador/run` |
| `SpreadsheetApp` (3 planilhas) | `SheetsDB.readValues` (somente leitura) |
| `Utilities.sleep` + `robustOpenById` | retry com backoff em `SheetsDB` |
| `Session` | não usado no original; identidade via `X-Auth-Request-Email` |

Planilhas: status/equipes (`SHEET_STATUS_ID`), histórico + feriados (`SHEET_HISTORICO_ID`), Tymershift (`SHEET_TYMERSHIFT_ID`). Todas precisam ser compartilhadas (Leitor basta) com `GOOGLE_CLIENT_EMAIL`.
