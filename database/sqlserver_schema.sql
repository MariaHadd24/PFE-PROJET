/*
  SQL Server schema generated from backend Pydantic models in backend/app/models.py
  Note: the current API models use string fields (e.g., Asset.category is a string, not Category.id).
  This schema keeps the same field names for maximum compatibility with the existing frontend/backend.

  Run order: execute this file once in your target database.
*/

-- Optional: set your schema
-- USE [YourDatabaseName];
-- GO

/* =========================
   Master data tables
   ========================= */

CREATE TABLE dbo.departments (
  id           NVARCHAR(64)  NOT NULL,
  name         NVARCHAR(200) NOT NULL,
  code         NVARCHAR(50)  NULL,
  head         NVARCHAR(200) NULL,
  members      INT           NULL,
  description  NVARCHAR(MAX) NULL,
  CONSTRAINT PK_departments PRIMARY KEY (id)
);

CREATE TABLE dbo.sites (
  id        NVARCHAR(64)  NOT NULL,
  name      NVARCHAR(200) NOT NULL,
  codeIt    NVARCHAR(50)  NULL,
  location  NVARCHAR(200) NOT NULL,
  zone      NVARCHAR(200) NULL,
  city      NVARCHAR(200) NULL,
  CONSTRAINT PK_sites PRIMARY KEY (id)
);

CREATE TABLE dbo.categories (
  id    NVARCHAR(64)  NOT NULL,
  name  NVARCHAR(200) NOT NULL,
  CONSTRAINT PK_categories PRIMARY KEY (id)
);

CREATE TABLE dbo.suppliers (
  id      NVARCHAR(64)  NOT NULL,
  name    NVARCHAR(200) NOT NULL,
  contact NVARCHAR(200) NOT NULL,
  CONSTRAINT PK_suppliers PRIMARY KEY (id)
);

CREATE TABLE dbo.[users] (
  id        NVARCHAR(64)  NOT NULL,
  name      NVARCHAR(200) NOT NULL,
  email     NVARCHAR(254) NOT NULL,
  role      NVARCHAR(20)  NOT NULL,
  avatarUrl NVARCHAR(1024) NULL,
  passwordHash NVARCHAR(512) NULL,
  signatureNumber NVARCHAR(20) NULL,
  signatureData NVARCHAR(MAX) NULL,
  CONSTRAINT PK_users PRIMARY KEY (id),
  CONSTRAINT UQ_users_email UNIQUE (email),
  CONSTRAINT CK_users_role CHECK (role IN ('Admin','Technician','Manager','Reader'))
);

/* =========================
   Assets
   ========================= */

CREATE TABLE dbo.assets (
  id              NVARCHAR(64)  NOT NULL,
  assetTag         NVARCHAR(100) NOT NULL,
  serialNumber     NVARCHAR(100) NOT NULL,
  macAddress       NVARCHAR(50)  NULL,
  ipAddress        NVARCHAR(50)  NULL,
  area             NVARCHAR(200) NULL,
  department       NVARCHAR(200) NULL,
  [condition]      NVARCHAR(50)  NULL,
  model            NVARCHAR(200) NOT NULL,
  [type]           NVARCHAR(100) NULL,
  deviceProfile    NVARCHAR(MAX) NULL,
  category         NVARCHAR(200) NOT NULL,
  supplier         NVARCHAR(200) NOT NULL,
  site             NVARCHAR(200) NOT NULL,
  status           NVARCHAR(20)  NOT NULL,
  warrantyEndDate  DATE          NOT NULL,
  acquisitionDate  DATE          NOT NULL,
  value            DECIMAL(18,2) NOT NULL,
  description      NVARCHAR(MAX) NULL,
  bci              NVARCHAR(100) NULL,
  bce              NVARCHAR(100) NULL,
  bciCheck         NVARCHAR(100) NULL,
  vnc              NVARCHAR(100) NULL,
  stockIn          NVARCHAR(20)  NULL,
  dateIn           DATE          NULL,
  pilote           NVARCHAR(200) NULL,
  stockOut         NVARCHAR(20)  NULL,
  dateOut          DATE          NULL,
  immoNumber       NVARCHAR(100) NULL,
  pilote1          NVARCHAR(200) NULL,
  comment          NVARCHAR(MAX) NULL,
  barcode          NVARCHAR(100) NULL,
  qrCode           NVARCHAR(100) NULL,
  storeLocation    NVARCHAR(200) NULL,
  cabinet          NVARCHAR(200) NULL,
  rack             NVARCHAR(200) NULL,
  level            NVARCHAR(50)  NULL,
  CONSTRAINT PK_assets PRIMARY KEY (id),
  CONSTRAINT UQ_assets_assetTag UNIQUE (assetTag),
  CONSTRAINT UQ_assets_serialNumber UNIQUE (serialNumber),
  CONSTRAINT CK_assets_status CHECK (status IN ('Available','Assigned','InRepair','Retired')),
  CONSTRAINT CK_assets_deviceProfile_json CHECK (deviceProfile IS NULL OR ISJSON(deviceProfile) = 1)
);

