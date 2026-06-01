import React, { useMemo, useState } from 'react';
import { Plus, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '../context/DataContext';
import { AddLicenceModal } from '../components/ui/AddLicenceModal';
import { motion } from 'motion/react';

export function LicencesPage() {
  const { licences, addLicence, loading, sites } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sorted = useMemo(() => {
    const list = Array.isArray(licences) ? [...licences] : [];
    list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return list;
  }, [licences]);

  const handleAdd = async (payload: {
    name: string;
    plant: string;
    key: string;
    manufacturer: string;
    purchaseDate: string;
    expiryDate: string;
    supplier: string;
  }) => {
    try {
      await addLicence(payload as any);
      toast.success('Licence added');
    } catch (e: any) {
      toast.error('Unable to add licence', { description: String(e?.message ?? 'Network error') });
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-hero">
        <div className="page-hero__topline" aria-hidden />
        <div className="page-hero__layout">
          <div className="min-w-0">
            <div className="page-hero__title-row">
              <div className="page-hero__icon" aria-hidden>
                <Plus className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">Licences</span>
                </div>

                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>
                      Licences
                    </span>
                    <span className="page-hero__title-text">Licences</span>
                  </span>
                </h1>

                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">Manage software licences</p>
              </div>
            </div>
          </div>

          <div className="page-hero__actions">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-6 py-3 rounded-lg hover:shadow-lg hover:scale-[1.02] transition-all font-medium"
            >
              <Plus className="w-5 h-5" />
              Add licence
            </button>
          </div>
        </div>
      </div>

      <AddLicenceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAdd}
        sites={sites}
      />

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
            <h2 className="text-lg font-black tracking-tight text-foreground uppercase">Licence Registry</h2>
          </div>
          <div className="px-3 py-1 rounded-full bg-muted/50 border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {sorted.length} Total Records
          </div>
        </div>

        <div className="overflow-x-auto sidebar-scroll">
          <table className="w-full premium-table">
            <thead>
              <tr className="bg-muted/20">
                {['Name', 'Plant', 'Key', 'Manufacturer', 'Purchase', 'Expiry', 'Supplier', 'Created', 'Updated', 'Actions'].map((h) => (
                  <th key={h} className="px-8 py-4 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] border-b border-border/50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-8 py-10 text-center text-[13px] text-muted-foreground font-medium">
                    {loading ? 'Loading…' : 'No licences found.'}
                  </td>
                </tr>
              ) : (
                sorted.map((l) => (
                  <tr key={l.id} className="group hover:bg-primary/5 transition-all duration-300">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="text-[13px] font-bold text-foreground leading-none">{l.name}</span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="text-[12px] font-bold text-foreground/80 bg-muted/50 px-2 py-0.5 rounded-md border border-border/40">
                        {l.plant}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[13px] text-muted-foreground font-medium">
                      {l.key}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[13px] text-foreground font-black tracking-tight">
                      {l.manufacturer}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="text-[11px] font-bold text-foreground/60 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {l.purchaseDate}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="text-[11px] font-bold text-foreground/60 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        {l.expiryDate}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[13px] font-bold text-foreground/70">
                      {l.supplier}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[11px] font-medium text-muted-foreground/60">
                      {l.createdAt}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[11px] font-medium text-muted-foreground/60">
                      {l.updatedAt}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-[13px] text-muted-foreground">—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
