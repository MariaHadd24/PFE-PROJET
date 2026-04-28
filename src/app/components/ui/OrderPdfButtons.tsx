// src/app/components/ui/OrderPdfButtons.tsx
import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PurchaseOrder, PurchaseRequest } from '../../types';
import { generateBonDeCommande, generateBonDeLivraison } from '../../lib/orderPdfUtils';

interface OrderPdfButtonsProps {
  po: PurchaseOrder;
  pr?: PurchaseRequest;
}

export function OrderPdfButtons({ po, pr }: OrderPdfButtonsProps) {
  const [loadingBC, setLoadingBC] = useState(false);
  const [loadingBL, setLoadingBL] = useState(false);

  const handleBC = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingBC(true);
    try {
      await generateBonDeCommande(po, pr);
      toast.success('Bon de Commande téléchargé', {
        description: `BC_${po.id}_${po.supplier}.pdf`,
      });
    } catch (err: any) {
      toast.error('Erreur PDF', { description: String(err?.message ?? 'Génération échouée') });
    } finally {
      setLoadingBC(false);
    }
  };

  const handleBL = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingBL(true);
    try {
      await generateBonDeLivraison(po, pr);
      toast.success('Bon de Livraison téléchargé', {
        description: `BL_${po.id.replace(/^PO-?/, '')}_${po.supplier}.pdf`,
      });
    } catch (err: any) {
      toast.error('Erreur PDF', { description: String(err?.message ?? 'Génération échouée') });
    } finally {
      setLoadingBL(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Bon de Commande */}
      <button
        onClick={handleBC}
        disabled={loadingBC}
        title="Télécharger le Bon de Commande (BC)"
        className="
          inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold
          bg-blue-50 text-blue-700 border border-blue-200
          hover:bg-blue-100 hover:border-blue-300
          dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800
          dark:hover:bg-blue-900/70
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-150
        "
      >
        {loadingBC ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="h-3.5 w-3.5" />
        )}
        BC
      </button>

      {/* Bon de Livraison — disponible dès Ordered */}
      <button
        onClick={handleBL}
        disabled={loadingBL || po.status === 'Draft' || po.status === 'Approved'}
        title={
          po.status === 'Draft' || po.status === 'Approved'
            ? 'Disponible une fois la commande passée (Ordered)'
            : 'Télécharger le Bon de Livraison (BL)'
        }
        className="
          inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold
          bg-emerald-50 text-emerald-700 border border-emerald-200
          hover:bg-emerald-100 hover:border-emerald-300
          dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800
          dark:hover:bg-emerald-900/70
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors duration-150
        "
      >
        {loadingBL ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="h-3.5 w-3.5" />
        )}
        BL
      </button>
    </div>
  );
}
