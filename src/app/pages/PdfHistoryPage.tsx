import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Download, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { API_BASE_URL, apiDelete, apiGet } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

type PdfItem = {
  file: string;
  size?: string;
  generatedBy?: string;
  date?: string; // unix seconds as string (see backend)
};

function formatEpochSeconds(seconds?: string): string {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const d = new Date(n * 1000);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function PdfHistoryPage() {
  const { user } = useAuth();
  const role = user?.role ?? 'Reader';
  const isAdmin = role === 'Admin';

  const [items, setItems] = useState<PdfItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  async function fetchPdfs() {
    setLoading(true);
    try {
      const data = await apiGet<PdfItem[]>('/pdfs');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPdfs();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? items.filter((it) => String(it.file ?? '').toLowerCase().includes(q)) : items;
    return [...base].sort((a, b) => Number(b.date ?? 0) - Number(a.date ?? 0));
  }, [items, search]);

  const getDownloadUrl = (filename: string) => {
    return `${API_BASE_URL}/pdfs/${encodeURIComponent(filename)}`;
  };

  const handleDelete = async (filename: string) => {
    if (!isAdmin) return;
    const ok = window.confirm(`Supprimer définitivement le PDF “${filename}” ?`);
    if (!ok) return;

    try {
      await apiDelete<{ ok: boolean }>(`/pdfs/${encodeURIComponent(filename)}`);
      setItems((prev) => prev.filter((x) => x.file !== filename));
      toast.success('PDF supprimé');
    } catch (e: any) {
      toast.error('Suppression impossible', { description: String(e?.message ?? e ?? 'Unknown error') });
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Historique des PDFs</h1>
        <Button onClick={fetchPdfs} variant="secondary" disabled={loading} className="gap-2">
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          {loading ? 'Chargement…' : 'Rafraîchir'}
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Rechercher un PDF…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tous les documents</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length > 0 ? (
            <div className="space-y-4">
              {filtered.map((pdf, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">{pdf.file}</p>
                      <p className="text-xs text-muted-foreground">
                        {pdf.size ? `${pdf.size} • ` : ''}Généré le {formatEpochSeconds(pdf.date)}
                      </p>
                    </div>
                  </div>
                  <a
                    href={getDownloadUrl(pdf.file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-md hover:bg-muted"
                    title="Télécharger le PDF"
                  >
                    <Download className="h-5 w-5" />
                  </a>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(pdf.file)}
                      className="p-2 rounded-md hover:bg-muted text-destructive"
                      title="Supprimer le PDF"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Aucun PDF trouvé</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Les PDFs disponibles sur le serveur apparaîtront ici.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