/* =========================
   Stock movements
   ========================= */

CREATE TABLE dbo.stock_movements (
  id              NVARCHAR(64)  NOT NULL,
  assetId         NVARCHAR(64)  NOT NULL,
  type            NVARCHAR(20)  NOT NULL,
  sourceSite      NVARCHAR(200) NULL,
  destinationSite NVARCHAR(200) NULL,
  [date]          DATE          NOT NULL,
  [user]          NVARCHAR(200) NOT NULL,
  comment         NVARCHAR(MAX) NOT NULL,
  CONSTRAINT PK_stock_movements PRIMARY KEY (id),
  CONSTRAINT FK_stock_movements_assets FOREIGN KEY (assetId) REFERENCES dbo.assets(id) ON DELETE CASCADE,
  CONSTRAINT CK_stock_movements_type CHECK (type IN ('Entry','Exit','Transfer'))
);

CREATE INDEX IX_stock_movements_assetId ON dbo.stock_movements(assetId);
CREATE INDEX IX_stock_movements_date ON dbo.stock_movements([date]);

/* =========================
   Assignments
   ========================= */

CREATE TABLE dbo.assignments (
  id         NVARCHAR(64)  NOT NULL,
    assetId    NVARCHAR(64)  NULL,
  assigneeName   NVARCHAR(200) NOT NULL,
  brand      NVARCHAR(100) NULL,
  area       NVARCHAR(200) NULL,
  department NVARCHAR(200) NOT NULL,
  site       NVARCHAR(200) NOT NULL,
  startDate  DATE          NOT NULL,
  returnDate DATE          NULL,
  status     NVARCHAR(20)  NOT NULL,
  approvedBy NVARCHAR(200) NULL,
  approvedAt DATETIME2(0)  NULL,
  approvalSignature NVARCHAR(MAX) NULL,
  device_category     NVARCHAR(20)  NULL,
  hostname            NVARCHAR(200) NULL,
  usb_status          NVARCHAR(100) NULL,
  usb                 NVARCHAR(100) NULL,
  [user]              NVARCHAR(200) NULL,
  username            NVARCHAR(200) NULL,
  full_name           NVARCHAR(200) NULL,
  service             NVARCHAR(200) NULL,
  ws_sn               NVARCHAR(100) NULL,
  ws_model            NVARCHAR(200) NULL,
  nb_sn               NVARCHAR(100) NULL,
  model_nb            NVARCHAR(200) NULL,
  mac_address         NVARCHAR(50)  NULL,
  os                  NVARCHAR(200) NULL,
  immo_ws             NVARCHAR(100) NULL,
  immo_number         NVARCHAR(100) NULL,
  bci_ws              NVARCHAR(100) NULL,
  bci                 NVARCHAR(100) NULL,
  acquisition_date    DATE          NULL,
  assignment_date     DATE          NULL,
  end_of_support_date DATE          NULL,
  monitor_model       NVARCHAR(200) NULL,
  monitor_sn          NVARCHAR(100) NULL,
  monitor_immo        NVARCHAR(100) NULL,
  monitor_bci         NVARCHAR(100) NULL,
  CONSTRAINT PK_assignments PRIMARY KEY (id),
  CONSTRAINT FK_assignments_assets FOREIGN KEY (assetId) REFERENCES dbo.assets(id) ON DELETE CASCADE,
  CONSTRAINT CK_assignments_status CHECK (status IN ('Pending','Active','Returned')),
  CONSTRAINT CK_assignments_device_category CHECK (device_category IS NULL OR device_category IN ('Workstation','Notebook','Printer'))
);

CREATE INDEX IX_assignments_assetId ON dbo.assignments(assetId);
CREATE INDEX IX_assignments_status ON dbo.assignments(status);

/* =========================
   Procurement: PR / PO + lines
   ========================= */

