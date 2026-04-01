import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BarChart3,
  FileDown,
  ExternalLink,
  AlertTriangle,
  ShoppingCart,
  Users,
  ClipboardCheck,
  Sparkles,
  Database,
} from 'lucide-react';

type FleetPoint = {
  name: string;
  totalAssets: number;
  availabilityPct: number;
};

type MaintenanceContributor = {
  name: string;
  value: number;
};

const MAINT_COLORS = ['#1F3C88', '#2563EB', '#60A5FA', '#93C5FD'];

function KPICard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="premium-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {subtitle ? <p className="text-xs text-muted-foreground mt-2">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

function formatTimeForHeader(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function ReportingPage() {
  const [businessUnit, setBusinessUnit] = useState('All Business Units');

  const lastUpdated = useMemo(() => {
    const now = new Date();
    return `Today, ${formatTimeForHeader(now)}`;
  }, []);

  const fleetData: FleetPoint[] = [
    { name: 'Jan', totalAssets: 980, availabilityPct: 62 },
    { name: 'Feb', totalAssets: 1100, availabilityPct: 59 },
    { name: 'Mar', totalAssets: 1240, availabilityPct: 57 },
    { name: 'Apr', totalAssets: 1320, availabilityPct: 58 },
    { name: 'May', totalAssets: 1460, availabilityPct: 55 },
    { name: 'Jun', totalAssets: 1580, availabilityPct: 54 },
  ];

  const maintenanceContrib: MaintenanceContributor[] = [
    { name: 'Hardware Age', value: 45 },
    { name: 'Accidental Damage', value: 32 },
    { name: 'Warranty Issues', value: 18 },
    { name: 'OS Faults', value: 5 },
  ];

  const stockValuation = {
    value: '1.24M DH',
    mom: '+2.4% MoM',
    note: "Calculated based on acquisition cost minus depreciation schedules (SLD 3-year).",
    insured: '1.05M DH',
  };

  const alerts = [
    {
      title: 'Low Stock Warning',
      description: "Standard Laptops (Dell) are below threshold (5 units left).",
      cta: 'Auto-Order Now',
      icon: <ShoppingCart className="w-5 h-5 text-orange-600" />,
    },
    {
      title: 'Unresolved Tickets',
      description: '3 Server maintenance tickets overdue by 48 hours.',
      cta: 'Reassign Techs',
      icon: <Users className="w-5 h-5 text-red-600" />,
    },
    {
      title: 'Stock Audit Due',
      description: "Annual inventory audit for 'Annex Site' starts next Monday.",
      cta: 'View Checklist',
      icon: <ClipboardCheck className="w-5 h-5 text-blue-600" />,
    },
  ];

  const aiRecommendation =
    '"Consolidate monitor purchases to HP next quarter to save 15% on bulk pricing based on current usage trends."';

  const handleExportExcel = async () => {
    const xlsx = await import('xlsx');
    const rows: Array<Record<string, unknown>> = [
      {
        Section: 'Executive Overview',
        Key: 'Last updated',
        Value: lastUpdated,
      },
      {
        Section: 'Executive Overview',
        Key: 'SQL Source',
        Value: 'DW_Inventory_Views',
      },
      {
        Section: 'Filters',
        Key: 'Business Unit',
        Value: businessUnit,
      },
      {
        Section: 'Stock Valuation',
        Key: 'Stock Valuation Summary',
        Value: stockValuation.value,
      },
      {
        Section: 'Stock Valuation',
        Key: 'MoM',
        Value: stockValuation.mom,
      },
      {
        Section: 'Stock Valuation',
        Key: 'Insured Value',
        Value: stockValuation.insured,
      },
      {
        Section: 'AI Recommendation',
        Key: 'Recommendation',
        Value: aiRecommendation,
      },
    ];

    fleetData.forEach(p => {
      rows.push({
        Section: 'Fleet Growth vs Availability (%)',
        Key: p.name,
        Value: `Total Assets: ${p.totalAssets} | Availability %: ${p.availabilityPct}`,
      });
    });

    maintenanceContrib.forEach(p => {
      rows.push({
        Section: 'Top Contributors to Maintenance',
        Key: p.name,
        Value: `${p.value}%`,
      });
    });

    alerts.forEach(a => {
      rows.push({
        Section: 'Critical Alerts Dashboard',
        Key: a.title,
        Value: a.description,
      });
    });

    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Executive Overview');
    xlsx.writeFile(wb, 'leoni-executive-overview.xlsx');
  };

  const handleOpenFullDashboard = () => {
    window.open('https://app.powerbi.com', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Advanced Reporting &amp; Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Live Power BI integration and cross-departmental KPI dashboards
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={handleExportExcel}
            className="w-full sm:w-auto flex items-center justify-center gap-2 border border-border bg-card text-foreground px-4 py-2 rounded-lg hover:bg-muted/30 transition-all font-medium"
          >
            <FileDown className="w-4 h-4" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={handleOpenFullDashboard}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-[#1B4F91] to-[#2563EB] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Open Full Dashboard
          </button>
        </div>
      </div>

      {/* Executive Overview */}
      <div className="bg-primary/5 dark:bg-primary/10 rounded-xl shadow-sm border border-primary/20 p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1F3C88] flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">BI</span>
                <h2 className="text-lg font-bold text-foreground">Leoni Manage Executive Overview</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Last updated: {lastUpdated} • <span className="inline-flex items-center gap-1"><Database className="w-4 h-4" />SQL Source: DW_Inventory_Views</span>
              </p>
            </div>
          </div>

          <div className="w-full md:w-72">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Filter View:</p>
            <select
              value={businessUnit}
              onChange={(e) => setBusinessUnit(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
            >
              <option value="All Business Units">All Business Units</option>
            </select>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Growth vs Availability */}
        <div className="premium-surface p-6">
          <h3 className="text-lg font-bold text-foreground mb-1">Fleet Growth vs Availability (%)</h3>
          <p className="text-sm text-muted-foreground mb-4">Total Assets vs Availability %</p>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={fleetData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="totalAssets" name="Total Assets" fill="#1F3C88" radius={[6, 6, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="availabilityPct" name="Availability %" stroke="#2563EB" strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Top Contributors to Maintenance */}
        <div className="premium-surface p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">Top Contributors to Maintenance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={maintenanceContrib}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }) => `${name} ${value}%`}
                  >
                    {maintenanceContrib.map((_, idx) => (
                      <Cell key={idx} fill={MAINT_COLORS[idx % MAINT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {maintenanceContrib.map((c, idx) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: MAINT_COLORS[idx % MAINT_COLORS.length] }} />
                    <span className="text-sm text-muted-foreground">{c.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{c.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Valuation + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="premium-surface p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Stock Valuation Summary</h3>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground">{stockValuation.value}</div>
                <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1">{stockValuation.mom}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">{stockValuation.note}</p>
            <div className="mt-5 border-t border-border pt-4">
              <div className="text-sm text-muted-foreground">Insured Value</div>
              <div className="text-xl font-bold text-foreground mt-1">{stockValuation.insured}</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 premium-surface p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-bold text-foreground">Critical Alerts Dashboard</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {alerts.map((a) => (
              <div key={a.title} className="rounded-xl border border-border p-4 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {a.icon}
                      <div className="text-sm font-bold text-foreground">{a.title}</div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{a.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-4 w-full border border-border bg-card text-foreground px-3 py-2 rounded-lg hover:bg-muted/30 transition-all font-medium"
                >
                  {a.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Recommendation */}
      <div className="premium-surface p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-[#1F3C88]" />
          <h3 className="text-lg font-bold text-foreground">AI Recommendation</h3>
        </div>
        <div className="text-sm text-foreground italic opacity-90">{aiRecommendation}</div>
      </div>

      <div className="text-xs text-muted-foreground uppercase tracking-wider">
        POWER BI EMBED ENVIRONMENT • TENANT: LEONI_GLOBAL_IT • VERSION 2.14.0-R1
      </div>
    </div>
  );
}
