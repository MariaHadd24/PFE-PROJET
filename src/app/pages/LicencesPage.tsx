import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '../context/DataContext';
import { AddLicenceModal } from '../components/ui/AddLicenceModal';

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

      <div className="premium-surface">
        <div className="overflow-x-auto">
          <table className="w-full premium-table">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">NAME</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">PLANT</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">KEY</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">MANUFACTURER</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">PURCHASE DATE</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">EXPIRY DATE</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SUPPLIER</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">CREATED AT</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">UPDATED AT</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-sm text-muted-foreground">
                    {loading ? 'Loading…' : 'No licences found.'}
                  </td>
                </tr>
              ) : (
                sorted.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{l.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{l.plant}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{l.key}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{l.manufacturer}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{l.purchaseDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{l.expiryDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{l.supplier}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{l.createdAt}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{l.updatedAt}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
