# PingfinAPI — Volledige API Documentatie

> **Project:** Pingfin 2026 — Regular Bank (OB/BB)
> **Team:** Azzouzi Fadil, Hammouche Ayoub, Kallouch Ilyas
> **Banken:** FAI Bank (Bank 1) · FAI Bank 2 (Bank 2)
> **Base URL:** `http://localhost:3000/api`

---

## Inhoudsopgave

1. [Overzicht](#1-overzicht)
2. [Authenticatie](#2-authenticatie)
3. [Standaard Responsformaat](#3-standaard-responsformaat)
4. [Foutcodes](#4-foutcodes)
5. [Rate Limiting](#5-rate-limiting)
6. [Publieke Endpoints](#6-publieke-endpoints)
7. [Authenticatie Endpoint](#7-authenticatie-endpoint)
8. [Beveiligde Endpoints — OB Workflow](#8-beveiligde-endpoints--ob-workflow)
9. [Beveiligde Endpoints — BB Workflow](#9-beveiligde-endpoints--bb-workflow)
10. [Beveiligde Endpoints — Full Cycle](#10-beveiligde-endpoints--full-cycle)
11. [Beveiligde Endpoints — Betalingen](#11-beveiligde-endpoints--betalingen)
12. [Beveiligde Endpoints — Data Viewers](#12-beveiligde-endpoints--data-viewers)
13. [Admin Endpoints](#13-admin-endpoints)
14. [Datamodellen](#14-datamodellen)
15. [Validatieregels](#15-validatieregels)
16. [Clearing Bank Integratie](#16-clearing-bank-integratie)
17. [Configuratie](#17-configuratie)
18. [Installatie & Deployment](#18-installatie--deployment)

---

## 1. Overzicht

De PingfinAPI simuleert een interbankenbetalingssysteem. Elke bankinstantie kan functioneren als:

- **OB (Originating Bank):** Initieert betalingen namens rekeninghouders
- **BB (Beneficiary Bank):** Ontvangt betalingen van andere banken

Betalingen verlopen via een centrale **Clearing Bank (CB)** die als tussenpartij fungeert.

### Betalingsflow

```
OB                    CB                    BB
 │                     │                     │
 ├─ PO_NEW (draft) ───►│                     │
 ├─ PO_NEW → validate  │                     │
 ├─ PO_OUT → send ────►│                     │
 │                     ├─ PO_OUT → BB ──────►│
 │                     │                     ├─ PO_IN → validate
 │                     │◄── ACK_OUT ─────────┤
 │◄── ACK_IN ──────────┤                     │
 ├─ Saldo bijwerken    │                     │
```

---

## 2. Authenticatie

De API gebruikt **JWT (JSON Web Token)** authenticatie.

### Token verkrijgen

Doe een `POST /api/auth/login` request (zie [sectie 7](#7-authenticatie-endpoint)).

### Token gebruiken

Voeg het token toe als `Authorization` header bij alle beveiligde endpoints:

```
Authorization: Bearer <jouw-jwt-token>
```

### Token details

| Parameter | Waarde |
|-----------|--------|
| Algoritme | HS256 |
| Geldigheid | 4 uur (configureerbaar via `JWT_EXPIRES_IN`) |
| Payload | `{ id, username, role }` |

### Rollen

| Rol | Toegang |
|-----|---------|
| `admin` | Alle endpoints inclusief gebruikersbeheer en accountbeheer |
| `user` | Alle operationele endpoints (workflows, data viewers) |

---

## 3. Standaard Responsformaat

Alle responses volgen hetzelfde formaat:

### Succes

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": { }
}
```

### Fout

```json
{
  "ok": false,
  "status": 400,
  "code": "3001",
  "message": "Originating account not found",
  "data": null
}
```

| Veld | Type | Beschrijving |
|------|------|-------------|
| `ok` | boolean | `true` bij succes, `false` bij fout |
| `status` | number | HTTP statuscode |
| `code` | string | Interne fout-/succescode |
| `message` | string | Leesbare beschrijving |
| `data` | object \| array \| null | Payload van de response |

---

## 4. Foutcodes

### Succes

| Code | Betekenis |
|------|-----------|
| `2000` | OK — Operatie geslaagd |

### OB Validatiefouten (3xxx)

| Code | Betekenis |
|------|-----------|
| `3001` | Originerende rekening (OA) niet gevonden |
| `3002` | Onvoldoende saldo op originerende rekening |
| `3003` | Ongeldig PO-formaat (validatie mislukt) |
| `3004` | Bedrag overschrijdt limiet van €500 |
| `3005` | Bedrag moet positief zijn |
| `3006` | Dubbel po_id (reeds aanwezig) |
| `3007` | Interne betaling (OB == BB) niet toegestaan |

### CB Fouten (4xxx)

| Code | Betekenis |
|------|-----------|
| `4001` | Interne transactie — mag niet naar CB gestuurd worden |
| `4002` | Bedrag overschrijdt €500 limiet |
| `4003` | Bedrag mag niet negatief zijn |
| `4004` | Begunstigde bank (BB) bestaat niet bij CB |
| `4005` | PO reeds ontvangen door CB |

### BB Validatiefouten (5xxx)

| Code | Betekenis |
|------|-----------|
| `5001` | Begunstigde rekening (BA) niet gevonden |
| `5002` | Ongeldig PO-formaat aan BB-zijde |
| `5003` | Dubbel PO ontvangen |

### Netwerk-/API-fouten (9xxx)

| Code | Betekenis |
|------|-----------|
| `9001` | CB API niet bereikbaar of timeout |
| `9002` | Ongeldige response van CB |
| `9003` | Authenticatiefout (ongeldig token of credentials) |

---

## 5. Rate Limiting

| Parameter | Waarde |
|-----------|--------|
| Venster | 60 seconden |
| Max requests | 300 per IP per venster |
| Scope | Alle `/api/*` endpoints |

Bij overschrijding: HTTP `429 Too Many Requests`.

---

## 6. Publieke Endpoints

Geen authenticatie vereist.

---

### `GET /api/help`

Lijst van alle beschikbare endpoints.

**Response:**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": {
    "bank_type": "Regular Bank (OB/BB)",
    "endpoints": {
      "public": ["GET /api/help", "GET /api/info", "..."],
      "protected": ["POST /api/auth/login", "GET /api/po_new", "..."]
    },
    "response_format": {
      "ok": "bool",
      "status": "HTTP code",
      "code": "message code",
      "message": "string",
      "data": "payload"
    }
  }
}
```

---

### `GET /api/info`

Identiteitsinformatie van de bank.

**Response:**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": {
    "bic": "BOFABE3X",
    "name": "Team 15 Bank",
    "members": "Azzouzi Fadil, Hammouche Ayoub, Kallouch Ilyas",
    "type": "regular"
  }
}
```

---

### `GET /api/accounts`

Lijst van alle bankrekeningen met saldo's.

**Response:**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": [
    {
      "id": "BE82414694956858",
      "balance": 50000.00
    }
  ]
}
```

---

### `GET /api/banks`

Lijst van alle deelnemende banken, opgehaald van de Clearing Bank.

**Response:** Banklijst van CB (geproxied).

**Mogelijke fouten:**

| Code | Situatie |
|------|----------|
| `9001` | CB niet bereikbaar |

---

### `GET /api/errorcodes`

Overzicht van alle lokale en CB foutcodes.

**Response:**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": {
    "local": {
      "2000": { "code": "2000", "message": "OK" },
      "3001": { "code": "3001", "message": "OA not found" }
    },
    "clearing_bank": { }
  }
}
```

---

## 7. Authenticatie Endpoint

---

### `POST /api/auth/login`

Verifieer inloggegevens en ontvang een JWT token.

**Request Body:**

```json
{
  "username": "admin",
  "password": "admin123"
}
```

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|-------------|
| `username` | string | Ja | Gebruikersnaam |
| `password` | string | Ja | Wachtwoord (plaintext, wordt intern vergeleken met bcrypt hash) |

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    }
  }
}
```

**Mogelijke fouten:**

| HTTP | Code | Situatie |
|------|------|----------|
| `400` | `3003` | Ontbrekend username of password |
| `401` | `9003` | Ongeldige inloggegevens |
| `500` | — | Serverfout |

---

## 8. Beveiligde Endpoints — OB Workflow

Vereist: `Authorization: Bearer <token>`

De OB-workflow verloopt in vier stappen:

```
1. po_new_generate / po_new_add  →  PO_NEW (wachtrij)
2. po_new_process                →  PO_OUT (gevalideerd)
3. po_out_send                   →  Verzonden naar CB
4. ack_pull                      →  ACK ontvangen, saldo bijgewerkt
```

---

### `GET /api/po_new_generate`

Genereer willekeurige Payment Orders voor testdoeleinden.

**Query Parameters:**

| Parameter | Type | Standaard | Beschrijving |
|-----------|------|-----------|-------------|
| `count` | number | `10` | Aantal te genereren PO's (max 100) |
| `errors` | boolean | `true` | Voeg opzettelijk ongeldige PO's toe (bijv. bedrag > €500) |

**Voorbeeld request:**

```
GET /api/po_new_generate?count=5&errors=false
```

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "Generated 5 PO's",
  "data": [
    {
      "po_id": "BOFABE3X_1714294245000-0-a1b2",
      "po_amount": 250.50,
      "po_message": "Test run 2026-04-28T10:30 - tx 1",
      "po_datetime": "2026-04-28 10:30:45",
      "ob_id": "BOFABE3X",
      "oa_id": "BE82414694956858",
      "bb_id": "GKCCBEBB",
      "ba_id": "BE72599632030243"
    }
  ]
}
```

---

### `POST /api/po_new_add`

Voeg Payment Orders toe aan de PO_NEW wachtrij.

**Request Body:**

```json
{
  "data": [
    {
      "po_id": "BOFABE3X_1714294245000-0-a1b2",
      "po_amount": 250.50,
      "po_message": "Betaling voor diensten",
      "po_datetime": "2026-04-28 10:30:45",
      "ob_id": "BOFABE3X",
      "oa_id": "BE82414694956858",
      "bb_id": "GKCCBEBB",
      "ba_id": "BE72599632030243"
    }
  ]
}
```

**PO Object velden:**

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|-------------|
| `po_id` | string | Ja | Uniek ID, max 50 tekens, begint met `{OB_BIC}_` |
| `po_amount` | number | Ja | Bedrag in EUR (> 0, max €500, max 2 decimalen) |
| `po_message` | string | Nee | Betalingsomschrijving |
| `po_datetime` | string | Ja | Formaat: `YYYY-MM-DD HH:MM:SS` |
| `ob_id` | string | Ja | BIC van de originerende bank |
| `oa_id` | string | Ja | IBAN van de originerende rekening |
| `bb_id` | string | Ja | BIC van de begunstigde bank |
| `ba_id` | string | Ja | IBAN van de begunstigde rekening |

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": {
    "inserted_count": 1,
    "inserted": ["BOFABE3X_1714294245000-0-a1b2"]
  }
}
```

---

### `GET /api/po_new_process`

Valideer alle PO's in de PO_NEW wachtrij en verplaats geldige PO's naar PO_OUT.

**Uitgevoerde validaties:**

1. IBAN-formaat en mod-97 checksum (OA en BA)
2. BIC-formaat (OB en BB)
3. Bedrag > 0 en ≤ €500
4. Datetime-formaat correct
5. Originerende rekening (OA) bestaat in deze bank
6. Voldoende saldo op OA
7. OB ≠ BB (geen interne betalingen)
8. PO_ID nog niet aanwezig in PO_OUT

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": {
    "passed": ["BOFABE3X_1714294245000-0-a1b2"],
    "failed": [
      {
        "po_id": "BOFABE3X_1714294245000-1-c3d4",
        "code": "3002",
        "reason": "Insufficient balance"
      }
    ]
  }
}
```

---

### `GET /api/po_out_send`

Stuur alle openstaande PO_OUT records naar de Clearing Bank.

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": {
    "sent": 2,
    "response": { }
  }
}
```

**Mogelijke fouten:**

| Code | Situatie |
|------|----------|
| `9001` | CB niet bereikbaar |

---

### `GET /api/ack_pull`

Haal Acknowledgments op van de Clearing Bank, verwerk ze en werk rekeningsaldo's bij.

**Wat er gebeurt:**
1. Ontvangen ACKs worden opgeslagen in `ack_in`
2. Bij succesvolle ACK: saldo van OA wordt verlaagd
3. Transactierecord aangemaakt in `transactions`

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": {
    "received": 2,
    "processed": 2
  }
}
```

---

## 9. Beveiligde Endpoints — BB Workflow

Vereist: `Authorization: Bearer <token>`

De BB-workflow verloopt in drie stappen:

```
1. po_pull       →  PO_IN (ontvangen van CB)
2. po_in_process →  Rekening gecrediteerd, ACK aangemaakt
3. ack_out_send  →  ACK verzonden naar CB
```

---

### `GET /api/po_pull`

Haal inkomende Payment Orders op van de Clearing Bank.

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": {
    "received": 3,
    "stored": 3
  }
}
```

---

### `GET /api/po_in_process`

Verwerk ontvangen PO's: crediteer begunstigde rekeningen en maak ACKs aan.

**Uitgevoerde validaties:**

1. BA IBAN-formaat geldig
2. BA rekening bestaat in deze bank

**Wat er gebeurt bij succes:**
- Saldo van BA rekening verhoogd met `po_amount`
- Transactierecord aangemaakt
- ACK aangemaakt in `ack_out` (status pending)

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": {
    "processed": ["BOFABE3X_1714294245000-0-a1b2"],
    "failed": [
      {
        "po_id": "BOFABE3X_1714294245000-1-c3d4",
        "code": "5001",
        "reason": "Beneficiary account not found"
      }
    ]
  }
}
```

---

### `GET /api/ack_out_send`

Stuur alle openstaande Acknowledgments naar de Clearing Bank.

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": {
    "sent": 2,
    "response": { }
  }
}
```

---

## 10. Beveiligde Endpoints — Full Cycle

Vereist: `Authorization: Bearer <token>`

---

### `GET /api/cycle`

Voer de volledige OB→CB→BB→ACK flow uit in één request.

**Volgorde van uitvoering:**

1. `po_new_process` — Valideer PO_NEW
2. `po_out_send` — Stuur POs naar CB
3. `ack_pull` — Haal ACKs op van CB
4. `po_pull` — Haal POs op van CB (als BB)
5. `po_in_process` — Verwerk ontvangen POs
6. `ack_out_send` — Stuur ACKs naar CB

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "Cycle complete",
  "data": {
    "po_new_process": {
      "passed": ["BOFABE3X_..."],
      "failed": []
    },
    "po_out_send": {
      "sent": 1,
      "response": {}
    },
    "ack_pull": {
      "received": 0,
      "processed": 0
    },
    "po_pull": {
      "received": 1,
      "stored": 1
    },
    "po_in_process": {
      "processed": ["GKCCBEBB_..."],
      "failed": []
    },
    "ack_out_send": {
      "sent": 1,
      "response": {}
    }
  }
}
```

---

## 11. Beveiligde Endpoints — Betalingen

Vereist: `Authorization: Bearer <token>`

---

### `POST /api/payments`

Maak een betaling aan, valideer en verzend in één request.

**Request Body:**

```json
{
  "from_iban": "BE82414694956858",
  "to_iban": "BE72599632030243",
  "to_bic": "GKCCBEBB",
  "amount": 150.75,
  "message": "Factuurbetaling"
}
```

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|-------------|
| `from_iban` | string | Ja | IBAN van de originerende rekening |
| `to_iban` | string | Ja | IBAN van de begunstigde rekening |
| `to_bic` | string | Ja | BIC van de begunstigde bank |
| `amount` | number | Ja | Bedrag in EUR (> 0, ≤ 500, max 2 decimalen) |
| `message` | string | Nee | Betalingsomschrijving |

**Validaties:**

- Alle verplichte velden aanwezig
- `from_iban` en `to_iban`: geldig IBAN-formaat + mod-97 checksum
- `to_bic`: geldig BIC-formaat
- `amount` > 0, maximaal 2 decimalen, ≤ €500

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "Payment initiated",
  "data": {
    "po_id": "BOFABE3X_1714294245000-0-a1b2",
    "process": {
      "passed": ["BOFABE3X_1714294245000-0-a1b2"],
      "failed": []
    },
    "send": {
      "sent": 1,
      "response": {}
    }
  }
}
```

**Mogelijke fouten:**

| HTTP | Code | Situatie |
|------|------|----------|
| `400` | `3003` | Ongeldig IBAN-, BIC- of datumformaat |
| `400` | `3004` | Bedrag overschrijdt €500 |
| `400` | `3001` | From-rekening niet gevonden |
| `400` | `3002` | Onvoldoende saldo |
| `503` | `9001` | CB niet bereikbaar |

---

## 12. Beveiligde Endpoints — Data Viewers

Vereist: `Authorization: Bearer <token>`

Alle viewers retourneren maximaal 200 records, gesorteerd op nieuwste eerst.

---

### `GET /api/po_new`

Alle PO's in de PO_NEW wachtrij (concept-status).

---

### `GET /api/po_out`

Alle PO's die naar CB zijn verzonden (wacht op ACK).

---

### `GET /api/po_in`

Alle PO's ontvangen van CB (als BB).

---

### `GET /api/ack_in`

Alle Acknowledgments ontvangen van CB (als OB).

---

### `GET /api/ack_out`

Alle Acknowledgments verzonden naar CB (als BB).

---

### `GET /api/transactions`

Transactiegeschiedenis van rekeningen.

**Query Parameters:**

| Parameter | Type | Verplicht | Beschrijving |
|-----------|------|-----------|-------------|
| `account` | string | Nee | IBAN om te filteren op specifieke rekening |

**Voorbeeld:**

```
GET /api/transactions?account=BE82414694956858
```

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": [
    {
      "id": 1,
      "amount": 150.75,
      "datetime": "2026-04-28 10:30:45",
      "po_id": "BOFABE3X_1714294245000-0-a1b2",
      "account_id": "BE82414694956858",
      "isvalid": 1,
      "iscomplete": 1
    }
  ]
}
```

---

### `GET /api/log`

Systeemlogboek.

**Query Parameters:**

| Parameter | Type | Standaard | Max | Beschrijving |
|-----------|------|-----------|-----|-------------|
| `limit` | number | `100` | `500` | Aantal logregels om op te halen |

**Voorbeeld:**

```
GET /api/log?limit=50
```

---

### `GET /api/stats`

Dashboard statistieken — overzicht van alle wachtrijen en saldo's.

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": {
    "accounts": 5,
    "total_balance": 250000.00,
    "po_new": 0,
    "po_out": 2,
    "po_in": 1,
    "ack_in": 2,
    "ack_out": 1,
    "tx_valid": 10,
    "tx_failed": 2,
    "outstanding_payments": 1
  }
}
```

---

## 13. Admin Endpoints

Vereist: `Authorization: Bearer <token>` + rol `admin`.

---

### `POST /api/accounts`

Maak een nieuwe bankrekening aan.

**Request Body:**

```json
{
  "id": "BE82414694956858",
  "balance": 5000.00
}
```

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|-------------|
| `id` | string | Ja | IBAN van de nieuwe rekening |
| `balance` | number | Ja | Beginsaldo in EUR (≥ 0) |

---

### `PUT /api/accounts/:iban/balance`

Pas het saldo van een rekening aan (toevoegen of aftrekken).

**URL Parameter:** `:iban` — IBAN van de rekening

**Request Body:**

```json
{
  "amount": 100.50
}
```

Negatief bedrag om saldo te verlagen.

---

### `DELETE /api/accounts/:iban`

Verwijder een bankrekening.

**URL Parameter:** `:iban` — IBAN van de rekening

**Voorwaarden:**
- Saldo moet €0,00 zijn
- Geen openstaande betalingen

---

### `GET /api/users`

Lijst van alle gebruikers.

**Response (200):**

```json
{
  "ok": true,
  "status": 200,
  "code": "2000",
  "message": "OK",
  "data": [
    {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "created_at": "2026-04-28 10:00:00"
    }
  ]
}
```

---

### `POST /api/users`

Maak een nieuwe gebruiker aan.

**Request Body:**

```json
{
  "username": "john",
  "password": "secret123",
  "role": "user"
}
```

| Veld | Type | Verplicht | Beschrijving |
|------|------|-----------|-------------|
| `username` | string | Ja | Unieke gebruikersnaam |
| `password` | string | Ja | Wachtwoord (wordt gehashed met bcrypt) |
| `role` | string | Ja | `"admin"` of `"user"` |

---

### `DELETE /api/users/:id`

Verwijder een gebruiker.

**URL Parameter:** `:id` — ID van de gebruiker

**Beperking:** Kan de eigen account niet verwijderen.

---

## 14. Datamodellen

### Payment Order (PO) Object

Alle PO-tabellen (`po_new`, `po_out`, `po_in`) delen dezelfde veldstructuur:

| Veld | Type | Beschrijving |
|------|------|-------------|
| `po_id` | VARCHAR(50) PK | Uniek ID: `{OB_BIC}_{timestamp}-{index}-{uuid}` |
| `po_amount` | DECIMAL(10,2) | Bedrag in EUR (> 0, ≤ 500) |
| `po_message` | VARCHAR(255) | Betalingsomschrijving |
| `po_datetime` | DATETIME | Tijdstip van de betaling |
| `ob_id` | VARCHAR(20) | BIC van de originerende bank |
| `oa_id` | VARCHAR(34) | IBAN van de originerende rekening |
| `ob_code` | VARCHAR(10) | Validatiecode van OB |
| `ob_datetime` | DATETIME | Tijdstip OB-verwerking |
| `cb_code` | VARCHAR(10) | Validatiecode van CB |
| `cb_datetime` | DATETIME | Tijdstip CB-verwerking |
| `bb_id` | VARCHAR(20) | BIC van de begunstigde bank |
| `ba_id` | VARCHAR(34) | IBAN van de begunstigde rekening |
| `bb_code` | VARCHAR(10) | Validatiecode van BB |
| `bb_datetime` | DATETIME | Tijdstip BB-verwerking |

**Extra velden per tabel:**

| Tabel | Extra veld | Beschrijving |
|-------|-----------|-------------|
| `po_new` | `status` | `'pending'`, `'processed'`, `'failed'` |
| `po_out` | `sent_to_cb` | `0` = wacht, `1` = verzonden |
| `po_in` | `status` | `'received'`, `'processed'`, `'failed'` |
| `ack_in` | `received_at` | Tijdstip van ontvangst |
| `ack_out` | `sent_to_cb` | `0` = wacht, `1` = verzonden |

---

### Rekening (Account)

| Veld | Type | Beschrijving |
|------|------|-------------|
| `id` | VARCHAR(34) PK | IBAN van de rekening |
| `balance` | DECIMAL(10,2) | Huidig saldo (≥ 0) |

---

### Transactie (Transaction)

| Veld | Type | Beschrijving |
|------|------|-------------|
| `id` | INT PK | Auto-increment ID |
| `amount` | DECIMAL(10,2) | Transactiebedrag |
| `datetime` | DATETIME | Tijdstip van de transactie |
| `po_id` | VARCHAR(50) | Referentie naar PO |
| `account_id` | VARCHAR(34) | Betrokken IBAN |
| `isvalid` | TINYINT(1) | `1` = geslaagd, `0` = mislukt |
| `iscomplete` | TINYINT(1) | `1` = voltooid, `0` = in verwerking |

---

### Gebruiker (User)

| Veld | Type | Beschrijving |
|------|------|-------------|
| `id` | INT PK | Auto-increment ID |
| `username` | VARCHAR(50) UNIQUE | Gebruikersnaam |
| `password_hash` | VARCHAR(255) | Bcrypt wachtwoord-hash |
| `role` | VARCHAR(20) | `'admin'` of `'user'` |
| `created_at` | DATETIME | Aanmaakdatum |

---

## 15. Validatieregels

### IBAN

- Lengte: 15–34 tekens (alfanumeriek)
- Begint met 2 letters + 2 cijfers
- Mod-97 checksum (ISO 13616)

**Belgisch IBAN voorbeeld:** `BE82414694956858`

### BIC

- Lengte: 8 of 11 tekens
- Formaat: `AAAA` (bank) + `BB` (land) + `CC` (locatie) + `DDD` (optioneel, filiaal)
- Regex: `/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/`

**Voorbeeld:** `GKCCBEBB`, `BOFABE3X`

### Bedrag

- Eindige waarde > 0
- Maximaal 2 decimalen
- Maximaal €500,00

### Datetime

- Formaat: `YYYY-MM-DD HH:MM:SS`

**Voorbeeld:** `2026-04-28 10:30:45`

### PO ID

- Maximaal 50 tekens
- Moet beginnen met `{OB_BIC}_`

**Voorbeeld:** `BOFABE3X_1714294245000-0-a1b2c3d4`

---

## 16. Clearing Bank Integratie

### Base URL

```
https://stevenop.be/pingfin/api/v2
```

Configureerbaar via `CB_BASE_URL` in `.env`.

### Authenticatie bij CB

```http
POST /token
Content-Type: application/json

{
  "bic": "BOFABE3X",
  "secret_key": "<CB_SECRET_KEY>"
}
```

Het ontvangen token wordt 4 uur gecacht. Bij een `401` response wordt automatisch een nieuw token aangevraagd.

### CB Endpoints

| Methode | Pad | Beschrijving | Auth |
|---------|-----|-------------|------|
| `POST` | `/token` | Token aanvragen | Nee |
| `GET` | `/banks` | Lijst van banken | Ja |
| `POST` | `/banks` | Bankinformatie bijwerken | Ja |
| `POST` | `/po_in` | PO's insturen (als OB) | Ja |
| `GET` | `/po_out` | PO's ophalen (als BB) | Ja |
| `POST` | `/ack_in` | ACKs insturen (als BB) | Ja |
| `GET` | `/ack_out` | ACKs ophalen (als OB) | Ja |
| `GET` | `/errorcodes` | Foutcodes opvragen | Nee |

### Timeouts

| Operatie | Timeout |
|----------|---------|
| Token aanvragen | 10 seconden |
| Overige requests | 15 seconden |

---

## 17. Configuratie

### `.env` bestand

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=db
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<wachtwoord>
DB_NAME=pingfin

# Bank identiteit
BANK_BIC=BOFABE3X
BANK_NAME=Team 15 Bank
BANK_MEMBERS=Azzouzi Fadil, Hammouche Ayoub, Kallouch Ilyas

# Clearing Bank
CB_BASE_URL=https://stevenop.be/pingfin/api/v2
CB_BIC=BOFABE3X
CB_SECRET_KEY=<geheim>

# Beveiliging
JWT_SECRET=pingfin-team15-secret-change-in-production
JWT_EXPIRES_IN=4h

# Standaard admin gebruiker
DEFAULT_USER=admin
DEFAULT_PASSWORD=admin123

# Achtergrond-poller (optioneel)
POLL_INTERVAL_SECONDS=30
POLL_ENABLED=false
```

### Verschil tussen Bank 1 en Bank 2

| Parameter | Bank 1 | Bank 2 |
|-----------|--------|--------|
| `BANK_BIC` | `BOFABE3X` | `FXBBBEBB` |
| `CB_BIC` | `BOFABE3X` | `FXBBBEBB` |
| `CB_SECRET_KEY` | Bank 1 sleutel | Bank 2 sleutel |
| `JWT_SECRET` | Bank 1 secret | Bank 2 secret |
| `PORT` | `3000` | `3001` (aanbevolen) |

---

## 18. Installatie & Deployment

### Vereisten

- Node.js 20+
- MariaDB 11+ of MySQL 8+
- (Optioneel) Docker & Docker Compose

---

### Lokale installatie

```bash
# 1. Dependencies installeren
npm install

# 2. Database initialiseren (tabellen + admin gebruiker aanmaken)
npm run init-db

# 3. Server starten
npm start

# Of met auto-herstart bij bestandswijzigingen
npm run dev
```

---

### Docker deployment

```bash
# Beide services starten (MariaDB + Node.js)
docker-compose up --build

# Op de achtergrond draaien
docker-compose up -d --build

# Stoppen
docker-compose down

# Stoppen + data verwijderen
docker-compose down -v
```

**Docker services:**

| Service | Image | Poort | Beschrijving |
|---------|-------|-------|-------------|
| `db` | MariaDB 11 | 3306 | Database |
| `app` | Node.js 20 Alpine | 3000 | API server |

---

### Database initialisatie

Het `npm run init-db` commando:

1. Maakt de database aan als die nog niet bestaat
2. Voert `schema.sql` uit (tabellen en indexen)
3. Maakt de standaard admin-gebruiker aan (`DEFAULT_USER` / `DEFAULT_PASSWORD`)
4. Voegt testrekeningen in

---

### Achtergrond-poller

De poller voert automatisch de volledige cycle uit op een interval. Standaard uitgeschakeld.

Activeren via `.env`:

```env
POLL_ENABLED=true
POLL_INTERVAL_SECONDS=30
```

---

*Documentatie gegenereerd voor PingfinAPI — Pingfin 2026 International Week Project*