CREATE TABLE dbo.purchase_requests (
  id          NVARCHAR(64)   NOT NULL,
  requester   NVARCHAR(200)  NOT NULL,
  department  NVARCHAR(200)  NOT NULL,
  budget      DECIMAL(18,2)  NOT NULL,
  justification NVARCHAR(MAX) NOT NULL,
  status      NVARCHAR(20)   NOT NULL,
  createdDate DATE           NOT NULL,
  CONSTRAINT PK_purchase_requests PRIMARY KEY (id),
  CONSTRAINT CK_purchase_requests_status CHECK (status IN ('Draft','Pending','Approved','Rejected'))
);

CREATE INDEX IX_purchase_requests_status ON dbo.purchase_requests(status);

CREATE TABLE dbo.pr_lines (
  id               NVARCHAR(64)  NOT NULL,
  purchaseRequestId NVARCHAR(64) NOT NULL,
  product          NVARCHAR(200) NOT NULL,
  quantity         INT           NOT NULL,
  estimatedPrice   DECIMAL(18,2) NOT NULL,
  CONSTRAINT PK_pr_lines PRIMARY KEY (id),
  CONSTRAINT FK_pr_lines_pr FOREIGN KEY (purchaseRequestId) REFERENCES dbo.purchase_requests(id) ON DELETE CASCADE
);

CREATE INDEX IX_pr_lines_purchaseRequestId ON dbo.pr_lines(purchaseRequestId);

CREATE TABLE dbo.purchase_orders (
  id          NVARCHAR(64)  NOT NULL,
  prId        NVARCHAR(64)  NOT NULL,
  supplier    NVARCHAR(200) NOT NULL,
  status      NVARCHAR(20)  NOT NULL,
  total       DECIMAL(18,2) NOT NULL,
  createdDate DATE          NOT NULL,
  CONSTRAINT PK_purchase_orders PRIMARY KEY (id),
  CONSTRAINT FK_purchase_orders_pr FOREIGN KEY (prId) REFERENCES dbo.purchase_requests(id),
  CONSTRAINT CK_purchase_orders_status CHECK (status IN ('Draft','Approved','Ordered','Received','Closed'))
);

CREATE INDEX IX_purchase_orders_prId ON dbo.purchase_orders(prId);
CREATE INDEX IX_purchase_orders_status ON dbo.purchase_orders(status);

CREATE TABLE dbo.po_lines (
  id              NVARCHAR(64)  NOT NULL,
  purchaseOrderId NVARCHAR(64)  NOT NULL,
  product         NVARCHAR(200) NOT NULL,
  quantity        INT           NOT NULL,
  price           DECIMAL(18,2) NOT NULL,
  CONSTRAINT PK_po_lines PRIMARY KEY (id),
  CONSTRAINT FK_po_lines_po FOREIGN KEY (purchaseOrderId) REFERENCES dbo.purchase_orders(id) ON DELETE CASCADE
);

CREATE INDEX IX_po_lines_purchaseOrderId ON dbo.po_lines(purchaseOrderId);

/* =========================
   Maintenance
   ========================= */

CREATE TABLE dbo.maintenance_tickets (
  id          NVARCHAR(64)  NOT NULL,
  assetId     NVARCHAR(64)  NOT NULL,
  status      NVARCHAR(20)  NOT NULL,
  provider    NVARCHAR(200) NOT NULL,
  cost        DECIMAL(18,2) NOT NULL,
  openDate    DATE          NOT NULL,
  closeDate   DATE          NULL,
  description NVARCHAR(MAX) NOT NULL,
  actions     NVARCHAR(MAX) NULL,
  CONSTRAINT PK_maintenance_tickets PRIMARY KEY (id),
  CONSTRAINT FK_maintenance_tickets_assets FOREIGN KEY (assetId) REFERENCES dbo.assets(id) ON DELETE CASCADE,
  CONSTRAINT CK_maintenance_tickets_status CHECK (status IN ('Open','InProgress','Done','Closed'))
);

CREATE INDEX IX_maintenance_tickets_assetId ON dbo.maintenance_tickets(assetId);
CREATE INDEX IX_maintenance_tickets_status ON dbo.maintenance_tickets(status);

/* =========================
   Audit logs
   ========================= */

CREATE TABLE dbo.audit_logs (
  id           NVARCHAR(64)  NOT NULL,
  [timestamp]  DATETIME2(0)  NOT NULL,
  [user]       NVARCHAR(200) NOT NULL,
  userRole     NVARCHAR(50)  NULL,
  userInitials NVARCHAR(10)  NULL,
  action       NVARCHAR(200) NOT NULL,
  entity       NVARCHAR(200) NOT NULL,
  entityId     NVARCHAR(64)  NULL,
  description  NVARCHAR(MAX) NULL,
  result       NVARCHAR(20)  NOT NULL,
  ip           NVARCHAR(45)  NOT NULL,
  details      NVARCHAR(MAX) NULL,
  CONSTRAINT PK_audit_logs PRIMARY KEY (id),
  CONSTRAINT CK_audit_logs_result CHECK (result IN ('Success','Failure','Warning')),
  CONSTRAINT CK_audit_logs_details_json CHECK (details IS NULL OR ISJSON(details) = 1)
);

