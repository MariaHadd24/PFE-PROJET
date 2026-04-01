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
      toast.success('Licence ajoutée');
    } catch (e: any) {
      toast.error('Impossible d\'ajouter la licence', { description: String(e?.message ?? 'Network error') });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Licences</h1>
          <p className="text-muted-foreground mt-1">Gestion des licences</p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-6 py-3 rounded-lg hover:shadow-lg hover:scale-[1.02] transition-all font-medium"
        >
          <Plus className="w-5 h-5" />
          Ajouter une licence
        </button>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">DATE D&apos;ACHAT</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">DATE D&apos;EXPIRATION</th>
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
                    {loading ? 'Chargement…' : 'Aucune licence trouvée.'}
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
