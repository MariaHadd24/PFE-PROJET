import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { AlertTriangle } from 'lucide-react';

import { toast } from 'sonner';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { useData } from '../context/DataContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import type { PrinterTonerIncident } from '../types';

function formatDate(value?: string | null): string {
  const s = String(value ?? '').trim();
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const hasTime = /[T\s]\d{2}:\d{2}/.test(s) || s.length > 10;
  if (hasTime) {
    return d.toLocaleString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR');
}

function formatDurationJHM(value: unknown): string {
  if (value === null || value === undefined) return '-';
  const raw = String(value).trim();
  if (!raw) return '-';

  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n)) return raw;

  // Convention: duration value is in hours (can be decimal).
  const totalMinutes = Math.max(0, Math.round(n * 60));
  const days = Math.floor(totalMinutes / (24 * 60));
  const remAfterDays = totalMinutes - days * 24 * 60;
  const hours = Math.floor(remAfterDays / 60);
  const minutes = remAfterDays - hours * 60;

  return `${days}j ${hours}h ${minutes}min`;
}

function formatCell(header: string, value: unknown): string {
  if (value === null || value === undefined) return '-';
  const s = String(value).trim();
  if (!s) return '-';
  const h = header.toLowerCase();
  if (h.includes('date')) return formatDate(s);
  if (h.includes('dur') || h.includes('duree')) return formatDurationJHM(value);
  return s;
}

