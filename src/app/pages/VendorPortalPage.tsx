import React, { useMemo, useState } from 'react';
import { Building2, ShieldCheck, Star, DollarSign, Search, Plus } from 'lucide-react';
import type { Vendor, VendorStatus } from '../types';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { formatMADCompact } from '../lib/money';

const statusStyles: Record<VendorStatus, string> = {
  PREFERRED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'UNDER REVIEW': 'bg-orange-100 text-orange-700',
};

function formatCompactMAD(value: number) {
  return formatMADCompact(value);
}

function escapeCsv(value: unknown) {
  const raw = value == null ? '' : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function exportContactsToCsv(vendors: Vendor[]) {
  const header = ['Vendor', 'Category', 'Status', 'Email', 'Phone'];
  const lines = [
    header.map(escapeCsv).join(','),
    ...vendors.map(v => [v.name, v.category, v.status, v.email, v.phone].map(escapeCsv).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vendor-contacts.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function KPICard({
  title,
  value,
  icon,
  bgColor,
  textColor,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
}) {
  return (
    <div className="bg-primary/5 dark:bg-primary/10 rounded-xl shadow-sm border border-primary/20 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
        </div>
        <div className={`w-14 h-14 rounded-lg ${bgColor} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function VendorPortalPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<VendorStatus | ''>('');
  const { vendors, addVendor } = useData();
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);

  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [form, setForm] = useState({
    name: '',
    category: '',
    status: 'APPROVED' as VendorStatus,
    email: '',
    phone: '',
  });

  const filteredVendors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return vendors.filter(v => {
      const matchesStatus = !filterStatus || v.status === filterStatus;
      if (!matchesStatus) return false;
      if (!q) return true;
      return [v.name, v.category, v.email, v.phone, v.status]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [vendors, searchTerm, filterStatus]);

  const activeVendorsCount = useMemo(() => {
    return vendors.filter(v => v.status !== 'UNDER REVIEW').length;
  }, [vendors]);

  const preferredCount = useMemo(() => vendors.filter(v => v.status === 'PREFERRED').length, [vendors]);

  const totalSpendMtd = 245_000;
  const compliancePercent = useMemo(() => {
    if (vendors.length === 0) return 0;
    const ok = vendors.filter(v => v.compliant).length;
    return Math.round((ok / vendors.length) * 100);
  }, [vendors]);

  const openDetails = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setDetailsOpen(true);
  };

  const handleOnboard = async () => {
    const name = form.name.trim();
    const category = form.category.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!name || !category || !email) return;

    const newVendor: Vendor = {
      id: `VEN-${Date.now()}`,
      name,
      category,
      status: form.status,
      email,
      phone,
      totalSpend: 0,
      activeContracts: 0,
      rating: 4.5,
      compliant: true,
    };

    try {
      await addVendor(newVendor);
      setIsOnboardOpen(false);
      setForm({ name: '', category: '', status: 'APPROVED', email: '', phone: '' });
    } catch (e: any) {
      toast.error('Unable to onboard vendor', { description: String(e?.message ?? 'Network error') });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-hero">
        <div className="page-hero__topline" aria-hidden />
        <div className="page-hero__layout">
          <div className="min-w-0">
            <div className="page-hero__title-row">
              <div className="page-hero__icon" aria-hidden>
                <Building2 className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">Vendors</span>
                </div>

                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>
                      Vendor &amp; Supplier Directory
                    </span>
                    <span className="page-hero__title-text">Vendor &amp; Supplier Directory</span>
                  </span>
                </h1>

                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">Manage partnerships, contracts, and procurement relationships</p>
              </div>
            </div>
          </div>

          <div className="page-hero__actions">
            <button
              type="button"
              onClick={() => setIsOnboardOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-[#1B4F91] to-[#2563EB] text-white px-6 py-3 rounded-lg hover:shadow-lg hover:scale-[1.02] transition-all font-medium"
            >
              <Plus className="w-5 h-5" />
              Onboard Vendor
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Active Vendors"
          value={activeVendorsCount}
          icon={<Building2 className="w-7 h-7 text-white" />}
          bgColor="bg-primary"
          textColor="text-foreground"
        />
        <KPICard
          title="Preferred Partners"
          value={preferredCount}
          icon={<Star className="w-7 h-7 text-white" />}
          bgColor="bg-blue-500"
          textColor="text-blue-600"
        />
        <KPICard
          title="Total Spend MTD"
          value={formatCompactMAD(totalSpendMtd)}
          icon={<DollarSign className="w-7 h-7 text-white" />}
          bgColor="bg-purple-500"
          textColor="text-purple-600"
        />
        <KPICard
          title="Compliance"
          value={`${compliancePercent}%`}
          icon={<ShieldCheck className="w-7 h-7 text-white" />}
          bgColor="bg-green-500"
          textColor="text-green-600"
        />
      </div>

      {/* Search + export */}
      <div className="bg-primary/5 dark:bg-primary/10 rounded-xl shadow-sm border border-primary/20 p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by vendor name, category, contact..."
              className="w-full pl-10 pr-4 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as VendorStatus | '')}
            className="w-full md:w-56 px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PREFERRED">PREFERRED</option>
            <option value="APPROVED">APPROVED</option>
            <option value="UNDER REVIEW">UNDER REVIEW</option>
          </select>

          <button
            type="button"
            onClick={() => exportContactsToCsv(filteredVendors)}
            className="w-full md:w-auto border border-border bg-card text-foreground px-4 py-2 rounded-lg hover:bg-muted/30 transition-all font-medium"
          >
            Export Contacts
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="premium-surface">
        <div className="overflow-x-auto">
          <table className="w-full premium-table">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendor / Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact Info</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Contract Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredVendors.map(v => (
                <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-foreground">{v.name}</div>
                    <div className="text-xs text-muted-foreground">{v.category}</div>
                    <div className="mt-2">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[v.status]}`}>
                        {v.status}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-foreground">{v.email}</div>
                    <div className="text-xs text-muted-foreground">{v.phone}</div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-foreground">{formatCompactMAD(v.totalSpend)}</div>
                    <div className="text-xs text-muted-foreground">{v.activeContracts} Active Contract(s)</div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground">{v.rating.toFixed(1)}</div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      type="button"
                      onClick={() => openDetails(v)}
                      className="text-primary hover:opacity-90 font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard Vendor Dialog */}
      <Dialog open={isOnboardOpen} onOpenChange={setIsOnboardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Onboard Vendor</DialogTitle>
            <DialogDescription>Add a new vendor to the directory.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Vendor name</label>
              <input
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none"
                placeholder="e.g., Dell Technologies"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none"
                placeholder="e.g., Hardware/Workstations"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value as VendorStatus }))}
                className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none"
              >
                <option value="PREFERRED">PREFERRED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="UNDER REVIEW">UNDER REVIEW</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none"
                placeholder="e.g., procurement@vendor.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-[#1F3C88] focus:border-transparent outline-none"
                placeholder="e.g., +1 (800) 000-0000"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setIsOnboardOpen(false)}
              className="border border-border bg-card text-foreground px-4 py-2 rounded-lg hover:bg-muted/30 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOnboard}
              className="bg-gradient-to-r from-[#1B4F91] to-[#2563EB] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              Add vendor
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor details */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Vendor details</SheetTitle>
            <SheetDescription>{selectedVendor ? selectedVendor.name : 'Details'}</SheetDescription>
          </SheetHeader>

          <div className="p-4 space-y-4 overflow-auto">
            {!selectedVendor ? (
              <div className="text-sm text-muted-foreground">Select a vendor to view details.</div>
            ) : (
              <div className="space-y-4">
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</div>
                      <div className="text-right">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[selectedVendor.status]}`}>
                          {selectedVendor.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</div>
                      <div className="text-sm text-foreground text-right">{selectedVendor.category}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</div>
                      <div className="text-sm text-foreground text-right">{selectedVendor.email}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</div>
                      <div className="text-sm text-foreground text-right">{selectedVendor.phone}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total spend</div>
                      <div className="text-sm text-foreground text-right">{formatCompactMAD(selectedVendor.totalSpend)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active contracts</div>
                      <div className="text-sm text-foreground text-right">{selectedVendor.activeContracts}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rating</div>
                      <div className="text-sm text-foreground text-right">{selectedVendor.rating.toFixed(1)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Compliance</div>
                      <div className="text-sm text-foreground text-right">{selectedVendor.compliant ? 'Compliant' : 'Non-compliant'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
