-- =========================================
-- DATABASE
-- =========================================
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'pingfin')
BEGIN
    CREATE DATABASE pingfin;
END
GO

USE pingfin;
GO

-- =========================================
-- ACCOUNTS
-- =========================================
CREATE TABLE accounts (
    id      VARCHAR(34)    PRIMARY KEY,          -- IBAN
    balance DECIMAL(10,2)  NOT NULL CHECK (balance >= 0)
);

-- =========================================
-- TRANSACTIONS
-- =========================================
CREATE TABLE transactions (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    amount     DECIMAL(10,2) NOT NULL,
    datetime   DATETIME      NOT NULL,
    po_id      VARCHAR(50),
    account_id VARCHAR(34),
    isvalid    BIT,
    iscomplete BIT
    -- Geen FK op account_id: mislukte TX kunnen ook gelogd worden
    -- voor rekeningen die niet bestaan of al verwijderd zijn
);

-- =========================================
-- LOGS
-- =========================================
CREATE TABLE logs (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    datetime    DATETIME      NOT NULL,
    message     VARCHAR(MAX),
    type        VARCHAR(50),

    po_id       VARCHAR(50),
    po_amount   DECIMAL(10,2),
    po_message  VARCHAR(255),
    po_datetime DATETIME,

    ob_id       VARCHAR(20),
    oa_id       VARCHAR(34),
    ob_code     VARCHAR(10),
    ob_datetime DATETIME,

    cb_code     VARCHAR(10),
    cb_datetime DATETIME,

    bb_id       VARCHAR(20),
    ba_id       VARCHAR(34),
    bb_code     VARCHAR(10),
    bb_datetime DATETIME
);

-- =========================================
-- PO_NEW  (POs aangemaakt door de OB,
--          nog niet verstuurd naar CB)
-- =========================================
CREATE TABLE po_new (
    po_id       VARCHAR(50)   PRIMARY KEY,
    po_amount   DECIMAL(10,2) CHECK (po_amount > 0 AND po_amount <= 500),
    po_message  VARCHAR(255),
    po_datetime DATETIME,

    ob_id       VARCHAR(20),
    oa_id       VARCHAR(34),
    ob_code     VARCHAR(10),
    ob_datetime DATETIME,

    cb_code     VARCHAR(10),
    cb_datetime DATETIME,

    bb_id       VARCHAR(20),
    ba_id       VARCHAR(34),
    bb_code     VARCHAR(10),
    bb_datetime DATETIME
);

-- =========================================
-- PO_OUT  (POs verstuurd naar CB,
--          wachten op ACK)
-- =========================================
CREATE TABLE po_out (
    po_id       VARCHAR(50)   PRIMARY KEY,
    po_amount   DECIMAL(10,2),
    po_message  VARCHAR(255),
    po_datetime DATETIME,

    ob_id       VARCHAR(20),
    oa_id       VARCHAR(34),
    ob_code     VARCHAR(10),
    ob_datetime DATETIME,

    cb_code     VARCHAR(10),
    cb_datetime DATETIME,

    bb_id       VARCHAR(20),
    ba_id       VARCHAR(34),
    bb_code     VARCHAR(10),
    bb_datetime DATETIME
);

-- =========================================
-- PO_IN   (POs ontvangen van CB als BB)
-- =========================================
CREATE TABLE po_in (
    po_id       VARCHAR(50)   PRIMARY KEY,
    po_amount   DECIMAL(10,2),
    po_message  VARCHAR(255),
    po_datetime DATETIME,

    ob_id       VARCHAR(20),
    oa_id       VARCHAR(34),
    ob_code     VARCHAR(10),
    ob_datetime DATETIME,

    cb_code     VARCHAR(10),
    cb_datetime DATETIME,

    bb_id       VARCHAR(20),
    ba_id       VARCHAR(34),
    bb_code     VARCHAR(10),
    bb_datetime DATETIME
);

-- =========================================
-- ACK_IN  (ACKs ontvangen van CB als OB)
-- =========================================
CREATE TABLE ack_in (
    po_id       VARCHAR(50)   PRIMARY KEY,
    po_amount   DECIMAL(10,2),
    po_message  VARCHAR(255),
    po_datetime DATETIME,

    ob_id       VARCHAR(20),
    oa_id       VARCHAR(34),
    ob_code     VARCHAR(10),
    ob_datetime DATETIME,

    cb_code     VARCHAR(10),
    cb_datetime DATETIME,

    bb_id       VARCHAR(20),
    ba_id       VARCHAR(34),
    bb_code     VARCHAR(10),
    bb_datetime DATETIME
);

-- =========================================
-- ACK_OUT (ACKs verstuurd naar CB als BB)
-- =========================================
CREATE TABLE ack_out (
    po_id       VARCHAR(50)   PRIMARY KEY,
    po_amount   DECIMAL(10,2),
    po_message  VARCHAR(255),
    po_datetime DATETIME,

    ob_id       VARCHAR(20),
    oa_id       VARCHAR(34),
    ob_code     VARCHAR(10),
    ob_datetime DATETIME,

    cb_code     VARCHAR(10),
    cb_datetime DATETIME,

    bb_id       VARCHAR(20),
    ba_id       VARCHAR(34),
    bb_code     VARCHAR(10),
    bb_datetime DATETIME
);

-- =========================================
-- TEST DATA — 20 geldige BE-IBANs
-- elk €5000 beginbalans
-- =========================================
INSERT INTO accounts (id, balance) VALUES
('BE51233543472462', 5000.00),
('BE28947265183047', 5000.00),
('BE73621847563920', 5000.00),
('BE19384756283910', 5000.00),
('BE56473829104857', 5000.00),
('BE84736291048572', 5000.00),
('BE37192847563019', 5000.00),
('BE62847391028475', 5000.00),
('BE91847362019283', 5000.00),
('BE45637281947563', 5000.00),
('BE82736491027384', 5000.00),
('BE16473829104756', 5000.00),
('BE53928174650392', 5000.00),
('BE70164839275610', 5000.00),
('BE38291746503928', 5000.00),
('BE94827361504839', 5000.00),
('BE21736485019274', 5000.00),
('BE67384910273849', 5000.00),
('BE49283716504938', 5000.00),
('BE85610293847561', 5000.00);
GO
