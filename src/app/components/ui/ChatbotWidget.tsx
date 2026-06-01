import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Send, X, Bot, User as UserIcon, MessageSquare, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { chatAssistant, type ChatHistoryItem } from '../../data/api';
import { cn } from './utils';
import { motion, AnimatePresence } from 'motion/react';

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
  return 2000 + Math.floor(Math.random() * 1500);
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

function isSiteRelatedQuestion(normalized: string) {
  return includesAny(normalized, [
    'site', 'app', 'application', 'module', 'menu', 'page', 'dashboard',
    'asset', 'assets', 'stock', 'inventaire', 'inventory', 'available', 'assigned', 'inrepair', 'retired',
    'import', 'excel', 'xlsx', 'xls', 'export', 'qr', 'scan', 'barcode', 'threshold', 'low stock',
    'assignment', 'assignments', 'assign', 'affectation', 'affecter',
    'order', 'orders', 'achat', 'achats', 'purchase', 'procurement',
    'bon de commande', 'bc', 'bl',
    'maintenance', 'ticket', 'tickets', 'repair', 'reparation',
    'admin', 'administration', 'utilisateur', 'users', 'sites', 'categories', 'suppliers', 'departments',
    'audit', 'logs', 'journal',
    'vendor', 'fournisseur', 'portal', 'report', 'reporting', 'rapport',
  ]);
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
  } = useData();

  const suggestedQuestions = useMemo(
    () => [
      'Statistiques du stock ?',
      'Comment importer un fichier Excel ?',
      'Ajouter un nouvel asset',
      'Créer une affectation',
      'Ouvrir un ticket de maintenance',
      'Où sont les rapports ?'
    ],
    [],
  );

  const greeting = useMemo(() => {
    const name = String(user?.name ?? '').trim();
    const who = name ? ` ${name}` : '';
    return `Bonjour${who}! Je suis votre assistant. Je peux répondre à vos questions sur le Stock, les Affectations, les Commandes, la Maintenance, et le Reporting. Posez-moi une question ou utilisez les suggestions ci-dessous.`;
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
  }, [isOpen, messages]);

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

    if (!q) {
      return {
        text: 'Tapez une question (ex: "import excel", "ticket maintenance", "nouvel asset"...).',
      };
    }

    if (!isSiteRelatedQuestion(q) && !includesAny(q, ['bonjour', 'salut', 'hello', 'hi'])) {
      return {
        text:
          'Désolé, je ne peux répondre qu\'aux questions concernant cette application (Stock, Affectations, Commandes, Maintenance, Administration, Audit, Reporting).',
        actions: [
          { label: 'Tableau de bord', link: '/dashboard' },
          { label: 'Stock IT', link: '/stock-inventory' },
          { label: 'Commandes', link: '/orders' },
          { label: 'Maintenance', link: '/maintenance' },
        ],
      };
    }

    if (includesAny(q, ['bonjour', 'salut', 'hello', 'hi'])) {
      return {
        text: `Bonjour ! Comment puis-je vous aider avec le stock, les affectations ou les commandes aujourd'hui ?`,
      };
    }

    if (includesAny(q, ['aide', 'help', 'menu', 'fonctionnalite', 'fonctionnalites', 'que peux-tu faire', 'quoi faire'])) {
      return {
        text:
          'Voici ce que je peux faire :\n' +
          '- Analyser le Stock IT (imports, scans, seuils)\n' +
          '- Suivre les Affectations\n' +
          '- Gérer les Commandes (BC/BL)\n' +
          '- Gérer la Maintenance (tickets)\n' +
          '- Consulter le Reporting et l\'Audit',
        actions: [
          { label: 'Stock IT', link: '/stock-inventory' },
          { label: 'Affectations', link: '/assignments' },
          { label: 'Commandes', link: '/orders' },
          { label: 'Maintenance', link: '/maintenance' },
          { label: 'Reporting', link: '/reporting' },
        ],
      };
    }

    if (includesAny(q, ['combien', 'stats', 'kpi', 'etat', 'status', 'statistique', 'statistiques'])) {
      if (includesAny(q, ['asset', 'stock', 'inventaire', 'inventory'])) {
        return {
          text: `État du stock :\n• Disponible : ${available}\n• Affecté : ${assigned}\n• En réparation : ${inRepair}\n• Retiré : ${retired}.`,
          actions: [{ label: 'Voir le Stock', link: '/stock-inventory' }],
        };
      }
      if (includesAny(q, ['ticket', 'maintenance'])) {
        return {
          text: `Maintenance : ${openTickets} ticket(s) en cours.`,
          actions: [{ label: 'Voir la Maintenance', link: '/maintenance' }],
        };
      }
      if (includesAny(q, ['assignment', 'affect', 'affectation'])) {
        return {
          text: `Affectations : ${activeAssignments} affectation(s) active(s).`,
          actions: [{ label: 'Voir les Affectations', link: '/assignments' }],
        };
      }
    }

    if (includesAny(q, ['achat', 'achats', 'commande', 'commandes', 'orders', 'order', 'purchase', 'procurement'])) {
      return {
        text:
          'Pour les achats : ouvrez le module "Commandes" pour créer et suivre vos BC/BL.',
        actions: [{ label: 'Aller aux Commandes', link: '/orders' }],
      };
    }

    if (includesAny(q, ['import', 'excel', 'xlsx', 'xls'])) {
      return {
        text: 'Pour importer un Excel : allez dans "Stock IT" puis cliquez sur "Import Excel" en haut à droite.',
        actions: [{ label: 'Aller au Stock', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['scan', 'qr', 'barcode', 'code barre', 'codebarre'])) {
      return {
        text: 'Pour scanner un asset : utilisez le bouton "Scan QR" dans le module Stock IT.',
        actions: [{ label: 'Aller au Stock', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['nouvel asset', 'ajouter asset', 'add asset', 'new asset', 'asset'])) {
      return {
        text: 'Pour ajouter un asset : Stock IT → bouton "Add New Asset".',
        actions: [{ label: 'Aller au Stock', link: '/stock-inventory' }],
      };
    }

    if (includesAny(q, ['report', 'reporting', 'rapport'])) {
      return {
        text: 'Les rapports et indicateurs clés (KPI) sont disponibles dans le module "Reporting".',
        actions: [{ label: 'Ouvrir Reporting', link: '/reporting' }],
      };
    }

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
        const message =
          'You are a site assistant for an internal web application. Only answer questions about the site features and navigation. Be concise and professional.\n\nUser question: ' +
          trimmed;
        const res = await chatAssistant({ message, history });
        const elapsed = Date.now() - startedAt;
        const remaining = delayMs - elapsed;
        if (remaining > 0) await sleep(remaining);
        replaceTypingWithAssistant(typingId, {
          text: String(res?.text ?? '').trim() || 'Je peux vous aider avec les fonctionnalités du site.',
          actions: Array.isArray(res?.actions) ? res.actions : undefined,
        });
      } catch (err) {
        const elapsed = Date.now() - startedAt;
        const remaining = delayMs - elapsed;
        if (remaining > 0) await sleep(remaining);
        replaceTypingWithAssistant(typingId, {
          text:
            'Je ne peux pas répondre pour le moment (IA indisponible), mais je peux vous guider vers les modules principaux.',
          actions: [
            { label: 'Stock IT', link: '/stock-inventory' },
            { label: 'Commandes', link: '/orders' },
            { label: 'Maintenance', link: '/maintenance' },
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
    <div className="fixed bottom-6 right-6 z-[90]" ref={panelRef}>
      {/* Toggle button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative group flex items-center justify-center transition-all duration-500",
          isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
        )}
        whileHover={{ scale: 1.1, y: -5 }}
        whileTap={{ scale: 0.9 }}
      >
        <div className="absolute -inset-4 bg-gradient-to-r from-primary/40 to-cyan-400/30 rounded-full blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-500" />
        <div className="relative h-16 w-16 rounded-full p-0.5 bg-gradient-to-br from-white/20 via-primary/20 to-cyan-400/20 shadow-2xl backdrop-blur-md border border-white/30 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-white/10" />
          <img
            src={assistantIconUrl}
            alt="Assistant"
            className="h-full w-full object-cover select-none relative z-10"
            draggable={false}
          />
        </div>
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          className="absolute -top-1 -right-1 h-5 w-5 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg"
        >
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </motion.div>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="panel-frame absolute bottom-0 right-0 w-[420px] max-w-[calc(100vw-3rem)] bg-card/95 dark:bg-card/80 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] rounded-3xl z-50 overflow-hidden border border-border/60"
          >
            {/* Header */}
            <div className="p-5 border-b border-border/50 bg-gradient-to-br from-primary/20 via-cyan-400/10 to-transparent relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.15),transparent_70%)] pointer-events-none" />
              
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-cyan-500 p-0.5 shadow-lg group">
                      <div className="h-full w-full rounded-[14px] bg-card flex items-center justify-center overflow-hidden">
                        <img src={assistantIconUrl} alt="AI" className="h-full w-full object-cover" />
                      </div>
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-2 border-card shadow-sm animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg tracking-tight text-foreground flex items-center gap-2">
                      Assistant IA
                      <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] uppercase tracking-widest font-black border border-primary/20">Pro</span>
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-primary/40" />
                        <span className="w-1 h-1 rounded-full bg-primary/40" />
                        <span className="w-1 h-1 rounded-full bg-primary/40" />
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wide">Support Intelligent</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all text-muted-foreground hover:text-foreground hover:rotate-90 duration-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="h-[450px] overflow-y-auto p-5 space-y-5 sidebar-scroll bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.03),transparent_70%)]">
              {messages.map((m) => (
                <motion.div 
                  initial={{ opacity: 0, x: m.role === 'user' ? 10 : -10, y: 5 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  key={m.id} 
                  className={cn('flex items-end gap-2.5', m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                >
                  <div className={cn(
                    "flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center border shadow-sm",
                    m.role === 'user' ? "bg-card border-border text-primary" : "bg-gradient-to-br from-primary to-cyan-500 border-transparent text-white"
                  )}>
                    {m.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed shadow-sm border relative group/msg transition-all duration-300',
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600 to-primary text-white border-transparent rounded-br-none'
                      : 'bg-card/50 dark:bg-muted/30 text-foreground border-border/60 rounded-bl-none backdrop-blur-md',
                  )}>
                    <div className="whitespace-pre-wrap font-medium">{m.text}</div>
                    
                    {m.role === 'assistant' && m.actions && m.actions.length > 0 && (
                      <div className="mt-3.5 flex flex-wrap gap-2 pt-3.5 border-t border-border/40">
                        {m.actions.map((a) => (
                          <button
                            key={a.link + a.label}
                            type="button"
                            onClick={() => navigate(a.link)}
                            className="chip-industrial px-3 py-1.5 rounded-lg text-xs font-bold text-primary hover:text-cyan-600 transition-all flex items-center gap-1.5 group/btn"
                          >
                            {a.label}
                            <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className={cn(
                      "absolute bottom-[-18px] text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 opacity-0 group-hover/msg:opacity-100 transition-opacity",
                      m.role === 'user' ? "right-0" : "left-0"
                    )}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Suggested questions */}
              <AnimatePresence>
                {suggestionsVisible && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="pt-4"
                  >
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Suggestions</span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestedQuestions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            setSuggestionsVisible(false);
                            send(q);
                          }}
                          className="px-4 py-2 rounded-xl text-[11px] font-bold border border-border/60 bg-card hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input */}
            <form onSubmit={onSubmit} className="p-4 border-t border-border/50 bg-card/50 dark:bg-muted/10">
              <div className="relative group/input">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-cyan-400/20 rounded-2xl blur opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center gap-2 bg-card border border-border/80 rounded-2xl p-1.5 shadow-sm group-focus-within/input:border-primary/50 transition-all">
                  <div className="pl-2.5 text-muted-foreground/50">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onFocus={() => setSuggestionsVisible(true)}
                    placeholder="Posez votre question..."
                    className="flex-1 bg-transparent border-none text-foreground text-[13px] font-medium outline-none placeholder:text-muted-foreground/40 placeholder:font-normal h-9"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-cyan-600 text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-105 disabled:opacity-30 disabled:grayscale disabled:scale-100 transition-all duration-300"
                    aria-label="Envoyer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

