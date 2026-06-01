import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, KeyRound, Search, User, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { uploadPdfToHistory } from '../lib/api';

export type AccountSummary = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  initials: string;
  source: 'Company provided' | 'Imported' | 'Unknown';
};

function getInitials(name: string, email: string) {
  const fromName = String(name ?? '').trim();
  if (fromName) {
    const parts = fromName.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? 'U';
    const b = (parts.length > 1 ? parts[parts.length - 1]?.[0] : '') ?? '';
    return `${String(a).toUpperCase()}${String(b).toUpperCase()}`;
  }

  const fromEmail = String(email ?? '').trim();
  return fromEmail ? fromEmail.slice(0, 2).toUpperCase() : 'NA';
}

type SessionPdfForm = {
  fullName: string;
  email: string;
  username: string;
  password: string;
  role: string;
  startDate: string;
  endDate: string;
  signatureNumber: string;
  department: string;
};

const DEFAULT_SESSION_FORM: SessionPdfForm = {
  fullName: '',
  email: '',
  username: '',
  password: '',
  role: 'Reader',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  signatureNumber: '',
  department: '',
};

function normalizeFilePart(value: string) {
  const cleaned = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'session';
}

function formatDateLabel(value: string) {
  const input = String(value ?? '').trim();
  if (!input) return '—';
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? input : date.toLocaleDateString();
}

