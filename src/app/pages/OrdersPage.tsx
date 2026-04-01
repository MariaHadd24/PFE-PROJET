import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { FileText, ShoppingCart, Package, CheckCircle, Clock, XCircle, ArrowRight } from 'lucide-react';
import type { PRStatus, POStatus } from '../types';
import { AddPRModal } from '../components/ui/AddPRModal';
import { AddPOModal } from '../components/ui/AddPOModal';
import { toast } from 'sonner';
import { useData } from '../context/DataContext';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { formatMAD } from '../lib/money';
import { useAuth } from '../context/AuthContext';
import { canPerformAction } from '../lib/rbac';

const pageContainerVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: 'easeOut', when: 'beforeChildren', staggerChildren: 0.05 },
  },
};

const pageItemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
};

const prStatusStyles: Record<PRStatus, string> = {
  Draft: 'bg-muted text-muted-foreground',
  Pending: 'bg-orange-100 text-orange-700',
  Approved: 'bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Rejected: 'bg-red-100 text-red-700 dark:bg-red-900/25 dark:text-red-200'
};

const poStatusStyles: Record<POStatus, string> = {
  Draft: 'bg-muted text-muted-foreground',
  Approved: 'bg-blue-100 text-blue-700',
  Ordered: 'bg-purple-100 text-purple-700',
  Received: 'bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Closed: 'bg-muted text-muted-foreground'
};

export function OrdersPage() {
  const shouldReduceMotion = useReducedMotion();
  const { user } = useAuth();
  const role = user?.role ?? 'Reader';
  const canManageOrders = canPerformAction(role, 'manage_orders');
  const {
    purchaseRequests,
    purchaseOrders,
    suppliers,
    categories,
    departments,
    users,
    addPurchaseRequest,
    addPurchaseOrder,
  } = useData();
  const [activeTab, setActiveTab] = useState<'pr' | 'po'>('pr');
  const [isPRModalOpen, setIsPRModalOpen] = useState(false);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [prList, setPrList] = useState(purchaseRequests);
  const [poList, setPoList] = useState(purchaseOrders);

  useEffect(() => {
    setPrList(purchaseRequests);
  }, [purchaseRequests]);

  useEffect(() => {
    setPoList(purchaseOrders);
  }, [purchaseOrders]);

  const handleAddPR = async (newPR: any) => {
    if (!canManageOrders) {
      toast.error('Access denied', { description: 'Your role is read-only for orders' });
      return;
    }
    try {
      const created = await addPurchaseRequest(newPR);
      setPrList(prev => [created, ...prev]);

      toast.success('Purchase Request created', {
        description: `${created.id} - Budget: ${formatMAD(created.budget)}`
      });
    } catch (e: any) {
      toast.error('Unable to create PR', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleAddPO = async (newPO: any) => {
    if (!canManageOrders) {
      toast.error('Access denied', { description: 'Your role is read-only for orders' });
      return;
    }
    try {
      const created = await addPurchaseOrder(newPO);
      setPoList(prev => [created, ...prev]);

      toast.success('Purchase Order created', {
        description: `${created.id} - Supplier: ${created.supplier} (${formatMAD(created.total)})`
      });
    } catch (e: any) {
      toast.error('Unable to create PO', { description: String(e?.message ?? 'Network error') });
    }
  };

  return (
    <motion.div
      className="space-y-6"
      variants={shouldReduceMotion ? undefined : pageContainerVariants}
      initial={shouldReduceMotion ? undefined : 'hidden'}
      animate={shouldReduceMotion ? undefined : 'show'}
    >
      {/* Header */}
      <motion.div variants={shouldReduceMotion ? undefined : pageItemVariants}>
        <h1 className="text-3xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground mt-1">Manage purchase requests and purchase orders</p>
      </motion.div>

      {/* Workflow Visualization */}
      <motion.div
        className="bg-primary/5 dark:bg-primary/10 rounded-xl shadow-sm border border-primary/20 p-6"
        variants={shouldReduceMotion ? undefined : pageItemVariants}
        whileHover={shouldReduceMotion ? undefined : { y: -1 }}
      >
        <h3 className="text-lg font-bold text-foreground mb-4">Order Workflow</h3>
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Draft</span>
          </div>
          <ArrowRight className="w-6 h-6 text-muted-foreground" />
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-2">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Pending</span>
          </div>
          <ArrowRight className="w-6 h-6 text-muted-foreground" />
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Approved</span>
          </div>
          <ArrowRight className="w-6 h-6 text-muted-foreground" />
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Ordered</span>
          </div>
          <ArrowRight className="w-6 h-6 text-muted-foreground" />
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-2">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Received</span>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div className="border-b border-border" variants={shouldReduceMotion ? undefined : pageItemVariants}>
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('pr')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
              ${activeTab === 'pr'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }
            `}
          >
            <FileText className="w-5 h-5" />
            Purchase Requests
          </button>
          <button
            onClick={() => setActiveTab('po')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
              ${activeTab === 'po'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }
            `}
          >
            <ShoppingCart className="w-5 h-5" />
            Purchase Orders
          </button>
        </nav>
      </motion.div>

      {/* Purchase Requests / Orders Tab */}
      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'pr' && (
          <motion.div
            key="tab-pr"
            className="premium-surface"
            variants={shouldReduceMotion ? undefined : pageItemVariants}
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
          >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Purchase Requests (PR)</h2>
            {canManageOrders && (
              <button
                onClick={() => setIsPRModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-[#1B4F91] to-[#2563EB] text-white rounded-lg hover:shadow-lg hover:scale-[1.02] transition-all text-sm font-medium"
              >
                New PR
              </button>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full premium-table">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Requester
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {prList.map((pr) => (
                  <tr key={pr.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-foreground">{pr.id}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {pr.requester}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {pr.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-medium">
                      {formatMAD(pr.budget)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(pr.createdDate).toLocaleDateString('en-US')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${prStatusStyles[pr.status]}`}>
                        {pr.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-primary hover:opacity-90 font-medium">
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </motion.div>
        )}

        {activeTab === 'po' && (
          <motion.div
            key="tab-po"
            className="premium-surface"
            variants={shouldReduceMotion ? undefined : pageItemVariants}
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
          >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Purchase Orders (PO)</h2>
            {canManageOrders && (
              <button
                onClick={() => setIsPOModalOpen(true)}
                className="px-4 py-2 bg-[#1F3C88] text-white rounded-lg hover:bg-[#163069] transition-colors text-sm"
              >
                New PO
              </button>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full premium-table">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Linked PR
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {poList.map((po) => (
                  <tr key={po.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-foreground">{po.id}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {po.prId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {po.supplier}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-medium">
                      {formatMAD(po.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(po.createdDate).toLocaleDateString('en-US')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${poStatusStyles[po.status]}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button className="text-primary hover:opacity-90 font-medium">
                        View
                      </button>
                      {canManageOrders && po.status === 'Received' && (
                        <button className="text-green-600 hover:text-green-700 font-medium">
                          Receive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add PR Modal */}
      <AddPRModal 
        isOpen={isPRModalOpen}
        onClose={() => setIsPRModalOpen(false)}
        onAdd={handleAddPR}
        categories={categories}
        departments={departments}
        users={users}
      />

      {/* Add PO Modal */}
      <AddPOModal 
        isOpen={isPOModalOpen}
        onClose={() => setIsPOModalOpen(false)}
        onAdd={handleAddPO}
        purchaseRequests={prList}
        suppliers={suppliers}
      />
    </motion.div>
  );
}