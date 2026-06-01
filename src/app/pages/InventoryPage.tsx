import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search, Filter, LayoutDashboard, Building2, Package, Tag, Layers, ChevronDown } from 'lucide-react';
import type { AssetStatus } from '../types';
import { AddAssetModal } from '../components/ui/AddAssetModal';
import { useNotifications } from '../context/NotificationContext';
import { toast } from 'sonner';
import { useData } from '../context/DataContext';
import { formatMAD } from '../lib/money';
import { useAuth } from '../context/AuthContext';
import { canPerformAction } from '../lib/rbac';
import { motion } from 'motion/react';
import { cn } from '../components/ui/utils';

const statusStyles: Record<AssetStatus, string> = {
  Available: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20',
  Assigned: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/20',
  InRepair: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/50 dark:border-orange-500/20',
  Retired: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200/50 dark:border-rose-500/20'
};

export function InventoryPage() {
  const { assets, categories, sites, suppliers, addAsset } = useData();
  const { user } = useAuth();
  const role = user?.role ?? 'Reader';
  const canManageInventory = canPerformAction(role, 'manage_inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetsList, setAssetsList] = useState(assets);
  const { addNotification } = useNotifications();

  useEffect(() => {
    setAssetsList(assets);
  }, [assets]);

  const handleAddAsset = async (newAsset: any) => {
    if (!canManageInventory) {
      toast.error('Access denied', { description: 'Your role is read-only for inventory' });
      return;
    }
    try {
      const created = await addAsset(newAsset);
      setAssetsList(prev => [created, ...prev]);

      toast.success('Asset added', {
        description: `${created.assetTag} was added successfully to inventory`
      });

      addNotification({
        type: 'success',
        title: 'New asset added',
        message: `${created.model} (${created.assetTag}) was added to inventory`,
        action: { label: 'View stock', link: '/stock-inventory' }
      });
    } catch (e: any) {
      toast.error('Unable to add asset', { description: String(e?.message ?? 'Network error') });
    }
  };

  const filteredAssets = assetsList.filter(asset => {
    const q = String(searchTerm ?? '').toLowerCase();
    const matchesSearch =
      String(asset.assetTag ?? '').toLowerCase().includes(q) ||
      String(asset.serialNumber ?? '').toLowerCase().includes(q) ||
      String(asset.model ?? '').toLowerCase().includes(q);
    
    const matchesCategory = !filterCategory || asset.category === filterCategory;
    const matchesSite = !filterSite || asset.site === filterSite;
    const matchesStatus = !filterStatus || asset.status === filterStatus;

    return matchesSearch && matchesCategory && matchesSite && matchesStatus;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="page-hero">
        <div className="page-hero__topline" aria-hidden />
        <div className="page-hero__layout">
          <div className="min-w-0">
            <div className="page-hero__title-row">
              <div className="page-hero__icon" aria-hidden>
                <Package className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">Central Inventory</span>
                </div>

                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>
                      Assets IT
                    </span>
                    <span className="page-hero__title-text">Assets IT</span>
                  </span>
                </h1>

                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle uppercase tracking-[0.15em] text-[10px] font-black opacity-60">Corporate Asset Registry & Control</p>
              </div>
            </div>
          </div>

          {canManageInventory && (
            <div className="page-hero__actions">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsModalOpen(true)}
                className="chip-industrial flex items-center gap-2 bg-gradient-to-br from-primary to-cyan-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-primary/20 transition-all font-bold text-sm uppercase tracking-widest"
              >
                <Plus className="w-4 h-4" />
                Add asset
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Filters Premium */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel-frame overflow-hidden bg-card/30 backdrop-blur-md rounded-3xl border border-border/60 shadow-xl"
      >
        <div className="px-8 py-6 border-b border-border/50 bg-gradient-to-r from-muted/30 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Filter className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-foreground uppercase">Inventory Filters</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 px-6 py-6">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-2.5 ml-1">
              Quick Search
            </label>
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/5 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center bg-card border border-border/80 rounded-xl transition-all group-focus-within:border-primary/50 group-focus-within:ring-4 group-focus-within:ring-primary/5 shadow-sm">
                <div className="pl-3.5 text-muted-foreground/40">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Asset Tag, SN, Model..."
                  className="w-full pl-3 pr-4 py-2.5 bg-transparent text-foreground placeholder:text-muted-foreground/30 text-[13px] font-medium outline-none"
                />
              </div>
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-2.5 ml-1">
              Category
            </label>
            <div className="relative flex items-center bg-card border border-border/80 rounded-xl shadow-sm">
              <div className="pl-3.5 text-muted-foreground/40">
                <Layers className="w-4 h-4" />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 bg-transparent text-foreground text-[13px] font-bold outline-none appearance-none cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <div className="absolute right-3 pointer-events-none text-muted-foreground/40">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Site Filter */}
          <div>
            <label className="block text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-2.5 ml-1">
              Site Location
            </label>
            <div className="relative flex items-center bg-card border border-border/80 rounded-xl shadow-sm">
              <div className="pl-3.5 text-muted-foreground/40">
                <Building2 className="w-4 h-4" />
              </div>
              <select
                value={filterSite}
                onChange={(e) => setFilterSite(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 bg-transparent text-foreground text-[13px] font-bold outline-none appearance-none cursor-pointer"
              >
                <option value="">All Sites</option>
                {sites.map(site => (
                  <option key={site.id} value={site.name}>{site.name}</option>
                ))}
              </select>
              <div className="absolute right-3 pointer-events-none text-muted-foreground/40">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-2.5 ml-1">
              Condition
            </label>
            <div className="relative flex items-center bg-card border border-border/80 rounded-xl shadow-sm">
              <div className="pl-3.5 text-muted-foreground/40">
                <Tag className="w-4 h-4" />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 bg-transparent text-foreground text-[13px] font-bold outline-none appearance-none cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="Available">Available</option>
                <option value="Assigned">Assigned</option>
                <option value="InRepair">In Repair</option>
                <option value="Retired">Retired</option>
              </select>
              <div className="absolute right-3 pointer-events-none text-muted-foreground/40">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Results Count */}
      <div className="flex items-center justify-between px-2">
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/50">
          Showing <span className="text-foreground">{filteredAssets.length}</span> individual records
        </p>
      </div>

      {/* Table Premium */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="panel-frame overflow-hidden bg-card/30 backdrop-blur-md rounded-3xl border border-border/60 shadow-xl"
      >
        <div className="px-8 py-6 border-b border-border/50 bg-gradient-to-r from-muted/30 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-foreground uppercase">Inventory Registry</h2>
          </div>
          <div className="px-3 py-1 rounded-full bg-muted/50 border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {filteredAssets.length} Total Records
          </div>
        </div>

        <div className="overflow-x-auto sidebar-scroll">
          <table className="w-full premium-table">
            <thead>
              <tr className="bg-muted/20">
                {['Asset Tag', 'Identities', 'Category', 'Site', 'Status', 'Net Value', 'Actions'].map((h) => (
                  <th key={h} className="px-8 py-4 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] border-b border-border/50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredAssets.map((asset) => (
                <tr key={asset.id} className="group hover:bg-primary/5 transition-all duration-300">
                  <td className="px-8 py-5 whitespace-nowrap">
                      <span className="font-black text-[13px] tracking-tight text-foreground uppercase transition-all">
                      {asset.assetTag || '—'}
                    </span>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-foreground leading-none">{asset.model || '—'}</span>
                        <span className="text-[11px] font-medium text-muted-foreground mt-1 tracking-tight">SN: {asset.serialNumber || '—'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                      <span className="text-[12px] font-bold text-foreground/80 bg-muted/50 px-2 py-0.5 rounded-md border border-border/40">
                      {asset.category}
                    </span>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-[13px] font-bold text-foreground/70">
                    {asset.site}
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <span className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 border shadow-sm transition-transform group-hover:scale-105",
                      statusStyles[asset.status]
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", 
                        asset.status === 'Available' ? 'bg-emerald-500' : 
                        asset.status === 'Assigned' ? 'bg-blue-500' : 
                        asset.status === 'InRepair' ? 'bg-orange-500' : 'bg-rose-500'
                      )} />
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-[13px] text-foreground font-black tracking-tight">
                    {formatMAD(asset.value)}
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-sm">
                    <Link
                      to={`/inventory/${asset.id}`}
                      className="chip-industrial inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary hover:text-cyan-600 transition-colors"
                    >
                      Inspect <Plus className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Add Asset Modal */}
      <AddAssetModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddAsset}
        categories={categories}
        sites={sites}
        suppliers={suppliers}
      />
    </div>
  );
}