# Todo checklist API Endpoints

## Publieke endpoints (`src/routes/public.js` & `src/routes/auth.js`)
- [x] `GET /api/help` — overzicht van alle endpoints
- [x] `GET /api/info` — BIC, naam, teamleden, type
- [x] `GET /api/accounts` — lijst van alle accounts (IBAN + saldo)
- [x] `GET /api/banks` — lijst banken (proxied via CB)
- [x] `GET /api/errorcodes` — lokale + CB foutcodes
- [x] `POST /api/auth/login` — JWT token ophalen
- [x] `GET /health` — server health check (`src/server.js`)

## OB endpoints (Originating Bank) (`src/routes/internal.js`)
- [x] `GET /api/po_new_generate?count=N` — random PO's genereren
- [x] `POST /api/po_new_add` — PO's toevoegen aan PO_NEW
- [x] `GET /api/po_new_process` — PO_NEW valideren → PO_OUT
- [x] `GET /api/po_out_send` — PO_OUT sturen naar CB
- [x] `GET /api/ack_pull` — ACKs ophalen van CB → ACK_IN
- [x] `POST /api/payments` — betaling starten in één stap (nieuw)

## BB endpoints (Beneficiary Bank) (`src/routes/internal.js`)
- [x] `GET /api/po_pull` — PO's ophalen van CB → PO_IN
- [x] `GET /api/po_in_process` — PO_IN verwerken, BA crediteren
- [x] `GET /api/ack_out_send` — ACK_OUT sturen naar CB

## Data & beheer endpoints (`src/routes/internal.js`)
- [x] `GET /api/cycle` — volledige OB+BB cycle in één call
- [x] `GET /api/stats` — live tellingen + totaal saldo
- [x] `GET /api/po_new`, `/po_out`, `/po_in` — tabellen inzien
- [x] `GET /api/ack_in`, `/ack_out` — tabellen inzien
- [x] `GET /api/transactions` — transactiehistorie
- [x] `GET /api/log?limit=N` — event log
- [x] `POST /api/accounts` — nieuw account aanmaken (admin)
- [x] `PUT /api/accounts/:iban/balance` — saldo aanpassen (admin)
- [x] `GET /api/users` — users beheren (admin)
- [x] `POST /api/users` — user aanmaken (admin)
- [x] `DELETE /api/users/:id` — user verwijderen (admin)

## Validatie & Businessregels (`src/utils/validators.js` & `src/services/obProcessor.js`)
- [x] Bedrag max €500 — foutcode 4002
- [x] Bedrag moet positief zijn — foutcode 4003
- [x] Max 2 decimalen op bedragen
- [x] IBAN validatie via mod-97 algoritme
- [x] BIC validatie — 8 of 11 chars, geen spaties
- [x] po_id formaat: `_`, max 50 chars
- [x] Datetime formaat: YYYY-MM-DD HH:MM:SS
- [x] Account saldo mag nooit negatief worden
- [x] Interne betalingen (OB==BB) geweigerd — code 3007
- [x] Alle foutcodes 2000-9003 correct geïmplementeerd
- [x] Duplicate po_id wordt genegeerd (INSERT IGNORE)
- [x] OA saldo check voor verzending naar CB

## GUI — Authenticatie (`public/index.html` & `public/script.js`)
- [x] Login scherm met username + password velden
- [x] Foutmelding bij foute credentials
- [x] JWT token opslaan in localStorage
- [x] Automatisch uitloggen bij 401 response
- [x] Logout knop in header
- [x] Twee rollen: admin en user — verschillende interface

## GUI — Admin Interface (`public/index.html` & `public/script.js`)
- [x] Dashboard met live statistieken (auto-refresh 5s)
- [x] Stat cards: accounts, saldo, PO_NEW/OUT/IN, ACK, TX, uitstaand
- [x] Quick action buttons: cycle draaien, POs genereren
- [x] Accounts tab — overzicht alle IBANs + saldo
- [x] Nieuw account aanmaken via modal
- [x] Saldo aanpassen per account
- [x] Betaling starten vanuit admin (OB flow)
- [x] PO Monitor — tabs voor PO_NEW/OUT/IN/ACK_IN/ACK_OUT
- [x] Status badges op PO rijen (ok/failed/pending)
- [x] Transactions tab — alle transacties
- [x] Logs tab met live feed + kleurcodering per type
- [x] Banks tab — lijst banken van CB
- [x] Users tab — users beheren (aanmaken/verwijderen)

## GUI — User Interface (`public/index.html` & `public/script.js`)
- [x] Mijn rekening — dropdown eigen IBANs + saldo
- [x] Betalingsformulier: van/naar IBAN, BIC, bedrag, bericht
- [x] IBAN validatie feedback in real-time
- [x] BIC dropdown van bekende banken + vrij invoer
- [x] Bedrag validatie (max €500, positief, 2 decimalen)
- [x] Resultaat tonen na betaling (success/fout)
- [x] Betalingshistorie — POs gekoppeld aan eigen accounts

## GUI — UX & Technisch (`public/index.html` & `public/script.js`)
- [x] Toast notificaties (success groen / fout rood, 3s)
- [x] Loading state op knoppen tijdens fetch
- [x] Centrale api() functie met automatische auth header
- [x] Responsive layout (laptop scherm)
- [x] Tabellen gesorteerd op datum, nieuwste eerst
- [x] Alles in één index.html (geen build step)
- [x] Header: banknaam, BIC, ingelogde user
