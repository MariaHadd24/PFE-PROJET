import React, { useEffect, useState } from 'react';
import { Plus, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, LayoutDashboard } from 'lucide-react';
import type { MovementType } from '../types';
import { AddMovementModal } from '../components/ui/AddMovementModal';
import { useNotifications } from '../context/NotificationContext';
import { toast } from 'sonner';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { canPerformAction } from '../lib/rbac';
import { motion } from 'motion/react';
import { cn } from '../components/ui/utils';

const movementIcons: Record<MovementType, React.ReactNode> = {
  Entry: <ArrowDownCircle className="w-5 h-5 text-green-600 dark:text-emerald-300" />,
  Exit: <ArrowUpCircle className="w-5 h-5 text-red-600 dark:text-red-300" />,
  Transfer: <ArrowLeftRight className="w-5 h-5 text-blue-600" />
};

const movementColors: Record<MovementType, string> = {
  Entry: 'bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Exit: 'bg-red-100 text-red-700 dark:bg-red-900/25 dark:text-red-200',
  Transfer: 'bg-blue-100 text-blue-700'
};

export function MovementsPage() {
  const { stockMovements, assets, sites, users, addMovement } = useData();
  const { user } = useAuth();
  const role = user?.role ?? 'Reader';
  const canManageMovements = canPerformAction(role, 'manage_movements');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [movementsList, setMovementsList] = useState(stockMovements);
  const { addNotification } = useNotifications();

  useEffect(() => {
    setMovementsList(stockMovements);
  }, [stockMovements]);

  const handleAddMovement = async (newMovement: any) => {
    if (!canManageMovements) {
      toast.error('Access denied', { description: 'Your role is read-only for movements' });
      return;
    }
    try {
      const created = await addMovement(newMovement);
      setMovementsList(prev => [created, ...prev]);

      const asset = assets.find(a => a.id === created.assetId);
      const assetTag = asset?.assetTag ?? created.assetId;

      toast.success('Movement recorded', {
        description: `${created.type} - ${assetTag}`
      });

      addNotification({
        type: 'info',
        title: 'New stock movement',
        message: `${created.type} - ${assetTag}: ${created.comment}`,
        action: { label: 'View stock', link: '/stock-inventory' }
      });
    } catch (e: any) {
      toast.error('Unable to record movement', { description: String(e?.message ?? 'Network error') });
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
                <ArrowLeftRight className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">Stock</span>
                </div>

                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>
                      Stock & Movements
                    </span>
                    <span className="page-hero__title-text">Stock & Movements</span>
                  </span>
                </h1>

                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">Manage entries, exits, and transfers</p>
              </div>
            </div>
          </div>

          {canManageMovements && (
            <div className="page-hero__actions">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-5 h-5" />
                New movement
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="premium-surface p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <ArrowDownCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Entries</p>
              <p className="text-2xl font-bold text-foreground">
                {movementsList.filter(m => m.type === 'Entry').length}
              </p>
            </div>
          </div>
        </div>

        <div className="premium-surface p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
              <ArrowUpCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Exits</p>
              <p className="text-2xl font-bold text-foreground">
                {movementsList.filter(m => m.type === 'Exit').length}
              </p>
            </div>
          </div>
        </div>

        <div className="premium-surface p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <ArrowLeftRight className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transfers</p>
              <p className="text-2xl font-bold text-foreground">
                {movementsList.filter(m => m.type === 'Transfer').length}
              </p>
            </div>
          </div>
        </div>
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
            <h2 className="text-lg font-black tracking-tight text-foreground uppercase">Movement Registry</h2>
          </div>
          <div className="px-3 py-1 rounded-full bg-muted/50 border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {movementsList.length} Total Records
          </div>
        </div>

        <div className="overflow-x-auto sidebar-scroll">
          <table className="w-full premium-table">
            <thead>
              <tr className="bg-muted/20">
                {['Date', 'Type', 'Asset', 'Source Site', 'Destination Site', 'User', 'Comment'].map((h) => (
                  <th key={h} className="px-8 py-4 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] border-b border-border/50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {movementsList.map((movement) => {
                const asset = assets.find(a => a.id === movement.assetId);
                return (
                  <tr key={movement.id} className="group hover:bg-primary/5 transition-all duration-300">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="text-[11px] font-bold text-foreground/60 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {new Date(movement.date).toLocaleDateString('en-GB')}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {movementIcons[movement.type]}
                        <span className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-sm transition-transform group-hover:scale-105",
                          movementColors[movement.type]
                        )}>
                          {movement.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="text-[13px] font-bold text-foreground leading-none">{asset?.assetTag || 'N/A'}</span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[13px] font-bold text-foreground/70">
                      {movement.sourceSite || '-'}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[13px] font-bold text-foreground/70">
                      {movement.destinationSite || '-'}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="text-[13px] font-medium text-muted-foreground">
                        {movement.user}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-[13px] text-muted-foreground font-medium max-w-xs truncate">
                      {movement.comment}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Modal for new movement */}
      <AddMovementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddMovement}
        assets={assets}
        sites={sites}
        users={users}
      />
    </div>
  );
}