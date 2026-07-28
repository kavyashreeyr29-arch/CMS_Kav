import { useState } from 'react';
import { Bell, ExternalLink, Mail, MessageCircle, X } from 'lucide-react';
import { Notification } from '../../types/notification';

interface Props {
  notif: Notification;
  recipientName: string;
  recipientEmail: string;
  onClose: () => void;
}

/**
 * Simulated preview of the email/Teams message a notification would send —
 * real delivery is a Phase 5 item (lld.md §6.1/§10, NotificationsService.deliver()
 * is currently a no-op past the DB write). This shows accurately what
 * *would* go out, same as the reference prototype's preview.
 */
export function NotificationPreviewModal({ notif, recipientName, recipientEmail, onClose }: Props) {
  const [channel, setChannel] = useState<'email' | 'teams'>(notif.channels[0] === 'teams' ? 'teams' : 'email');

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Bell size={15} />Notification preview
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div className="np-tabs">
            <div className={`np-tab ${channel === 'email' ? 'active' : ''}`} onClick={() => setChannel('email')}><Mail size={13} />Email</div>
            <div className={`np-tab ${channel === 'teams' ? 'active' : ''}`} onClick={() => setChannel('teams')}><MessageCircle size={13} />Teams</div>
          </div>

          {channel === 'email' ? (
            <div className="email-frame">
              <div className="email-head">
                <div><b>To</b> {recipientName} &lt;{recipientEmail}&gt;</div>
                <div><b>From</b> ElevatoHub &lt;notifications@elevatohub.io&gt;</div>
                <div><b>Subject</b> {notif.subject}</div>
              </div>
              <div className="email-body">
                <p>Hi {recipientName.split(' ')[0]},</p>
                <p>{notif.body}</p>
                <p style={{ color: 'var(--ink-soft)', fontSize: 11.5 }}>
                  — View this ticket in ElevatoHub for full details, or reply directly to this email to add a comment.
                </p>
              </div>
            </div>
          ) : (
            <div className="teams-card">
              <div className="teams-head">
                <div className="teams-bot-avatar"><MessageCircle size={14} /></div>
                <div><div className="teams-head-text">ElevatoHub Bot</div><div className="teams-head-sub">to {recipientName} · {new Date(notif.createdAt).toLocaleString()}</div></div>
              </div>
              <div className="teams-body">
                <strong>{notif.subject}</strong>
                <p style={{ margin: '6px 0 0' }}>{notif.body}</p>
                <div className="teams-btn"><ExternalLink size={11} />Open in ElevatoHub</div>
              </div>
            </div>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 10 }}>
            This is a simulated preview of what would be sent. Real delivery needs an email provider
            (SES/SendGrid/Postmark) and the Microsoft Teams webhook/Graph API wired up on the backend.
          </div>
        </div>
      </div>
    </div>
  );
}
