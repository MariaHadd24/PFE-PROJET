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
      "Combien d'assets sont disponibles / assignés / en réparation ?",
      'Comment importer un fichier Excel dans le stock ?',
      'Je veux ajouter un nouvel asset',
      'Créer une nouvelle affectation (assignment)',
      'Créer un ticket de maintenance',
      'Où voir les logs (audit) et le reporting ?'
    ],
    [],
  );

  const greeting = useMemo(() => {
    const name = String(user?.name ?? '').trim();
    const who = name ? ` ${name}` : '';
    return `Salut${who} ! Je suis l’assistant du site. Je réponds uniquement aux questions liées aux fonctionnalités de cette application (Stock, Assignments, Orders PR/PO, Maintenance, Admin, Audit Logs, Vendor Portal, Reporting). Pose-moi une question ou clique une suggestion.`;
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
        text: 'Écris une question (ex: “import excel”, “ticket maintenance”, “nouvel asset”…).',
      };
    }

    if (includesAny(q, ['bonjour', 'salut', 'hello', 'hi'])) {
      return {
        text: `Bonjour ! Je peux t’aider sur le stock, les affectations, les tickets maintenance, et les achats (PR/PO).`,
      };
    }

    if (includesAny(q, ['aide', 'help', 'menu', 'fonctionnalite', 'fonctionnalites', 'que peux-tu faire', 'quoi faire'])) {
      return {
        text:
          'Voici les parties disponibles dans ce site :\n' +
          '- Assets IT (import/export Excel, scan QR, gestion colonnes/vues)\n' +
          '- Assignments (affectations)\n' +
          '- Orders (Achats / Commandes: PR & PO)\n' +
          '- Maintenance (tickets)\n' +
          '- Administration (users, sites, categories, suppliers, departments)\n' +
          '- Audit Logs\n' +
          '- Vendor Portal\n' +
          '- Reporting',
        actions: [
          { label: 'Assets IT', link: '/stock-inventory' },
          { label: 'Assignments', link: '/assignments' },
          { label: 'Orders (Achats)', link: '/orders' },
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
          text: `Stock (assets): Disponible ${available} • Assigné ${assigned} • En réparation ${inRepair} • Retiré ${retired}.`,
          actions: [{ label: 'Ouvrir Assets IT', link: '/stock-inventory' }],
        };
      }
      if (includesAny(q, ['ticket', 'maintenance'])) {
        return {
          text: `Maintenance: ${openTickets} ticket(s) ouverts/en cours.`,
          actions: [{ label: 'Ouvrir Maintenance', link: '/maintenance' }],
        };
      }
      if (includesAny(q, ['assignment', 'affect', 'affectation'])) {
        return {
          text: `Assignments: ${activeAssignments} affectation(s) active(s).`,
          actions: [{ label: 'Ouvrir Assignments', link: '/assignments' }],
        };
      }
      if (includesAny(q, ['order', 'achat', 'pr', 'po', 'purchase'])) {
        return {
          text: `Orders: PR en attente ${prPending} • PO en statut Ordered ${poOrdered}.`,
          actions: [{ label: 'Ouvrir Orders', link: '/orders' }],
        };
      }
    }

    if (includesAny(q, ['achat', 'achats', 'commande', 'commandes', 'orders', 'order', 'purchase', 'procurement'])) {
      return {
        text:
          'Pour les achats/commandes: ouvre “Orders”.\n' +
          '- PR (Purchase Request): onglet “Purchase Requests” → bouton “New PR”\n' +
          '- PO (Purchase Order): onglet “Purchase Orders” → bouton “New PO”',
        actions: [{ label: 'Aller à Orders (Achats)', link: '/orders' }],
      };
    }

    if (includesAny(q, ['import', 'excel', 'xlsx', 'xls'])) {
      return {
        text: 'Pour importer Excel: va dans “Assets IT” puis clique “Import Excel” (bouton en haut à droite). Le fichier doit être .xlsx/.xls.',
        actions: [{ label: 'Aller à Assets IT', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['scan', 'qr', 'barcode', 'code barre', 'codebarre'])) {
      return {
        text: 'Pour scanner: va dans “Assets IT” puis clique “Scan QR” (bouton en haut à droite).',
        actions: [{ label: 'Aller à Assets IT', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['seuil', 'threshold', 'stock bas', 'low stock'])) {
      return {
        text: 'Les seuils “stock bas” se configurent depuis “Assets IT” → bouton “Configure thresholds” (dans l’encart stock bas).',
        actions: [{ label: 'Aller à Assets IT', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['colonne', 'colonnes', 'vue', 'vues', 'view', 'views'])) {
      return {
        text: 'Dans “Assets IT”, tu peux personnaliser les colonnes et enregistrer des vues (boutons de configuration en haut de la page).',
        actions: [{ label: 'Aller à Assets IT', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['export', 'telecharger', 'download'])) {
      return {
        text: 'Pour exporter le stock: “Assets IT” → bouton “Export Excel” en haut à droite.',
        actions: [{ label: 'Aller à Assets IT', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['nouvel asset', 'ajouter asset', 'add asset', 'new asset', 'asset'])) {
      return {
        text: 'Pour ajouter un asset: “Assets IT” → bouton “Add New Asset” (en haut à droite) puis remplis le formulaire.',
        actions: [{ label: 'Aller à Assets IT', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['assignment', 'affectation', 'assigner', 'assign'])) {
      return {
        text: 'Pour créer une affectation: “Assignments” → bouton “New assignment” puis sélectionne l’asset/utilisateur/département/site.',
        actions: [{ label: 'Aller à Assignments', link: '/assignments' }],
      };
    }

    if (includesAny(q, ['maintenance', 'ticket', 'repair', 'reparation'])) {
      return {
        text: 'Pour ouvrir un ticket: “Maintenance” → bouton “New ticket”. Règle métier: quand le ticket est Open/InProgress, l’asset passe automatiquement à “InRepair”.',
        actions: [{ label: 'Aller à Maintenance', link: '/maintenance' }],
      };
    }

    if (includesAny(q, ['pr', 'purchase request', 'demande achat'])) {
      return {
        text: 'Pour créer une PR: “Orders” → onglet “Purchase Requests” → bouton “New PR”.',
        actions: [{ label: 'Aller à Orders', link: '/orders' }],
      };
    }

    if (includesAny(q, ['po', 'purchase order', 'bon de commande'])) {
      return {
        text: 'Pour créer un PO: “Orders” → onglet “Purchase Orders” → bouton “New PO”.',
        actions: [{ label: 'Aller à Orders', link: '/orders' }],
      };
    }

    if (includesAny(q, ['admin', 'utilisateur', 'users', 'sites', 'categories', 'suppliers', 'departments'])) {
      return {
        text: 'Administration: gère Users, Sites, Categories, Suppliers, Departments depuis la page “Administration”.',
        actions: [{ label: 'Aller à Administration', link: '/admin' }],
      };
    }

    if (includesAny(q, ['audit', 'logs', 'journal'])) {
      return {
        text: 'Les actions système sont visibles dans “Audit Logs”.',
        actions: [{ label: 'Ouvrir Audit Logs', link: '/audit-logs' }],
      };
    }

    if (includesAny(q, ['report', 'reporting', 'rapport'])) {
      return {
        text: 'Les rapports et indicateurs se trouvent dans “Reporting”.',
        actions: [{ label: 'Ouvrir Reporting', link: '/reporting' }],
      };
    }

    if (includesAny(q, ['vendor', 'fournisseur', 'portal'])) {
      return {
        text: 'Le répertoire fournisseurs / portail est dans “Vendor Portal”.',
        actions: [{ label: 'Ouvrir Vendor Portal', link: '/vendor-portal' }],
      };
    }

    if (includesAny(q, ['rechercher', 'search', 'trouver'])) {
      return {
        text: 'Tu peux rechercher rapidement: Ctrl+K (palette de recherche) ou utilise la barre de recherche dans Assets IT.',
        actions: [
          { label: 'Ouvrir Assets IT', link: '/stock-inventory' },
          { label: 'Ouvrir Dashboard', link: '/dashboard' },
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
          text: String(res?.text ?? '').trim() || 'Je peux aider uniquement sur les fonctionnalités du site.',
          actions: Array.isArray(res?.actions) ? res.actions : undefined,
        });
      } catch (err) {
        console.warn('Chatbot LLM call failed:', err);
        const elapsed = Date.now() - startedAt;
        const remaining = delayMs - elapsed;
        if (remaining > 0) await sleep(remaining);
        replaceTypingWithAssistant(typingId, {
          text:
            'Je ne peux pas répondre à ça pour le moment (LLM indisponible). Je peux quand même aider sur les modules du site; pour les questions générales, démarre Ollama puis réessaie.',
          actions: [
            { label: 'Menu (Aide)', link: '/dashboard' },
            { label: 'Orders (Achats)', link: '/orders' },
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
                placeholder="Écris ta question…"
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
