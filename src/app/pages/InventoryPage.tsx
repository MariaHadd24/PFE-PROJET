import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search, Filter } from 'lucide-react';
import type { AssetStatus } from '../types';
import { AddAssetModal } from '../components/ui/AddAssetModal';
import { useNotifications } from '../context/NotificationContext';
import { toast } from 'sonner';
import { useData } from '../context/DataContext';
import { formatMAD } from '../lib/money';
import { useAuth } from '../context/AuthContext';
import { canPerformAction } from '../lib/rbac';

const statusStyles: Record<AssetStatus, string> = {
  Available: 'bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Assigned: 'bg-blue-100 text-blue-700',
  InRepair: 'bg-orange-100 text-orange-700',
  Retired: 'bg-red-100 text-red-700 dark:bg-red-900/25 dark:text-red-200'
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
    <div className="space-y-6">
      {/* Header */}
      <div className="page-hero">
        <div className="page-hero__topline" aria-hidden />
        <div className="page-hero__layout">
          <div className="min-w-0">
            <div className="page-hero__title-row">
              <div className="page-hero__icon" aria-hidden>
                <Search className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">Inventory</span>
                </div>

                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>
                      Inventory
                    </span>
                    <span className="page-hero__title-text">Inventory</span>
                  </span>
                </h1>

                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">IT asset management</p>
              </div>
            </div>
          </div>

          {canManageInventory && (
            <div className="page-hero__actions">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-6 py-3 rounded-lg hover:shadow-lg hover:scale-[1.02] transition-all font-medium"
              >
                <Plus className="w-5 h-5" />
                Add asset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="premium-surface p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Quick search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Asset tag, SN, model..."
                className="w-full pl-10 pr-4 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
            >
              <option value="">All</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Site Filter */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Site
            </label>
            <select
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
            >
              <option value="">All</option>
              {sites.map(site => (
                <option key={site.id} value={site.name}>{site.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
            >
              <option value="">All</option>
              <option value="Available">Available</option>
              <option value="Assigned">Assigned</option>
              <option value="InRepair">In repair</option>
              <option value="Retired">Retired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredAssets.length} asset(s) found
        </p>
      </div>

      {/* Table */}
      <div className="premium-surface">
        <div className="overflow-x-auto">
          <table className="w-full premium-table">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Asset Tag
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Serial Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-foreground">{asset.assetTag}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {asset.serialNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {asset.model}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {asset.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {asset.site}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[asset.status]}`}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {formatMAD(asset.value)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      to={`/inventory/${asset.id}`}
                      className="text-primary hover:opacity-90 font-medium"
                    >
                      View details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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