import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../../api/notifications';
import { useAuth } from '../../auth/AuthContext';
import { NotificationPreviewModal } from './NotificationPreviewModal';
import { Notification } from '../../types/notification';

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState<Notification | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    notificationsApi
      .list()
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function toggle() {
    setOpen((v) => !v);
  }

  function markAllRead() {
    notificationsApi.markAllRead().then(() => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    });
  }

  function openOne(n: Notification) {
    if (!n.read) {
      notificationsApi.markRead(n.id).then(() => {
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      });
    }
    setOpen(false);
    setPreview(n);
  }

  return (
    <div className="bell-wrap">
      <button className="bell" onClick={toggle} aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`} aria-expanded={open}>
        <Bell size={17} />
        {unreadCount > 0 && <span className="dot">{unreadCount}</span>}
      </button>
      {open && (
        <div className="bell-dropdown">
          <div className="bell-head">
            Notifications
            {unreadCount > 0 && <span onClick={markAllRead}>Mark all read</span>}
          </div>
          {loaded && notifications.length === 0 && (
            <div className="bell-empty">No notifications yet.<br />Create a ticket or project to see one.</div>
          )}
          {notifications.slice(0, 12).map((n) => (
            <div key={n.id} className={`bell-item ${!n.read ? 'unread' : ''}`} onClick={() => openOne(n)}>
              <div className="bell-icon">
                <Bell size={13} />
              </div>
              <div>
                <div className="bell-subject">{n.subject}</div>
                <div className="bell-body">{n.body.slice(0, 65)}{n.body.length > 65 ? '…' : ''}</div>
                <div className="bell-time">via {n.channels.join(' + ')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {preview && user && (
        <NotificationPreviewModal
          notif={preview}
          recipientName={user.name}
          recipientEmail={user.email}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
