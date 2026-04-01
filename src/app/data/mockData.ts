import type {
  Asset,
  StockMovement,
  Assignment,
  PurchaseRequest,
  PurchaseOrder,
  MaintenanceTicket,
  Site,
  Department,
  Supplier,
  Category,
  User,
  KPIData,
  AuditLog,
  Vendor
} from '../types';

// Sites
export const sites: Site[] = [
  { id: 'SEB', name: 'SEB', location: 'TBD' },
  { id: 'BOK', name: 'BOK', location: 'TBD' },
  { id: 'MA6', name: 'MA6', location: 'TBD' },
  { id: 'MA7', name: 'MA7', location: 'TBD' },
  { id: 'AS3', name: 'AS3', location: 'TBD' }
];

// Departments
export const departments: Department[] = [
  { id: 'PROD', name: 'Production', code: 'PROD', head: 'TBD', members: 0 },
  { id: 'LOG', name: 'Logistics', code: 'LOG', head: 'TBD', members: 0 },
  { id: 'IT', name: 'Information Technology', code: 'IT', head: 'TBD', members: 0 },
  { id: 'FRM', name: 'Format', code: 'FRM', head: 'TBD', members: 0 },
  { id: 'ENG', name: 'Engineering', code: 'ENG', head: 'TBD', members: 0 },
  { id: 'HR', name: 'Human Resources', code: 'HR', head: 'TBD', members: 0 },
  { id: 'MET', name: 'Methods', code: 'MET', head: 'TBD', members: 0 },
  { id: 'QL', name: 'Quality', code: 'QL', head: 'TBD', members: 0 },
  { id: 'Maintenance', name: 'Maintenance', code: 'Maintenance', head: 'TBD', members: 0 },
  { id: 'Laboratory', name: 'Laboratory', code: 'Laboratory', head: 'TBD', members: 0 },
  { id: 'LOG-ZP', name: 'Log (zone principale )', code: 'LOG-ZP', head: 'TBD', members: 0 },
  { id: 'LOG-B', name: 'Log bureau', code: 'LOG-B', head: 'TBD', members: 0 },
  { id: 'FS', name: 'Facility Services', code: 'FS', head: 'TBD', members: 0 },
  { id: 'Tooling', name: 'Tooling', code: 'Tooling', head: 'TBD', members: 0 }
];

// Suppliers
export const suppliers: Supplier[] = [
  { id: '1', name: 'Dell Technologies', contact: 'contact@dell.com' },
  { id: '2', name: 'HP Inc.', contact: 'sales@hp.com' },
  { id: '3', name: 'Lenovo', contact: 'info@lenovo.com' },
  { id: '4', name: 'Apple', contact: 'business@apple.com' },
  { id: '5', name: 'Cisco Systems', contact: 'orders@cisco.com' }
];

// Vendor Directory (mock)
export const vendorDirectory: Vendor[] = [
  {
    id: 'VEN-0001',
    name: 'Dell Technologies',
    category: 'Hardware/Workstations',
    status: 'PREFERRED',
    email: 'corp-sales@dell.com',
    phone: '+1 (800) DELL-IT',
    totalSpend: 1_200_000,
    activeContracts: 3,
    rating: 4.8,
    compliant: true,
  },
  {
    id: 'VEN-0002',
    name: 'Apple Inc.',
    category: 'Mobile/Laptops',
    status: 'APPROVED',
    email: 'business@apple.com',
    phone: '+1 (800) MY-APPLE',
    totalSpend: 450_000,
    activeContracts: 1,
    rating: 4.9,
    compliant: true,
  },
  {
    id: 'VEN-0003',
    name: 'CDW Logistics',
    category: 'Peripheral/Networking',
    status: 'PREFERRED',
    email: 'logistics@cdw.com',
    phone: '+1 (888) CDW-HELP',
    totalSpend: 890_000,
    activeContracts: 5,
    rating: 4.5,
    compliant: true,
  },
  {
    id: 'VEN-0004',
    name: 'Cisco Systems',
    category: 'Networking/Security',
    status: 'APPROVED',
    email: 'security@cisco.com',
    phone: '+1 (800) CISCO-IT',
    totalSpend: 620_000,
    activeContracts: 2,
    rating: 4.7,
    compliant: true,
  },
  {
    id: 'VEN-0005',
    name: 'Amazon Business',
    category: 'Miscellaneous IT',
    status: 'UNDER REVIEW',
    email: 'support@amazon.biz',
    phone: '+1 (800) AMZ-BIZ',
    totalSpend: 120_000,
    activeContracts: 0,
    rating: 4.2,
    compliant: true,
  },
];

