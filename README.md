# Pingfin 2026 — Regular Bank API (Team 15)

**BIC:** `BOFABE3X` | **Coaches:** Sam Van Buggenhout & Jens Baetens (HER 3 - 4306)

Stack: **Node.js 20 + Express.js + MySQL/MariaDB**

---

## Snel starten

### Docker Compose (aanbevolen voor deployment)

```bash
docker-compose up --build
```

Open: <http://localhost:3000> or your deployed domain — Login: `admin` / `admin123`

---

## API endpoints

| Method | URL | Auth | Beschrijving |
|--------|-----|------|-------------|
| GET  | `/api/help`                | ✅ | Overzicht endpoints |
| GET  | `/api/info`                | ✅ | Bank BIC, naam, members |
| GET  | `/api/accounts`            | ✅ | Lijst accounts |
| GET  | `/api/banks`               | ✅ | Banken via CB |
| GET  | `/api/errorcodes`          | ✅ | Foutcodes |
| POST | `/api/auth/login`          | ✅ | Login → JWT |
| GET  | `/api/po_new_generate`     | ✅ | Genereer random PO's |
| POST | `/api/po_new_add`          | ✅ | PO's toevoegen aan PO_NEW |
| GET  | `/api/po_new_process`      | ✅ | Valideer PO_NEW → PO_OUT |
| GET  | `/api/po_out_send`         | ✅ | PO_OUT → CB |
| GET  | `/api/po_pull`             | ✅ | CB → PO_IN (BB) |
| GET  | `/api/po_in_process`       | ✅ | PO_IN verwerken, BA crediteren |
| GET  | `/api/ack_out_send`        | ✅ | ACK_OUT → CB (BB) |
| GET  | `/api/ack_pull`            | ✅ | CB → ACK_IN (OB) |
| GET  | `/api/cycle`               | ✅ | Alle stappen in één keer |
| GET  | `/api/stats`               | ✅ | Dashboard statistieken |
| GET  | `/api/po_new`              | ✅ | Tabellen inzien |
| GET  | `/api/po_out`              | ✅ | Tabellen inzien |
| GET  | `/api/po_in`               | ✅ | Tabellen inzien |
| GET  | `/api/ack_out`             | ✅ | Tabellen inzien |
| GET  | `/api/ack_in`              | ✅ | Tabellen inzien |
| GET  | `/api/transactions`        | ✅ | Transacties |
| GET  | `/api/log`                 | ✅ | Logs |

---

## File structuur

```
src/
├── server.js
├── db/
│   ├── db.js            # MySQL connection pool
│   ├── init.js          # init script (run once)
│   └── schema.sql       # DDL + 20 accounts seed
├── routes/
│   ├── public.js        # /help, /info, /accounts, /banks
│   ├── auth.js          # /login
│   └── internal.js      # alle protected endpoints
├── services/
│   ├── cbClient.js      # client voor Pingfin CB API
│   ├── obProcessor.js   # OB business logic
│   ├── bbProcessor.js   # BB business logic
│   ├── poGenerator.js   # random PO generator
│   ├── poller.js        # background cycle (elke 30s)
│   └── logger.js        # logging naar `logs` tabel
├── middleware/auth.js   # JWT verificatie
└── utils/
    ├── validators.js    # IBAN/BIC/amount checks
    ├── codes.js         # error codes
    └── response.js      # standaard response format
public/index.html        # GUI (login + dashboard)
```
