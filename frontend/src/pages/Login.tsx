import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck, TimerReset, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { landingPathFor } from '../permissions/helpers';
import { DEMO_ACCOUNTS, DEMO_GROUPS, DEMO_PASSWORD } from './demoAccounts';

const BRAND_POINTS = [
  { icon: Users, text: 'Role-aware ticketing across every team, from client to leadership' },
  { icon: TimerReset, text: 'SLA visibility from the moment a ticket is raised to resolution' },
  { icon: ShieldCheck, text: 'One dashboard for delivery, one for the people who need the summary' },
];

export function Login() {
  const { user, permissions, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user && permissions) return <Navigate to={landingPathFor(permissions)} replace />;

  async function doLogin(loginEmail: string, loginPassword: string) {
    setError('');
    setSubmitting(true);
    try {
      const freshPermissions = await login(loginEmail, loginPassword);
      // Use the permissions returned directly from login(), not the
      // `permissions` from useAuth() above — that's still the pre-login
      // (null) value in this closure until the next render.
      navigate(landingPathFor(freshPermissions));
    } catch (err) {
      // A failed fetch (rather than an API response) means the frontend was
      // started without the API service. Give a useful setup hint instead of
      // the generic error, which made the quick-login accounts look broken.
      setError(
        err instanceof ApiError
          ? err.message
          : 'Cannot reach the sign-in service. Start the backend, then try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await doLogin(email, password);
  }

  return (
    <div className="login-shell">
      <div className="login-brand">
        <div className="login-brand-glow login-brand-glow-1" />
        <div className="login-brand-glow login-brand-glow-2" />
        <div className="login-brand-content">
          <img className="login-logo" src="/elevatoz-logo.png" alt="Elevatoz" />
          <div className="login-brand-name">ElevatoHub</div>
          <div className="login-brand-tagline">Elevate your delivery.</div>
          <ul className="login-brand-points">
            {BRAND_POINTS.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon size={16} />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-form-card">
          <div className="login-form-head">
            <div className="login-form-title">Welcome back</div>
            <div className="login-form-sub">Sign in to your ElevatoHub workspace.</div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <div className="field-error" style={{ marginBottom: 10 }}>{error}</div>}
            <button className="btn-primary" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div className="login-form-hint">
            Seed demo accounts: any seeded email (see backend/prisma/seed.ts) + password "{DEMO_PASSWORD}".
          </div>
        </div>

        {/* TEMPORARY — test-only quick-login panel, one click per seeded role.
            Remove this whole panel (and demoAccounts.ts) once manual role
            testing is done — see CLAUDE.md / CHANGELOG.md 2026-07-22. */}
        <div className="panel login-quicklogin">
          <div className="login-quicklogin-head">
            <div className="panel-title">Quick login</div>
            <span className="label-chip" style={{ background: '#FDF1DC', color: '#C87F0A' }}>test only</span>
          </div>
          <div className="panel-sub" style={{ marginBottom: 10 }}>
            One click per seeded role — remove this panel before shipping.
          </div>
          {DEMO_GROUPS.map((group) => (
            <div key={group} className="login-quicklogin-group">
              <div className="login-quicklogin-group-label">{group}</div>
              <div className="login-quicklogin-pills">
                {DEMO_ACCOUNTS.filter((a) => a.group === group).map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    className="select-pill"
                    disabled={submitting}
                    onClick={() => doLogin(account.email, DEMO_PASSWORD)}
                    title={`${account.name} <${account.email}>`}
                  >
                    {account.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