// Categories
export const categories: Category[] = [
  { id: 'CAT-MON', name: 'Monitor' },
  { id: 'CAT-WKS', name: 'Workstation' },
  { id: 'CAT-NBK', name: 'Notebook' },
  { id: 'CAT-DOC', name: 'Docking Station' },
  { id: 'CAT-PRI', name: 'Printer' },
  { id: 'CAT-APS', name: 'APs' },
  { id: 'CAT-SCA', name: 'Scanner' },
  { id: 'CAT-KAB', name: 'KABA' },
  { id: 'CAT-CIS', name: 'Cisco' }
];

// Users
export const users: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@company.com', role: 'Admin', avatarUrl: '' },
  { id: '2', name: 'Jean Dupont', email: 'jean.dupont@company.com', role: 'Technician', avatarUrl: '' },
  { id: '3', name: 'Marie Martin', email: 'marie.martin@company.com', role: 'Manager', avatarUrl: '' },
  { id: '4', name: 'Pierre Dubois', email: 'pierre.dubois@company.com', role: 'Reader', avatarUrl: '' },
  { id: '5', name: 'Sophie Bernard', email: 'sophie.bernard@company.com', role: 'Technician', avatarUrl: '' }
];

// Audit Logs
export const auditLogs: AuditLog[] = [
  {
    id: 'AL-0001',
    timestamp: '2026-02-19T14:23:45',
    action: 'Asset Updated',
    entity: 'MacBook Pro M3',
    entityId: 'LEO-123',
    user: 'John Doe',
    userInitials: 'JD',
    userRole: 'Admin',
    description: "Changed status from 'Available' to 'In Use'",
    result: 'Success',
    ip: '10.45.2.122',
    details: { field: 'status', from: 'Available', to: 'In Use' }
  },
  {
    id: 'AL-0002',
    timestamp: '2026-02-19T13:10:22',
    action: 'New Assignment',
    entity: 'Dell XPS 15',
    entityId: 'LEO-456',
    user: 'Jane Smith',
    userInitials: 'JS',
    userRole: 'Technician',
    description: 'Assigned to Marketing Dept - Sarah Miller',
    result: 'Success',
    ip: '10.45.2.145',
    details: { department: 'Marketing', assignee: 'Sarah Miller', assetTag: 'LEO-456' }
  },
  {
    id: 'AL-0003',
    timestamp: '2026-02-19T09:00:15',
    action: 'Login Success',
    entity: 'System Access',
    user: 'Admin User',
    userInitials: 'AU',
    userRole: 'Super Admin',
    description: 'Successful login from Chrome 122.0.0.0',
    result: 'Success',
    ip: '192.168.1.45',
    details: { browser: 'Chrome 122.0.0.0', outcome: 'success' }
  },
  {
    id: 'AL-0004',
    timestamp: '2026-02-18T16:45:30',
    action: 'PO Approved',
    entity: 'PO-2026-0012',
    user: 'Marc Leoni',
    userInitials: 'ML',
    userRole: 'Manager',
    description: 'Approved purchase of 20x Monitors',
    result: 'Success',
    ip: '10.45.2.10',
    details: { quantity: 20, item: 'Monitors', po: 'PO-2026-0012' }
  },
  {
    id: 'AL-0005',
    timestamp: '2026-02-18T11:20:10',
    action: 'Asset Deleted',
    entity: 'Old Server',
    entityId: 'LEO-001',
    user: 'John Doe',
    userInitials: 'JD',
    userRole: 'Admin',
    description: 'Asset decommissioned and removed from active list',
    result: 'Warning',
    ip: '10.45.2.122',
    details: { reason: 'Decommissioned', assetTag: 'LEO-001' }
  },
  {
    id: 'AL-0006',
    timestamp: '2026-02-17T15:30:00',
    action: 'Password Changed',
    entity: 'User Profile',
    user: 'Robert Green',
    userInitials: 'RG',
    userRole: 'Technician',
    description: 'User updated account credentials',
    result: 'Success',
    ip: '10.45.2.89',
    details: { type: 'password', outcome: 'success' }
  },
  {
    id: 'AL-0007',
    timestamp: '2026-02-17T10:15:22',
    action: 'Stock Movement',
    entity: 'HDMI Adapters (x50)',
    user: 'John Doe',
    userInitials: 'JD',
    userRole: 'Admin',
    description: 'Moved from Central Warehouse to IT Lab',
    result: 'Success',
    ip: '10.45.2.122',
    details: { from: 'Central Warehouse', to: 'IT Lab', quantity: 50, item: 'HDMI Adapters' }
  },
  {
    id: 'AL-0008',
    timestamp: '2026-02-16T17:05:44',
    action: 'Maintenance Closed',
    entity: 'Ticket #8942',
    user: 'Jane Smith',
    userInitials: 'JS',
    userRole: 'Technician',
    description: 'Repair completed for Screen Flickering',
    result: 'Success',
    ip: '10.45.2.145',
    details: { ticket: 8942, outcome: 'closed', issue: 'Screen Flickering' }
  }
];

