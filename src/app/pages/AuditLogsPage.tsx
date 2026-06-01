import React, { useEffect, useMemo, useState } from 'react';
import { ScrollText, Search, LayoutDashboard } from 'lucide-react';
import type { AuditLog, AuditLogResult } from '../types';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';

const resultStyles: Record<AuditLogResult, string> = {
  Success: 'bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Failure: 'bg-red-100 text-red-700 dark:bg-red-900/25 dark:text-red-200',
  Warning: 'bg-orange-100 text-orange-700',
};

function safeParseDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(value: string) {
  const d = safeParseDate(value);
  if (!d) return value;
  return d.toLocaleTimeString('en-US', { hour12: false });
}

function formatDate(value: string) {
  const d = safeParseDate(value);
  if (!d) return '';
  return d.toLocaleDateString('en-CA');
}

function getInitialsFromName(name: string) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return 'NA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getEntityDisplay(log: AuditLog) {
  if (log.entityId) return `${log.entity} (${log.entityId})`;
  return log.entity;
}

function escapeCsv(value: unknown) {
  const raw = value == null ? '' : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function isRedactedMarker(value: any): value is { redacted: true; len?: number } {
  return !!value && typeof value === 'object' && value.redacted === true;
}

function formatValueBrief(value: any): string {
  if (value == null) return '—';
  if (isRedactedMarker(value)) {
    const n = Number(value.len);
    return Number.isFinite(n) ? `redacted (len ${n})` : 'redacted';
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return '—';
    return s.length > 120 ? `${s.slice(0, 117)}...` : s;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length ? `[${value.length} items]` : '[]';
  if (typeof value === 'object') return '{…}';
  return String(value);
}

function pickFields(obj: any, keys: string[]) {
  if (!obj || typeof obj !== 'object') return [] as Array<[string, any]>;
  const out: Array<[string, any]> = [];
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out.push([k, (obj as any)[k]]);
  }
  return out;
}

function describeDetails(log: AuditLog): { title: string; lines: string[] } {
  const d: any = (log.details ?? {}) as any;
  const action = String(log.action ?? '').toUpperCase();
  const entity = String(log.entity ?? '').trim();
  const entityId = String(log.entityId ?? '').trim();

  // Common: update/delete/create snapshots
  const before = d?.before;
  const after = d?.after;
  const patch = d?.patch;
  const created = d?.created;
  const payload = d?.payload;

  if (action === 'CREATE') {
    const subject = entityId ? `${entity} (${entityId})` : entity;
    const data = created ?? payload ?? {};
    const lines: string[] = [];

    if (entity === 'User' || entity === 'UserDB') {
      const fields = pickFields(data, ['id', 'name', 'email', 'role', 'avatarUrl', 'signatureNumber']);
      for (const [k, v] of fields) lines.push(`${k}: ${formatValueBrief(v)}`);

      if ((data as any)?.passwordHash !== undefined) lines.push(`passwordHash: ${formatValueBrief((data as any).passwordHash)}`);
      if ((data as any)?.password !== undefined) lines.push(`password: ${formatValueBrief((data as any).password)}`);
      if ((data as any)?.signatureData !== undefined) lines.push(`signatureData: ${formatValueBrief((data as any).signatureData)}`);
    } else {
      const id = (data as any)?.id ?? entityId;
      if (id) lines.push(`id: ${formatValueBrief(id)}`);
      const nameLike = (data as any)?.name ?? (data as any)?.assetTag ?? (data as any)?.serialNumber;
      if (nameLike) lines.push(`info: ${formatValueBrief(nameLike)}`);
    }

    return { title: `Created ${subject}`, lines: lines.length ? lines : ['No extra details'] };
  }

  if (action === 'UPDATE') {
    const subject = entityId ? `${entity} (${entityId})` : entity;
    const lines: string[] = [];

    if (patch && typeof patch === 'object') {
      const keys = Object.keys(patch);
      if (keys.length) {
        lines.push(`Changed fields: ${keys.sort((a, b) => a.localeCompare(b)).join(', ')}`);
        for (const k of keys.slice(0, 12)) {
          lines.push(`${k}: ${formatValueBrief((before as any)?.[k])} → ${formatValueBrief((patch as any)[k])}`);
        }
        if (keys.length > 12) lines.push(`…and ${keys.length - 12} more`);
      }
    }

    // If we have after snapshot, show a couple identifying values.
    if (after && typeof after === 'object') {
      const id = (after as any)?.id ?? entityId;
      if (id) lines.push(`id: ${formatValueBrief(id)}`);
      if ((after as any)?.email) lines.push(`email: ${formatValueBrief((after as any).email)}`);
      if ((after as any)?.role) lines.push(`role: ${formatValueBrief((after as any).role)}`);
    }

    return { title: `Updated ${subject}`, lines: lines.length ? lines : ['No patch details'] };
  }

  if (action === 'DELETE') {
    const subject = entityId ? `${entity} (${entityId})` : entity;
    const lines: string[] = [];
    const data = before ?? {};
    const id = (data as any)?.id ?? entityId;
    if (id) lines.push(`id: ${formatValueBrief(id)}`);
    if ((data as any)?.email) lines.push(`email: ${formatValueBrief((data as any).email)}`);
    if ((data as any)?.name) lines.push(`name: ${formatValueBrief((data as any).name)}`);
    if ((data as any)?.assetTag) lines.push(`assetTag: ${formatValueBrief((data as any).assetTag)}`);
    return { title: `Deleted ${subject}`, lines: lines.length ? lines : ['No snapshot details'] };
  }

  if (action === 'UNDO') {
    const applied = formatValueBrief(d?.applied);
    const originalAction = formatValueBrief(d?.originalAction);
    const lines = [`originalAction: ${originalAction}`, `applied: ${applied}`, `logId: ${formatValueBrief(d?.logId)}`];
    return { title: `Undo`, lines };
  }

  // Fallback
  const subject = entityId ? `${entity} (${entityId})` : entity;
  return { title: `${action || 'Event'} ${subject}`.trim(), lines: ['Details available but not summarized'] };
}

function exportLogsToCsv(logs: AuditLog[]) {
  const delimiter = ';';
  const header = [
    'Event Type',
    'Entity affected',
    'Triggered By',
    'Role',
    'Description',
    'Timestamp',
    'IP',
    'Result',
  ];

  const lines = [
    // Helps Excel detect the separator and render as a table.
    `sep=${delimiter}`,
    header.map(escapeCsv).join(delimiter),
    ...logs.map((l) =>
      [
        l.action,
        getEntityDisplay(l),
        l.user,
        l.userRole ?? '',
        l.description ?? '',
        l.timestamp,
        l.ip,
        l.result,
      ]
        .map(escapeCsv)
        .join(delimiter),
    ),
  ];

  // BOM makes Excel reliably treat it as UTF-8.
  const csv = `\ufeff${lines.join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'audit-logs.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function AuditLogsPage() {
  const { auditLogs, undoAuditLog } = useData();
  const { user } = useAuth();
  const isAdmin = String((user as any)?.role ?? '').trim().toLowerCase() === 'admin';

  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterEventType, setFilterEventType] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const allLogs = useMemo(() => auditLogs ?? [], [auditLogs]);

  const eventTypes = useMemo(() => {
    const set = new Set(allLogs.map(l => l.action).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allLogs
      .slice()
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .filter(log => {
        const matchesEventType = !filterEventType || log.action === filterEventType;
        if (!matchesEventType) return false;

        if (!q) return true;
        return [
          log.action,
          log.user,
          log.userRole ?? '',
          log.entity,
          log.entityId ?? '',
          log.description ?? '',
          log.ip,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      });
  }, [allLogs, searchTerm, filterEventType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterEventType]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pagedLogs = filteredLogs.slice(pageStart, pageEnd);

  const pageItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    pages.add(safeCurrentPage);
    pages.add(Math.max(1, safeCurrentPage - 1));
    pages.add(Math.min(totalPages, safeCurrentPage + 1));

    return Array.from(pages).sort((a, b) => a - b);
  }, [safeCurrentPage, totalPages]);

  const openDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const supportsUndoSelected =
    !!selectedLog &&
    (String(selectedLog.action).toUpperCase() === 'CREATE' ||
      String(selectedLog.action).toUpperCase() === 'UPDATE' ||
      String(selectedLog.action).toUpperCase() === 'DELETE');

  const canUndoSelected = isAdmin && supportsUndoSelected;

  const onUndoSelected = async () => {
    if (!selectedLog) return;
    if (!canUndoSelected) return;

    setUndoError(null);
    setUndoing(true);
    try {
      await undoAuditLog(selectedLog.id);
      setDetailsOpen(false);
      setSelectedLog(null);
    } catch (e: any) {
      setUndoError(String(e?.message ?? 'Unable to undo audit log'));
    } finally {
      setUndoing(false);
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
                <ScrollText className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">System</span>
                </div>

                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>
                      System Audit Logs
                    </span>
                    <span className="page-hero__title-text">System Audit Logs</span>
                  </span>
                </h1>

                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">Track all platform activities and changes for compliance monitoring.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-primary/5 dark:bg-primary/10 rounded-xl shadow-sm border border-primary/20 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <button
            type="button"
            onClick={() => exportLogsToCsv(filteredLogs)}
            className="w-full md:w-auto border border-border bg-card text-foreground px-4 py-2 rounded-lg hover:bg-muted/30 transition-all font-medium"
          >
            Export CSV
          </button>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs by action, user, or entity..."
              className="w-full pl-10 pr-4 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
            />
          </div>

          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="w-full md:w-56 px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none"
          >
            <option value="">All Event Types</option>
            {eventTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

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
            <h2 className="text-lg font-black tracking-tight text-foreground uppercase">Log Registry</h2>
          </div>
          <div className="px-3 py-1 rounded-full bg-muted/50 border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {filteredLogs.length} Total Records
          </div>
        </div>

        <div className="overflow-x-auto sidebar-scroll">
          <table className="w-full premium-table">
            <thead>
              <tr className="bg-muted/20">
                {['Event Type', 'Entity affected', 'Triggered By', 'Description', 'Timestamp & IP'].map((h) => (
                  <th key={h} className="px-8 py-4 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] border-b border-border/50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-[13px] text-muted-foreground font-medium">
                    No audit logs match your filters.
                  </td>
                </tr>
              ) : (
                pagedLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="group hover:bg-primary/5 transition-all duration-300 cursor-pointer"
                    onClick={() => openDetails(log)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetails(log);
                      }
                    }}
                  >
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="text-[13px] font-black text-primary/80 group-hover:text-primary transition-colors">
                        {log.action}
                      </span>
                    </td>

                    <td className="px-8 py-5">
                      <span className="text-[13px] font-bold text-foreground leading-none">{getEntityDisplay(log)}</span>
                    </td>

                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs shadow-sm ring-1 ring-primary/20">
                          {(log.userInitials ?? getInitialsFromName(log.user)).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-foreground leading-none">{log.user}</span>
                          <span className="text-[11px] font-medium text-muted-foreground mt-1">{log.userRole ?? 'Operator'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-8 py-5">
                      <p className="text-[13px] text-muted-foreground font-medium line-clamp-1">{log.description ?? '—'}</p>
                    </td>

                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex flex-col items-end">
                        <span className="text-[11px] font-bold text-foreground/60 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {formatTime(log.timestamp)}
                        </span>
                        <span className="text-[10px] font-black text-muted-foreground/40 mt-1 uppercase tracking-widest">
                          {formatDate(log.timestamp)} • IP: {log.ip || 'unknown'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredLogs.length > 0 ? (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {pageStart + 1}-{Math.min(pageEnd, filteredLogs.length)} of {filteredLogs.length.toLocaleString('en-US')} log entries
            </div>
            {totalPages > 1 ? (
              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      className={safeCurrentPage === 1 ? 'pointer-events-none opacity-50' : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(p => Math.max(1, p - 1));
                      }}
                    />
                  </PaginationItem>

                  {pageItems.map((page, idx) => {
                    const prev = pageItems[idx - 1];
                    const needsEllipsis = typeof prev === 'number' && page - prev > 1;

                    return (
                      <React.Fragment key={page}>
                        {needsEllipsis ? (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : null}
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            isActive={page === safeCurrentPage}
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(page);
                            }}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      </React.Fragment>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      className={safeCurrentPage === totalPages ? 'pointer-events-none opacity-50' : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(p => Math.min(totalPages, p + 1));
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </div>
        ) : null}
      </motion.div>

      {/* Details Panel */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Audit log details</SheetTitle>
            <SheetDescription>
              {selectedLog ? `${selectedLog.action} • ${selectedLog.user}` : 'Details'}
            </SheetDescription>
          </SheetHeader>

          <div className="p-4 space-y-4 overflow-auto">
            {!selectedLog ? (
              <div className="text-sm text-muted-foreground">Select a log entry to view details.</div>
            ) : (
              <div className="space-y-4">
                {canUndoSelected ? (
                  <div className="bg-card rounded-xl border border-border p-4">
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={onUndoSelected}
                        disabled={undoing || !canUndoSelected}
                        className="w-full border border-border bg-card text-foreground px-4 py-2 rounded-lg hover:bg-muted/30 transition-all font-medium disabled:opacity-50"
                      >
                        {undoing ? 'Undoing…' : `Undo ${String(selectedLog.action).toUpperCase()}`}
                      </button>
                      {!isAdmin ? (
                        <div className="text-xs text-muted-foreground">
                          Undo is restricted to Admin users.
                        </div>
                      ) : null}
                      {undoError ? (
                        <div className="text-xs text-red-600 dark:text-red-300 break-words">{undoError}</div>
                      ) : null}
                      <div className="text-xs text-muted-foreground">
                        Deletes newly created records, restores deleted records, or reverts updates using the audit snapshot.
                      </div>
                    </div>
                  </div>
                ) : supportsUndoSelected ? (
                  <div className="bg-card rounded-xl border border-border p-4">
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        disabled
                        className="w-full border border-border bg-card text-foreground px-4 py-2 rounded-lg font-medium opacity-50"
                      >
                        {`Undo ${String(selectedLog.action).toUpperCase()}`}
                      </button>
                      <div className="text-xs text-muted-foreground">
                        Undo is restricted to Admin users.
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Event Type</div>
                      <div className="text-sm text-foreground text-right">{selectedLog.action}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Entity affected</div>
                      <div className="text-sm text-foreground text-right">{getEntityDisplay(selectedLog)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Triggered By</div>
                      <div className="text-sm text-foreground text-right">
                        {selectedLog.user}
                        {selectedLog.userRole ? ` (${selectedLog.userRole})` : ''}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</div>
                      <div className="text-sm text-foreground text-right">{selectedLog.timestamp}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">IP</div>
                      <div className="text-sm text-foreground text-right">{selectedLog.ip}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Result</div>
                      <div className="text-right">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${resultStyles[selectedLog.result]}`}>
                          {selectedLog.result}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Description</div>
                  <div className="text-sm text-muted-foreground">{selectedLog.description ?? '—'}</div>
                </div>

                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Details</div>
                  {(() => {
                    const info = describeDetails(selectedLog);
                    return (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-foreground">{info.title}</div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {info.lines.map((line, idx) => (
                            <div key={idx} className="break-words">{line}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
