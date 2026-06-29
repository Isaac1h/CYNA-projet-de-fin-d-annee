'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Bot, LifeBuoy, MessageCircle, Send, User, X } from 'lucide-react';
import { FAQ, SUGGESTED_IDS, type FaqEntry } from '@/data/faq';
import { matchFaq } from '@/lib/faq-matcher';

/**
 * Floating FAQ chat widget.
 *
 * - Bouton rond fixe bas-gauche, présent sur toutes les pages publiques.
 *   Caché sous /admin (le back-office a son propre flux support).
 * - Au clic → ouvre un overlay/dialog (pas une route).
 * - 100% statique : FAQ scriptée dans `src/data/faq.ts`, matching
 *   simple par intersection de mots-clés (`src/lib/faq-matcher.ts`).
 *   PAS d'IA, PAS d'appel réseau, PAS de clé API.
 * - Accessibilité :
 *     trigger : aria-label + aria-expanded
 *     dialog  : role="dialog" aria-modal + aria-labelledby
 *     ESC ferme, focus rappelé au trigger à la fermeture
 *     input  : <label sr-only>, log de messages en aria-live=polite
 * - Mobile : prend toute la largeur sous 640px, max-w-md au-delà.
 *
 * Si aucune entrée FAQ ne correspond avec une confiance suffisante,
 * le bot ne hallucine PAS : il propose explicitement d'escalader vers
 * la page de contact existante (/tools).
 */

const HIDDEN_PATH_PREFIXES: ReadonlyArray<string> = ['/admin'];
const ESCALATION_HREF = '/tools';

type ChatMessage =
  | { id: string; role: 'user'; kind: 'text'; content: string }
  | { id: string; role: 'bot'; kind: 'text'; content: string }
  | { id: string; role: 'bot'; kind: 'escalation'; content: string };

let __counter = 0;
const newId = (role: 'user' | 'bot') =>
  `${role}-${Date.now().toString(36)}-${(++__counter).toString(36)}`;

// NOTE i18n LOT 1 : la UI du widget est traduite (title, boutons, greeting,
// escalation). Le contenu de la FAQ (questions + réponses dans src/data/faq.ts)
// reste FR pour l'instant — la traduction du corpus FAQ est un lot à part
// (contenu métier avec matching keyword-based FR).
const greeting = (content: string): ChatMessage => ({
  id: newId('bot'),
  role: 'bot',
  kind: 'text',
  content,
});

const escalationMessage = (content: string): ChatMessage => ({
  id: newId('bot'),
  role: 'bot',
  kind: 'escalation',
  content,
});

