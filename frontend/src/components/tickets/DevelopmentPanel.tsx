import { GitPullRequest, GitMerge, GitPullRequestClosed, ExternalLink, Download, X, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { githubApi } from '../../api/github';
import { exportToCsv } from '../ui/exportCsv';
import { PullRequestLink, PrState, PrReviewState } from '../../types/ticket';

interface Props {
  displayId: string;
  pullRequests: PullRequestLink[];
  onChanged: () => void;
}

const STATE_META: Record<PrState, { label: string; color: string; bg: string; Icon: typeof GitPullRequest }> = {
  open: { label: 'Open', color: '#1A7F37', bg: '#E6F4EA', Icon: GitPullRequest },
  merged: { label: 'Merged', color: '#8250DF', bg: '#F3EEFB', Icon: GitMerge },
  closed: { label: 'Closed', color: '#CF222E', bg: '#FCEBEA', Icon: GitPullRequestClosed },
};

const REVIEW_META: Record<PrReviewState, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  approved: { label: 'Approved', color: '#1A7F37', Icon: CheckCircle2 },
  changes_requested: { label: 'Changes requested', color: '#CF222E', Icon: AlertCircle },
  pending: { label: 'Review pending', color: '#9A6700', Icon: Clock },
};

export function DevelopmentPanel({ displayId, pullRequests, onChanged }: Props) {
  async function unlink(id: string) {
    await githubApi.unlinkPr(id);
    onChanged();
  }

  function exportPrs() {
    exportToCsv(
      `${displayId}-pull-requests`,
      ['PR #', 'Title', 'State', 'Review', 'Branch', 'Author', 'URL'],
      pullRequests.map((pr) => [pr.number, pr.title, STATE_META[pr.state].label, REVIEW_META[pr.reviewState].label, pr.headRef, pr.authorLogin, pr.url]),
    );
  }

  return (
    <div className="panel">
      <div className="td-section-title" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><GitPullRequest size={13} />Development ({pullRequests.length})</span>
        <button className="btn-ghost" onClick={exportPrs} disabled={pullRequests.length === 0}><Download size={11} />CSV</button>
      </div>

      {pullRequests.length === 0 ? (
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', lineHeight: 1.5 }}>
          No linked pull requests yet. Include <span className="tid">{displayId}</span> in a branch name, PR title, or PR description
          and it links automatically once GitHub is connected — its status then keeps this ticket in sync.
        </div>
      ) : (
        <div className="pr-list">
          {pullRequests.map((pr) => {
            const s = STATE_META[pr.state];
            const rv = REVIEW_META[pr.reviewState];
            return (
              <div className="pr-item" key={pr.id}>
                <div className="pr-item-icon" style={{ background: s.bg, color: s.color }}><s.Icon size={15} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pr-item-title">
                    <a href={pr.url} target="_blank" rel="noopener noreferrer" title={pr.title}>
                      #{pr.number} {pr.title} <ExternalLink size={10} style={{ verticalAlign: 0 }} />
                    </a>
                  </div>
                  <div className="pr-item-meta">
                    <span className="pr-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    <span style={{ color: rv.color, display: 'inline-flex', alignItems: 'center', gap: 3 }}><rv.Icon size={11} />{rv.label}</span>
                    <span className="mono" style={{ color: 'var(--ink-faint)' }}>{pr.headRef}</span>
                    <span style={{ color: 'var(--ink-faint)' }}>@{pr.authorLogin}</span>
                  </div>
                </div>
                <button className="icon-btn" onClick={() => unlink(pr.id)} title="Unlink" aria-label={`Unlink PR #${pr.number}`}><X size={12} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