// Assets
export const assets: Asset[] = [
  {
    id: '1',
    assetTag: 'LAP-2024-001',
    serialNumber: 'SN123456789',
    macAddress: '00:1A:2B:3C:4D:5E',
    model: 'Dell Latitude 7420',
    category: 'Notebook',
    supplier: 'Dell Technologies',
    site: 'SEB',
    status: 'Assigned',
    warrantyEndDate: '2026-12-31',
    acquisitionDate: '2024-01-15',
    value: 1200
  },
  {
    id: '2',
    assetTag: 'LAP-2024-002',
    serialNumber: 'SN987654321',
    macAddress: '00:1A:2B:3C:4D:5F',
    model: 'HP EliteBook 840',
    category: 'Notebook',
    supplier: 'HP Inc.',
    site: 'BOK',
    status: 'Available',
    warrantyEndDate: '2027-03-20',
    acquisitionDate: '2024-02-10',
    value: 1100
  },
  {
    id: '3',
    assetTag: 'DSK-2023-015',
    serialNumber: 'SN555444333',
    model: 'Lenovo ThinkCentre M720',
    category: 'Workstation',
    supplier: 'Lenovo',
    site: 'SEB',
    status: 'InRepair',
    warrantyEndDate: '2025-06-15',
    acquisitionDate: '2023-06-15',
    value: 800
  },
  {
    id: '4',
    assetTag: 'MON-2024-050',
    serialNumber: 'SN777888999',
    model: 'Dell UltraSharp U2720Q',
    category: 'Monitor',
    supplier: 'Dell Technologies',
    site: 'MA6',
    status: 'Available',
    warrantyEndDate: '2026-08-30',
    acquisitionDate: '2024-03-05',
    value: 450
  },
  {
    id: '5',
    assetTag: 'SRV-2022-005',
    serialNumber: 'SN111222333',
    model: 'HP ProLiant DL380 Gen10',
    category: 'Workstation',
    supplier: 'HP Inc.',
    site: 'SEB',
    status: 'Assigned',
    warrantyEndDate: '2025-01-20',
    acquisitionDate: '2022-01-20',
    value: 5000
  },
  {
    id: '6',
    assetTag: 'LAP-2019-010',
    serialNumber: 'SN999888777',
    model: 'Dell Latitude 5490',
    category: 'Notebook',
    supplier: 'Dell Technologies',
    site: 'BOK',
    status: 'Retired',
    warrantyEndDate: '2022-05-10',
    acquisitionDate: '2019-05-10',
    value: 900
  },
  {
    id: '7',
    assetTag: 'NET-2024-020',
    serialNumber: 'SN444555666',
    model: 'Cisco Catalyst 2960-X',
    category: 'Cisco',
    supplier: 'Cisco Systems',
    site: 'SEB',
    status: 'Assigned',
    warrantyEndDate: '2029-04-15',
    acquisitionDate: '2024-04-15',
    value: 2500
  },
  {
    id: '8',
    assetTag: 'LAP-2024-003',
    serialNumber: 'SN333222111',
    model: 'MacBook Pro 14"',
    category: 'Notebook',
    supplier: 'Apple',
    site: 'AS3',
    status: 'Assigned',
    warrantyEndDate: '2027-02-28',
    acquisitionDate: '2024-02-28',
    value: 2500
  }
];

