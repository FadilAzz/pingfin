-- =========================================
-- DATABASE
-- =========================================
CREATE DATABASE IF NOT EXISTS pingfin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pingfin;

-- =========================================
-- USERS (voor GUI/API authenticatie)
-- =========================================
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  DEFAULT 'admin',
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- ACCOUNTS
-- =========================================
CREATE TABLE IF NOT EXISTS accounts (
    id      VARCHAR(34)   PRIMARY KEY,        -- IBAN
    balance DECIMAL(10,2) NOT NULL CHECK (balance >= 0)
);

-- =========================================
-- TRANSACTIONS
-- =========================================
CREATE TABLE IF NOT EXISTS transactions (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    amount     DECIMAL(10,2) NOT NULL,
    datetime   DATETIME      NOT NULL,
    po_id      VARCHAR(50),
    account_id VARCHAR(34),
    isvalid    TINYINT(1),
    iscomplete TINYINT(1),
    INDEX idx_account (account_id),
    INDEX idx_po (po_id)
);

-- =========================================
-- LOGS
-- =========================================
CREATE TABLE IF NOT EXISTS logs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    datetime    DATETIME      NOT NULL,
    message     TEXT,
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
    bb_datetime DATETIME,

    INDEX idx_type     (type),
    INDEX idx_datetime (datetime),
    INDEX idx_po_id    (po_id)
);

-- =========================================
-- PO_NEW  (POs aangemaakt door OB, nog niet verstuurd)
-- =========================================
CREATE TABLE IF NOT EXISTS po_new (
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
    bb_datetime DATETIME,

    status      VARCHAR(20) DEFAULT 'pending'
);

-- =========================================
-- PO_OUT  (POs verstuurd naar CB, wachten op ACK)
-- =========================================
CREATE TABLE IF NOT EXISTS po_out (
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
    bb_datetime DATETIME,

    sent_to_cb  TINYINT(1) DEFAULT 0
);

-- =========================================
-- PO_IN   (POs ontvangen van CB als BB)
-- =========================================
CREATE TABLE IF NOT EXISTS po_in (
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
    bb_datetime DATETIME,

    status      VARCHAR(20) DEFAULT 'received'
);

-- =========================================
-- ACK_IN  (ACKs ontvangen van CB als OB)
-- =========================================
CREATE TABLE IF NOT EXISTS ack_in (
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
    bb_datetime DATETIME,
    status      VARCHAR(20) DEFAULT 'pending',
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- ACK_OUT (ACKs verstuurd naar CB als BB)
-- =========================================
CREATE TABLE IF NOT EXISTS ack_out (
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
    bb_datetime DATETIME,

    sent_to_cb  TINYINT(1) DEFAULT 0
);

-- =========================================
-- TEST DATA — Geldige testrekeningen
-- =========================================
INSERT IGNORE INTO accounts (id, balance) VALUES
('BE51233543472462', 5000.00),
('BE39947265183047', 5000.00),
('BE43621847563920', 5000.00),
('BE22384756283910', 5000.00),
('BE78473829104857', 5000.00),
('BE07736291048572', 5000.00),
('BE25192847563019', 5000.00),
('BE04847391028475', 5000.00),
('BE57847362019283', 5000.00),
('BE53637281947563', 5000.00),
('BE65736491027384', 5000.00),
('BE89473829104756', 5000.00),
('BE39928174650392', 5000.00),
('BE79164839275610', 5000.00),
('BE39291746503928', 5000.00),
('BE60827361504839', 5000.00),
('BE18736485019274', 5000.00),
('BE32384910273849', 5000.00),
('BE43283716504938', 5000.00),
('BE48610293847561', 5000.00),
-- De eerdere accounts behouden we ook voor de zekerheid
('BE82414694956858', 50000.00),
('BE36670513107156', 50000.00),
('BE44930506370834', 50000.00),
('BE28255074145679', 50000.00),
('BE78824438272260', 50000.00);
