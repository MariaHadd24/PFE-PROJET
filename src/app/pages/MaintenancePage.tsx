import React, { useEffect, useState } from 'react';
import { Plus, Wrench, AlertCircle, Clock, CheckCircle2, BadgePercent, LayoutDashboard } from 'lucide-react';
import type { TicketStatus } from '../types';
import { AddMaintenanceTicketModal } from '../components/ui/AddMaintenanceTicketModal';
import { useNotifications } from '../context/NotificationContext';
import { toast } from 'sonner';
import { useData } from '../context/DataContext';
import { formatMAD } from '../lib/money';
import { useAuth } from '../context/AuthContext';
import { canPerformAction } from '../lib/rbac';
import { motion } from 'motion/react';
import { cn } from '../components/ui/utils';

const ticketStatusStyles: Record<TicketStatus, string> = {
  Open: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/50 dark:border-orange-500/20',
  InProgress: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/20',
  Done: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20',
  Closed: 'bg-muted text-muted-foreground border-border/50'
};

const ticketStatusIcons: Record<TicketStatus, React.ReactNode> = {
  Open: <AlertCircle className="w-3.5 h-3.5" />,
  InProgress: <Clock className="w-3.5 h-3.5" />,
  Done: <CheckCircle2 className="w-3.5 h-3.5" />,
  Closed: <CheckCircle2 className="w-3.5 h-3.5" />
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
    <div className="space-y-8 pb-12">
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
                <p className="page-hero__subtitle uppercase tracking-[0.15em] text-[10px] font-black opacity-60">Manage maintenance tickets and repairs</p>
              </div>
            </div>
          </div>

          {canManageMaintenance && (
            <div className="page-hero__actions">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="chip-industrial flex items-center gap-2 bg-gradient-to-br from-primary to-cyan-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-primary/20 transition-all font-bold text-sm uppercase tracking-widest"
                onClick={() => setIsModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                New ticket
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Premium */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Open Tickets', value: openTickets.length, icon: AlertCircle, color: '#f97316', glow: 'from-orange-500/20' },
          { label: 'In Progress', value: ticketsList.filter(t => t.status === 'InProgress').length, icon: Clock, color: '#3b82f6', glow: 'from-blue-500/20' },
          { label: 'Completed', value: ticketsList.filter(t => t.status === 'Done').length, icon: CheckCircle2, color: '#10b981', glow: 'from-emerald-500/20' },
          { label: 'Total Cost', value: formatMAD(totalCost, { decimals: 0 }), icon: BadgePercent, color: '#8b5cf6', glow: 'from-purple-500/20' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="panel-frame group relative overflow-hidden p-6 bg-card/50 backdrop-blur-md rounded-2xl border border-border/60"
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", stat.glow, "to-transparent")} />
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">{stat.label}</p>
                <p className="text-3xl font-black tracking-tighter text-foreground">{stat.value}</p>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border shadow-sm group-hover:scale-110 transition-transform duration-500">
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '60%' }}
                  className="h-full bg-gradient-to-r from-transparent"
                  style={{ backgroundColor: stat.color }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tickets Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="panel-frame overflow-hidden bg-card/30 backdrop-blur-md rounded-3xl border border-border/60"
      >
        <div className="px-8 py-6 border-b border-border/50 bg-gradient-to-r from-muted/30 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-foreground uppercase">Ticket Registry</h2>
          </div>
          <div className="px-3 py-1 rounded-full bg-muted/50 border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {ticketsList.length} Total Records
          </div>
        </div>
        
        <div className="overflow-x-auto sidebar-scroll">
          <table className="w-full premium-table">
            <thead>
              <tr className="bg-muted/20">
                {['ID', 'Asset', 'Description', 'Status', 'Provider', 'Cost', 'Timeline'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] border-b border-border/50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {ticketsList.map((ticket) => {
                const asset = assets.find(a => a.id === ticket.assetId);
                return (
                  <tr key={ticket.id} className="group hover:bg-primary/5 transition-all duration-300">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="font-black text-xs tracking-widest text-primary/80 group-hover:text-primary transition-colors">#{ticket.id}</span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-foreground leading-none">{asset?.assetTag || 'Unknown'}</span>
                        <span className="text-[11px] font-medium text-muted-foreground mt-1">{asset?.model || 'â€”'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-[13px] text-muted-foreground max-w-xs truncate font-medium">
                      {ticket.description}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 border shadow-sm transition-transform group-hover:scale-105",
                        ticketStatusStyles[ticket.status]
                      )}>
                        {ticketStatusIcons[ticket.status]}
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[13px] font-bold text-foreground/70">
                      {ticket.provider}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[13px] text-foreground font-black tracking-tight">
                      {ticket.cost === 0 ? (
                        <span className="text-blue-500 uppercase tracking-widest text-[10px]">Warranty</span>
                      ) : formatMAD(ticket.cost, { decimals: 2 })}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-foreground/60 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {new Date(ticket.openDate).toLocaleDateString('en-GB')}
                        </span>
                        {ticket.closeDate && (
                          <span className="text-[11px] font-bold text-muted-foreground/50 flex items-center gap-1.5 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted" />
                            {new Date(ticket.closeDate).toLocaleDateString('en-GB')}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Info Box */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="panel-frame bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-center gap-4"
      >
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
          <AlertCircle className="w-5 h-5" />
        </div>
        <p className="text-[13px] font-medium text-foreground/80 leading-relaxed">
          <strong className="text-primary uppercase tracking-widest text-xs mr-2">System Protocol:</strong> 
          When a maintenance ticket status is set to <span className="font-black text-orange-500">Open</span> or <span className="font-black text-blue-500">InProgress</span>, 
          the associated asset is automatically flagged as <span className="italic font-bold text-foreground underline decoration-primary/30">InRepair</span> in the master inventory.
        </p>
      </motion.div>

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