// Stock Movements
export const stockMovements: StockMovement[] = [
  {
    id: '1',
    assetId: '1',
    type: 'Entry',
    destinationSite: 'SEB',
    date: '2024-01-15',
    user: 'Jean Dupont',
    comment: 'New laptop received'
  },
  {
    id: '2',
    assetId: '1',
    type: 'Transfer',
    sourceSite: 'SEB',
    destinationSite: 'BOK',
    date: '2024-03-10',
    user: 'Sophie Bernard',
    comment: 'Transfer for new employee'
  },
  {
    id: '3',
    assetId: '3',
    type: 'Entry',
    destinationSite: 'SEB',
    date: '2023-06-15',
    user: 'Jean Dupont',
    comment: 'Initial stock entry'
  }
];

// Assignments
export const assignments: Assignment[] = [
  {
    id: '1',
    assetId: '1',
    userName: 'Marie Martin',
    department: 'Finance',
    site: 'SEB',
    startDate: '2024-01-20',
    status: 'Active',
    approvedBy: 'Admin User'
  },
  {
    id: '2',
    assetId: '5',
    userName: 'Jean Dupont',
    department: 'IT',
    site: 'SEB',
    startDate: '2024-02-01',
    status: 'Active',
    approvedBy: 'Admin User'
  },
  {
    id: '3',
    assetId: '7',
    userName: 'Pierre Dubois',
    department: 'IT',
    site: 'SEB',
    startDate: '2024-04-20',
    status: 'Active',
    approvedBy: 'Marie Martin'
  },
  {
    id: '4',
    assetId: '2',
    userName: 'Sophie Bernard',
    department: 'Sales',
    site: 'BOK',
    startDate: '2024-02-15',
    returnDate: '2024-05-20',
    status: 'Returned',
    approvedBy: 'Marie Martin'
  }
];

// Purchase Requests
export const purchaseRequests: PurchaseRequest[] = [
  {
    id: 'PR-2024-001',
    requester: 'Jean Dupont',
    department: 'IT',
    budget: 15000,
    justification: 'Replacement of obsolete equipment for IT team',
    status: 'Approved',
    createdDate: '2024-01-10',
    lines: [
      { id: '1', product: 'Dell Latitude 7420', quantity: 5, estimatedPrice: 1200 },
      { id: '2', product: 'Dell Monitor U2720Q', quantity: 5, estimatedPrice: 450 }
    ]
  },
  {
    id: 'PR-2024-002',
    requester: 'Sophie Bernard',
    department: 'Sales',
    budget: 8000,
    justification: 'New laptops for sales team expansion',
    status: 'Pending',
    createdDate: '2024-02-15',
    lines: [
      { id: '3', product: 'HP EliteBook 840', quantity: 4, estimatedPrice: 1100 }
    ]
  },
  {
    id: 'PR-2024-003',
    requester: 'Marie Martin',
    department: 'Finance',
    budget: 3000,
    justification: 'Workstation upgrade',
    status: 'Draft',
    createdDate: '2024-02-18',
    lines: [
      { id: '4', product: 'Lenovo ThinkCentre M720', quantity: 2, estimatedPrice: 800 }
    ]
  }
];

