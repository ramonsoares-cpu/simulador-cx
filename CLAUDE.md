# Simulador CX (Dimensionamento)

Migração do web app Google Apps Script "Dashboard Simulador CX" para Node.js 24 + Express 5 (CommonJS, sem build), entregue no Magic Deploy (`simulador-cx.hotmart.run`).

## Contrato da plataforma (não alterar)
- Entry `src/server.js` (`dotenv`, `0.0.0.0:${PORT||3001}`); `npm start` = `node src/server.js`.
- `GET /api/health` → `200 {"status":"ok"}`, registrado **antes** da autenticação, sem tocar em Sheets.
- Sem banco/ORM. Storage = Google Sheets (`googleapis`, Service Account, escopo `spreadsheets.readonly`).
- Secrets só por variáveis de ambiente: declarar em `values.yml` (`secretKeyRef`, nome `simulador-cx-<kebab>`) **e** em `.env.example`.
- Identidade: header `X-Auth-Request-Email` (ingress). `DEV_USER_EMAIL` só fora de produção.
- Front puro em `public/`; bibliotecas via npm servidas em `/vendor/...` (Chart.js 3.9.1 fixo).

## Estrutura
- `src/app.js` monta o Express; `src/routes/simulador.js` valida entrada (`GET /api/simulador/initial-data`, `POST /api/simulador/run`).
- `src/services/`: `hierarchy` (aba de equipes, cache 60 s), `baseline` (histórico, feriados, Tymershift), `forecast` (WMA), `simulation` (motor).
- `src/lib/SheetsDB.js` lê com `UNFORMATTED_VALUE` e cita o nome da aba; falhas do Google viram 502 (nunca 403).

## Regras
- Datas do Sheets chegam como serial; `src/lib/dates.js` normaliza para o dia (03:00 UTC).
- A aba do Tymershift é mensal (`TAB_TYMERSHIFT`, ex.: `2026-07`): atualizar `values.yml` a cada mês.
- Nunca `innerHTML` com dados dinâmicos; nunca `NODE_TLS_REJECT_UNAUTHORIZED=0`. Em rede com inspeção TLS use `npm run dev` (`--use-system-ca`).
- Mudanças de comportamento em relação ao Apps Script devem ser documentadas.