export function SessionsPage() {
  const navigate = useNavigate();
  const { users } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [sessionForm, setSessionForm] = useState<SessionPdfForm>(DEFAULT_SESSION_FORM);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const accounts = useMemo<AccountSummary[]>(() => {
    return (users ?? [])
      .map((u) => ({
        id: String(u.id ?? ''),
        name: String(u.name ?? '').trim() || 'Unnamed account',
        email: String(u.email ?? '').trim(),
        role: String(u.role ?? 'Reader'),
        avatarUrl: u.avatarUrl,
        initials: getInitials(String(u.name ?? ''), String(u.email ?? '')),
        source: 'Company provided' as const,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const filteredAccounts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return accounts.filter((account) => {
      if (!q) return true;

      return [account.name, account.email]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [accounts, searchTerm]);

  const handleSessionFieldChange = (field: keyof SessionPdfForm, value: string) => {
    setSessionForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerateSessionPdf = async () => {
    const fullName = sessionForm.fullName.trim();
    const email = sessionForm.email.trim();
    const username = sessionForm.username.trim();
    const password = sessionForm.password.trim();

    if (!fullName || !email || !username || !password) {
      toast.error('Missing session data', { description: 'Full name, email, username, and password are required.' });
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const role = sessionForm.role.trim() || 'Reader';
      const startDate = formatDateLabel(sessionForm.startDate);
      const endDate = formatDateLabel(sessionForm.endDate);
      const signatureNumber = sessionForm.signatureNumber.trim() || '—';
      const department = sessionForm.department.trim() || '—';
      const generatedAt = new Date();
      const dateLabel = generatedAt.toLocaleDateString();
      const timeLabel = generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFillColor(31, 60, 136);
      doc.rect(0, 0, pageWidth, 92, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('Session Agreement', 40, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text('Generated from the Sessions page', 40, 64);

      doc.setTextColor(20, 24, 33);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('Access Summary', 40, 126);

      const leftX = 40;
      const valueX = 190;
      let y = 154;

      const fields = [
        ['Full name', fullName],
        ['Email', email],
        ['Username', username],
        ['Initial password', password],
        ['Role', role],
        ['Department', department],
        ['Signature number', signatureNumber],
        ['Start date', startDate],
        ['End date', endDate],
      ] as const;

      doc.setFontSize(11);
      fields.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(88, 96, 114);
        doc.text(`${label}:`, leftX, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(20, 24, 33);
        const lines = doc.splitTextToSize(value || '—', pageWidth - valueX - 40);
        doc.text(lines, valueX, y);
        y += Math.max(18, lines.length * 14 + 4);
      });

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Contract Note', leftX, y);
      y += 18;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const note = [
        'The credentials above are issued by the company for the person identified in this document.',
        'The initial password should be changed after the first sign-in if your internal policy requires it.',
      ].join(' ');
      const noteLines = doc.splitTextToSize(note, pageWidth - 80);
      doc.text(noteLines, leftX, y);

      const signatureY = pageHeight - 124;
      doc.setDrawColor(146, 155, 171);
      doc.line(40, signatureY, 250, signatureY);
      doc.line(pageWidth - 250, signatureY, pageWidth - 40, signatureY);
      doc.setFontSize(10);
      doc.setTextColor(88, 96, 114);
      doc.text('User signature', 40, signatureY + 16);
      doc.text('Company representative', pageWidth - 250, signatureY + 16);
      doc.text(`Issued on ${dateLabel} at ${timeLabel}`, 40, pageHeight - 32);

      const filename = `session_${normalizeFilePart(username)}_${generatedAt.getTime()}.pdf`;
      const blob = doc.output('blob');
      const pdfFile = new File([blob], filename, { type: 'application/pdf' });

      try {
        await uploadPdfToHistory(pdfFile, 'sessions');
        toast.success('Session PDF created', { description: 'The document was generated and added to PDF History.' });
      } catch (err: any) {
        toast.warning('Session PDF created locally', {
          description: String(err?.message ?? err ?? 'The PDF could not be saved to history.'),
        });
      }

      doc.save(filename);
    } finally {
      setIsGeneratingPdf(false);
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
                <KeyRound className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="page-hero__badge">Accounts</span>
                </div>

                <h1 className="page-hero__title">
                  <span className="page-hero__title-stack">
                    <span className="page-hero__title-glow" aria-hidden>
                      Accounts & sessions
                    </span>
                    <span className="page-hero__title-text">Accounts & sessions</span>
                  </span>
                </h1>

                <div className="page-hero__underline" aria-hidden />
                <p className="page-hero__subtitle">Manage accounts and generate a PDF agreement with a clean, focused layout.</p>
              </div>
            </div>
          </div>

          <div className="page-hero__actions">
            <button
              type="button"
              onClick={() => navigate('/admin?tab=users')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1F3C88] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#163069]"
            >
              <ArrowRight className="h-4 w-4" />
              Open user administration
            </button>
          </div>
        </div>
      </div>

      <section className="premium-surface rounded-3xl p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-foreground">Create a PDF agreement</h2>
            <p className="mt-1 text-sm text-muted-foreground">Fill in the required details, then generate the document.</p>
          </div>
          <div className="rounded-full bg-muted/60 px-3 py-1 text-xs font-bold text-muted-foreground">
            Direct creation
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Full name</span>
              <input
                value={sessionForm.fullName}
                onChange={(e) => handleSessionFieldChange('fullName', e.target.value)}
                placeholder="John Doe"
                className="w-full rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Email</span>
              <input
                value={sessionForm.email}
                onChange={(e) => handleSessionFieldChange('email', e.target.value)}
                placeholder="john.doe@company.com"
                type="email"
                className="w-full rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Username</span>
              <input
                value={sessionForm.username}
                onChange={(e) => handleSessionFieldChange('username', e.target.value)}
                placeholder="jdoe"
                className="w-full rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Initial password</span>
              <input
                value={sessionForm.password}
                onChange={(e) => handleSessionFieldChange('password', e.target.value)}
                placeholder="Temporary password"
                type="text"
                className="w-full rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Role</span>
              <select
                value={sessionForm.role}
                onChange={(e) => handleSessionFieldChange('role', e.target.value)}
                className="w-full rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              >
                {['Reader', 'Technician', 'Manager', 'Admin'].map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Signature number</span>
              <input
                value={sessionForm.signatureNumber}
                onChange={(e) => handleSessionFieldChange('signatureNumber', e.target.value)}
                placeholder="100001"
                inputMode="numeric"
                className="w-full rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Start date</span>
              <input
                value={sessionForm.startDate}
                onChange={(e) => handleSessionFieldChange('startDate', e.target.value)}
                type="date"
                className="w-full rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-foreground">End date</span>
              <input
                value={sessionForm.endDate}
                onChange={(e) => handleSessionFieldChange('endDate', e.target.value)}
                type="date"
                className="w-full rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-foreground">Department / note</span>
              <textarea
                value={sessionForm.department}
                onChange={(e) => handleSessionFieldChange('department', e.target.value)}
                placeholder="IT, Finance, Operations..."
                rows={3}
                className="w-full rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleGenerateSessionPdf}
                disabled={isGeneratingPdf}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1F3C88] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#163069] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ArrowRight className="h-4 w-4" />
                {isGeneratingPdf ? 'Generating PDF…' : 'Generate session PDF'}
              </button>
              <span className="text-sm text-muted-foreground">
                The PDF will be created locally and added to PDF History.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="premium-surface rounded-3xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-foreground">Accounts</h2>
            <p className="mt-1 text-sm text-muted-foreground">Company account list.</p>
          </div>

          <div className="w-full max-w-sm">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search accounts..."
                className="w-full rounded-2xl border border-border/60 bg-card/70 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
        </div>

        <div className="mb-4 rounded-2xl bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
          {filteredAccounts.length} account(s) shown
        </div>

        {filteredAccounts.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filteredAccounts.map((account) => {
              return (
                <div key={account.id} className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm transition-transform hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-sm font-black text-primary ring-1 ring-primary/15">
                        {account.avatarUrl ? (
                          <img src={account.avatarUrl} alt={account.name} className="h-12 w-12 rounded-2xl object-cover" />
                        ) : (
                          account.initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-bold text-foreground">{account.name}</div>
                        <div className="truncate text-sm text-muted-foreground">{account.email}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-4 rounded-2xl bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => navigate('/admin?tab=users')}
                      className="inline-flex items-center gap-2 rounded-full bg-[#1F3C88] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#163069]"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Admin
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border/60 bg-muted/20 px-6 py-10 text-center">
            <User className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-bold text-foreground">No results</h3>
            <p className="mt-2 text-sm text-muted-foreground">Try adjusting your search.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export { SessionsPage as AccountsPage };
