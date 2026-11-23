import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { MyBoard } from './pages/MyBoard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { TicketsList } from './pages/TicketsList';
import { TicketDetail } from './pages/TicketDetail';
import { Kanban } from './pages/Kanban';
import { Backlog } from './pages/Backlog';
import { Comms } from './pages/Comms';
import { Analytics } from './pages/Analytics';
import { Users } from './pages/Users';
import { RolesAdmin } from './pages/RolesAdmin';
import { TeamsAdmin } from './pages/TeamsAdmin';
import { AuditLog } from './pages/AuditLog';
import { Labels } from './pages/Labels';
import { BusinessCategories } from './pages/BusinessCategories';
import { SlaPolicies } from './pages/SlaPolicies';
import { AiProviders } from './pages/AiProviders';
import { WorkHours } from './pages/WorkHours';
import { Timesheet } from './pages/Timesheet';
import { Workflow } from './pages/Workflow';
import { GithubIntegration } from './pages/GithubIntegration';
import { landingPathFor } from './permissions/helpers';

export default function App() {
  const { user, permissions, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-board" element={<MyBoard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:code" element={<ProjectDetail />} />
        <Route path="/tickets" element={<TicketsList />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route path="/backlog" element={<Backlog />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/comms" element={<Comms />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/users" element={<Users />} />
        <Route path="/teams" element={<TeamsAdmin />} />
        <Route path="/roles" element={<RolesAdmin />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/labels" element={<Labels />} />
        <Route path="/business-categories" element={<BusinessCategories />} />
        <Route path="/sla-policies" element={<SlaPolicies />} />
        <Route path="/ai-providers" element={<AiProviders />} />
        <Route path="/workflow" element={<Workflow />} />
        <Route path="/github" element={<GithubIntegration />} />
        <Route path="/work-hours" element={<WorkHours />} />
        <Route path="/timesheet" element={<Timesheet />} />
      </Route>
      <Route
        path="/"
        element={
          loading ? (
            <div className="loading-state">Loading…</div>
          ) : user && permissions ? (
            <Navigate to={landingPathFor(permissions)} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