export default function ChatbotWidget() {
  const t = useTranslations('chatbot');
  const pathname = usePathname() ?? '/';
  const hidden = HIDDEN_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLOListElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const suggestions = useMemo<FaqEntry[]>(
    () => SUGGESTED_IDS.map((id) => FAQ.find((f) => f.id === id)).filter(
      (e): e is FaqEntry => Boolean(e),
    ),
    [],
  );

  const close = useCallback(() => setOpen(false), []);

  // Open: snapshot focus, seed greeting once, focus the input.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    setMessages((prev) => (prev.length === 0 ? [greeting(t('greeting'))] : prev));
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open, t]);

  // Close: restore focus to whatever held it before opening.
  useEffect(() => {
    if (open) return;
    previouslyFocused.current?.focus?.();
  }, [open]);

  // ESC closes — only while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Auto-scroll the message log to the latest message. We drive the OL's
  // scrollTop directly rather than calling scrollIntoView on a sentinel:
  // scrollIntoView can scroll any ancestor scroll container (including the
  // page) when the dialog's internal flex layout hasn't quite settled yet,
  // which produced jumpy behaviour on mobile. scrollTop on a fixed-size
  // overflow container is unambiguous.
  useEffect(() => {
    if (!open) return;
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const ask = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      setInput('');
      setMessages((prev) => [
        ...prev,
        { id: newId('user'), role: 'user', kind: 'text', content: text },
      ]);
      // Tiny delay so the user perceives a reply, not a screen flash.
      window.setTimeout(() => {
        const match = matchFaq(text);
        setMessages((prev) => [
          ...prev,
          match
            ? {
                id: newId('bot'),
                role: 'bot',
                kind: 'text',
                content: match.entry.answer,
              }
            : escalationMessage(t('escalationMessage')),
        ]);
      }, 180);
    },
    [t],
  );

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    ask(input);
  };

  // Hidden on admin pages — early return AFTER hooks to keep ordering stable.
  if (hidden) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? t('triggerClose') : t('triggerOpen')}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="fixed bottom-4 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 sm:bottom-6 sm:left-6"
      >
        <MessageCircle aria-hidden="true" className="h-6 w-6" />
      </button>

      {open && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-start p-4 sm:items-end sm:p-6"
        >
          {/* Click-outside-to-close. Keyboard users use ESC. tabIndex=-1
              keeps it out of the tab order — it's purely visual. */}
          <button
            type="button"
            aria-label={t('closeDialog')}
            onClick={close}
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-background/40 backdrop-blur-[2px]"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            // Hauteur STABLE : min(85vh, 600px) — la fenêtre ne grandit
            // plus avec le nombre de messages. Sur mobile, 85vh prend
            // l'écran sans coller au notch ; sur desktop, 600px reste
            // confortable et borné. La structure interne (header/log/
            // form) est un flex-col où seul le log scrolle, grâce à
            // `min-h-0` sur l'OL — sans quoi flex-1 garde la taille
            // intrinsèque de ses enfants et pousse le parent.
            className="relative flex h-[min(85vh,600px)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary"
                >
                  <Bot className="h-4 w-4" />
                </span>
                <h2 id={titleId} className="text-base font-semibold text-foreground">
                  {t('title')}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={t('closeDialog')}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </header>

            <ol
              ref={logRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              // `min-h-0` est obligatoire : un enfant flex (flex-1) ne
              // peut shrinker en dessous de sa taille intrinsèque que si
              // min-height vaut 0. Sans ça, la liste grandit avec les
              // messages et pousse la fenêtre vers le haut.
              className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-secondary/30 p-4"
            >
              {messages.map((message) => {
                const isUser = message.role === 'user';
                return (
                  <li
                    key={message.id}
                    className={`flex items-start gap-2 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!isUser && (
                      <span
                        aria-hidden="true"
                        className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                      >
                        <Bot className="h-4 w-4" />
                      </span>
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-card text-foreground'
                      }`}
                    >
                      <span className="sr-only">
                        {isUser ? t('srUserPrefix') : t('srBotPrefix')}
                      </span>
                      <p>{message.content}</p>
                      {message.role === 'bot' && message.kind === 'escalation' && (
                        <div className="mt-3">
                          <Link
                            href={ESCALATION_HREF}
                            onClick={close}
                            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <LifeBuoy aria-hidden="true" className="h-3.5 w-3.5" />
                            {t('contactSupport')}
                          </Link>
                        </div>
                      )}
                    </div>
                    {isUser && (
                      <span
                        aria-hidden="true"
                        className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                      >
                        <User className="h-4 w-4" />
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="shrink-0 border-t border-border bg-card px-4 py-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t('faqLabel')}
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
                {suggestions.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => ask(entry.question)}
                    className="rounded-full border border-input bg-background px-3 py-1 text-xs text-foreground hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {entry.question}
                  </button>
                ))}
              </div>

              <form onSubmit={onSubmit} className="flex items-center gap-2">
                <label htmlFor="chatbot-widget-input" className="sr-only">
                  {t('inputLabel')}
                </label>
                <input
                  ref={inputRef}
                  id="chatbot-widget-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('inputPlaceholder')}
                  autoComplete="off"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={input.trim().length === 0}
                  aria-label={t('sendLabel')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