// Purchase Orders
export const purchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO-2024-001',
    prId: 'PR-2024-001',
    supplier: 'Dell Technologies',
    status: 'Received',
    total: 8250,
    createdDate: '2024-01-20',
    lines: [
      { id: '1', product: 'Dell Latitude 7420', quantity: 5, price: 1200 },
      { id: '2', product: 'Dell Monitor U2720Q', quantity: 5, price: 450 }
    ]
  },
  {
    id: 'PO-2024-002',
    prId: 'PR-2024-002',
    supplier: 'HP Inc.',
    status: 'Ordered',
    total: 4400,
    createdDate: '2024-02-20',
    lines: [
      { id: '3', product: 'HP EliteBook 840', quantity: 4, price: 1100 }
    ]
  }
];

// Maintenance Tickets
export const maintenanceTickets: MaintenanceTicket[] = [
  {
    id: 'TKT-2024-001',
    assetId: '3',
    status: 'InProgress',
    provider: 'Lenovo Support',
    cost: 250,
    openDate: '2024-02-10',
    description: 'Hard drive failure, requires replacement',
    actions: 'Diagnostic completed, ordering replacement HDD'
  },
  {
    id: 'TKT-2024-002',
    assetId: '1',
    status: 'Done',
    provider: 'Dell Support',
    cost: 0,
    openDate: '2024-01-25',
    closeDate: '2024-01-27',
    description: 'Screen flickering issue',
    actions: 'Updated graphics drivers, tested - resolved under warranty'
  },
  {
    id: 'TKT-2024-003',
    assetId: '5',
    status: 'Open',
    provider: 'HP Enterprise Services',
    cost: 800,
    openDate: '2024-02-18',
    description: 'Memory upgrade required for performance',
    actions: ''
  }
];

// KPI Data
export const kpiData: KPIData = {
  totalAssets: assets.length,
  available: assets.filter(a => a.status === 'Available').length,
  assigned: assets.filter(a => a.status === 'Assigned').length,
  inRepair: assets.filter(a => a.status === 'InRepair').length,
  retired: assets.filter(a => a.status === 'Retired').length,
  totalValue: assets.reduce((sum, asset) => sum + asset.value, 0)
};

// Chart data
export const categoryChartData = [
  { name: 'Monitor', value: assets.filter(a => a.category === 'Monitor').length },
  { name: 'Workstation', value: assets.filter(a => a.category === 'Workstation').length },
  { name: 'Notebook', value: assets.filter(a => a.category === 'Notebook').length },
  { name: 'Docking Station', value: assets.filter(a => a.category === 'Docking Station').length },
  { name: 'Printer', value: assets.filter(a => a.category === 'Printer').length },
  { name: 'APs', value: assets.filter(a => a.category === 'APs').length },
  { name: 'Scanner', value: assets.filter(a => a.category === 'Scanner').length },
  { name: 'KABA', value: assets.filter(a => a.category === 'KABA').length },
  { name: 'Cisco', value: assets.filter(a => a.category === 'Cisco').length }
];

export const siteChartData = [
  { name: 'SEB', value: assets.filter(a => a.site === 'SEB').length },
  { name: 'BOK', value: assets.filter(a => a.site === 'BOK').length },
  { name: 'MA6', value: assets.filter(a => a.site === 'MA6').length },
  { name: 'MA7', value: assets.filter(a => a.site === 'MA7').length },
  { name: 'AS3', value: assets.filter(a => a.site === 'AS3').length }
];
