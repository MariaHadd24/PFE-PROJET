import React, { useEffect, useState } from 'react';
import { Plus, Wrench, AlertCircle } from 'lucide-react';
import type { TicketStatus } from '../types';
import { AddMaintenanceTicketModal } from '../components/ui/AddMaintenanceTicketModal';
import { useNotifications } from '../context/NotificationContext';
import { toast } from 'sonner';
import { useData } from '../context/DataContext';
import { formatMAD } from '../lib/money';
import { useAuth } from '../context/AuthContext';
import { canPerformAction } from '../lib/rbac';

const ticketStatusStyles: Record<TicketStatus, string> = {
  Open: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200',
  InProgress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
  Done: 'bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Closed: 'bg-muted text-muted-foreground'
};

const ticketStatusIcons: Record<TicketStatus, React.ReactNode> = {
  Open: <AlertCircle className="w-5 h-5" />,
  InProgress: <Wrench className="w-5 h-5" />,
  Done: <Wrench className="w-5 h-5" />,
  Closed: <Wrench className="w-5 h-5" />
};

export function MaintenancePage() {
  const { maintenanceTickets, assets, suppliers, addMaintenanceTicket } = useData();
  const { user } = useAuth();
  const role = user?.role ?? 'Reader';
  const canManageMaintenance = canPerformAction(role, 'manage_maintenance');
  const [ticketsList, setTicketsList] = useState(maintenanceTickets);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    setTicketsList(maintenanceTickets);
  }, [maintenanceTickets]);

  const totalCost = ticketsList.reduce((sum, ticket) => sum + ticket.cost, 0);
  const openTickets = ticketsList.filter(t => t.status === 'Open' || t.status === 'InProgress');

  const handleAddTicket = async (newTicket: any) => {
    if (!canManageMaintenance) {
      toast.error('Access denied', { description: 'Your role is read-only for maintenance' });
      return;
    }
    try {
      const created = await addMaintenanceTicket(newTicket);
      setTicketsList(prev => [created, ...prev]);

      const asset = assets.find(a => a.id === created.assetId);
      toast.success('Maintenance ticket created', {
        description: `${created.id} - ${asset?.assetTag} (${created.isWarranty ? 'Warranty' : formatMAD(created.cost, { decimals: 2 })})`
      });

      addNotification({
        type: 'warning',
        title: 'New maintenance ticket',
        message: `${created.id} - ${created.description.substring(0, 50)}${created.description.length > 50 ? '...' : ''}`,
        action: { label: 'View tickets', link: '/maintenance' }
      });
    } catch (e: any) {
      toast.error('Unable to create ticket', { description: String(e?.message ?? 'Network error') });
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
                <Wrench className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">Maintenance</span>
                </div>

                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>
                      Maintenance
                    </span>
                    <span className="page-hero__title-text">Maintenance</span>
                  </span>
                </h1>

                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">Manage maintenance tickets and repairs</p>
              </div>
            </div>
          </div>

          {canManageMaintenance && (
            <div className="page-hero__actions">
              <button
                className="flex items-center gap-2 bg-[#1F3C88] text-white px-4 py-2 rounded-lg hover:bg-[#163069] transition-colors"
                onClick={() => setIsModalOpen(true)}
              >
                <Plus className="w-5 h-5" />
                New ticket
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-primary/5 dark:bg-primary/10 rounded-xl shadow-sm border border-primary/20 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open Tickets</p>
              <p className="text-2xl font-bold text-foreground">{openTickets.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-primary/5 dark:bg-primary/10 rounded-xl shadow-sm border border-primary/20 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold text-foreground">
                {ticketsList.filter(t => t.status === 'InProgress').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-primary/5 dark:bg-primary/10 rounded-xl shadow-sm border border-primary/20 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-foreground">
                {ticketsList.filter(t => t.status === 'Done').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-primary/5 dark:bg-primary/10 rounded-xl shadow-sm border border-primary/20 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <span className="text-xl font-bold text-purple-600">MAD</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-bold text-foreground">{formatMAD(totalCost, { decimals: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="premium-surface">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Ticket List</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full premium-table">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Ticket Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Open Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Close Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {ticketsList.map((ticket) => {
                const asset = assets.find(a => a.id === ticket.assetId);
                return (
                  <tr key={ticket.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-foreground">{ticket.id}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-foreground">{asset?.assetTag}</div>
                        <div className="text-xs text-muted-foreground">{asset?.model}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate">
                      {ticket.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${ticketStatusStyles[ticket.status]}`}>
                        {ticketStatusIcons[ticket.status]}
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {ticket.provider}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-medium">
                      {ticket.cost === 0 ? 'Warranty' : formatMAD(ticket.cost, { decimals: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(ticket.openDate).toLocaleDateString('en-US')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {ticket.closeDate ? new Date(ticket.closeDate).toLocaleDateString('en-US') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <p className="text-sm text-foreground">
          <strong>Business rule:</strong> When a ticket is open or in progress, the associated asset status is automatically set to "InRepair".
        </p>
      </div>

      {/* Add Maintenance Ticket Modal */}
      <AddMaintenanceTicketModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdd={handleAddTicket}
        assets={assets}
        suppliers={suppliers}
      />
    </div>
  );
}