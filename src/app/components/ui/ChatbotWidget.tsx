import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Send, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { chatAssistant, type ChatHistoryItem } from '../../data/api';
import { cn } from './utils';

type ChatAction = {
  label: string;
  link: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actions?: ChatAction[];
  createdAt: number;
  isTyping?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function humanDelayMs() {
  // Looks like a human is typing: 3–5 seconds.
  return 3000 + Math.floor(Math.random() * 2000);
}

function stripDiacritics(input: string) {
  return input.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function normalizeText(input: string) {
  return stripDiacritics(String(input ?? '')).trim().toLowerCase();
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((n) => haystack.includes(n));
}

export function ChatbotWidget() {
  const assistantIconUrl = '/chatbot-icon.png';
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const {
    assets,
    assignments,
    maintenanceTickets,
    purchaseRequests,
    purchaseOrders,
  } = useData();

  const suggestedQuestions = useMemo(
    () => [
      'How many assets are available / assigned / in repair?',
      'How do I import an Excel file into stock?',
      'I want to add a new asset',
      'Create a new assignment',
      'Create a maintenance ticket',
      'Where can I see audit logs and reporting?'
    ],
    [],
  );

  const greeting = useMemo(() => {
    const name = String(user?.name ?? '').trim();
    const who = name ? ` ${name}` : '';
    return `Hi${who}! I’m the site assistant. I can only answer questions related to this application’s features (Stock, Assignments, Orders PR/PO, Maintenance, Admin, Audit Logs, Vendor Portal, Reporting). Ask a question or click a suggestion.`;
  }, [user?.name]);

  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: greeting,
        createdAt: Date.now(),
      },
    ]);
  }, [greeting]);

  useEffect(() => {
    if (!isOpen) {
      setSuggestionsVisible(false);
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [isOpen, messages.length]);

  const pushAssistant = (payload: Omit<ChatMessage, 'id' | 'createdAt' | 'role'> & Partial<Pick<ChatMessage, 'actions'>>) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `a:${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role: 'assistant',
        createdAt: Date.now(),
        text: payload.text,
        actions: payload.actions,
      },
    ]);
  };

  const pushAssistantTyping = () => {
    const id = `t:${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setMessages((prev) => [
      ...prev,
      {
        id,
        role: 'assistant',
        createdAt: Date.now(),
        text: '…',
        isTyping: true,
      },
    ]);
    return id;
  };

  const replaceTypingWithAssistant = (typingId: string, payload: { text: string; actions?: ChatAction[] }) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === typingId
          ? {
              ...m,
              isTyping: false,
              text: payload.text,
              actions: payload.actions,
              createdAt: Date.now(),
            }
          : m,
      ),
    );
  };

  const buildHistoryForLlm = (): ChatHistoryItem[] => {
    // Keep the last few turns, skip the initial welcome.
    const slice = messages.filter((m) => m.id !== 'welcome' && !m.isTyping).slice(-10);
    return slice.map((m) => ({ role: m.role, text: m.text }));
  };

  const buildResponse = (raw: string): ({ text: string; actions?: ChatAction[] } | null) => {
    const q = normalizeText(raw);

    const available = assets.filter((a) => a.status === 'Available').length;
    const assigned = assets.filter((a) => a.status === 'Assigned').length;
    const inRepair = assets.filter((a) => a.status === 'InRepair').length;
    const retired = assets.filter((a) => a.status === 'Retired').length;

    const openTickets = maintenanceTickets.filter((t) => t.status === 'Open' || t.status === 'InProgress').length;
    const activeAssignments = assignments.filter((a) => (a.status ?? 'Active') === 'Active').length;
    const prPending = purchaseRequests.filter((pr) => pr.status === 'Pending').length;
    const poOrdered = purchaseOrders.filter((po) => po.status === 'Ordered').length;

    if (!q) {
      return {
        text: 'Type a question (e.g. “import excel”, “maintenance ticket”, “new asset”…).',
      };
    }

    if (includesAny(q, ['bonjour', 'salut', 'hello', 'hi'])) {
      return {
        text: `Hi! I can help with stock, assignments, maintenance tickets, and purchasing (PR/PO).`,
      };
    }

    if (includesAny(q, ['aide', 'help', 'menu', 'fonctionnalite', 'fonctionnalites', 'que peux-tu faire', 'quoi faire'])) {
      return {
        text:
          'Here are the available modules in this site:\n' +
          '- Assets IT (Excel import/export, QR scan, columns/views)\n' +
          '- Assignments\n' +
          '- Orders (PR & PO)\n' +
          '- Maintenance (tickets)\n' +
          '- Administration (users, sites, categories, suppliers, departments)\n' +
          '- Audit Logs\n' +
          '- Vendor Portal\n' +
          '- Reporting',
        actions: [
          { label: 'Assets IT', link: '/stock-inventory' },
          { label: 'Assignments', link: '/assignments' },
          { label: 'Orders', link: '/orders' },
          { label: 'Maintenance', link: '/maintenance' },
          { label: 'Administration', link: '/admin' },
          { label: 'Audit Logs', link: '/audit-logs' },
          { label: 'Vendor Portal', link: '/vendor-portal' },
          { label: 'Reporting', link: '/reporting' },
        ],
      };
    }

    if (includesAny(q, ['combien', 'stats', 'kpi', 'etat', 'status'])) {
      if (includesAny(q, ['asset', 'stock', 'inventaire', 'inventory'])) {
        return {
          text: `Stock (assets): Available ${available} • Assigned ${assigned} • In repair ${inRepair} • Retired ${retired}.`,
          actions: [{ label: 'Open Assets IT', link: '/stock-inventory' }],
        };
      }
      if (includesAny(q, ['ticket', 'maintenance'])) {
        return {
          text: `Maintenance: ${openTickets} ticket(s) open / in progress.`,
          actions: [{ label: 'Open Maintenance', link: '/maintenance' }],
        };
      }
      if (includesAny(q, ['assignment', 'affect', 'affectation'])) {
        return {
          text: `Assignments: ${activeAssignments} active assignment(s).`,
          actions: [{ label: 'Open Assignments', link: '/assignments' }],
        };
      }
      if (includesAny(q, ['order', 'achat', 'pr', 'po', 'purchase'])) {
        return {
          text: `Orders: PR pending ${prPending} • PO with status Ordered ${poOrdered}.`,
          actions: [{ label: 'Open Orders', link: '/orders' }],
        };
      }
    }

    if (includesAny(q, ['achat', 'achats', 'commande', 'commandes', 'orders', 'order', 'purchase', 'procurement'])) {
      return {
        text:
          'For purchasing: open “Orders”.\n' +
          '- PR (Purchase Request): “Purchase Requests” tab → “New PR”\n' +
          '- PO (Purchase Order): “Purchase Orders” tab → “New PO”',
        actions: [{ label: 'Go to Orders', link: '/orders' }],
      };
    }

    if (includesAny(q, ['import', 'excel', 'xlsx', 'xls'])) {
      return {
        text: 'To import Excel: go to “Assets IT” then click “Import Excel” (top right). The file must be .xlsx/.xls.',
        actions: [{ label: 'Go to Assets IT', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['scan', 'qr', 'barcode', 'code barre', 'codebarre'])) {
      return {
        text: 'To scan: go to “Assets IT” then click “Scan QR” (top right).',
        actions: [{ label: 'Go to Assets IT', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['seuil', 'threshold', 'stock bas', 'low stock'])) {
      return {
        text: 'Low stock thresholds can be configured from “Assets IT” → “Configure thresholds” (in the low stock panel).',
        actions: [{ label: 'Go to Assets IT', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['colonne', 'colonnes', 'vue', 'vues', 'view', 'views'])) {
      return {
        text: 'In “Assets IT”, you can customize columns and save views (configuration buttons at the top of the page).',
        actions: [{ label: 'Go to Assets IT', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['export', 'telecharger', 'download'])) {
      return {
        text: 'To export stock: “Assets IT” → “Export Excel” button (top right).',
        actions: [{ label: 'Go to Assets IT', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['nouvel asset', 'ajouter asset', 'add asset', 'new asset', 'asset'])) {
      return {
        text: 'To add an asset: “Assets IT” → “Add New Asset” button (top right), then fill the form.',
        actions: [{ label: 'Go to Assets IT', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['assignment', 'affectation', 'assigner', 'assign'])) {
      return {
        text: 'To create an assignment: “Assignments” → “New assignment”, then select the asset/user/department/site.',
        actions: [{ label: 'Go to Assignments', link: '/assignments' }],
      };
    }

    if (includesAny(q, ['maintenance', 'ticket', 'repair', 'reparation'])) {
      return {
        text: 'To open a ticket: “Maintenance” → “New ticket”. Business rule: when a ticket is Open/InProgress, the asset automatically switches to “InRepair”.',
        actions: [{ label: 'Go to Maintenance', link: '/maintenance' }],
      };
    }

    if (includesAny(q, ['pr', 'purchase request', 'demande achat'])) {
      return {
        text: 'To create a PR: “Orders” → “Purchase Requests” tab → “New PR”.',
        actions: [{ label: 'Go to Orders', link: '/orders' }],
      };
    }

    if (includesAny(q, ['po', 'purchase order', 'bon de commande'])) {
      return {
        text: 'To create a PO: “Orders” → “Purchase Orders” tab → “New PO”.',
        actions: [{ label: 'Go to Orders', link: '/orders' }],
      };
    }

    if (includesAny(q, ['admin', 'utilisateur', 'users', 'sites', 'categories', 'suppliers', 'departments'])) {
      return {
        text: 'Administration: manage Users, Sites, Categories, Suppliers, and Departments from the “Administration” page.',
        actions: [{ label: 'Go to Administration', link: '/admin' }],
      };
    }

    if (includesAny(q, ['audit', 'logs', 'journal'])) {
      return {
        text: 'System actions are visible in “Audit Logs”.',
        actions: [{ label: 'Open Audit Logs', link: '/audit-logs' }],
      };
    }

    if (includesAny(q, ['report', 'reporting', 'rapport'])) {
      return {
        text: 'Reports and KPIs are available in “Reporting”.',
        actions: [{ label: 'Open Reporting', link: '/reporting' }],
      };
    }

    if (includesAny(q, ['vendor', 'fournisseur', 'portal'])) {
      return {
        text: 'The supplier directory / portal is in “Vendor Portal”.',
        actions: [{ label: 'Open Vendor Portal', link: '/vendor-portal' }],
      };
    }

    if (includesAny(q, ['rechercher', 'search', 'trouver'])) {
      return {
        text: 'You can search quickly: Ctrl+K (search palette), or use the search bar in Assets IT.',
        actions: [
          { label: 'Open Assets IT', link: '/stock-inventory' },
          { label: 'Open Dashboard', link: '/dashboard' },
        ],
      };
    }

    // Unknown: let the LLM try, still constrained to site capabilities.
    return null;
  };

  const send = (text: string) => {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return;

    setSuggestionsVisible(false);

    const startedAt = Date.now();
    const delayMs = humanDelayMs();

    setMessages((prev) => [
      ...prev,
      {
        id: `u:${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role: 'user',
        text: trimmed,
        createdAt: Date.now(),
      },
    ]);

    const typingId = pushAssistantTyping();

    const local = buildResponse(trimmed);
    if (local) {
      void (async () => {
        const elapsed = Date.now() - startedAt;
        const remaining = delayMs - elapsed;
        if (remaining > 0) await sleep(remaining);
        replaceTypingWithAssistant(typingId, local);
      })();
      return;
    }

    void (async () => {
      try {
        const history = buildHistoryForLlm();
        const res = await chatAssistant({ message: trimmed, history });
        const elapsed = Date.now() - startedAt;
        const remaining = delayMs - elapsed;
        if (remaining > 0) await sleep(remaining);
        replaceTypingWithAssistant(typingId, {
          text: String(res?.text ?? '').trim() || 'I can only help with the site features.',
          actions: Array.isArray(res?.actions) ? res.actions : undefined,
        });
      } catch (err) {
        console.warn('Chatbot LLM call failed:', err);
        const elapsed = Date.now() - startedAt;
        const remaining = delayMs - elapsed;
        if (remaining > 0) await sleep(remaining);
        replaceTypingWithAssistant(typingId, {
          text:
            'I can’t answer right now (LLM unavailable). I can still help with the site modules; for general questions, start Ollama and try again.',
          actions: [
            { label: 'Help menu', link: '/dashboard' },
            { label: 'Orders', link: '/orders' },
            { label: 'Assets IT', link: '/stock-inventory' },
          ],
        });
      }
    })();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = draft;
    setDraft('');
    send(t);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={panelRef}>
      {/* Toggle button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="p-0 bg-transparent shadow-none hover:opacity-90 transition-opacity flex items-center justify-center"
          aria-label="Open assistant"
        >
          <img
            src={assistantIconUrl}
            alt="Assistant"
            className="h-14 w-14 select-none"
            draggable={false}
          />
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="w-[380px] max-w-[calc(100vw-3rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
                  A
                </div>
                <div>
                  <div className="font-bold leading-tight">Assistant PFE</div>
                  <div className="text-xs text-white/80">Stock • Assignments • Orders • Maintenance</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close assistant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={listRef} className="max-h-[420px] overflow-y-auto p-4 space-y-3 bg-gray-50/60 dark:bg-gray-950/30">
            {messages.map((m) => (
              <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm border',
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-transparent'
                      : 'bg-blue-50 dark:bg-blue-950/30 text-gray-900 dark:text-gray-100 border-blue-200 dark:border-blue-900/40',
                  )}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  {m.role === 'assistant' && m.actions && m.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.actions.map((a) => (
                        <button
                          key={a.link + a.label}
                          type="button"
                          onClick={() => navigate(a.link)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Suggested questions */}
            {suggestionsVisible && (
              <div className="pt-1">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Suggestions</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setSuggestionsVisible(false);
                        send(q);
                      }}
                      className="px-3 py-1.5 rounded-full text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={onSubmit} className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => setSuggestionsVisible(true)}
                placeholder="Type your question…"
                className="flex-1 h-10 px-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="submit"
                className="h-10 w-10 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground flex items-center justify-center hover:shadow-lg transition-shadow"
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
