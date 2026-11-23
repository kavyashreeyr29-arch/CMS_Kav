import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Auto-links ticket references inside free text (comments, descriptions) —
// the same "type the displayId and it just works" convention already used
// for PR titles/branches (DevelopmentPanel, backend/src/github), extended to
// plain text. Matches a full URL first (so a pasted "copy link" URL is
// consumed as one unit and its trailing displayId/id isn't also matched by
// the bare-reference alternative below), or a bare ticket displayId like
// "ATLAS-1024". Ticket lookup (backend tickets.service.ts findOne) accepts
// either form, so both resolve via the same /tickets/:id route.
const REFERENCE_PATTERN = /(https?:\/\/\S+)|(\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b)/g;

export function Linkify({ text }: { text: string }) {
  if (!text) return null;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(REFERENCE_PATTERN)) {
    const [full, url] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));

    if (url) {
      let internalPath: string | null = null;
      try {
        const parsed = new URL(url);
        if (parsed.origin === window.location.origin) {
          const ticketMatch = parsed.pathname.match(/^\/tickets\/([^/]+)/);
          if (ticketMatch) internalPath = `/tickets/${ticketMatch[1]}`;
        }
      } catch {
        // Not a parseable URL (e.g. trailing punctuation swallowed by \S+) — fall through and render as external text.
      }
      parts.push(
        internalPath ? (
          <Link key={key++} to={internalPath} className="ref-link">{full}</Link>
        ) : (
          <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="ref-link">{full}</a>
        ),
      );
    } else {
      parts.push(<Link key={key++} to={`/tickets/${full}`} className="ref-link tid">{full}</Link>);
    }
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}
