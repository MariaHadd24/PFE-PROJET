import React, { useEffect, useState } from 'react';
import { Plus, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight } from 'lucide-react';
import type { MovementType } from '../types';
import { AddMovementModal } from '../components/ui/AddMovementModal';
import { useNotifications } from '../context/NotificationContext';
import { toast } from 'sonner';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { canPerformAction } from '../lib/rbac';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stock & Movements</h1>
          
          <p className="text-muted-foreground mt-1">Manage entries, exits, and transfers</p>
        </div>
        {canManageMovements && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New movement
          </button>
        )}
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

      {/* Movements History */}
      <div className="premium-surface">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Movement History</h2>
          <p className="text-sm text-muted-foreground mt-1">All movements are read-only (not editable)</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full premium-table">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Source Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Destination Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Comment
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {movementsList.map((movement) => {
                const asset = assets.find(a => a.id === movement.assetId);
                return (
                  <tr key={movement.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {new Date(movement.date).toLocaleDateString('en-US')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {movementIcons[movement.type]}
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${movementColors[movement.type]}`}>
                          {movement.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-medium">
                      {asset?.assetTag || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {movement.sourceSite || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {movement.destinationSite || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {movement.user}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {movement.comment}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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