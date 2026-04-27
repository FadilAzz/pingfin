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
    id VARCHAR(34) PRIMARY KEY, -- IBAN
    balance DECIMAL(10,2) NOT NULL CHECK (balance >= 0)
);

-- =========================================
-- TRANSACTIONS
-- =========================================
CREATE TABLE transactions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    amount DECIMAL(10,2) NOT NULL,
    datetime DATETIME NOT NULL,
    po_id VARCHAR(50),
    account_id VARCHAR(34),
    isvalid BIT,
    iscomplete BIT,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- =========================================
-- LOGS
-- =========================================
CREATE TABLE logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    datetime DATETIME NOT NULL,
    message VARCHAR(MAX),
    type VARCHAR(50),

    po_id VARCHAR(50),
    po_amount DECIMAL(10,2),
    po_message VARCHAR(255),
    po_datetime DATETIME,

    ob_id VARCHAR(20),
    oa_id VARCHAR(34),
    ob_code VARCHAR(10),
    ob_datetime DATETIME,

    cb_code VARCHAR(10),
    cb_datetime DATETIME,

    bb_id VARCHAR(20),
    ba_id VARCHAR(34),
    bb_code VARCHAR(10),
    bb_datetime DATETIME
);

-- =========================================
-- BANKS (voor clearing bank)
-- =========================================
CREATE TABLE banks (
    id VARCHAR(20) PRIMARY KEY, -- BIC
    name VARCHAR(100),
    description VARCHAR(MAX),
    token VARCHAR(255)
);

-- =========================================
-- PO_NEW
-- =========================================
CREATE TABLE po_new (
    po_id VARCHAR(50) PRIMARY KEY,
    po_amount DECIMAL(10,2) CHECK (po_amount >= 0 AND po_amount <= 500),
    po_message VARCHAR(255),
    po_datetime DATETIME,

    ob_id VARCHAR(20),
    oa_id VARCHAR(34),
    ob_code VARCHAR(10),
    ob_datetime DATETIME,

    bb_id VARCHAR(20),
    ba_id VARCHAR(34)
);

-- =========================================
-- PO_OUT
-- =========================================
CREATE TABLE po_out (
    po_id VARCHAR(50) PRIMARY KEY,
    po_amount DECIMAL(10,2),
    po_message VARCHAR(255),
    po_datetime DATETIME,

    ob_id VARCHAR(20),
    oa_id VARCHAR(34),
    ob_code VARCHAR(10),
    ob_datetime DATETIME,

    bb_id VARCHAR(20),
    ba_id VARCHAR(34)
);

-- =========================================
-- PO_IN
-- =========================================
CREATE TABLE po_in (
    po_id VARCHAR(50) PRIMARY KEY,
    po_amount DECIMAL(10,2),
    po_message VARCHAR(255),
    po_datetime DATETIME,

    ob_id VARCHAR(20),
    oa_id VARCHAR(34),
    ob_code VARCHAR(10),
    ob_datetime DATETIME,

    cb_code VARCHAR(10),
    cb_datetime DATETIME,

    bb_id VARCHAR(20),
    ba_id VARCHAR(34)
);

-- =========================================
-- ACK_IN
-- =========================================
CREATE TABLE ack_in (
    po_id VARCHAR(50) PRIMARY KEY,
    po_amount DECIMAL(10,2),
    po_message VARCHAR(255),
    po_datetime DATETIME,

    ob_id VARCHAR(20),
    oa_id VARCHAR(34),
    ob_code VARCHAR(10),
    ob_datetime DATETIME,

    cb_code VARCHAR(10),
    cb_datetime DATETIME,

    bb_id VARCHAR(20),
    ba_id VARCHAR(34),
    bb_code VARCHAR(10),
    bb_datetime DATETIME
);

-- =========================================
-- ACK_OUT
-- =========================================
CREATE TABLE ack_out (
    po_id VARCHAR(50) PRIMARY KEY,
    po_amount DECIMAL(10,2),
    po_message VARCHAR(255),
    po_datetime DATETIME,

    ob_id VARCHAR(20),
    oa_id VARCHAR(34),
    ob_code VARCHAR(10),
    ob_datetime DATETIME,

    cb_code VARCHAR(10),
    cb_datetime DATETIME,

    bb_id VARCHAR(20),
    ba_id VARCHAR(34),
    bb_code VARCHAR(10),
    bb_datetime DATETIME
);

-- =========================================
-- TEST DATA (minstens 20 accounts verplicht!)
-- =========================================
INSERT INTO accounts (id, balance) VALUES
('BE00000000000001', 5000),
('BE00000000000002', 5000),
('BE00000000000003', 5000),
('BE00000000000004', 5000),
('BE00000000000005', 5000),
('BE00000000000006', 5000),
('BE00000000000007', 5000),
('BE00000000000008', 5000),
('BE00000000000009', 5000),
('BE00000000000010', 5000),
('BE00000000000011', 5000),
('BE00000000000012', 5000),
('BE00000000000013', 5000),
('BE00000000000014', 5000),
('BE00000000000015', 5000),
('BE00000000000016', 5000),
('BE00000000000017', 5000),
('BE00000000000018', 5000),
('BE00000000000019', 5000),
('BE00000000000020', 5000);