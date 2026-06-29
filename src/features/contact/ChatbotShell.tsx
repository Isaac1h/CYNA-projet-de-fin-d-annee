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
import { Bot, MessageCircle, Send, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from './types';

// TODO: real chatbot (FAQ matching + escalation to a human agent) is out of
// scope for this migration. The widget below is intentionally a UI shell
// only — no API call, no AI integration, no remote dependency. The canned
// responses live here so the page is walkable in demos without surprising
// anyone with an unmoderated LLM.
type FaqKey = 'soc' | 'edr' | 'xdr' | 'pricing' | 'invoice';

const FAQ_PATTERNS: { match: RegExp; key: FaqKey }[] = [
  { match: /\bsoc\b/i, key: 'soc' },
  { match: /\bedr\b/i, key: 'edr' },
  { match: /\bxdr\b/i, key: 'xdr' },
  { match: /(prix|tarif|pricing|cout|cost|price)/i, key: 'pricing' },
  { match: /(facture|invoice)/i, key: 'invoice' },
];

const generateId = (role: 'user' | 'bot') =>
  `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export default function ChatbotShell() {
  const t = useTranslations('contact.chatbot');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLLIElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const dialogTitleId = useId();

  const suggestions = useMemo(
    () => [t('suggestions.soc'), t('suggestions.edr'), t('suggestions.pricing')],
    [t],
  );

  const greetingMessage = useCallback(
    (): ChatMessage => ({
      id: `bot-${Date.now()}`,
      role: 'bot',
      content: t('greeting'),
    }),
    [t],
  );

  const findCannedAnswer = useCallback(
    (userInput: string): string => {
      for (const entry of FAQ_PATTERNS) {
        if (entry.match.test(userInput)) return t(`faq.${entry.key}`);
      }
      return t('defaultAnswer');
    },
    [t],
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    setMessages((prev) => (prev.length === 0 ? [greetingMessage()] : prev));
    // Defer focus until the dialog has actually rendered.
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open, greetingMessage]);

  useEffect(() => {
    if (open) return;
    previouslyFocused.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const userMessage: ChatMessage = { id: generateId('user'), role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    window.setTimeout(() => {
      const answer: ChatMessage = {
        id: generateId('bot'),
        role: 'bot',
        content: findCannedAnswer(text),
      };
      setMessages((prev) => [...prev, answer]);
    }, 350);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage(input);
  };

  return (
    <section
      aria-labelledby="chatbot-section-heading"
      className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <header className="mb-4">
        <h2 id="chatbot-section-heading" className="text-xl font-bold text-foreground sm:text-2xl">
          {t('sectionHeading')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('sectionSubheading')}</p>
      </header>

      <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
        <li>{t('bullet1')}</li>
        <li>{t('bullet2')}</li>
        <li>{t('bullet3')}</li>
      </ul>

      <Button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <MessageCircle aria-hidden="true" className="mr-2 h-4 w-4" />
        {t('cta')}
      </Button>

      {open && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm p-4 sm:items-center sm:justify-end sm:p-6"
        >
          {/* Overlay click closes the dialog. Keyboard users use ESC or
              the explicit close button. */}
          <button
            type="button"
            aria-label={t('closeOverlay')}
            onClick={close}
            className="absolute inset-0 cursor-default"
            tabIndex={-1}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-border bg-card/95 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bot aria-hidden="true" className="h-5 w-5 text-primary" />
                <h3 id={dialogTitleId} className="text-base font-semibold text-foreground">
                  {t('dialogTitle')}
                </h3>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={t('closeButton')}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </header>

            <ol
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              className="flex-1 space-y-3 overflow-y-auto bg-secondary/30 p-4"
            >
              {messages.map((message) => {
                const isUser = message.role === 'user';
                return (
                  <li
                    key={message.id}
                    className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <span aria-hidden="true" className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Bot className="h-4 w-4" />
                      </span>
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-card text-foreground'
                      }`}
                    >
                      <span className="sr-only">{isUser ? t('srUserPrefix') : t('srBotPrefix')}</span>
                      {message.content}
                    </div>
                    {isUser && (
                      <span aria-hidden="true" className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <User className="h-4 w-4" />
                      </span>
                    )}
                  </li>
                );
              })}
              <li aria-hidden="true" ref={messagesEndRef} />
            </ol>

            <div className="border-t border-border bg-card px-4 py-3">
              <p className="mb-2 text-xs text-muted-foreground">{t('suggestionsLabel')}</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendMessage(suggestion)}
                    className="rounded-full border border-input bg-background px-3 py-1 text-xs text-foreground hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <label htmlFor="chatbot-input" className="sr-only">
                  {t('inputLabel')}
                </label>
                <input
                  ref={inputRef}
                  id="chatbot-input"
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={t('inputPlaceholder')}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button type="submit" size="sm" aria-label={t('sendLabel')} disabled={input.trim().length === 0}>
                  <Send aria-hidden="true" className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
