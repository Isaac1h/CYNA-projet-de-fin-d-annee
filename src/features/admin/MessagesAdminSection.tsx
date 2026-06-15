'use client';

import { useEffect, useState } from 'react';
import { Archive, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

/**
 * Admin messages table.
 *
 * Reads via the shared anon-key client + admin session JWT. The
 * `contact_messages_admin_select` / `contact_messages_admin_update` RLS
 * policies gate every row on `public.is_admin()` — a non-admin (or a
 * UI bug in this component) cannot leak nor mutate anything.
 *
 * UPDATE column grant is locked to `status` only at the SQL layer, so
 * even if a future bug here tried to overwrite a message body it would
 * be rejected by Postgres.
 */

type MessageStatus = 'new' | 'read' | 'archived';

type DbMessage = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: MessageStatus;
  created_at: string;
};

const STATUS_LABEL: Record<MessageStatus, string> = {
  new: 'Nouveau',
  read: 'Lu',
  archived: 'Archivé',
};

const STATUS_CLASS: Record<MessageStatus, string> = {
  new: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  read: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  archived: 'border-muted-foreground/40 bg-muted/30 text-muted-foreground',
};

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function MessagesAdminSection() {
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from('contact_messages')
        .select('id, user_id, name, email, subject, message, status, created_at')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }
      setMessages((data as DbMessage[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateStatus = async (id: string, status: MessageStatus) => {
    setUpdatingId(id);
    const { error: updateError } = await supabase
      .from('contact_messages')
      .update({ status })
      .eq('id', id);
    setUpdatingId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status } : m)),
    );
  };

  return (
    <section id="messages" aria-labelledby="messages-heading" className="space-y-4">
      <header>
        <h2 id="messages-heading" className="text-xl font-bold text-foreground sm:text-2xl">
          Messages de contact
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Messages reçus depuis le formulaire public. Cliquez une ligne pour lire le contenu et changer son statut.
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Liste des messages de contact, triée du plus récent au plus ancien.
          </caption>
          <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="w-8 px-2 py-3" aria-hidden="true" />
              <th scope="col" className="px-4 py-3">Date</th>
              <th scope="col" className="px-4 py-3">Nom</th>
              <th scope="col" className="px-4 py-3">Email</th>
              <th scope="col" className="px-4 py-3">Sujet</th>
              <th scope="col" className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground" aria-live="polite">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-destructive" role="alert">
                  Impossible de charger les messages : {error}
                </td>
              </tr>
            )}
            {!loading && !error && messages.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun message pour le moment.
                </td>
              </tr>
            )}
            {!loading && !error && messages.map((m) => {
              const expanded = expandedId === m.id;
              const toggle = () => setExpandedId(expanded ? null : m.id);
              return (
                <Row
                  key={m.id}
                  message={m}
                  expanded={expanded}
                  onToggle={toggle}
                  onUpdateStatus={updateStatus}
                  updating={updatingId === m.id}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type RowProps = {
  message: DbMessage;
  expanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: string, status: MessageStatus) => Promise<void>;
  updating: boolean;
};

function Row({ message, expanded, onToggle, onUpdateStatus, updating }: RowProps) {
  return (
    <>
      <tr
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
        aria-controls={`message-detail-${message.id}`}
        className="cursor-pointer hover:bg-secondary/30 focus:outline-none focus-visible:bg-secondary/40"
      >
        <td className="w-8 px-2 py-3 text-muted-foreground">
          {expanded ? (
            <ChevronDown aria-hidden="true" className="h-4 w-4" />
          ) : (
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          )}
        </td>
        <td className="px-4 py-3 text-muted-foreground">{formatDateTime(message.created_at)}</td>
        <td className="px-4 py-3 font-medium text-foreground">{message.name}</td>
        <td className="px-4 py-3 text-muted-foreground">
          <a
            href={`mailto:${message.email}`}
            className="hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {message.email}
          </a>
        </td>
        <td className="px-4 py-3 text-foreground">{message.subject}</td>
        <td className="px-4 py-3">
          <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_CLASS[message.status]}`}>
            {STATUS_LABEL[message.status]}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr id={`message-detail-${message.id}`} className="bg-secondary/20">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-3">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Message
                </h3>
                <p className="whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-sm text-foreground">
                  {message.message}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {message.status !== 'read' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={updating}
                    onClick={() => onUpdateStatus(message.id, 'read')}
                  >
                    <Eye aria-hidden="true" className="mr-1 h-4 w-4" />
                    Marquer lu
                  </Button>
                )}
                {message.status !== 'archived' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={updating}
                    onClick={() => onUpdateStatus(message.id, 'archived')}
                  >
                    <Archive aria-hidden="true" className="mr-1 h-4 w-4" />
                    Archiver
                  </Button>
                )}
                {message.status !== 'new' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={updating}
                    onClick={() => onUpdateStatus(message.id, 'new')}
                  >
                    Remettre en nouveau
                  </Button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