function normalizeKey(input: string): string {
  const s = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-/\.'’]+/g, '_')
    .replace(/[^a-z0-9_]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s;
}

function statusLabel(value?: string | null): string {
  return value === 'INTERVENUE' ? 'Intervenue' : 'Non intervenue';
}

function dynamicValue(row: PrinterTonerIncident, header: string): unknown {
  const rawVal = (row.raw as any)?.[header];
  if (rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '') return rawVal;

  const n = normalizeKey(header);
  if (n.includes('reclamation')) return row.claimDate;
  if (n.includes('intervention')) return row.interventionDate;
  if (n.includes('duree')) return row.duration;
  if (n.includes('ticket')) return row.ticketNumber;
  if (n === 'printer' || n === 'printer_name') return row.printerName;
  if (n.includes('printer_name')) return row.printerName;
  if (n === 'site') return row.site;
  if (n === 'claim' || n === 'date_claim' || n === 'claim_date') return row.claimDate;
  if (n === 'type' || n === 'type_of_demand' || (n.includes('type') && n.includes('demand'))) return row.demandType;
  if (n === 's_n' || n === 'sn' || n.includes('serial')) return row.printerSerial;
  if (n.includes('model')) return row.printerModel;
  if (n === 'nature' || n === 'issue' || n === 'problem') return row.problemNature;
  if (n.includes('nature_du_prob')) return row.problemNature;
  return rawVal;
}

function toDatetimeLocalValue(value?: string | null): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`;
  const t = s.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) return t.slice(0, 16);
  return t;
}

export function PrinterIncidentsPage() {
  const { assets, sites } = useData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PrinterTonerIncident[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PrinterTonerIncident | null>(null);

  const [formSite, setFormSite] = useState('');
  const [formPrinterName, setFormPrinterName] = useState('');
  const [formDemandType, setFormDemandType] = useState('');
  const [formTicketNumber, setFormTicketNumber] = useState('');
  const [formProblemNature, setFormProblemNature] = useState('');
  const [formPrinterSerial, setFormPrinterSerial] = useState('');
  const [formPrinterModel, setFormPrinterModel] = useState('');
  const [formClaimDate, setFormClaimDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<PrinterTonerIncident[]>('/printer-toner-incidents?limit=10000');
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const msg = String(e?.message ?? 'Unable to load incidents');
      setError(msg);
      setRows([]);
      toast.error('Incidents error', { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const ad = Date.parse(String(a.claimDate ?? ''));
      const bd = Date.parse(String(b.claimDate ?? ''));
      if (Number.isNaN(ad) && Number.isNaN(bd)) return 0;
      if (Number.isNaN(ad)) return 1;
      if (Number.isNaN(bd)) return -1;
      return bd - ad;
    });
    return list;
  }, [rows]);

  const printerAssets = useMemo(() => {
    const list = Array.isArray(assets) ? assets : [];
    const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

    const isConsumableTonerLike = (asset: any): boolean => {
      const type = String(asset?.type ?? '').trim().toLowerCase();
      const assetTag = String(asset?.assetTag ?? '').trim().toLowerCase();
      const model = String(asset?.model ?? '').trim().toLowerCase();
      const serialNumber = String(asset?.serialNumber ?? '').trim().toLowerCase();

      // Matches known toner IDs from the inventory (W913x / W924x families)
      if (/^sn-w(?:913[0-3]|924[0-3])mc$/.test(assetTag)) return true;
      if (/^w(?:913[0-3]|924[0-3])mc$/.test(model)) return true;
      if (/^w(?:913[0-3]|924[0-3])mc$/.test(serialNumber)) return true;

      const isColor =
        type === 'noir' ||
        type === 'black' ||
        type === 'cyan' ||
        type === 'jaune' ||
        type === 'yellow' ||
        type === 'magenta';
      if (!isColor) return false;

      const looksLikeTonerCode = /^w\d{4}[a-z0-9-]*$/.test(model) || /^w\d{4}[a-z0-9-]*$/.test(serialNumber);
      const looksLikeStockTonerId = assetTag.startsWith('sn-w') || serialNumber.startsWith('sn-w');
      return looksLikeTonerCode || looksLikeStockTonerId;
    };

    return list
      // Prefer strict category match when available.
      .filter((a: any) => {
        const cat = norm((a as any)?.category);
        if (cat === 'printer' || cat === 'printers' || cat === 'imprimante' || cat === 'imprimantes') return true;

        const section = norm((a as any)?.section);
        const combined = `${cat} ${section}`.trim();
        if (!combined) return false;
        return combined.includes('printer') || combined.includes('imprim') || combined.includes('copier') || combined.includes('mfp');
      })
      .filter((a: any) => !isConsumableTonerLike(a))
      .filter((a: any) => String((a as any)?.serialNumber ?? '').trim())
      .sort((a: any, b: any) => String(a.serialNumber).localeCompare(String(b.serialNumber)));
  }, [assets]);

  const printerBySerial = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of printerAssets as any[]) {
      const sn = String(a?.serialNumber ?? '').trim();
      if (!sn) continue;
      if (!m.has(sn)) m.set(sn, a);
    }
    return m;
  }, [printerAssets]);

  const siteOptions = useMemo(() => {
    const list = Array.isArray(sites) ? sites : [];
    const opts = list
      .map((s: any) => {
        const name = String(s?.name ?? '').trim();
        const id = String(s?.id ?? '').trim();
        const codeIt = String(s?.codeIt ?? '').trim();
        return {
          value: id || name,
          label: [id, codeIt, name].filter(Boolean).join(' • '),
        };
      })
      .filter((o) => o.value);

    // de-dup by value
    const seen = new Set<string>();
    const out: Array<{ value: string; label: string }> = [];
    for (const o of opts) {
      if (seen.has(o.value)) continue;
      seen.add(o.value);
      out.push(o);
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [sites]);

  const rawHeaders = useMemo(() => {
    const candidate = sortedRows.find((r) => Array.isArray(r.rawHeaders) && r.rawHeaders.length > 0);
    return (candidate?.rawHeaders ?? []) as string[];
  }, [sortedRows]);

  const tableColumns = useMemo(
    () => [
      { key: 'site', label: 'Site' },
      { key: 'printerName', label: 'Printer' },
      { key: 'demandType', label: 'Type' },
      { key: 'ticketNumber', label: 'Ticket' },
      { key: 'problemNature', label: 'Nature' },
      { key: 'printerSerial', label: 'S/N' },
      { key: 'printerModel', label: 'Model' },
      { key: 'claimDate', label: 'Claim date' },
      { key: 'interventionDate', label: 'Intervention date' },
      { key: 'duration', label: 'Duration' },
    ],
    [],
  );

  const resetForm = useCallback(() => {
    setFormSite('');
    setFormPrinterName('');
    setFormDemandType('');
    setFormTicketNumber('');
    setFormProblemNature('');
    setFormPrinterSerial('');
    setFormPrinterModel('');
    setFormClaimDate('');
  }, []);

  const openAdd = useCallback(() => {
    setEditing(null);
    resetForm();
    setAddOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((row: PrinterTonerIncident) => {
    setEditing(row);
    setFormSite(String(row.site ?? '').trim());
    setFormPrinterName(String(row.printerName ?? '').trim());
    setFormDemandType(String(row.demandType ?? '').trim());
    setFormTicketNumber(String(row.ticketNumber ?? '').trim());
    setFormProblemNature(String(row.problemNature ?? '').trim());
    const sn = String(row.printerSerial ?? '').trim();
    setFormPrinterSerial(sn);

    const modelFromRow = String(row.printerModel ?? '').trim();
    const asset = sn ? printerBySerial.get(sn) : null;
    const modelFromAsset = asset ? String(asset?.model ?? '').trim() : '';
    setFormPrinterModel(modelFromRow || modelFromAsset);

    setFormClaimDate(toDatetimeLocalValue(row.claimDate));
    setAddOpen(true);
  }, [printerBySerial]);

  const submitIncident = useCallback(async () => {
    const claimDate = String(formClaimDate ?? '').trim();
    if (!claimDate) {
      toast.error('Claim date is required');
      return;
    }

    const site = String(formSite ?? '').trim();
    const printerName = String(formPrinterName ?? '').trim();
    const demandType = String(formDemandType ?? '').trim();
    const ticketNumber = String(formTicketNumber ?? '').trim();
    const problemNature = String(formProblemNature ?? '').trim();
    const printerSerial = String(formPrinterSerial ?? '').trim();
    const printerModel = String(formPrinterModel ?? '').trim();

    const payload: Partial<PrinterTonerIncident> & {
      status: 'NON_INTERVENUE' | 'INTERVENUE';
    } = {
      site: site || null,
      printerName: printerName || null,
      demandType: demandType || null,
      ticketNumber: ticketNumber || null,
      problemNature: problemNature || null,
      printerSerial: printerSerial || null,
      printerModel: printerModel || null,
      claimDate,
      status: (editing?.status as any) || (editing?.interventionDate ? 'INTERVENUE' : 'NON_INTERVENUE'),
    };

    const headersForPayload = (editing?.rawHeaders?.length ? editing.rawHeaders : rawHeaders) as string[];
    if (headersForPayload.length > 0) {
      const headerMap = new Map<string, string>();
      for (const h of headersForPayload) headerMap.set(normalizeKey(h), h);

      const raw: Record<string, unknown> = { ...(((editing?.raw as any) ?? {}) as Record<string, unknown>) };
      const setIfHeaderExists = (normalizedHeaderKey: string, value: unknown) => {
        const header = headerMap.get(normalizedHeaderKey);
        if (header) raw[header] = value;
      };

      setIfHeaderExists('site', site || null);
      setIfHeaderExists('printer_name', printerName || null);
      setIfHeaderExists('type_of_demand', demandType || null);
      setIfHeaderExists('n_ticket_cbi', ticketNumber || null);
      setIfHeaderExists('n_ticket', ticketNumber || null);
      setIfHeaderExists('ticket', ticketNumber || null);
      setIfHeaderExists('nature_du_probleme', problemNature || null);
      setIfHeaderExists('nature_du_problme', problemNature || null);
      setIfHeaderExists('s_n', printerSerial || null);
      setIfHeaderExists('sn', printerSerial || null);
      setIfHeaderExists('serial_number', printerSerial || null);
      setIfHeaderExists('model', printerModel || null);
      setIfHeaderExists('printer_model', printerModel || null);
      setIfHeaderExists('date_reclamation', claimDate);
      setIfHeaderExists('date_rclamation', claimDate);

      payload.rawHeaders = headersForPayload;
      payload.raw = raw;
    }

    setSaving(true);
    try {
      if (editing?.id) {
        await apiPatch<PrinterTonerIncident>(`/printer-toner-incidents/${encodeURIComponent(editing.id)}`, payload);
        toast.success('Incident updated');
      } else {
        await apiPost<PrinterTonerIncident>('/printer-toner-incidents', { ...payload, status: 'NON_INTERVENUE' });
        toast.success('Incident added');
      }

      resetForm();
      setEditing(null);
      setAddOpen(false);
      await load();
    } catch (e: any) {
      const msg = String(e?.message ?? 'Unable to save incident');
      toast.error(editing?.id ? 'Update incident' : 'Add incident', { description: msg });
    } finally {
      setSaving(false);
    }
  }, [editing, formClaimDate, formDemandType, formProblemNature, formPrinterModel, formPrinterName, formPrinterSerial, formSite, formTicketNumber, load, rawHeaders, resetForm]);

  const deleteIncident = useCallback(
    async (id: string) => {
      if (!window.confirm('Delete this incident?')) return;
      setDeletingId(id);
      try {
        await apiDelete<{ ok: boolean }>(`/printer-toner-incidents/${encodeURIComponent(id)}`);
        setRows((prev) => prev.filter((r) => r.id !== id));
        toast.success('Incident deleted');
      } catch (e: any) {
        const msg = String(e?.message ?? 'Unable to delete incident');
        toast.error('Delete incident', { description: msg });
      } finally {
        setDeletingId(null);
      }
    },
    [setRows],
  );

  const markIntervened = useCallback(
    async (id: string) => {
      setMarkingId(id);
      try {
        const updated = await apiPost<PrinterTonerIncident>(`/printer-toner-incidents/${encodeURIComponent(id)}/mark-intervened`, {});
        setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
        toast.success('Status updated');
      } catch (e: any) {
        const msg = String(e?.message ?? 'Unable to update incident');
        toast.error('Update incident', { description: msg });
      } finally {
        setMarkingId(null);
      }
    },
    [setRows],
  );

  return (
    <div className="space-y-8 pb-12 relative">
      <div className="panel-frame overflow-hidden bg-card/30 backdrop-blur-md rounded-3xl border border-border/60 shadow-xl">
        <div className="px-6 pt-6">
          <div className="page-hero">
            <div className="page-hero__topline" aria-hidden />
            <div className="page-hero__layout">
              <div className="min-w-0">
                <div className="page-hero__title-row">
                  <div className="page-hero__icon" aria-hidden>
                    <AlertTriangle className="h-[18px] w-[18px]" />
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="page-hero__badge">Printers</span>
                    </div>

                    <h2 className="page-hero__title">
                      <span className="page-hero__title-stack">
                        <span className="page-hero__title-glow" aria-hidden>
                          Incidents
                        </span>
                        <span className="page-hero__title-text">Incidents</span>
                      </span>
                    </h2>

                    <div className="page-hero__underline" aria-hidden />
                    <p className="page-hero__subtitle">
                      {loading ? 'Loading…' : error ? 'Loading error' : `${sortedRows.length} incident(s)`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="page-hero__actions">
                <button
                  className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-60"
                  disabled={saving}
                  onClick={() => openAdd()}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <Dialog open={addOpen} onOpenChange={(open) => (!saving ? setAddOpen(open) : undefined)}>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{editing?.id ? 'Edit incident' : 'Add incident'}</DialogTitle>
                <DialogDescription>Please provide at least the claim date.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Site</label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={formSite}
                    onChange={(e) => setFormSite(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {formSite && !siteOptions.some((o) => o.value === formSite) ? (
                      <option value={formSite}>{`${formSite} • (not in list)`}</option>
                    ) : null}
                    {siteOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Printer name</label>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={formPrinterName}
                    onChange={(e) => setFormPrinterName(e.target.value)}
                    placeholder="HP…"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Request type</label>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={formDemandType}
                    onChange={(e) => setFormDemandType(e.target.value)}
                    placeholder="CBI…"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Ticket</label>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={formTicketNumber}
                    onChange={(e) => setFormTicketNumber(e.target.value)}
                    placeholder="CBI…"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Serial number (SN)</label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={formPrinterSerial}
                    onChange={(e) => {
                      const nextSn = e.target.value;
                      setFormPrinterSerial(nextSn);
                      const asset = printerBySerial.get(nextSn);
                      if (asset) {
                        const model = String(asset?.model ?? '').trim();
                        if (model) setFormPrinterModel(model);
                        const hostnameFromProfile = String((asset as any)?.deviceProfile?.hostname ?? '').trim();
                        const printerName = hostnameFromProfile || String(asset?.assetTag ?? '').trim();
                        if (printerName && !String(formPrinterName ?? '').trim()) {
                          setFormPrinterName(printerName);
                        }
                      }
                    }}
                  >
                    <option value="">Select…</option>
                    {formPrinterSerial && !printerBySerial.has(formPrinterSerial) ? (
                      <option value={formPrinterSerial}>{`${formPrinterSerial} • (not in list)`}</option>
                    ) : null}
                    {printerAssets.map((a: any) => {
                      const sn = String(a?.serialNumber ?? '').trim();
                      const tag = String(a?.assetTag ?? '').trim();
                      const model = String(a?.model ?? '').trim();
                      const label = `${sn}${tag ? ` • ${tag}` : ''}${model ? ` • ${model}` : ''}`;
                      return (
                        <option key={sn} value={sn}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Model</label>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={formPrinterModel}
                    onChange={(e) => setFormPrinterModel(e.target.value)}
                    placeholder="E77830dn…"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Claim date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={formClaimDate}
                    onChange={(e) => setFormClaimDate(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">Issue</label>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={formProblemNature}
                    onChange={(e) => setFormProblemNature(e.target.value)}
                    placeholder="Paper jam…"
                  />
                </div>
              </div>

              <DialogFooter>
                <button
                  type="button"
                  className="border border-border bg-card text-foreground px-4 py-2 rounded-lg hover:bg-muted/30 transition-all font-medium disabled:opacity-60"
                  disabled={saving}
                  onClick={() => {
                    setAddOpen(false);
                    setEditing(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg transition-all font-medium disabled:opacity-60"
                  disabled={saving}
                  onClick={() => void submitIncident()}
                >
                  {saving ? 'Saving…' : editing?.id ? 'Update' : 'Add'}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="mt-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading incidents…</div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : sortedRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No incidents found.</div>
            ) : (
              <div className="overflow-x-auto table-scrollbar sidebar-scroll">
                <table className="min-w-[1200px] w-full premium-table">
                  <thead>
                    <tr>
                      {tableColumns.map((col) => (
                        <th
                          key={col.key}
                          className="px-8 py-3 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] border-b border-border/50 whitespace-nowrap"
                        >
                          {col.label}
                        </th>
                      ))}
                      <th className="px-8 py-3 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] border-b border-border/50 whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-8 py-3 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] border-b border-border/50 whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((i) => {
                      const st = (i.status || (i.interventionDate ? 'INTERVENUE' : 'NON_INTERVENUE')) as
                        | 'NON_INTERVENUE'
                        | 'INTERVENUE';

                      return (
                        <tr key={i.id}>
                          {tableColumns.map((col) => (
                            <td key={col.key} className="px-8 py-5 whitespace-nowrap text-[12px] font-medium text-foreground/80">
                              {formatCell(col.label, dynamicValue(i, col.label))}
                            </td>
                          ))}
                          <td className="px-8 py-5 whitespace-nowrap text-[12px] font-medium text-foreground/80">
                            {statusLabel(st)}
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {st !== 'INTERVENUE' ? (
                                <button
                                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-cyan-600 disabled:opacity-60"
                                  disabled={markingId === i.id}
                                  onClick={() => void markIntervened(i.id)}
                                >
                                  {markingId === i.id ? '…' : 'Mark as intervened'}
                                </button>
                              ) : (
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">OK</span>
                              )}
                              <button
                                className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-cyan-600 disabled:opacity-60"
                                disabled={saving || deletingId === i.id}
                                onClick={() => openEdit(i)}
                              >
                                Edit
                              </button>
                              <button
                                className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 disabled:opacity-60"
                                disabled={deletingId === i.id}
                                onClick={() => void deleteIncident(i.id)}
                              >
                                {deletingId === i.id ? '…' : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
