import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { searchApi, SearchResults } from '../../api/search';
import { formatStatus } from '../ui/Chips';

const EMPTY: SearchResults = { tickets: [], projects: [], people: [] };

export function SearchBox() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY);
      return;
    }
    const handle = setTimeout(() => {
      searchApi.search(query.trim()).then(setResults).catch(() => setResults(EMPTY));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function go(path: string) {
    setOpen(false);
    setQuery('');
    navigate(path);
  }

  const hasResults = results.tickets.length > 0 || results.projects.length > 0 || results.people.length > 0;
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div className="search-box" ref={containerRef}>
      <Search size={14} />
      <input
        placeholder="Search tickets, projects, people…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {showDropdown && (
        <div className="search-dropdown">
          {!hasResults && <div className="bell-empty">No matches for "{query.trim()}".</div>}
          {results.tickets.length > 0 && (
            <>
              <div className="search-group-label">Tickets</div>
              {results.tickets.map((t) => (
                <div key={t.id} className="search-result-item" onClick={() => go(`/tickets/${t.id}`)}>
                  <div className="search-result-title">{t.title}</div>
                  <div className="search-result-sub">{t.displayId} · {formatStatus(t.status)}</div>
                </div>
              ))}
            </>
          )}
          {results.projects.length > 0 && (
            <>
              <div className="search-group-label">Projects</div>
              {results.projects.map((p) => (
                <div key={p.code} className="search-result-item" onClick={() => go(`/projects/${p.code}`)}>
                  <div className="search-result-title">{p.name}</div>
                  <div className="search-result-sub">{p.code}</div>
                </div>
              ))}
            </>
          )}
          {results.people.length > 0 && (
            <>
              <div className="search-group-label">People</div>
              {/* No profile/detail page exists for a person yet — these rows
                  are informational (name + email), not navigable. */}
              {results.people.map((u) => (
                <div key={u.id} className="search-result-item" style={{ cursor: 'default' }}>
                  <div className="search-result-title">{u.name}</div>
                  <div className="search-result-sub">{u.email}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