CREATE INDEX IX_audit_logs_timestamp ON dbo.audit_logs([timestamp]);
CREATE INDEX IX_audit_logs_entity ON dbo.audit_logs(entity);

/* =========================
   Vendors
   ========================= */

CREATE TABLE dbo.vendors (
  id              NVARCHAR(64)  NOT NULL,
  name            NVARCHAR(200) NOT NULL,
  category        NVARCHAR(200) NOT NULL,
  status          NVARCHAR(20)  NOT NULL,
  email           NVARCHAR(254) NOT NULL,
  phone           NVARCHAR(50)  NOT NULL,
  totalSpend      DECIMAL(18,2) NOT NULL,
  activeContracts INT           NOT NULL,
  rating          DECIMAL(3,2)  NOT NULL,
  compliant       BIT           NOT NULL,
  CONSTRAINT PK_vendors PRIMARY KEY (id),
  CONSTRAINT CK_vendors_status CHECK (status IN ('PREFERRED','APPROVED','UNDER REVIEW'))
);

CREATE INDEX IX_vendors_status ON dbo.vendors(status);

/* =========================
   Printer Toner / Consumables
   ========================= */

CREATE TABLE dbo.printer_toner_incidents (
  id                NVARCHAR(64)  NOT NULL,
  site              NVARCHAR(200) NULL,
  printerName       NVARCHAR(200) NULL,
  demandType        NVARCHAR(200) NULL,
  ticketNumber      NVARCHAR(200) NULL,
  problemNature     NVARCHAR(400) NULL,
  printerSerial     NVARCHAR(200) NULL,
  printerModel      NVARCHAR(200) NULL,
  claimDate         DATETIME2(0)  NULL,
  interventionDate  DATETIME2(0)  NULL,
  duration          NVARCHAR(100) NULL,
  status            NVARCHAR(20)  NOT NULL CONSTRAINT DF_printer_toner_incidents_status DEFAULT ('NON_INTERVENUE'),
  raw               NVARCHAR(MAX) NULL,
  rawHeaders        NVARCHAR(MAX) NULL,
  CONSTRAINT PK_printer_toner_incidents PRIMARY KEY (id),
  CONSTRAINT CK_printer_toner_incidents_status CHECK (status IN ('NON_INTERVENUE','INTERVENUE')),
  CONSTRAINT CK_printer_toner_incidents_raw_json CHECK (raw IS NULL OR ISJSON(raw) = 1),
  CONSTRAINT CK_printer_toner_incidents_rawHeaders_json CHECK (rawHeaders IS NULL OR ISJSON(rawHeaders) = 1)
);

CREATE INDEX IX_printer_toner_incidents_claimDate ON dbo.printer_toner_incidents(claimDate);
CREATE INDEX IX_printer_toner_incidents_ticketNumber ON dbo.printer_toner_incidents(ticketNumber);

CREATE TABLE dbo.printer_toner_entries (
  id          NVARCHAR(64)  NOT NULL,
  [date]      DATE          NULL,
  article     NVARCHAR(400) NULL,
  articleCode NVARCHAR(200) NULL,
  quantity    INT           NOT NULL,
  CONSTRAINT PK_printer_toner_entries PRIMARY KEY (id)
);

CREATE INDEX IX_printer_toner_entries_date ON dbo.printer_toner_entries([date]);

CREATE TABLE dbo.printer_toner_exits (
  id          NVARCHAR(64)  NOT NULL,
  [date]      DATE          NULL,
  article     NVARCHAR(400) NULL,
  articleCode NVARCHAR(200) NULL,
  quantity    INT           NOT NULL,
  CONSTRAINT PK_printer_toner_exits PRIMARY KEY (id)
);

CREATE INDEX IX_printer_toner_exits_date ON dbo.printer_toner_exits([date]);

CREATE TABLE dbo.printer_toner_min_qty (
  id      NVARCHAR(64)  NOT NULL,
  ref     NVARCHAR(200) NOT NULL,
  color   NVARCHAR(20)  NOT NULL,
  minQty  INT           NOT NULL,
  CONSTRAINT PK_printer_toner_min_qty PRIMARY KEY (id)
);

CREATE INDEX IX_printer_toner_min_qty_ref_color ON dbo.printer_toner_min_qty(ref, color);
