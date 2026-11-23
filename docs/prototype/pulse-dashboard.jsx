import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import {
  Search, Bell, ChevronDown, LayoutDashboard, Ticket as TicketIcon,
  Trello, AlertTriangle, Clock, CheckCircle2, Flame, Gauge, Users,
  TrendingUp, MessageSquare, Circle, Plus, X, Mail, AtSign, Send,
  Inbox, CheckCheck, Folder, Upload, FileText, Image as ImageIcon,
  Paperclip, ArrowUp, ArrowDown, Phone, Headphones, Settings as SettingsIcon,
  Globe, Briefcase, MessageCircle, GripVertical, ExternalLink, Plug,
  Shield, Lock, XCircle, RotateCcw, UserCog, Tag, BarChart3, Trash2,
  UserPlus, Download, PlayCircle, StopCircle, Timer
} from "lucide-react";

/* ---------------------------------------------------------
   DETERMINISTIC MOCK DATA
--------------------------------------------------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
function hashScale(code) {
  if (!code || code === "ALL") return 1;
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  const f = mulberry32(h || 1)();
  return 0.14 + f * 0.22;
}

const SEED_PROJECTS = [
  { code: "ATLAS", name: "Atlas — Core Platform", client: "Internal", lead: "N. Rao", status: "Active", priority: "High", start: new Date("2026-02-03"), end: new Date("2026-09-30"), description: "Core services and shared platform capabilities used across all products.", documents: [{ id: "d1", name: "Atlas_BRD_v3.docx", size: 482000, kind: "doc", url: null }, { id: "d2", name: "Architecture_Diagram.pdf", size: 1240000, kind: "doc", url: null }] },
  { code: "ORION", name: "Orion — Mobile Banking", client: "Meridian Bank", lead: "S. Iyer", status: "Active", priority: "Critical", start: new Date("2026-01-12"), end: new Date("2026-08-15"), description: "Native mobile banking app rebuild for Meridian Bank.", documents: [{ id: "d3", name: "Orion_BRD_Final.docx", size: 690000, kind: "doc", url: null }, { id: "d4", name: "Compliance_Checklist.xlsx", size: 88000, kind: "doc", url: null }, { id: "d5", name: "UAT_Signoff.pdf", size: 210000, kind: "doc", url: null }] },
  { code: "NOVA", name: "Nova — Client Portal", client: "Kestrel Retail", lead: "A. Fernandes", status: "Active", priority: "Medium", start: new Date("2026-03-01"), end: new Date("2026-07-20"), description: "Self-service portal for Kestrel Retail's franchise partners.", documents: [{ id: "d6", name: "Nova_Kickoff_Deck.pptx", size: 3400000, kind: "doc", url: null }] },
  { code: "HELIX", name: "Helix — Data Platform", client: "Internal", lead: "P. Sharma", status: "Active", priority: "High", start: new Date("2026-01-20"), end: new Date("2026-10-01"), description: "Central data platform and analytics pipeline migration.", documents: [{ id: "d7", name: "Helix_Data_Dictionary.xlsx", size: 156000, kind: "doc", url: null }, { id: "d8", name: "Migration_Plan.docx", size: 340000, kind: "doc", url: null }] },
  { code: "ZEN", name: "Zen — Support Desk", client: "Vantage Health", lead: "M. Thomas", status: "Active", priority: "Medium", start: new Date("2026-04-05"), end: new Date("2026-08-30"), description: "Customer support ticketing rollout for Vantage Health.", documents: [{ id: "d9", name: "Zen_BRD.docx", size: 275000, kind: "doc", url: null }] },
];

const PEOPLE = [
  "N. Rao", "S. Iyer", "A. Fernandes", "P. Sharma", "M. Thomas",
  "R. Gupta", "K. Menon", "D. Chen", "L. Okafor", "J. Silva", "T. Novak"
];
const CURRENT_USER = "P. Manager";
const CLIENT_IDENTITY = "A. Kapoor (Meridian Bank)";

const TYPES = ["Story", "Epic", "Bug", "Feature", "Enhancement", "Support", "Task", "Change Request"];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const STATUSES = ["Open", "Assigned", "In Progress", "In Review", "QA Testing", "Completed", "Closed", "Reopened"];
const OPEN_STATUSES = ["Open", "Assigned", "In Progress", "In Review", "QA Testing", "Reopened"];
const PROJECT_STATUSES = ["Active", "Planning", "On Hold", "Completed"];
const SOURCES = ["Internal / PM", "Call Center", "Customer Success", "Operations", "Client Portal", "Sales"];
const LABELS = ["Login Issue", "Redemption Issue", "Coupon Issue", "Payment Issue", "Account Access", "Delivery Delay", "App Crash", "Refund Request", "Data Sync Issue", "General Query"];
const LABEL_COLORS = ["#362F9E", "#2563EB", "#16946E", "#C87F0A", "#E2483B", "#5B3DE0", "#0EA5A5", "#DB2777", "#7C8598", "#8E5A2B"];

const PRIORITY_COLOR = { Critical: "#E2483B", High: "#F5A524", Medium: "#3B6CF4", Low: "#7C8598" };
const AGING_COLORS = ["#1DB88E", "#7FD858", "#F5C518", "#F5A524", "#E2483B"];
const AGING_BUCKETS = ["0-2d", "3-5d", "6-10d", "11-20d", "21d+"];

const INTEGRATIONS = [
  { name: "Call Center (IVR / CTI)", icon: Phone, endpoint: "POST /api/v1/tickets?source=call-center", note: "Agents raise a ticket straight from the call screen; caller details pre-fill the reporter field." },
  { name: "Customer Success Tool", icon: Headphones, endpoint: "POST /api/v1/tickets?source=customer-success", note: "CSM escalations from renewal or health-score alerts land here automatically." },
  { name: "Operations Portal", icon: SettingsIcon, endpoint: "POST /api/v1/tickets?source=operations", note: "Internal ops requests (access, provisioning, incidents) route in as tickets." },
  { name: "Client Portal", icon: Globe, endpoint: "POST /api/v1/tickets?source=client-portal", note: "Clients log issues directly; replies sync back out via the same channel." },
  { name: "Sales / CRM", icon: Briefcase, endpoint: "POST /api/v1/tickets?source=sales", note: "Deal-blocking requests from Sales get flagged and prioritised automatically." },
  { name: "Microsoft Teams", icon: MessageCircle, endpoint: "Outgoing webhook → Teams channel", note: "Assignment, mention, and status-change alerts post to the assignee's Teams DM and the project channel." },
];

/* ---------------------------------------------------------
   ROLE-BASED ACCESS CONTROL
--------------------------------------------------------- */
const ROLES = [
  { id: "admin", label: "Admin", group: "Full access", blurb: "Full access to every project, dashboard, and user management.", identity: CURRENT_USER },
  { id: "director", label: "Director", group: "Full access", blurb: "Full visibility across every project, dashboard, and report.", identity: CURRENT_USER },
  { id: "manager", label: "Project Manager", group: "Full access", blurb: "Full visibility, plus story/bug tracking and time logging.", identity: CURRENT_USER },
  { id: "developer", label: "Developer", group: "Full access", blurb: "Full visibility, creates stories/bugs, tracks time on tickets.", identity: CURRENT_USER },
  { id: "qa", label: "QA", group: "Full access", blurb: "Full visibility, creates stories/bugs, tracks time on tickets.", identity: CURRENT_USER },
  { id: "callcenter", label: "Call Center Agent", group: "Field team", source: "Call Center", identity: "R. Gupta", blurb: "Raise tickets from calls, see team tickets & projects, track & close." },
  { id: "customersuccess", label: "Customer Success", group: "Field team", source: "Customer Success", identity: "K. Menon", blurb: "Raise tickets, work the board, see team tickets & projects." },
  { id: "operations", label: "Operations", group: "Field team", source: "Operations", identity: "D. Chen", blurb: "Raise internal requests, track status, comment, close." },
  { id: "client", label: "Client", group: "External", source: "Client Portal", identity: CLIENT_IDENTITY, blurb: "Raise, track, comment, close, and reopen your own tickets." },
];

const ROLE_PERMISSIONS = {
  admin: { dashboard: true, projects: true, board: true, comms: true, createProject: true, userManagement: true, manageLabels: true, adminAnalytics: true, allTickets: true, restrictedStatuses: false, simpleDashboard: false, canReopen: true, timeTracking: true, scope: "all" },
  director: { dashboard: true, projects: true, board: true, comms: true, createProject: true, userManagement: false, manageLabels: false, adminAnalytics: false, allTickets: true, restrictedStatuses: false, simpleDashboard: false, canReopen: true, timeTracking: false, scope: "all" },
  manager: { dashboard: true, projects: true, board: true, comms: true, createProject: true, userManagement: false, manageLabels: false, adminAnalytics: false, allTickets: true, restrictedStatuses: false, simpleDashboard: false, canReopen: true, timeTracking: true, scope: "all" },
  developer: { dashboard: true, projects: true, board: true, comms: true, createProject: true, userManagement: false, manageLabels: false, adminAnalytics: false, allTickets: true, restrictedStatuses: false, simpleDashboard: false, canReopen: true, timeTracking: true, scope: "all" },
  qa: { dashboard: true, projects: true, board: true, comms: true, createProject: true, userManagement: false, manageLabels: false, adminAnalytics: false, allTickets: true, restrictedStatuses: false, simpleDashboard: false, canReopen: true, timeTracking: true, scope: "all" },
  callcenter: { dashboard: false, projects: true, board: false, comms: false, createProject: false, userManagement: false, manageLabels: false, adminAnalytics: false, allTickets: false, restrictedStatuses: true, simpleDashboard: true, canReopen: false, timeTracking: false, scope: "source" },
  customersuccess: { dashboard: false, projects: true, board: true, comms: false, createProject: false, userManagement: false, manageLabels: false, adminAnalytics: false, allTickets: false, restrictedStatuses: false, simpleDashboard: true, canReopen: false, timeTracking: false, scope: "source" },
  operations: { dashboard: false, projects: false, board: false, comms: false, createProject: false, userManagement: false, manageLabels: false, adminAnalytics: false, allTickets: false, restrictedStatuses: true, simpleDashboard: true, canReopen: false, timeTracking: false, scope: "source" },
  client: { dashboard: false, projects: false, board: false, comms: false, createProject: false, userManagement: false, manageLabels: false, adminAnalytics: false, allTickets: false, restrictedStatuses: true, simpleDashboard: false, canReopen: true, timeTracking: false, scope: "reporter" },
};
function permissionsFor(roleId) { return ROLE_PERMISSIONS[roleId]; }
function landingTabFor(p) { if (p.dashboard) return "dashboard"; if (p.simpleDashboard) return "myboard"; return "tickets"; }
function ticketScopeLabel(perm) { if (perm.scope === "all") return "Tickets"; if (perm.scope === "source") return "Team tickets"; return "My tickets"; }
function ticketVisible(t, role, perm) {
  if (perm.scope === "all") return true;
  if (perm.scope === "source") return t.source === role.source;
  if (perm.scope === "reporter") return t.reporter === role.identity;
  return true;
}
const DEPARTMENT_BY_TYPE = { Story: "Engineering Team", Epic: "Engineering Team", Bug: "Engineering Team", Feature: "Engineering Team", Enhancement: "Engineering Team", Task: "Delivery Team", "Change Request": "Delivery Team", Support: "Support Team" };
function assigneeDisplay(ticket, perm) {
  if (perm.scope === "reporter") return DEPARTMENT_BY_TYPE[ticket.type] || "Delivery Team";
  return ticket.assignee;
}
function colorForLabel(label) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return LABEL_COLORS[h % LABEL_COLORS.length];
}
function formatMinutes(mins) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function totalLoggedMinutes(ticket, nowTick) {
  return (ticket.timeEntries || []).reduce((sum, e) => sum + (e.endedAt ? (e.endedAt - e.startedAt) : (Date.now() - e.startedAt)) / 60000, 0);
}

const RESTRICTED_STATUS_OPTIONS = ["Open", "In Progress", "Closed"];

const PERMISSION_ROWS = [
  { key: "dashboard", label: "Portfolio dashboard & analytics" },
  { key: "projects", label: "Projects — view, create, document folders" },
  { key: "allTickets", label: "See tickets across every team" },
  { key: "board", label: "Kanban board" },
  { key: "comms", label: "Comms & tracking audit log" },
  { key: "simpleDashboard", label: "Personal \"my tickets\" summary" },
  { key: "createProject", label: "Create new projects" },
  { key: "userManagement", label: "Create users & assign roles" },
  { key: "manageLabels", label: "Add / remove issue labels" },
  { key: "timeTracking", label: "Start / stop time tracking" },
  { key: "adminAnalytics", label: "Cross-project & time-period analytics" },
  { key: "canReopen", label: "Reopen a closed ticket" },
];

function bucketFor(days) {
  if (days <= 2) return 0;
  if (days <= 5) return 1;
  if (days <= 10) return 2;
  if (days <= 20) return 3;
  return 4;
}
const TODAY = new Date("2026-07-09");
function daysAgo(n) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
function fmt(d) { if (!d) return "—"; return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); }
function toInputDate(d) { if (!d) return ""; return new Date(d).toISOString().slice(0, 10); }
function emailFor(name) { return name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 20) + "@pulse-pm.io"; }
function initialsOf(name) { return name.split(" ").map(s => s[0]).join("").replace(".", "").slice(0, 2); }
function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function kindOf(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "doc";
}

const TICKET_TITLES = [
  "Login fails on token refresh", "Add export to CSV on report screen",
  "Improve dashboard load time", "Client requests SSO integration",
  "Fix pagination on tickets table", "Sprint retro action items",
  "Update onboarding email copy", "Investigate memory leak in worker",
  "UAT feedback — invoice screen", "Add audit log for role changes",
  "Mobile layout breaks on iPad", "Rate limit exceeded on API gateway",
  "Design review — new kanban card", "Data migration validation",
  "Support: password reset not received", "Refactor auth middleware",
  "Add dark mode to settings", "Slack notification duplication bug",
  "Coupon not applying at checkout", "Redemption points not credited",
];

let seqCounter = 1000;
function buildTickets() {
  const list = [];
  SEED_PROJECTS.forEach((proj) => {
    const count = int(28, 42);
    for (let i = 0; i < count; i++) {
      seqCounter += 1;
      const status = pick(STATUSES.filter(s => s !== "Reopened").concat(["Open", "In Progress", "In Progress"]));
      const isOpen = OPEN_STATUSES.includes(status);
      const createdDaysAgo = int(0, 34);
      const created = daysAgo(createdDaysAgo);
      const ageDays = isOpen ? createdDaysAgo : int(0, createdDaysAgo);
      const due = new Date(created);
      due.setDate(due.getDate() + int(3, 21));
      const estimated = int(2, 24);
      const actual = status === "Completed" || status === "Closed"
        ? Math.max(1, Math.round(estimated * (0.7 + rand() * 0.7)))
        : Math.round(estimated * rand() * 0.8);
      const source = pick(SOURCES);
      let reporter = pick(PEOPLE);
      if (source === "Call Center" && rand() < 0.6) reporter = "R. Gupta";
      if (source === "Customer Success" && rand() < 0.6) reporter = "K. Menon";
      if (source === "Operations" && rand() < 0.6) reporter = "D. Chen";

      list.push({
        id: `${proj.code}-${seqCounter}`,
        project: proj.code,
        projectName: proj.name,
        title: pick(TICKET_TITLES),
        description: "Details to be added by the reporter. Steps to reproduce, expected vs. actual behaviour, and acceptance criteria go here.",
        type: pick(TYPES),
        priority: pick(PRIORITIES),
        status,
        source,
        label: pick(LABELS),
        reporter,
        assignee: pick(PEOPLE),
        watchers: [],
        created, due,
        ageDays,
        estimated, actual,
        remaining: Math.max(0, estimated - actual),
        isOpen,
        isOverdue: isOpen && due < TODAY,
        comments: [],
        attachments: [],
        timeEntries: [],
      });
    }
  });
  let clientSeeded = 0;
  for (let i = 0; i < list.length && clientSeeded < 5; i++) {
    if (list[i].source === "Client Portal") { list[i].reporter = CLIENT_IDENTITY; clientSeeded++; }
  }
  return list;
}
const INITIAL_TICKETS = buildTickets();

/* ---------------------------------------------------------
   AGGREGATIONS (static demo series)
--------------------------------------------------------- */
function buildPeriodSeries(labels, createdRange, closedRange) {
  return labels.map(period => ({
    period, created: int(...createdRange), closed: int(...closedRange),
    avgRes: Number((int(24, 58) / 10).toFixed(1)), sla: int(76, 97),
  }));
}
const MONTHLY = buildPeriodSeries(["Feb", "Mar", "Apr", "May", "Jun", "Jul"], [64, 118], [55, 112]);
const QUARTERLY = buildPeriodSeries(["Q3 '25", "Q4 '25", "Q1 '26", "Q2 '26"], [220, 420], [200, 400]);
const YEARLY = buildPeriodSeries(["2023", "2024", "2025", "2026 YTD"], [900, 1600], [850, 1550]);
const PERIOD_SETS = { month: { data: MONTHLY, label: "month", noun: "Last 6 months" }, quarter: { data: QUARTERLY, label: "quarter", noun: "Last 4 quarters" }, year: { data: YEARLY, label: "year", noun: "Last 4 years" } };

function buildBurndown() {
  const total = 120; let ideal = total, actual = total; const days = [];
  for (let d = 0; d <= 10; d++) {
    ideal = Math.max(0, total - (total / 10) * d);
    actual = Math.max(0, actual - (total / 10) * (0.6 + rand() * 0.8));
    days.push({ day: `D${d}`, ideal: Math.round(ideal), actual: Math.round(actual) });
  }
  return days;
}
const BURNDOWN = buildBurndown();

const MILESTONES = [
  { project: "ORION", name: "UAT Sign-off", date: "14 Jul", days: 5 },
  { project: "NOVA", name: "Client Portal v2 Launch", date: "18 Jul", days: 9 },
  { project: "ATLAS", name: "Core API Freeze", date: "22 Jul", days: 13 },
  { project: "HELIX", name: "Data Migration Cutover", date: "25 Jul", days: 16 },
];

const SEED_ACTIVITY = [
  { id: "a1", ticketId: "ORION-1042", who: "S. Iyer", action: "moved ORION-1042 to QA Testing", time: "12 min ago" },
  { id: "a2", ticketId: "ATLAS-1078", who: "R. Gupta", action: "commented on ATLAS-1078", time: "34 min ago" },
  { id: "a3", ticketId: "HELIX-1091", who: "K. Menon", action: "closed HELIX-1091 as duplicate", time: "1 hr ago" },
  { id: "a4", ticketId: "NOVA-1105", who: "D. Chen", action: "raised NOVA-1105 — Critical", time: "2 hr ago" },
  { id: "a5", ticketId: "ZEN-1063", who: "L. Okafor", action: "attached UAT sign-off to ZEN-1063", time: "3 hr ago" },
  { id: "a6", ticketId: "ORION-1039", who: "M. Thomas", action: "reassigned ORION-1039 to T. Novak", time: "5 hr ago" },
];

const SEED_USER_ROLES = { "N. Rao": "director", "S. Iyer": "manager", "A. Fernandes": "manager", "P. Sharma": "developer", "M. Thomas": "developer", "R. Gupta": "callcenter", "K. Menon": "customersuccess", "D. Chen": "operations", "L. Okafor": "customersuccess", "J. Silva": "callcenter", "T. Novak": "operations" };
const SEED_USERS = PEOPLE.map((name, i) => ({ id: `u${i}`, name, email: emailFor(name), roleId: SEED_USER_ROLES[name] || "developer" }));

/* ---------------------------------------------------------
   MENTION HELPERS
--------------------------------------------------------- */
function extractMentions(text) {
  const re = /@\[([^\]]+)\]/g; const found = []; let m;
  while ((m = re.exec(text || ""))) if (PEOPLE.includes(m[1]) && !found.includes(m[1])) found.push(m[1]);
  return found;
}
function MentionText({ text }) {
  const parts = (text || "").split(/(@\[[^\]]+\])/g);
  return <>{parts.map((p, i) => {
    const m = p.match(/^@\[([^\]]+)\]$/);
    if (m) return <span key={i} className="mention-chip">@{m[1]}</span>;
    return <span key={i}>{p}</span>;
  })}</>;
}

/* ---------------------------------------------------------
   SMALL UI PRIMITIVES
--------------------------------------------------------- */
function KpiCard({ icon: Icon, label, value, sub, tone = "ink" }) {
  return (
    <div className="kpi">
      <div className={`kpi-icon tone-${tone}`}><Icon size={16} /></div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
function StatusDot({ status }) {
  const color = status === "Closed" || status === "Completed" ? "#1DB88E" :
    status === "Reopened" ? "#E2483B" :
    status === "In Review" || status === "QA Testing" ? "#3B6CF4" :
    status === "In Progress" ? "#F5A524" : "#7C8598";
  return <Circle size={8} fill={color} color={color} />;
}
function PrioChip({ p, small }) {
  return <span className="prio-chip" style={{ background: PRIORITY_COLOR[p] + "22", color: PRIORITY_COLOR[p], fontSize: small ? 9.5 : 10.5, padding: small ? "1px 6px" : "2px 8px" }}>{p}</span>;
}
function SourceChip({ s }) { return <span className="source-chip">{s}</span>; }
function LabelChip({ l }) {
  const color = colorForLabel(l);
  return <span className="label-chip" style={{ background: color + "1a", color }}><Tag size={9} />{l}</span>;
}
function NotifIcon({ type }) {
  if (type === "mentioned") return <AtSign size={13} />;
  if (type === "status") return <TrendingUp size={13} />;
  if (type === "attachment") return <Paperclip size={13} />;
  if (type === "project") return <Folder size={13} />;
  if (type === "document") return <FileText size={13} />;
  if (type === "reopened") return <RotateCcw size={13} />;
  return <TicketIcon size={13} />;
}
function AttachmentThumb({ a }) {
  if (a.kind === "image" && a.url) return <img src={a.url} alt={a.name} className="att-thumb" />;
  if (a.kind === "video" && a.url) return <video src={a.url} className="att-thumb" muted />;
  return <div className="att-thumb att-thumb-doc"><FileText size={20} /></div>;
}
function AttachmentGrid({ files }) {
  if (!files.length) return <div className="att-empty">No files yet.</div>;
  return (
    <div className="att-grid">
      {files.map(a => (
        <div className="att-card" key={a.id}>
          <AttachmentThumb a={a} />
          <div className="att-meta"><div className="att-name">{a.name}</div><div className="att-size">{fileSize(a.size)}</div></div>
          {a.url
            ? <a className="att-download" href={a.url} download={a.name} title="Download" onClick={e => e.stopPropagation()}><Download size={11} /></a>
            : <span className="att-download att-download-disabled" title="No downloadable file — seed data for this demo"><Download size={11} /></span>}
        </div>
      ))}
    </div>
  );
}
function MomStat({ label, curr, prev, suffix = "", invert = false, decimals = 0, periodNoun = "month" }) {
  const delta = curr - prev;
  const pct = prev ? Math.round((delta / prev) * 100) : 0;
  const good = invert ? delta <= 0 : delta >= 0;
  return (
    <div className="mom-stat">
      <div className="mom-label">{label}</div>
      <div className="mom-value">{decimals ? curr.toFixed(decimals) : curr}{suffix}</div>
      <div className={`mom-delta ${good ? "up" : "down"}`}>{delta === 0 ? <span>flat</span> : <>{good ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{Math.abs(pct)}% vs last {periodNoun}</>}</div>
    </div>
  );
}

/* ---------------------------------------------------------
   ATTACHMENT PICKER
--------------------------------------------------------- */
function AttachmentPicker({ files, onChange, compact, label }) {
  const inputRef = useRef(null);
  const handleFiles = (fileList) => {
    const items = Array.from(fileList).map(f => ({ id: `f${Date.now()}${Math.round(rand() * 1000)}`, name: f.name, size: f.size, kind: kindOf(f), url: URL.createObjectURL(f) }));
    if (compact) onChange(items);
    else onChange([...files, ...items]);
  };
  const remove = (id) => onChange(files.filter(f => f.id !== id));
  return (
    <div>
      <div className="dropzone" onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
        <Upload size={16} />
        <span>{label || (compact ? "Add files to this folder" : "Drop files here or click to upload — documents, images, or videos")}</span>
        <input ref={inputRef} type="file" multiple hidden accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.txt,.ppt,.pptx" onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {!compact && files.length > 0 && (
        <div className="att-grid">
          {files.map(a => (
            <div className="att-card" key={a.id}>
              <AttachmentThumb a={a} />
              <div className="att-meta"><div className="att-name">{a.name}</div><div className="att-size">{fileSize(a.size)}</div></div>
              <a className="att-download" href={a.url} download={a.name} title="Download" onClick={e => e.stopPropagation()}><Download size={11} /></a>
              <button className="att-remove" onClick={() => remove(a.id)}><X size={11} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   REUSABLE TREND PANEL — month / quarter / year toggle
--------------------------------------------------------- */
function TrendPanel({ projectCode }) {
  const [period, setPeriod] = useState("month");
  const set = PERIOD_SETS[period];
  const scale = hashScale(projectCode);
  const data = set.data.map(d => projectCode && projectCode !== "ALL"
    ? { ...d, created: Math.max(1, Math.round(d.created * scale)), closed: Math.max(0, Math.round(d.closed * scale)) }
    : d);
  const last = data[data.length - 1], prev = data[data.length - 2];
  return (
    <div className="panel">
      <div className="panel-head">
        <div><div className="panel-title">Trend summary</div><div className="panel-sub">{set.noun}{projectCode && projectCode !== "ALL" ? ` — scoped to ${projectCode}` : " — all projects merged"}</div></div>
        <div className="period-toggle">
          {["month", "quarter", "year"].map(p => <div key={p} className={`period-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>{p[0].toUpperCase() + p.slice(1)}</div>)}
        </div>
      </div>
      <div className="mom-row">
        <MomStat label="Tickets closed" curr={last.closed} prev={prev.closed} periodNoun={set.label} />
        <MomStat label="Avg resolution" curr={last.avgRes} prev={prev.avgRes} suffix="d" invert decimals={1} periodNoun={set.label} />
        <MomStat label="SLA compliance" curr={last.sla} prev={prev.sla} suffix="%" periodNoun={set.label} />
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={data} margin={{ left: -18, right: 8 }} barGap={4}>
          <CartesianGrid stroke="#EEF0F6" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 10.5, fill: "#9AA1B2" }} axisLine={{ stroke: "#E3E5EF" }} tickLine={false} />
          <YAxis tick={{ fontSize: 10.5, fill: "#9AA1B2" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E3E5EF" }} />
          <Bar dataKey="created" fill="#362F9E" radius={[4, 4, 0, 0]} />
          <Bar dataKey="closed" fill="#1DB88E" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------
   LABEL / ISSUE-CATEGORY BREAKDOWN
--------------------------------------------------------- */
function LabelBreakdown({ tickets, title, sub }) {
  const grouped = {};
  tickets.forEach(t => { grouped[t.label] = (grouped[t.label] || 0) + 1; });
  const counts = Object.entries(grouped).map(([label, count]) => ({ label, count, color: colorForLabel(label) }))
    .sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...counts.map(c => c.count));
  return (
    <div className="panel">
      <div className="panel-head"><div><div className="panel-title">{title || "Recurring issue categories"}</div><div className="panel-sub">{sub || "Where tickets are coming from, by label"}</div></div></div>
      {counts.length === 0 && <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>No tickets yet.</div>}
      {counts.map(c => (
        <div className="wl-row" key={c.label}>
          <div className="wl-name" style={{ width: 118 }}>{c.label}</div>
          <div className="wl-bar-track"><div className="wl-bar-fill" style={{ width: `${(c.count / max) * 100}%`, background: c.color }} /></div>
          <div className="wl-val">{c.count}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------
   LABELS MANAGER (admin) — add / remove issue categories
--------------------------------------------------------- */
function LabelsManager({ labels, tickets, onAdd, onRemove }) {
  const [draft, setDraft] = useState("");
  const counts = {};
  tickets.forEach(t => { counts[t.label] = (counts[t.label] || 0) + 1; });
  function submit() {
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft("");
  }
  return (
    <div className="panel">
      <div className="panel-head">
        <div><div className="panel-title">Issue labels / categories</div><div className="panel-sub">Used when raising a ticket, and rolled up in the recurring-issue reports</div></div>
      </div>
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input className="label-add-input" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="e.g. Shipping Delay" />
        <button className="btn-primary" onClick={submit}><Plus size={14} />Add label</button>
      </div>
      <div className="labels-manage-grid">
        {labels.map(l => (
          <div className="labels-manage-row" key={l}>
            <LabelChip l={l} />
            <span className="labels-manage-count">{counts[l] || 0} ticket{(counts[l] || 0) === 1 ? "" : "s"}</span>
            <button className="del-btn" onClick={() => onRemove(l)} title="Remove label"><Trash2 size={13} /></button>
          </div>
        ))}
        {labels.length === 0 && <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>No labels yet — add one above.</div>}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 12 }}>Removing a label only takes it out of the picker for new tickets — tickets already using it keep their label for historical reporting.</div>
    </div>
  );
}

/* ---------------------------------------------------------
   MAIN APP
--------------------------------------------------------- */
export default function App() {
  const [roleId, setRoleId] = useState("director");
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [showRoleMatrix, setShowRoleMatrix] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [projects, setProjects] = useState(SEED_PROJECTS);
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [ticketFilters, setTicketFilters] = useState({ status: "ALL", priority: "ALL", source: "ALL" });
  const [tickets, setTickets] = useState(INITIAL_TICKETS);
  const [users, setUsers] = useState(SEED_USERS);
  const [labels, setLabels] = useState(LABELS);
  const [activityLog, setActivityLog] = useState(SEED_ACTIVITY);
  const [notifications, setNotifications] = useState([]);
  const [showBell, setShowBell] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [openTicketId, setOpenTicketId] = useState(null);
  const [openProjectId, setOpenProjectId] = useState(null);
  const [notifPreview, setNotifPreview] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const idCounter = useRef(seqCounter);

  const role = ROLES.find(r => r.id === roleId);
  const perm = permissionsFor(roleId);

  function switchRole(id) {
    setRoleId(id);
    setShowRoleSwitcher(false);
    setTab(landingTabFor(permissionsFor(id)));
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  function pushActivity(ticketId, who, action) {
    setActivityLog(prev => [{ id: `a${Date.now()}${rand()}`, ticketId, who, action, time: "Just now" }, ...prev]);
  }
  function pushNotification({ type, recipient, ticket, subject, body }) {
    const notif = { id: `n${Date.now()}${Math.round(rand() * 1000)}`, type, recipient, ticketId: ticket.id, project: ticket.project, subject, body, to: emailFor(recipient), time: "Just now", read: false, channels: ["email", "teams"] };
    setNotifications(prev => [notif, ...prev]);
  }
  function notifyAssignment(ticket) {
    const attNote = ticket.attachments.length ? ` It includes ${ticket.attachments.length} attachment(s).` : "";
    pushNotification({
      type: "assigned", recipient: ticket.assignee, ticket,
      subject: `[${ticket.id}] Assigned to you: ${ticket.title}`,
      body: `${ticket.reporter} assigned "${ticket.title}" (${ticket.priority} priority, ${ticket.type}), raised via ${ticket.source} as ${ticket.label}, to you. Start: ${fmt(ticket.created)} · Due: ${fmt(ticket.due)}.${attNote}`,
    });
    pushActivity(ticket.id, ticket.reporter, `assigned ${ticket.id} to ${ticket.assignee}`);
  }
  function notifyMentions(ticket, text, source) {
    extractMentions(text).forEach(name => {
      pushNotification({
        type: "mentioned", recipient: name, ticket,
        subject: `[${ticket.id}] You were mentioned`,
        body: `Someone mentioned you in a ${source} on "${ticket.title}": "${text.replace(/@\[[^\]]+\]/g, m => m.slice(2, -1))}"`,
      });
    });
  }
  function notifyStatusChange(ticket, newStatus, actor) {
    [ticket.assignee, ...ticket.watchers].filter((v, i, a) => a.indexOf(v) === i).forEach(name => {
      pushNotification({ type: "status", recipient: name, ticket, subject: `[${ticket.id}] Status changed to ${newStatus}`, body: `${ticket.id} — "${ticket.title}" moved from ${ticket.status} to ${newStatus} by ${actor}.` });
    });
    pushActivity(ticket.id, actor, `moved ${ticket.id} to ${newStatus}`);
  }
  function notifyReopen(ticket, actor) {
    [ticket.assignee, ...ticket.watchers].filter((v, i, a) => a.indexOf(v) === i).forEach(name => {
      pushNotification({ type: "reopened", recipient: name, ticket, subject: `[${ticket.id}] Reopened`, body: `${actor} reopened "${ticket.title}" — it was previously marked ${ticket.status}. Please review.` });
    });
    pushActivity(ticket.id, actor, `reopened ${ticket.id}`);
  }
  function notifyAttachments(ticket, count) {
    [ticket.assignee, ...ticket.watchers].filter((v, i, a) => a.indexOf(v) === i).forEach(name => {
      pushNotification({ type: "attachment", recipient: name, ticket, subject: `[${ticket.id}] New attachment added`, body: `${count} file(s) added to "${ticket.title}".` });
    });
    pushActivity(ticket.id, CURRENT_USER, `attached ${count} file(s) to ${ticket.id}`);
  }
  function notifyProjectLead(proj) {
    pushNotification({ type: "project", recipient: proj.lead, ticket: { id: proj.code, title: proj.name }, subject: `[${proj.code}] You're the project manager`, body: `${CURRENT_USER} set up "${proj.name}" for ${proj.client} and assigned you as project manager. Timeline: ${fmt(proj.start)} — ${fmt(proj.end)}.` });
  }
  function notifyProjectDocument(proj, count) {
    pushNotification({ type: "document", recipient: proj.lead, ticket: { id: proj.code, title: proj.name }, subject: `[${proj.code}] ${count} document(s) added to the project folder`, body: `${count} file(s) added to the ${proj.name} document folder.` });
  }

  function handleCreateProject(form) {
    const code = form.code.trim().toUpperCase().replace(/\s+/g, "");
    const newProj = { code, name: form.name || code, client: form.client || "Internal", lead: form.lead, status: form.status, priority: form.priority, start: new Date(form.start), end: new Date(form.end), description: form.description, documents: form.documents };
    setProjects(prev => [newProj, ...prev]);
    notifyProjectLead(newProj);
    setActivityLog(prev => [{ id: `a${Date.now()}`, ticketId: newProj.code, who: CURRENT_USER, action: `created project ${newProj.code} — ${newProj.name}${form.documents.length ? ` with ${form.documents.length} document(s)` : ""}`, time: "Just now" }, ...prev]);
    setShowCreateProject(false);
    setProjectFilter(code);
  }
  function handleAddProjectDocuments(proj, newFiles) {
    if (!newFiles.length) return;
    setProjects(prev => prev.map(p => p.code === proj.code ? { ...p, documents: [...p.documents, ...newFiles] } : p));
    notifyProjectDocument(proj, newFiles.length);
  }

  function handleCreateTicket(form) {
    idCounter.current += 1;
    const created = new Date(form.startDate);
    const due = new Date(form.endDate);
    const estimated = Number(form.estimated) || 0;
    const reporter = perm.scope === "all" ? CURRENT_USER : role.identity;
    const newTicket = {
      id: `${form.project}-${idCounter.current}`, project: form.project,
      projectName: projects.find(p => p.code === form.project)?.name || form.project,
      title: form.title || "Untitled ticket", description: form.description,
      type: form.type, priority: form.priority, status: "Open", source: form.source, label: form.label,
      reporter, assignee: form.assignee, watchers: form.watchers,
      created, due, ageDays: 0, estimated, actual: 0, remaining: estimated,
      isOpen: true, isOverdue: false, comments: [], attachments: form.attachments, timeEntries: [],
    };
    setTickets(prev => [newTicket, ...prev]);
    pushActivity(newTicket.id, reporter, `created ${newTicket.id} via ${form.source}${form.attachments.length ? ` with ${form.attachments.length} attachment(s)` : ""}`);
    notifyAssignment(newTicket);
    notifyMentions(newTicket, form.description, "ticket description");
    newTicket.watchers.forEach(name => {
      pushNotification({ type: "watching", recipient: name, ticket: newTicket, subject: `[${newTicket.id}] Added as watcher`, body: `You were added as a watcher on "${newTicket.title}". You'll get updates on status changes and comments.` });
    });
    setShowCreateTicket(false);
    setOpenTicketId(newTicket.id);
  }
  function handleAddComment(ticket, text) {
    if (!text.trim()) return;
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, comments: [...t.comments, { id: `c${Date.now()}`, author: role.identity, time: "Just now", text }] } : t));
    pushActivity(ticket.id, role.identity, `commented on ${ticket.id}`);
    notifyMentions(ticket, text, "comment");
  }
  function handleStatusChange(ticket, newStatus) {
    if (ticket.status === newStatus) return;
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: newStatus, isOpen: OPEN_STATUSES.includes(newStatus), isOverdue: OPEN_STATUSES.includes(newStatus) && t.due < TODAY } : t));
    notifyStatusChange(ticket, newStatus, role.identity);
  }
  function handleReopen(ticket) {
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: "Reopened", isOpen: true, isOverdue: t.due < TODAY } : t));
    notifyReopen(ticket, role.identity);
  }
  function handleAddAttachments(ticket, newFiles) {
    if (!newFiles.length) return;
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, attachments: [...t.attachments, ...newFiles] } : t));
    notifyAttachments(ticket, newFiles.length);
  }
  function handleDrop(e, status) {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData("text/plain");
    const ticket = tickets.find(t => t.id === id);
    if (ticket) handleStatusChange(ticket, status);
  }
  function handleAddUser(form) {
    setUsers(prev => [{ id: `u${Date.now()}`, name: form.name, email: emailFor(form.name), roleId: form.roleId }, ...prev]);
    setShowAddUser(false);
  }
  function handleChangeUserRole(userId, newRoleId) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, roleId: newRoleId } : u));
  }
  function handleRemoveUser(userId) {
    setUsers(prev => prev.filter(u => u.id !== userId));
  }
  function handleAddLabel(name) {
    const trimmed = name.trim();
    if (!trimmed || labels.includes(trimmed)) return;
    setLabels(prev => [...prev, trimmed]);
  }
  function handleRemoveLabel(name) {
    setLabels(prev => prev.filter(l => l !== name));
  }
  function handleStartTimer(ticket) {
    if ((ticket.timeEntries || []).some(e => e.who === role.identity && !e.endedAt)) return;
    const entry = { id: `t${Date.now()}`, who: role.identity, roleLabel: role.label, startedAt: Date.now(), endedAt: null };
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, timeEntries: [...(t.timeEntries || []), entry] } : t));
    pushActivity(ticket.id, role.identity, `started the timer on ${ticket.id}`);
  }
  function handleStopTimer(ticket) {
    let loggedMins = 0;
    setTickets(prev => prev.map(t => {
      if (t.id !== ticket.id) return t;
      const entries = (t.timeEntries || []).map(e => {
        if (e.who === role.identity && !e.endedAt) {
          const endedAt = Date.now();
          loggedMins = Math.round((endedAt - e.startedAt) / 60000);
          return { ...e, endedAt };
        }
        return e;
      });
      return { ...t, timeEntries: entries };
    }));
    pushActivity(ticket.id, role.identity, `stopped the timer on ${ticket.id} — logged ${formatMinutes(loggedMins)}`);
  }

  const filteredTickets = useMemo(() => tickets.filter(t =>
    (projectFilter === "ALL" || t.project === projectFilter) &&
    ticketVisible(t, role, perm)
  ), [tickets, projectFilter, roleId]);

  const openTickets = filteredTickets.filter(t => t.isOpen);
  const overdue = filteredTickets.filter(t => t.isOverdue);
  const dueToday = filteredTickets.filter(t => t.isOpen && t.due.toDateString() === TODAY.toDateString());
  const highPriority = openTickets.filter(t => t.priority === "Critical" || t.priority === "High");
  const completedThisMonth = filteredTickets.filter(t => (t.status === "Completed" || t.status === "Closed") && t.created.getMonth() === TODAY.getMonth());

  const avgResolution = useMemo(() => {
    const done = filteredTickets.filter(t => t.status === "Completed" || t.status === "Closed");
    if (!done.length) return 0;
    return (done.reduce((s, t) => s + t.ageDays, 0) / done.length).toFixed(1);
  }, [filteredTickets]);
  const slaCompliance = useMemo(() => {
    const done = filteredTickets.filter(t => t.status === "Completed" || t.status === "Closed");
    if (!done.length) return 100;
    const onTime = done.filter(t => t.due >= t.created).length;
    return Math.round((onTime / done.length) * 100);
  }, [filteredTickets]);
  const capacityUsed = useMemo(() => {
    const assigned = filteredTickets.reduce((s, t) => s + t.estimated, 0);
    return Math.min(100, Math.round((assigned / (PEOPLE.length * 40)) * 100));
  }, [filteredTickets]);

  const priorityData = PRIORITIES.map(p => ({ name: p, value: openTickets.filter(t => t.priority === p).length, color: PRIORITY_COLOR[p] }));

  const workload = useMemo(() => {
    const map = {}; PEOPLE.forEach(p => map[p] = { name: p, assigned: 0, remaining: 0 });
    filteredTickets.filter(t => t.isOpen).forEach(t => { map[t.assignee].assigned += t.estimated; map[t.assignee].remaining += t.remaining; });
    return Object.values(map).sort((a, b) => b.remaining - a.remaining).slice(0, 8);
  }, [filteredTickets]);

  const agingByProject = useMemo(() => {
    const projList = projectFilter === "ALL" ? projects : projects.filter(p => p.code === projectFilter);
    return projList.map(proj => {
      const buckets = [0, 0, 0, 0, 0];
      tickets.filter(t => t.project === proj.code && t.isOpen).forEach(t => { buckets[bucketFor(t.ageDays)] += 1; });
      return { proj, buckets, total: buckets.reduce((a, b) => a + b, 0) };
    });
  }, [tickets, projects, projectFilter]);

  const projectHealth = useMemo(() => projects.map(proj => {
    const pts = tickets.filter(t => t.project === proj.code);
    const od = pts.filter(t => t.isOverdue).length;
    const openCt = pts.filter(t => t.isOpen).length;
    const ratio = openCt ? od / openCt : 0;
    const health = ratio > 0.25 ? "red" : ratio > 0.1 ? "amber" : "green";
    return { proj, openCt, od, health, total: pts.length };
  }), [tickets, projects]);

  const projectAnalytics = useMemo(() => projects.map(proj => {
    const pts = tickets.filter(t => t.project === proj.code);
    const openPts = pts.filter(t => t.isOpen);
    const closedPts = pts.filter(t => t.status === "Completed" || t.status === "Closed");
    const avgAge = openPts.length ? Math.round(openPts.reduce((s, t) => s + t.ageDays, 0) / openPts.length) : 0;
    const clientPts = pts.filter(t => t.source === "Client Portal");
    const clientOpen = clientPts.filter(t => t.isOpen).length;
    const clientClosed = clientPts.filter(t => t.status === "Completed" || t.status === "Closed").length;
    return { proj, total: pts.length, open: openPts.length, closed: closedPts.length, avgAge, clientTotal: clientPts.length, clientOpen, clientClosed };
  }), [tickets, projects]);

  const myTickets = useMemo(() => tickets.filter(t => t.reporter === role.identity), [tickets, roleId]);
  const myOpen = myTickets.filter(t => t.status === "Open" || t.status === "Assigned" || t.status === "Reopened");
  const myInProgress = myTickets.filter(t => t.status === "In Progress" || t.status === "In Review" || t.status === "QA Testing");
  const myClosed = myTickets.filter(t => t.status === "Completed" || t.status === "Closed");

  const kanbanCols = ["Open", "In Progress", "In Review", "QA Testing", "Completed"];
  const ticketsForKanban = filteredTickets.filter(t => kanbanCols.includes(t.status));
  const filteredTable = filteredTickets.filter(t =>
    (ticketFilters.status === "ALL" || t.status === ticketFilters.status) &&
    (ticketFilters.priority === "ALL" || t.priority === ticketFilters.priority) &&
    (ticketFilters.source === "ALL" || t.source === ticketFilters.source)
  ).slice(0, 80);
  const openTicket = tickets.find(t => t.id === openTicketId);
  const openProject = projects.find(p => p.code === openProjectId);

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .app { --bg:#F4F5FA; --surface:#FFFFFF; --surface-2:#EEF0F6; --ink:#13161F; --ink-soft:#676F82; --ink-faint:#9AA1B2; --border:#E3E5EF; --brand:#362F9E; --brand-soft:#EDECFB; --lime:#B4FF39;
          font-family:'Inter',sans-serif; background:var(--bg); color:var(--ink); min-height:100%; display:flex; font-size:13px; position:relative; }
        .app .mono { font-family:'IBM Plex Mono',monospace; }
        .sidebar { width:60px; background:var(--ink); display:flex; flex-direction:column; align-items:center; padding:16px 0; gap:6px; flex-shrink:0; overflow-y:auto; }
        .sidebar .logo { width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg,var(--lime),#8FE000); display:flex; align-items:center; justify-content:center; margin-bottom:18px; font-family:'Space Grotesk',sans-serif; font-weight:700; color:var(--ink); font-size:15px; box-shadow:0 4px 10px rgba(180,255,57,0.25); flex-shrink:0; }
        .nav-btn { width:38px; height:38px; border-radius:9px; display:flex; align-items:center; justify-content:center; color:#8A90A6; cursor:pointer; border:none; background:transparent; transition:all .15s ease; flex-shrink:0; }
        .nav-btn:hover { background:#1E2130; color:#fff; }
        .nav-btn.active { background:#262A3D; color:var(--lime); }
        .main { flex:1; min-width:0; display:flex; flex-direction:column; }
        .topbar { height:60px; background:var(--surface); display:flex; align-items:center; padding:0 22px; gap:14px; flex-shrink:0; box-shadow:0 1px 0 rgba(19,22,31,0.06), 0 4px 14px rgba(19,22,31,0.03); position:relative; z-index:10; }
        .topbar .titles h1 { font-family:'Space Grotesk',sans-serif; font-size:16px; margin:0; font-weight:700; }
        .topbar .titles p { margin:0; font-size:11.5px; color:var(--ink-soft); }
        .search-box { margin-left:20px; flex:1; max-width:260px; display:flex; align-items:center; gap:8px; background:var(--surface-2); border-radius:8px; padding:7px 11px; color:var(--ink-faint); }
        .search-box input { border:none; background:transparent; outline:none; font-size:12.5px; width:100%; color:var(--ink); }
        .topbar-right { display:flex; align-items:center; gap:10px; margin-left:auto; }
        .btn-primary { display:flex; align-items:center; gap:6px; background:var(--brand); color:#fff; border:none; border-radius:8px; padding:8px 13px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; transition:all .15s ease; }
        .btn-primary:hover { background:#2c266f; box-shadow:0 4px 10px rgba(54,47,158,0.28); transform:translateY(-1px); }
        .select-pill { display:flex; align-items:center; gap:6px; background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:6px 10px; font-size:12px; font-weight:500; cursor:pointer; color:var(--ink); white-space:nowrap; transition:all .15s ease; }
        .select-pill:hover { border-color:var(--brand); }
        .proj-select-wrap { position:relative; padding:0; cursor:pointer; max-width:220px; }
        .proj-select { appearance:none; -webkit-appearance:none; border:none; background:transparent; outline:none; font:inherit; color:var(--ink); font-weight:500; padding:6px 26px 6px 10px; width:100%; cursor:pointer; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .proj-select-chevron { position:absolute; right:8px; top:50%; transform:translateY(-50%); pointer-events:none; color:var(--ink-soft); }
        .icon-btn { width:34px; height:34px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--ink-soft); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s ease; flex-shrink:0; }
        .icon-btn:hover { border-color:var(--brand); color:var(--brand); }
        .role-switcher { display:flex; align-items:center; gap:8px; cursor:pointer; padding:4px 8px 4px 4px; border-radius:20px; border:1px solid var(--border); background:var(--surface); }
        .role-switcher:hover { border-color:var(--brand); }
        .role-switcher-text { line-height:1.2; }
        .role-switcher-name { font-size:11.5px; font-weight:700; }
        .role-switcher-group { font-size:9.5px; color:var(--ink-faint); }
        .role-dropdown { width:320px; }
        .role-group-label { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-faint); padding:10px 14px 4px; }
        .role-option { display:flex; gap:9px; padding:8px 14px; cursor:pointer; align-items:flex-start; }
        .role-option:hover { background:#FAFAFD; }
        .role-option.active { background:var(--brand-soft); }
        .role-option-avatar { width:24px; height:24px; border-radius:50%; background:var(--brand-soft); color:var(--brand); font-size:9.5px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-family:'Space Grotesk',sans-serif; }
        .role-option-name { font-size:11.5px; font-weight:700; display:flex; align-items:center; color:var(--brand); }
        .role-option:not(.active) .role-option-name { color:var(--ink); }
        .role-option-blurb { font-size:10px; color:var(--ink-faint); margin-top:1px; line-height:1.3; }
        .restricted-banner { display:flex; align-items:center; gap:8px; background:var(--brand-soft); color:var(--brand); border-radius:10px; padding:10px 14px; font-size:11.5px; font-weight:500; margin-bottom:14px; }
        .perm-table { width:100%; border-collapse:collapse; }
        .perm-table th { text-align:center; font-size:10px; text-transform:uppercase; letter-spacing:.03em; color:var(--ink-faint); font-weight:600; padding:8px 6px; border-bottom:1px solid var(--border); }
        .perm-table th:first-child { text-align:left; }
        .perm-table td { padding:9px 6px; text-align:center; border-bottom:1px solid var(--border); font-size:11.5px; }
        .perm-table td:first-child { text-align:left; font-weight:500; }
        .perm-role-head { display:flex; flex-direction:column; align-items:center; gap:2px; }
        .perm-role-head span:first-child { font-weight:700; font-size:11px; }
        .perm-role-head span:last-child { font-size:9px; color:var(--ink-faint); }
        .avatar { width:30px; height:30px; border-radius:50%; background:var(--brand); color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; font-family:'Space Grotesk',sans-serif; flex-shrink:0; }
        .bell-wrap { position:relative; }
        .bell { position:relative; color:var(--ink-soft); cursor:pointer; display:flex; }
        .bell .dot { position:absolute; top:-3px; right:-4px; min-width:14px; height:14px; padding:0 3px; border-radius:8px; background:#E2483B; color:#fff; font-size:8.5px; font-weight:700; display:flex; align-items:center; justify-content:center; font-family:'IBM Plex Mono',monospace; }
        .bell-dropdown { position:absolute; top:34px; right:0; width:350px; max-height:420px; overflow-y:auto; background:var(--surface); border:1px solid var(--border); border-radius:12px; box-shadow:0 16px 34px rgba(19,22,31,0.16); z-index:40; }
        .bell-head { padding:12px 14px; border-bottom:1px solid var(--border); font-weight:700; font-size:12px; display:flex; justify-content:space-between; align-items:center; }
        .bell-head span { font-weight:500; color:var(--brand); font-size:10.5px; cursor:pointer; }
        .bell-item { display:flex; gap:9px; padding:10px 14px; border-bottom:1px solid var(--border); cursor:pointer; }
        .bell-item:hover { background:#FAFAFD; }
        .bell-item:last-child { border-bottom:none; }
        .bell-icon { width:26px; height:26px; border-radius:7px; background:var(--brand-soft); color:var(--brand); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .bell-item.unread .bell-icon { background:#FCEBEA; color:#E2483B; }
        .bell-subject { font-size:11.5px; font-weight:600; line-height:1.3; }
        .bell-body { font-size:10.5px; color:var(--ink-soft); margin-top:2px; line-height:1.3; }
        .bell-time { font-size:9.5px; color:var(--ink-faint); margin-top:3px; }
        .bell-empty { padding:30px 14px; text-align:center; color:var(--ink-faint); font-size:11.5px; }
        .tabs { display:flex; gap:4px; padding:0 22px; background:var(--surface); border-bottom:1px solid var(--border); overflow-x:auto; }
        .tab-btn { padding:11px 6px; font-size:12.5px; font-weight:600; color:var(--ink-soft); background:none; border:none; cursor:pointer; border-bottom:2px solid transparent; display:flex; align-items:center; gap:6px; transition:color .15s ease; white-space:nowrap; }
        .tab-btn:hover { color:var(--brand); }
        .tab-btn.active { color:var(--brand); border-bottom-color:var(--brand); }
        .content { flex:1; overflow-y:auto; padding:20px 22px 40px; }
        .kpi-grid { display:grid; grid-template-columns:repeat(8,1fr); gap:10px; margin-bottom:18px; }
        .kpi-grid.cols-4 { grid-template-columns:repeat(4,1fr); }
        .kpi { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:12px 12px 11px; transition:all .15s ease; }
        .kpi:hover { transform:translateY(-2px); box-shadow:0 8px 18px rgba(19,22,31,0.06); }
        .kpi-icon { width:24px; height:24px; border-radius:6px; display:flex; align-items:center; justify-content:center; margin-bottom:8px; }
        .tone-ink { background:var(--surface-2); color:var(--ink-soft); }
        .tone-red { background:#FCEBEA; color:#E2483B; }
        .tone-amber { background:#FDF1DC; color:#C87F0A; }
        .tone-green { background:#E4F8F1; color:#16946E; }
        .tone-brand { background:var(--brand-soft); color:var(--brand); }
        .kpi-value { font-family:'Space Grotesk',sans-serif; font-size:21px; font-weight:700; line-height:1; }
        .kpi-label { font-size:10.5px; color:var(--ink-soft); margin-top:5px; font-weight:500; }
        .kpi-sub { font-size:9.5px; color:var(--ink-faint); margin-top:2px; }
        .row { display:grid; gap:12px; margin-bottom:12px; }
        .row-2 { grid-template-columns:1.4fr 1fr; }
        .row-2b { grid-template-columns:1fr 1fr; }
        .panel { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px 18px; box-shadow:0 1px 2px rgba(19,22,31,0.03); }
        .panel-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:8px; }
        .panel-title { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:13.5px; }
        .panel-sub { font-size:10.5px; color:var(--ink-faint); margin-top:2px; }
        .legend-row { display:flex; gap:12px; font-size:10.5px; color:var(--ink-soft); flex-wrap:wrap; }
        .legend-dot { display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:4px; }
        .period-toggle { display:flex; gap:3px; background:var(--surface-2); border-radius:8px; padding:3px; }
        .period-btn { padding:5px 10px; font-size:11px; font-weight:600; color:var(--ink-soft); border-radius:6px; cursor:pointer; }
        .period-btn.active { background:var(--brand); color:#fff; }
        .aging-table, .comms-table, .ticket-table, .analytics-table, .users-table { width:100%; border-collapse:collapse; }
        .aging-table th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-faint); font-weight:600; padding-bottom:8px; }
        .aging-table td { padding:6px 4px; vertical-align:middle; }
        .aging-proj { font-weight:600; font-size:12px; }
        .aging-proj-sub { font-size:10px; color:var(--ink-faint); }
        .aging-cell { text-align:center; }
        .aging-chip { display:inline-flex; align-items:center; justify-content:center; min-width:34px; height:26px; border-radius:7px; font-family:'IBM Plex Mono',monospace; font-size:11.5px; font-weight:600; color:#fff; }
        .aging-total { font-family:'IBM Plex Mono',monospace; font-weight:600; }
        .wl-row { display:flex; align-items:center; gap:10px; margin-bottom:9px; }
        .wl-name { width:70px; font-size:11.5px; font-weight:500; flex-shrink:0; }
        .wl-bar-track { flex:1; height:8px; background:var(--surface-2); border-radius:4px; overflow:hidden; }
        .wl-bar-fill { height:100%; border-radius:4px; }
        .wl-val { width:46px; text-align:right; font-family:'IBM Plex Mono',monospace; font-size:10.5px; color:var(--ink-soft); flex-shrink:0; }
        .health-item { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); }
        .health-item:last-child { border-bottom:none; }
        .health-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
        .health-dot.green { background:#1DB88E; } .health-dot.amber { background:#F5A524; } .health-dot.red { background:#E2483B; }
        .health-name { font-weight:600; font-size:12px; }
        .health-sub { font-size:10.5px; color:var(--ink-faint); }
        .health-meta { margin-left:auto; text-align:right; font-size:10.5px; color:var(--ink-soft); }
        .activity-item, .milestone-item { display:flex; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); }
        .activity-item:last-child, .milestone-item:last-child { border-bottom:none; }
        .activity-avatar { width:24px; height:24px; border-radius:50%; background:var(--brand-soft); color:var(--brand); display:flex; align-items:center; justify-content:center; font-size:9.5px; font-weight:700; flex-shrink:0; font-family:'Space Grotesk',sans-serif; }
        .activity-text { font-size:11.5px; line-height:1.4; }
        .activity-time { font-size:10px; color:var(--ink-faint); }
        .ms-badge { width:40px; height:40px; border-radius:9px; background:var(--surface-2); flex-shrink:0; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:'Space Grotesk',sans-serif; }
        .ms-badge .d { font-size:13px; font-weight:700; line-height:1; }
        .ms-badge .m { font-size:8px; color:var(--ink-faint); text-transform:uppercase; }
        .ms-name { font-weight:600; font-size:11.5px; }
        .ms-proj { font-size:10px; color:var(--ink-faint); }
        .ms-days { margin-left:auto; font-size:10px; color:var(--brand); font-weight:600; align-self:center; }
        .filter-bar { display:flex; gap:8px; margin-bottom:14px; align-items:center; flex-wrap:wrap; }
        .table-scroll { overflow-x:auto; border-radius:12px; }
        .ticket-table { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; box-shadow:0 1px 2px rgba(19,22,31,0.03); min-width:920px; }
        .ticket-table th, .comms-table th, .analytics-table th, .users-table th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-faint); font-weight:600; padding:10px 12px; background:var(--surface-2); border-bottom:1px solid var(--border); }
        .ticket-table td, .comms-table td, .analytics-table td, .users-table td { padding:9px 12px; border-bottom:1px solid var(--border); font-size:11.5px; }
        .ticket-table tr:last-child td, .comms-table tr:last-child td, .analytics-table tr:last-child td, .users-table tr:last-child td { border-bottom:none; }
        .ticket-table tr:hover, .comms-table tr:hover { background:#FAFAFD; cursor:pointer; }
        .tid { font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--brand); }
        .prio-chip { display:inline-flex; align-items:center; gap:4px; font-weight:600; border-radius:20px; }
        .source-chip { display:inline-flex; align-items:center; font-size:10px; font-weight:600; padding:2px 8px; border-radius:20px; background:var(--surface-2); color:var(--ink-soft); }
        .label-chip { display:inline-flex; align-items:center; gap:3px; font-size:9.5px; font-weight:600; padding:2px 7px; border-radius:20px; margin-top:3px; }
        .status-chip { display:flex; align-items:center; gap:6px; font-size:11px; }
        .row-overdue { background:#FFF6F5; }
        .kanban { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; align-items:start; }
        .kcol { background:var(--surface-2); border-radius:12px; padding:10px; min-height:220px; border:2px dashed transparent; transition:all .15s ease; }
        .kcol.drag-over { background:var(--brand-soft); border-color:var(--brand); }
        .kcol-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:0 2px; }
        .kcol-title { font-weight:700; font-size:11.5px; }
        .kcol-count { font-family:'IBM Plex Mono',monospace; font-size:10.5px; color:var(--ink-faint); background:var(--surface); padding:1px 7px; border-radius:10px; }
        .kcard { background:var(--surface); border-radius:9px; padding:9px 10px; margin-bottom:8px; border:1px solid var(--border); border-left:3px solid var(--border); cursor:grab; transition:all .15s ease; }
        .kcard:hover { transform:translateY(-2px); box-shadow:0 8px 16px rgba(19,22,31,0.09); }
        .kcard:active { cursor:grabbing; opacity:0.6; }
        .kcard-id-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
        .kcard-id { font-family:'IBM Plex Mono',monospace; font-size:9.5px; color:var(--ink-faint); }
        .kcard-title { font-size:11px; font-weight:500; line-height:1.35; margin-bottom:4px; }
        .kcard-desc { font-size:10px; color:var(--ink-faint); line-height:1.35; margin-bottom:8px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .kcard-foot { display:flex; align-items:center; justify-content:space-between; }
        .kcard-assignee { width:18px; height:18px; border-radius:50%; background:var(--brand-soft); color:var(--brand); font-size:8px; font-weight:700; display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk',sans-serif; }
        .ticket-title-cell { max-width:280px; }
        .ticket-desc-snip { font-size:10.5px; color:var(--ink-faint); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px; }

        .mom-row { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:14px; }
        .mom-stat { background:var(--surface-2); border-radius:10px; padding:11px 13px; }
        .mom-label { font-size:10px; color:var(--ink-soft); font-weight:600; text-transform:uppercase; letter-spacing:.02em; }
        .mom-value { font-family:'Space Grotesk',sans-serif; font-size:19px; font-weight:700; margin:3px 0; }
        .mom-delta { font-size:10.5px; display:flex; align-items:center; gap:3px; font-weight:600; }
        .mom-delta.up { color:#16946E; } .mom-delta.down { color:#E2483B; }

        .proj-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .proj-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:15px 16px; cursor:pointer; transition:all .15s ease; box-shadow:0 1px 2px rgba(19,22,31,0.03); }
        .proj-card:hover { border-color:var(--brand); transform:translateY(-2px); box-shadow:0 10px 22px rgba(19,22,31,0.08); }
        .proj-card-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; }
        .proj-code { font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:11px; color:var(--brand); background:var(--brand-soft); padding:2px 8px; border-radius:6px; }
        .proj-name { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:13.5px; margin:8px 0 3px; }
        .proj-client { font-size:10.5px; color:var(--ink-faint); margin-bottom:10px; }
        .proj-meta-row { display:flex; justify-content:space-between; font-size:10.5px; color:var(--ink-soft); border-top:1px solid var(--border); padding-top:9px; margin-top:9px; }
        .proj-stat b { font-family:'IBM Plex Mono',monospace; color:var(--ink); font-size:12px; display:block; }
        .proj-doc-count { display:inline-flex; align-items:center; gap:4px; font-size:10px; color:var(--ink-faint); margin-top:6px; }
        .status-pill { font-size:9.5px; font-weight:700; padding:2px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:.02em; }

        .overlay { position:fixed; inset:0; background:rgba(19,22,31,0.5); backdrop-filter:blur(2px); display:flex; align-items:center; justify-content:center; z-index:100; padding:24px; }
        .modal { background:var(--surface); border-radius:14px; width:100%; max-height:88vh; overflow-y:auto; box-shadow:0 24px 60px rgba(0,0,0,0.28); }
        .modal.w-sm { max-width:420px; } .modal.w-md { max-width:620px; } .modal.w-lg { max-width:800px; } .modal.w-xl { max-width:920px; }
        .modal-head { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border); position:sticky; top:0; background:var(--surface); z-index:2; }
        .modal-title { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:15px; }
        .modal-close { border:none; background:var(--surface-2); width:28px; height:28px; border-radius:7px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--ink-soft); transition:all .15s ease; }
        .modal-close:hover { background:#FCEBEA; color:#E2483B; }
        .modal-body { padding:20px; }
        .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .field { margin-bottom:12px; }
        .field.full { grid-column:1/-1; }
        .field label { display:block; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:var(--ink-soft); margin-bottom:5px; }
        .field input, .field select, .field textarea { width:100%; border:1px solid var(--border); border-radius:8px; padding:8px 10px; font-size:12.5px; font-family:'Inter',sans-serif; color:var(--ink); background:var(--surface); outline:none; transition:border-color .15s ease; }
        .field textarea { resize:vertical; min-height:70px; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color:var(--brand); }
        .mention-picker { display:flex; flex-wrap:wrap; gap:5px; margin-top:6px; }
        .mention-tag { font-size:10.5px; padding:3px 8px; border-radius:20px; background:var(--brand-soft); color:var(--brand); cursor:pointer; font-weight:600; }
        .mention-chip { background:var(--brand-soft); color:var(--brand); padding:1px 5px; border-radius:5px; font-weight:600; font-size:11px; }
        .watcher-chip { display:inline-flex; align-items:center; gap:4px; font-size:10.5px; padding:3px 8px; border-radius:20px; background:var(--surface-2); border:1px solid var(--border); margin:2px 4px 2px 0; cursor:pointer; }
        .watcher-chip.active { background:var(--brand); color:#fff; border-color:var(--brand); }
        .modal-foot { display:flex; justify-content:flex-end; gap:8px; padding:14px 20px; border-top:1px solid var(--border); position:sticky; bottom:0; background:var(--surface); }
        .btn-ghost { background:var(--surface-2); border:none; border-radius:8px; padding:8px 14px; font-size:12px; font-weight:600; cursor:pointer; color:var(--ink); }
        .field-error { font-size:10.5px; color:#E2483B; margin-top:4px; }

        .dropzone { border:1.5px dashed var(--border); border-radius:10px; padding:14px; display:flex; align-items:center; gap:9px; font-size:11.5px; color:var(--ink-soft); cursor:pointer; background:var(--surface-2); transition:all .15s ease; }
        .dropzone:hover { border-color:var(--brand); color:var(--brand); background:var(--brand-soft); }
        .att-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:10px; }
        .att-card { position:relative; border:1px solid var(--border); border-radius:9px; overflow:hidden; background:var(--surface-2); }
        .att-thumb { width:100%; height:64px; object-fit:cover; display:block; background:#DEE1EC; }
        .att-thumb-doc { display:flex; align-items:center; justify-content:center; color:var(--ink-faint); }
        .att-meta { padding:5px 6px; }
        .att-name { font-size:9.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .att-size { font-size:8.5px; color:var(--ink-faint); }
        .att-remove { position:absolute; top:4px; right:4px; width:18px; height:18px; border-radius:50%; background:rgba(19,22,31,0.65); color:#fff; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .att-download { position:absolute; top:4px; left:4px; width:18px; height:18px; border-radius:50%; background:rgba(54,47,158,0.85); color:#fff; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; text-decoration:none; }
        .att-download:hover { background:var(--brand); }
        .att-download-disabled { background:rgba(154,161,178,0.6); cursor:not-allowed; }
        .att-empty { font-size:11px; color:var(--ink-faint); padding:8px 0; }

        .td-meta-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:16px; }
        .td-meta-item { background:var(--surface-2); border-radius:9px; padding:8px 10px; }
        .td-meta-label { font-size:9.5px; text-transform:uppercase; letter-spacing:.03em; color:var(--ink-faint); font-weight:700; margin-bottom:3px; }
        .td-meta-value { font-size:12px; font-weight:600; }
        .td-desc { font-size:12.5px; line-height:1.55; color:var(--ink); background:var(--surface-2); border-radius:9px; padding:12px; margin-bottom:16px; }
        .td-section-title { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:12.5px; margin-bottom:10px; display:flex; align-items:center; gap:6px; }
        .comment-item { display:flex; gap:9px; margin-bottom:12px; }
        .comment-body { background:var(--surface-2); border-radius:9px; padding:9px 11px; flex:1; }
        .comment-author { font-size:11.5px; font-weight:700; }
        .comment-time { font-size:9.5px; color:var(--ink-faint); margin-left:6px; font-weight:400; }
        .comment-text { font-size:12px; margin-top:3px; line-height:1.45; }
        .comment-input-row { display:flex; gap:8px; margin-top:6px; }
        .comment-input-row textarea { flex:1; }
        .send-btn { background:var(--brand); color:#fff; border:none; border-radius:8px; padding:0 14px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .timeline-item { display:flex; gap:9px; font-size:11.5px; padding:6px 0; }
        .timeline-dot { width:6px; height:6px; border-radius:50%; background:var(--brand); margin-top:5px; flex-shrink:0; }
        .reopen-banner { display:flex; align-items:center; justify-content:space-between; gap:10px; background:#FCEBEA; color:#E2483B; border-radius:10px; padding:10px 14px; font-size:11.5px; font-weight:500; margin-bottom:16px; }
        .reopen-btn { background:#E2483B; color:#fff; border:none; border-radius:7px; padding:7px 12px; font-size:11.5px; font-weight:700; display:flex; align-items:center; gap:5px; cursor:pointer; flex-shrink:0; }
        .timer-btn { border:none; border-radius:8px; padding:8px 14px; font-size:11.5px; font-weight:700; display:flex; align-items:center; gap:6px; cursor:pointer; }
        .timer-btn-start { background:var(--brand); color:#fff; }
        .timer-btn-stop { background:#FCEBEA; color:#E2483B; }

        .comms-chan { display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:600; padding:2px 7px; border-radius:20px; background:var(--surface-2); color:var(--ink-soft); margin-right:4px; }
        .comms-chan.email { background:#E4F0FF; color:#2563EB; }
        .comms-chan.teams { background:#EDE6FF; color:#5B3DE0; }
        .integ-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }
        .integ-card { border:1px solid var(--border); border-radius:10px; padding:12px 13px; background:var(--surface); }
        .integ-head { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
        .integ-icon { width:26px; height:26px; border-radius:7px; background:var(--brand-soft); color:var(--brand); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .integ-name { font-weight:700; font-size:11.5px; }
        .integ-status { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:#16946E; background:#E4F8F1; padding:1px 7px; border-radius:20px; margin-left:auto; }
        .integ-endpoint { font-family:'IBM Plex Mono',monospace; font-size:9.5px; color:var(--brand); background:var(--brand-soft); padding:3px 7px; border-radius:5px; display:inline-block; margin-bottom:6px; }
        .integ-note { font-size:10.5px; color:var(--ink-soft); line-height:1.4; }

        .np-tabs { display:flex; gap:6px; margin-bottom:12px; }
        .np-tab { padding:6px 12px; border-radius:8px; font-size:11.5px; font-weight:600; cursor:pointer; background:var(--surface-2); color:var(--ink-soft); display:flex; align-items:center; gap:5px; }
        .np-tab.active { background:var(--brand); color:#fff; }
        .email-frame { border:1px solid var(--border); border-radius:10px; overflow:hidden; }
        .email-head { background:var(--surface-2); padding:12px 14px; font-size:11.5px; }
        .email-head div { margin-bottom:3px; }
        .email-head b { color:var(--ink-soft); font-weight:600; width:46px; display:inline-block; }
        .email-body { padding:16px 14px; font-size:12.5px; line-height:1.6; }
        .teams-card { border:1px solid var(--border); border-radius:10px; overflow:hidden; background:#F6F5FF; }
        .teams-head { display:flex; align-items:center; gap:9px; padding:12px 14px; background:#5B3DE0; color:#fff; }
        .teams-bot-avatar { width:26px; height:26px; border-radius:6px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .teams-head-text { font-size:12px; font-weight:700; }
        .teams-head-sub { font-size:9.5px; opacity:0.85; }
        .teams-body { padding:14px; font-size:12px; line-height:1.55; }
        .teams-btn { display:inline-flex; align-items:center; gap:5px; background:#fff; border:1px solid #D8D4F5; color:#5B3DE0; font-size:11px; font-weight:600; padding:6px 12px; border-radius:7px; margin-top:10px; cursor:default; }

        .users-table { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
        .users-table select { border:1px solid var(--border); border-radius:6px; padding:4px 8px; font-size:11px; }
        .users-role-badge { font-size:9.5px; font-weight:700; padding:2px 8px; border-radius:20px; background:var(--brand-soft); color:var(--brand); }
        .del-btn { background:none; border:none; color:var(--ink-faint); cursor:pointer; display:flex; }
        .label-add-input { border:1px solid var(--border); border-radius:8px; padding:7px 11px; font-size:12.5px; min-width:220px; outline:none; }
        .label-add-input:focus { border-color:var(--brand); }
        .labels-manage-grid { display:flex; flex-direction:column; gap:2px; }
        .labels-manage-row { display:flex; align-items:center; gap:12px; padding:9px 4px; border-bottom:1px solid var(--border); }
        .labels-manage-row:last-child { border-bottom:none; }
        .labels-manage-count { font-size:10.5px; color:var(--ink-faint); margin-left:auto; }
        .del-btn:hover { color:#E2483B; }
        .analytics-table td:first-child { font-weight:600; }
      `}</style>

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="logo">P</div>
        {perm.dashboard && <button className={`nav-btn ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}><LayoutDashboard size={17} /></button>}
        {perm.simpleDashboard && <button className={`nav-btn ${tab === "myboard" ? "active" : ""}`} onClick={() => setTab("myboard")}><Gauge size={17} /></button>}
        {perm.projects && <button className={`nav-btn ${tab === "projects" ? "active" : ""}`} onClick={() => setTab("projects")}><Folder size={17} /></button>}
        <button className={`nav-btn ${tab === "tickets" ? "active" : ""}`} onClick={() => setTab("tickets")}><TicketIcon size={17} /></button>
        {perm.board && <button className={`nav-btn ${tab === "kanban" ? "active" : ""}`} onClick={() => setTab("kanban")}><Trello size={17} /></button>}
        {perm.comms && <button className={`nav-btn ${tab === "comms" ? "active" : ""}`} onClick={() => setTab("comms")}><Mail size={17} /></button>}
        {perm.adminAnalytics && <button className={`nav-btn ${tab === "analytics" ? "active" : ""}`} onClick={() => setTab("analytics")}><BarChart3 size={17} /></button>}
        {perm.userManagement && <button className={`nav-btn ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}><UserCog size={17} /></button>}
        {perm.manageLabels && <button className={`nav-btn ${tab === "labels" ? "active" : ""}`} onClick={() => setTab("labels")}><Tag size={17} /></button>}
      </div>

      <div className="main">
        {/* TOPBAR */}
        <div className="topbar">
          <div className="titles"><h1>Pulse</h1><p>Portfolio control room</p></div>
          <div className="search-box"><Search size={14} /><input placeholder="Search tickets, projects, people…" /></div>
          <div className="topbar-right">
            <div className="select-pill proj-select-wrap">
              <select className="proj-select" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
                <option value="ALL">All projects</option>
                {projects.map(p => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
              </select>
              <ChevronDown size={13} className="proj-select-chevron" />
            </div>
            <button className="btn-primary" onClick={() => setShowCreateTicket(true)}><Plus size={14} />New ticket</button>
            <div className="bell-wrap">
              <div className="bell" onClick={() => setShowBell(v => !v)}>
                <Bell size={17} />
                {unreadCount > 0 && <span className="dot">{unreadCount}</span>}
              </div>
              {showBell && (
                <div className="bell-dropdown">
                  <div className="bell-head">Notifications
                    {unreadCount > 0 && <span onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}>Mark all read</span>}
                  </div>
                  {notifications.length === 0 && <div className="bell-empty">No notifications yet.<br />Create a ticket or project to see one.</div>}
                  {notifications.slice(0, 12).map(n => (
                    <div key={n.id} className={`bell-item ${!n.read ? "unread" : ""}`}
                      onClick={() => { setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x)); setNotifPreview(n); }}>
                      <div className="bell-icon"><NotifIcon type={n.type} /></div>
                      <div>
                        <div className="bell-subject">{n.subject}</div>
                        <div className="bell-body">To {n.recipient} · {n.body.slice(0, 65)}{n.body.length > 65 ? "…" : ""}</div>
                        <div className="bell-time">{n.time} · via email + Teams</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {perm.dashboard && (
              <button className="icon-btn" title="View role & permission matrix" onClick={() => setShowRoleMatrix(true)}><Shield size={16} /></button>
            )}
            <div className="bell-wrap">
              <div className="role-switcher" onClick={() => setShowRoleSwitcher(v => !v)}>
                <div className="avatar">{initialsOf(role.label)}</div>
                <div className="role-switcher-text">
                  <div className="role-switcher-name">{role.label}</div>
                  <div className="role-switcher-group">{role.identity}</div>
                </div>
                <ChevronDown size={13} />
              </div>
              {showRoleSwitcher && (
                <div className="bell-dropdown role-dropdown">
                  <div className="bell-head">Viewing as</div>
                  {["Full access", "Field team", "External"].map(group => (
                    <div key={group}>
                      <div className="role-group-label">{group}</div>
                      {ROLES.filter(r => r.group === group).map(r => (
                        <div key={r.id} className={`role-option ${r.id === roleId ? "active" : ""}`} onClick={() => switchRole(r.id)}>
                          <div className="role-option-avatar">{initialsOf(r.label)}</div>
                          <div>
                            <div className="role-option-name">{r.label}{r.id === roleId && <CheckCircle2 size={12} style={{ marginLeft: 5 }} />}</div>
                            <div className="role-option-blurb">{r.blurb}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="tabs">
          {perm.dashboard && <button className={`tab-btn ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}><LayoutDashboard size={13} /> Dashboard</button>}
          {perm.simpleDashboard && <button className={`tab-btn ${tab === "myboard" ? "active" : ""}`} onClick={() => setTab("myboard")}><Gauge size={13} /> My tickets summary</button>}
          {perm.projects && <button className={`tab-btn ${tab === "projects" ? "active" : ""}`} onClick={() => setTab("projects")}><Folder size={13} /> Projects</button>}
          <button className={`tab-btn ${tab === "tickets" ? "active" : ""}`} onClick={() => setTab("tickets")}><TicketIcon size={13} /> {ticketScopeLabel(perm)}</button>
          {perm.board && <button className={`tab-btn ${tab === "kanban" ? "active" : ""}`} onClick={() => setTab("kanban")}><Trello size={13} /> Board</button>}
          {perm.comms && <button className={`tab-btn ${tab === "comms" ? "active" : ""}`} onClick={() => setTab("comms")}><Mail size={13} /> Comms & tracking {notifications.length > 0 && `(${notifications.length})`}</button>}
          {perm.adminAnalytics && <button className={`tab-btn ${tab === "analytics" ? "active" : ""}`} onClick={() => setTab("analytics")}><BarChart3 size={13} /> Analytics</button>}
          {perm.userManagement && <button className={`tab-btn ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}><UserCog size={13} /> Users & roles ({users.length})</button>}
          {perm.manageLabels && <button className={`tab-btn ${tab === "labels" ? "active" : ""}`} onClick={() => setTab("labels")}><Tag size={13} /> Labels ({labels.length})</button>}
        </div>

        <div className="content">
          {tab === "dashboard" && perm.dashboard && (
            <>
              <div className="kpi-grid">
                <KpiCard icon={TicketIcon} tone="ink" label="Open tickets" value={openTickets.length} sub={`of ${filteredTickets.length} total`} />
                <KpiCard icon={Clock} tone="amber" label="Due today" value={dueToday.length} />
                <KpiCard icon={AlertTriangle} tone="red" label="Overdue" value={overdue.length} sub={`${openTickets.length ? Math.round(overdue.length / openTickets.length * 100) : 0}% of open`} />
                <KpiCard icon={Flame} tone="red" label="High + Critical" value={highPriority.length} />
                <KpiCard icon={CheckCircle2} tone="green" label="Closed this month" value={completedThisMonth.length} />
                <KpiCard icon={TrendingUp} tone="brand" label="Avg resolution" value={`${avgResolution}d`} />
                <KpiCard icon={Gauge} tone="green" label="SLA compliance" value={`${slaCompliance}%`} />
                <KpiCard icon={Users} tone="brand" label="Team capacity used" value={`${capacityUsed}%`} />
              </div>

              <div className="row row-2">
                <div className="panel">
                  <div className="panel-head">
                    <div><div className="panel-title">Open tickets by priority</div><div className="panel-sub">{openTickets.length} tickets currently open</div></div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                        {priorityData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E3E5EF" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="legend-row" style={{ justifyContent: "center", marginTop: -6 }}>
                    {priorityData.map((d, i) => <span key={i}><span className="legend-dot" style={{ background: d.color }} />{d.name} ({d.value})</span>)}
                  </div>
                </div>
                <LabelBreakdown tickets={filteredTickets} />
              </div>

              <div className="row">
                <TrendPanel projectCode={projectFilter} />
              </div>

              <div className="row">
                <div className="panel">
                  <div className="panel-head">
                    <div><div className="panel-title">Ticket ageing by project</div><div className="panel-sub">How long open tickets have sat untouched, bucketed by age</div></div>
                    <div className="legend-row">{AGING_BUCKETS.map((b, i) => <span key={i}><span className="legend-dot" style={{ background: AGING_COLORS[i] }} />{b}</span>)}</div>
                  </div>
                  <table className="aging-table">
                    <thead><tr><th style={{ width: "22%" }}>Project</th>{AGING_BUCKETS.map(b => <th key={b} className="aging-cell">{b}</th>)}<th className="aging-cell">Total open</th></tr></thead>
                    <tbody>
                      {agingByProject.map(({ proj, buckets, total }) => (
                        <tr key={proj.code}>
                          <td><div className="aging-proj">{proj.code}</div><div className="aging-proj-sub">{proj.name}</div></td>
                          {buckets.map((c, i) => (
                            <td key={i} className="aging-cell"><span className="aging-chip" style={{ background: AGING_COLORS[i], opacity: c === 0 ? 0.18 : 0.55 + Math.min(c, 10) * 0.045, color: c === 0 ? "#9AA1B2" : "#fff" }}>{c}</span></td>
                          ))}
                          <td className="aging-cell aging-total">{total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="row row-2b">
                <div className="panel">
                  <div className="panel-head"><div><div className="panel-title">Sprint burndown</div><div className="panel-sub">Story points remaining — current sprint, day 10 of 10</div></div></div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={BURNDOWN} margin={{ left: -18, right: 8 }}>
                      <CartesianGrid stroke="#EEF0F6" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9AA1B2" }} axisLine={{ stroke: "#E3E5EF" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9AA1B2" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E3E5EF" }} />
                      <Line type="monotone" dataKey="ideal" stroke="#C4C8D6" strokeDasharray="4 3" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="actual" stroke="#362F9E" strokeWidth={2.2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="panel">
                  <div className="panel-head"><div><div className="panel-title">Team workload</div><div className="panel-sub">Remaining hours on open tickets, top 8</div></div></div>
                  {workload.map((w, i) => {
                    const overloaded = w.remaining > 32;
                    return (
                      <div className="wl-row" key={i}>
                        <div className="wl-name">{w.name}</div>
                        <div className="wl-bar-track"><div className="wl-bar-fill" style={{ width: `${Math.min(100, (w.remaining / 40) * 100)}%`, background: overloaded ? "#E2483B" : "#362F9E" }} /></div>
                        <div className="wl-val">{w.remaining}h</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="row row-2b">
                <div className="panel">
                  <div className="panel-head"><div><div className="panel-title">Project health</div><div className="panel-sub">Based on share of overdue open tickets</div></div></div>
                  {projectHealth.map(({ proj, openCt, od, health }) => (
                    <div className="health-item" key={proj.code}>
                      <div className={`health-dot ${health}`} />
                      <div><div className="health-name">{proj.code}</div><div className="health-sub">{proj.name}</div></div>
                      <div className="health-meta">{openCt} open<br />{od} overdue</div>
                    </div>
                  ))}
                </div>
                <div className="panel">
                  <div className="panel-head"><div className="panel-title">Upcoming milestones</div></div>
                  {MILESTONES.map((m, i) => (
                    <div className="milestone-item" key={i}>
                      <div className="ms-badge"><div className="d">{m.date.split(" ")[0]}</div><div className="m">{m.date.split(" ")[1]}</div></div>
                      <div><div className="ms-name">{m.name}</div><div className="ms-proj">{m.project}</div></div>
                      <div className="ms-days">{m.days}d</div>
                    </div>
                  ))}
                  <div className="panel-title" style={{ marginTop: 14, marginBottom: 8, fontSize: 12 }}>Recent activity</div>
                  {activityLog.slice(0, 5).map((a) => (
                    <div className="activity-item" key={a.id}><div className="activity-avatar">{initialsOf(a.who)}</div><div><div className="activity-text"><strong>{a.who}</strong> {a.action}</div><div className="activity-time">{a.time}</div></div></div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "myboard" && perm.simpleDashboard && (
            <>
              <div className="restricted-banner"><Gauge size={14} />Personal summary for <strong style={{ margin: "0 4px" }}>{role.identity}</strong> ({role.label}) — counts only the tickets you raised.</div>
              <div className="kpi-grid cols-4">
                <KpiCard icon={TicketIcon} tone="brand" label="Raised by me" value={myTickets.length} />
                <KpiCard icon={Clock} tone="amber" label="Open / pending" value={myOpen.length} />
                <KpiCard icon={TrendingUp} tone="ink" label="In progress" value={myInProgress.length} />
                <KpiCard icon={CheckCircle2} tone="green" label="Closed" value={myClosed.length} />
              </div>
              <div className="row">
                <LabelBreakdown tickets={myTickets} title="My tickets by issue category" sub="Helps spot which problem types you raise most often" />
              </div>
              <div className="panel">
                <div className="panel-head"><div className="panel-title">My recent tickets</div></div>
                <div className="table-scroll">
                  <table className="ticket-table" style={{ minWidth: 0 }}>
                    <thead><tr><th>ID</th><th>Title</th><th>Label</th><th>Status</th><th>Raised</th></tr></thead>
                    <tbody>
                      {myTickets.slice(0, 15).map(t => (
                        <tr key={t.id} onClick={() => setOpenTicketId(t.id)}>
                          <td className="tid">{t.id}</td><td>{t.title}</td><td><LabelChip l={t.label} /></td>
                          <td><span className="status-chip"><StatusDot status={t.status} />{t.status}</span></td>
                          <td className="mono">{fmt(t.created)}</td>
                        </tr>
                      ))}
                      {myTickets.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 20 }}>No tickets raised yet — use "New ticket" to raise your first one.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {tab === "projects" && perm.projects && (
            <>
              <div className="filter-bar">
                <div className="select-pill">{projects.length} projects</div>
                {perm.createProject && <button className="btn-primary" style={{ marginLeft: "auto" }} onClick={() => setShowCreateProject(true)}><Plus size={14} />New project</button>}
              </div>
              <div className="proj-grid">
                {projectHealth.map(({ proj, openCt, od, health, total }) => (
                  <div className="proj-card" key={proj.code} onClick={() => setOpenProjectId(proj.code)}>
                    <div className="proj-card-head">
                      <span className="proj-code">{proj.code}</span>
                      <span className={`health-dot ${health}`} title={`${health} health`} />
                    </div>
                    <div className="proj-name">{proj.name}</div>
                    <div className="proj-client">{proj.client} · PM: {proj.lead}</div>
                    <span className="status-pill" style={{
                      background: proj.status === "Active" ? "#E4F8F1" : proj.status === "Planning" ? "#E4F0FF" : proj.status === "On Hold" ? "#FDF1DC" : "#EEF0F6",
                      color: proj.status === "Active" ? "#16946E" : proj.status === "Planning" ? "#2563EB" : proj.status === "On Hold" ? "#C87F0A" : "#676F82",
                    }}>{proj.status}</span>{" "}
                    <PrioChip p={proj.priority} small />
                    <div className="proj-doc-count"><Folder size={11} />{proj.documents.length} document{proj.documents.length !== 1 ? "s" : ""} in folder</div>
                    <div className="proj-meta-row">
                      <div className="proj-stat">{fmt(proj.start)} — {fmt(proj.end)}</div>
                      <div className="proj-stat" style={{ textAlign: "right" }}><b>{total} tickets</b>{openCt} open · {od} overdue</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "tickets" && (
            <>
              {perm.scope === "reporter" && (
                <div className="kpi-grid cols-4" style={{ marginBottom: 14 }}>
                  <KpiCard icon={TicketIcon} tone="brand" label="Tickets raised" value={filteredTickets.length} />
                  <KpiCard icon={Clock} tone="amber" label="Open" value={filteredTickets.filter(t => t.isOpen).length} />
                  <KpiCard icon={CheckCircle2} tone="green" label="Closed" value={filteredTickets.filter(t => !t.isOpen).length} />
                  <KpiCard icon={RotateCcw} tone="red" label="Reopened" value={filteredTickets.filter(t => t.status === "Reopened").length} />
                </div>
              )}
              {perm.scope !== "all" && (
                <div className="restricted-banner">
                  <Lock size={14} />
                  {perm.scope === "source"
                    ? <>You're viewing tickets raised via <strong style={{ margin: "0 4px" }}>{role.source}</strong> — as a {role.label}, you can raise tickets, comment, take updates, and close them.</>
                    : <>You're viewing only tickets you raised as <strong style={{ margin: "0 4px" }}>{role.identity}</strong>. The assignee is shown by department, and closed tickets can be reopened if the issue isn't resolved.</>}
                </div>
              )}
              <div className="filter-bar">
                <select className="select-pill" value={ticketFilters.status} onChange={e => setTicketFilters(f => ({ ...f, status: e.target.value }))} style={{ border: "1px solid #E3E5EF" }}>
                  <option value="ALL">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="select-pill" value={ticketFilters.priority} onChange={e => setTicketFilters(f => ({ ...f, priority: e.target.value }))} style={{ border: "1px solid #E3E5EF" }}>
                  <option value="ALL">All priorities</option>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {perm.allTickets && (
                  <select className="select-pill" value={ticketFilters.source} onChange={e => setTicketFilters(f => ({ ...f, source: e.target.value }))} style={{ border: "1px solid #E3E5EF" }}>
                    <option value="ALL">All sources</option>{SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                <div className="select-pill">{filteredTable.length} shown</div>
                <button className="btn-primary" style={{ marginLeft: "auto" }} onClick={() => setShowCreateTicket(true)}><Plus size={14} />New ticket</button>
              </div>
              <div className="table-scroll">
                <table className="ticket-table">
                  <thead><tr><th>ID</th><th>Title</th><th>Source</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Start</th><th>End</th><th>Age</th><th>Files</th>{(perm.allTickets || perm.timeTracking) && <th>Time logged</th>}</tr></thead>
                  <tbody>
                    {filteredTable.map(t => (
                      <tr key={t.id} className={t.isOverdue ? "row-overdue" : ""} onClick={() => setOpenTicketId(t.id)}>
                        <td className="tid">{t.id}</td>
                        <td className="ticket-title-cell">
                          <div>{t.title}</div>
                          {t.description && <div className="ticket-desc-snip" title={t.description}>{t.description}</div>}
                          <LabelChip l={t.label} />
                        </td>
                        <td><SourceChip s={t.source} /></td>
                        <td><PrioChip p={t.priority} /></td>
                        <td><span className="status-chip"><StatusDot status={t.status} />{t.status}</span></td>
                        <td>{assigneeDisplay(t, perm)}</td>
                        <td className="mono">{fmt(t.created)}</td>
                        <td className="mono" style={{ color: t.isOverdue ? "#E2483B" : "inherit" }}>{fmt(t.due)}</td>
                        <td className="mono">{t.ageDays}d</td>
                        <td>{t.attachments.length > 0 ? <span className="status-chip"><Paperclip size={11} />{t.attachments.length}</span> : "—"}</td>
                        {(perm.allTickets || perm.timeTracking) && <td className="mono">{formatMinutes(totalLoggedMinutes(t))}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "kanban" && perm.board && (
            <div className="kanban">
              {kanbanCols.map(col => {
                const items = ticketsForKanban.filter(t => t.status === col);
                return (
                  <div className={`kcol ${dragOverCol === col ? "drag-over" : ""}`} key={col}
                    onDragOver={e => { e.preventDefault(); if (dragOverCol !== col) setDragOverCol(col); }}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={e => handleDrop(e, col)}>
                    <div className="kcol-head"><div className="kcol-title">{col}</div><div className="kcol-count">{items.length}</div></div>
                    {items.slice(0, 12).map(t => (
                      <div className="kcard" key={t.id} draggable
                        onDragStart={e => e.dataTransfer.setData("text/plain", t.id)}
                        onClick={() => setOpenTicketId(t.id)}
                        style={{ borderLeftColor: PRIORITY_COLOR[t.priority] }}>
                        <div className="kcard-id-row"><span className="kcard-id">{t.id}</span><GripVertical size={11} color="#C4C8D6" /></div>
                        <div className="kcard-title">{t.title}</div>
                        {t.description && <div className="kcard-desc">{t.description}</div>}
                        <div className="kcard-foot"><PrioChip p={t.priority} small /><div className="kcard-assignee">{initialsOf(t.assignee)}</div></div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "comms" && perm.comms && (
            <>
              <div className="panel" style={{ marginBottom: 12 }}>
                <div className="panel-title" style={{ display: "flex", alignItems: "center", gap: 6 }}><Plug size={14} />Connected intake channels</div>
                <div className="panel-sub" style={{ marginBottom: 12 }}>Other teams raise tickets straight into Pulse from their own tools; every ticket keeps its source so leadership can see where demand is coming from.</div>
                <div className="integ-grid">
                  {INTEGRATIONS.map((it, i) => (
                    <div className="integ-card" key={i}>
                      <div className="integ-head"><div className="integ-icon"><it.icon size={13} /></div><div className="integ-name">{it.name}</div><span className="integ-status">Connected</span></div>
                      <div className="integ-endpoint">{it.endpoint}</div>
                      <div className="integ-note">{it.note}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel" style={{ marginBottom: 12 }}>
                <div className="panel-title">Communication & tracking log</div>
                <div className="panel-sub">Every assignment, mention, status change, attachment, reopen, and new project generates an email plus a Microsoft Teams notification — this is the audit trail management can review.</div>
              </div>
              <div className="table-scroll">
                <table className="comms-table" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, minWidth: 700 }}>
                  <thead><tr><th>Time</th><th>Ticket / Project</th><th>Type</th><th>Recipient</th><th>Subject</th><th>Channel</th></tr></thead>
                  <tbody>
                    {notifications.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--ink-faint)" }}>No communications yet — create a ticket or project, or add a comment with an @mention.</td></tr>}
                    {notifications.map(n => (
                      <tr key={n.id} onClick={() => { setNotifPreview(n); setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x)); }}>
                        <td className="mono">{n.time}</td>
                        <td className="tid">{n.ticketId}</td>
                        <td style={{ textTransform: "capitalize" }}>{n.type}</td>
                        <td>{n.recipient}</td>
                        <td>{n.subject}</td>
                        <td><span className="comms-chan email"><Mail size={10} />Email</span><span className="comms-chan teams"><MessageCircle size={10} />Teams</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "analytics" && perm.adminAnalytics && (
            <>
              <div className="row">
                <TrendPanel projectCode={projectFilter} />
              </div>
              <div className="row row-2">
                <LabelBreakdown tickets={filteredTickets} title="Recurring issue categories" sub="Across the current project filter — helps spot what to fix at the root" />
                <div className="panel">
                  <div className="panel-head"><div><div className="panel-title">Client-raised tickets</div><div className="panel-sub">Source = Client Portal, all projects merged</div></div></div>
                  {(() => {
                    const clientPts = tickets.filter(t => t.source === "Client Portal");
                    const co = clientPts.filter(t => t.isOpen).length;
                    const cc = clientPts.filter(t => t.status === "Completed" || t.status === "Closed").length;
                    const cr = clientPts.filter(t => t.status === "Reopened").length;
                    return (
                      <div className="kpi-grid cols-4" style={{ marginBottom: 0 }}>
                        <KpiCard icon={TicketIcon} tone="brand" label="Total raised" value={clientPts.length} />
                        <KpiCard icon={Clock} tone="amber" label="Open" value={co} />
                        <KpiCard icon={CheckCircle2} tone="green" label="Closed" value={cc} />
                        <KpiCard icon={RotateCcw} tone="red" label="Reopened" value={cr} />
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="row">
                <div className="panel">
                  <div className="panel-head"><div><div className="panel-title">Project-wise performance</div><div className="panel-sub">Total, open, closed, ageing, and the client-raised slice — under each project</div></div></div>
                  <div className="table-scroll">
                    <table className="analytics-table" style={{ minWidth: 760 }}>
                      <thead><tr><th>Project</th><th>Total</th><th>Open</th><th>Closed</th><th>Avg age (open)</th><th>Client-raised</th><th>Client open</th><th>Client closed</th></tr></thead>
                      <tbody>
                        {projectAnalytics.map(({ proj, total, open, closed, avgAge, clientTotal, clientOpen, clientClosed }) => (
                          <tr key={proj.code}>
                            <td>{proj.code} <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>— {proj.name}</span></td>
                            <td className="mono">{total}</td>
                            <td className="mono">{open}</td>
                            <td className="mono">{closed}</td>
                            <td className="mono">{avgAge}d</td>
                            <td className="mono">{clientTotal}</td>
                            <td className="mono">{clientOpen}</td>
                            <td className="mono">{clientClosed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "users" && perm.userManagement && (
            <>
              <div className="filter-bar">
                <div className="select-pill">{users.length} users</div>
                <button className="btn-primary" style={{ marginLeft: "auto" }} onClick={() => setShowAddUser(true)}><UserPlus size={14} />Add user</button>
              </div>
              <table className="users-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Group</th><th></th></tr></thead>
                <tbody>
                  {users.map(u => {
                    const uRole = ROLES.find(r => r.id === u.roleId);
                    return (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                        <td className="mono" style={{ color: "var(--ink-soft)" }}>{u.email}</td>
                        <td>
                          <select value={u.roleId} onChange={e => handleChangeUserRole(u.id, e.target.value)}>
                            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                          </select>
                        </td>
                        <td><span className="users-role-badge">{uRole?.group}</span></td>
                        <td><button className="del-btn" onClick={() => handleRemoveUser(u.id)}><Trash2 size={14} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {tab === "labels" && perm.manageLabels && (
            <LabelsManager labels={labels} tickets={tickets} onAdd={handleAddLabel} onRemove={handleRemoveLabel} />
          )}
        </div>
      </div>

      {showCreateTicket && <CreateTicketModal onClose={() => setShowCreateTicket(false)} onCreate={handleCreateTicket} defaultProject={projectFilter !== "ALL" ? projectFilter : projects[0].code} projects={projects} role={role} perm={perm} labels={labels} />}
      {showCreateProject && <CreateProjectModal onClose={() => setShowCreateProject(false)} onCreate={handleCreateProject} existingCodes={projects.map(p => p.code)} />}
      {showAddUser && <AddUserModal onClose={() => setShowAddUser(false)} onCreate={handleAddUser} />}

      {openTicket && (
        <TicketDetailModal ticket={openTicket} onClose={() => setOpenTicketId(null)} onAddComment={handleAddComment} onStatusChange={handleStatusChange} onAddAttachments={handleAddAttachments} onReopen={handleReopen} onStartTimer={handleStartTimer} onStopTimer={handleStopTimer} activity={activityLog.filter(a => a.ticketId === openTicket.id)} perm={perm} role={role} />
      )}
      {openProject && (
        <ProjectDetailModal project={openProject} tickets={tickets.filter(t => t.project === openProject.code)} onClose={() => setOpenProjectId(null)} onAddDocuments={handleAddProjectDocuments}
          onOpenTicket={(id) => { setOpenProjectId(null); setOpenTicketId(id); }}
          onViewDashboard={() => { setProjectFilter(openProject.code); setOpenProjectId(null); if (perm.dashboard) setTab("dashboard"); }} />
      )}
      {notifPreview && <NotificationPreviewModal notif={notifPreview} onClose={() => setNotifPreview(null)} />}
      {showRoleMatrix && <RoleMatrixModal onClose={() => setShowRoleMatrix(false)} />}
    </div>
  );
}

/* ---------------------------------------------------------
   CREATE TICKET MODAL
--------------------------------------------------------- */
function CreateTicketModal({ onClose, onCreate, defaultProject, projects, role, perm, labels }) {
  const [form, setForm] = useState({
    title: "", description: "", project: defaultProject, type: "Task", priority: "Medium",
    source: perm.scope === "all" ? "Internal / PM" : role.source, label: labels[0],
    assignee: PEOPLE[0], watchers: [], startDate: toInputDate(TODAY), endDate: toInputDate(daysAgo(-7)),
    storyPoints: 3, estimated: 8, attachments: [],
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleWatcher = (name) => setForm(f => ({ ...f, watchers: f.watchers.includes(name) ? f.watchers.filter(w => w !== name) : [...f.watchers, name] }));
  const insertMention = (name) => set("description", form.description + (form.description.endsWith(" ") || form.description === "" ? "" : " ") + `@[${name}] `);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title">New ticket</div><button className="modal-close" onClick={onClose}><X size={15} /></button></div>
        <div className="modal-body">
          <div className="field full"><label>Title</label><input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Checkout fails on Safari with saved cards" /></div>
          <div className="field full">
            <label>Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Steps to reproduce, expected behaviour, acceptance criteria…" />
            <div className="mention-picker"><span style={{ fontSize: 10.5, color: "var(--ink-faint)", alignSelf: "center", marginRight: 2 }}>Mention:</span>{PEOPLE.slice(0, 6).map(p => <span key={p} className="mention-tag" onClick={() => insertMention(p)}>@{p}</span>)}</div>
          </div>
          <div className="form-grid">
            <div className="field"><label>Project</label><select value={form.project} onChange={e => set("project", e.target.value)}>{projects.map(p => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}</select></div>
            <div className="field">
              <label>Raised via</label>
              {perm.scope === "all" ? (
                <select value={form.source} onChange={e => set("source", e.target.value)}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select>
              ) : (
                <input value={form.source} disabled style={{ background: "var(--surface-2)", color: "var(--ink-soft)" }} />
              )}
            </div>
            <div className="field"><label>Issue category / label</label><select value={form.label} onChange={e => set("label", e.target.value)}>{labels.map(l => <option key={l}>{l}</option>)}</select></div>
            <div className="field"><label>Type</label><select value={form.type} onChange={e => set("type", e.target.value)}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label>Priority</label><select value={form.priority} onChange={e => set("priority", e.target.value)}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
            <div className="field"><label>Assignee</label><select value={form.assignee} onChange={e => set("assignee", e.target.value)}>{PEOPLE.map(p => <option key={p}>{p}</option>)}</select></div>
            <div className="field"><label>Start date</label><input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} /></div>
            <div className="field"><label>End date</label><input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} /></div>
            {perm.scope === "all" && <div className="field"><label>Story points</label><input type="number" min="0" value={form.storyPoints} onChange={e => set("storyPoints", e.target.value)} /></div>}
            {perm.scope === "all" && <div className="field"><label>Estimated hours</label><input type="number" min="0" value={form.estimated} onChange={e => set("estimated", e.target.value)} /></div>}
          </div>
          <div className="field full"><label>Watchers (get notified on updates)</label><div>{PEOPLE.filter(p => p !== form.assignee).map(p => <span key={p} className={`watcher-chip ${form.watchers.includes(p) ? "active" : ""}`} onClick={() => toggleWatcher(p)}>{p}</span>)}</div></div>
          <div className="field full">
            <label>Attachments — documents, images, or videos</label>
            <AttachmentPicker files={form.attachments} onChange={files => set("attachments", files)} />
          </div>
        </div>
        <div className="modal-foot"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={() => onCreate(form)}><Plus size={14} />Create & notify</button></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   CREATE PROJECT MODAL
--------------------------------------------------------- */
function CreateProjectModal({ onClose, onCreate, existingCodes }) {
  const [form, setForm] = useState({
    name: "", code: "", client: "", lead: PEOPLE[0], status: "Planning", priority: "Medium",
    start: toInputDate(TODAY), end: toInputDate(daysAgo(-60)), description: "", documents: [],
  });
  const [error, setError] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function submit() {
    const code = form.code.trim().toUpperCase().replace(/\s+/g, "");
    if (!code) { setError("Project code is required."); return; }
    if (existingCodes.includes(code)) { setError(`Code "${code}" is already in use — pick another.`); return; }
    if (!form.name.trim()) { setError("Project name is required."); return; }
    setError("");
    onCreate(form);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-md" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title">New project</div><button className="modal-close" onClick={onClose}><X size={15} /></button></div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field full"><label>Project name</label><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Compass — Partner Onboarding" /></div>
            <div className="field"><label>Project code</label><input value={form.code} onChange={e => set("code", e.target.value.toUpperCase())} placeholder="e.g. COMPASS" maxLength={10} /></div>
            <div className="field"><label>Client</label><input value={form.client} onChange={e => set("client", e.target.value)} placeholder="Internal or client name" /></div>
            <div className="field"><label>Project manager</label><select value={form.lead} onChange={e => set("lead", e.target.value)}>{PEOPLE.map(p => <option key={p}>{p}</option>)}</select></div>
            <div className="field"><label>Status</label><select value={form.status} onChange={e => set("status", e.target.value)}>{PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label>Priority</label><select value={form.priority} onChange={e => set("priority", e.target.value)}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
            <div className="field"><label>Start date</label><input type="date" value={form.start} onChange={e => set("start", e.target.value)} /></div>
            <div className="field"><label>End date</label><input type="date" value={form.end} onChange={e => set("end", e.target.value)} /></div>
            <div className="field full"><label>Description</label><textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="What is this project delivering, and for whom?" /></div>
            <div className="field full">
              <label>Project documents — BRD, data files, decks, and more</label>
              <AttachmentPicker files={form.documents} onChange={files => set("documents", files)} />
            </div>
          </div>
          {error && <div className="field-error">{error}</div>}
        </div>
        <div className="modal-foot"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit}><Plus size={14} />Create project</button></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ADD USER MODAL (admin)
--------------------------------------------------------- */
function AddUserModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", roleId: "developer" });
  const [error, setError] = useState("");
  function submit() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    onCreate(form);
  }
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title">Add user</div><button className="modal-close" onClick={onClose}><X size={15} /></button></div>
        <div className="modal-body">
          <div className="field full"><label>Full name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. V. Kapoor" /></div>
          <div className="field full">
            <label>Role</label>
            <select value={form.roleId} onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}>
              {ROLES.map(r => <option key={r.id} value={r.id}>{r.label} — {r.group}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>Email is auto-generated as firstname@pulse-pm.io for this demo.</div>
          {error && <div className="field-error">{error}</div>}
        </div>
        <div className="modal-foot"><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit}><UserPlus size={14} />Add user</button></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   TICKET DETAIL MODAL
--------------------------------------------------------- */
function TicketDetailModal({ ticket, onClose, onAddComment, onStatusChange, onAddAttachments, onReopen, onStartTimer, onStopTimer, activity, perm, role }) {
  const [comment, setComment] = useState("");
  const [nowTick, setNowTick] = useState(Date.now());
  const insertMention = (name) => setComment(c => c + (c.endsWith(" ") || c === "" ? "" : " ") + `@[${name}] `);
  const statusOptions = perm.restrictedStatuses
    ? Array.from(new Set([...RESTRICTED_STATUS_OPTIONS, ticket.status]))
    : STATUSES;
  const canReopenNow = perm.canReopen && (ticket.status === "Completed" || ticket.status === "Closed");
  const timeEntries = ticket.timeEntries || [];
  const hasRunning = timeEntries.some(e => !e.endedAt);
  const myRunning = timeEntries.find(e => e.who === role.identity && !e.endedAt);

  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasRunning]);

  const totalMins = totalLoggedMinutes(ticket, nowTick);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title mono" style={{ color: "var(--brand)" }}>{ticket.id}</div><button className="modal-close" onClick={onClose}><X size={15} /></button></div>
        <div className="modal-body">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, fontFamily: "'Space Grotesk', sans-serif" }}>{ticket.title}</div>
          <div style={{ marginBottom: 14 }}><LabelChip l={ticket.label} /></div>

          {canReopenNow && (
            <div className="reopen-banner">
              <span><RotateCcw size={13} style={{ verticalAlign: -2, marginRight: 5 }} />This ticket is {ticket.status}. If the issue isn't actually resolved, you can reopen it.</span>
              <button className="reopen-btn" onClick={() => onReopen(ticket)}><RotateCcw size={12} />Reopen ticket</button>
            </div>
          )}

          <div className="td-meta-grid">
            <div className="td-meta-item"><div className="td-meta-label">Status</div>
              <select value={ticket.status} onChange={e => onStatusChange(ticket, e.target.value)} style={{ border: "none", background: "transparent", fontWeight: 600, fontSize: 12, padding: 0 }}>{statusOptions.map(s => <option key={s}>{s}</option>)}</select>
            </div>
            <div className="td-meta-item"><div className="td-meta-label">Priority</div><div className="td-meta-value"><PrioChip p={ticket.priority} /></div></div>
            <div className="td-meta-item"><div className="td-meta-label">Raised via</div><div className="td-meta-value"><SourceChip s={ticket.source} /></div></div>
            <div className="td-meta-item"><div className="td-meta-label">Reported by</div><div className="td-meta-value">{ticket.reporter}</div></div>
            <div className="td-meta-item"><div className="td-meta-label">{perm.scope === "reporter" ? "Handled by" : "Assignee"}</div><div className="td-meta-value">{assigneeDisplay(ticket, perm)}</div></div>
            <div className="td-meta-item"><div className="td-meta-label">Start / End</div><div className="td-meta-value mono" style={{ fontSize: 11 }}>{fmt(ticket.created)} — <span style={{ color: ticket.isOverdue ? "#E2483B" : "inherit" }}>{fmt(ticket.due)}</span></div></div>
          </div>

          <div className="td-desc"><MentionText text={ticket.description} /></div>

          {ticket.watchers.length > 0 && (
            <div style={{ marginBottom: 16 }}><div className="td-section-title"><Users size={13} />Watchers</div>{ticket.watchers.map(w => <span key={w} className="watcher-chip active" style={{ marginBottom: 4 }}>{w}</span>)}</div>
          )}

          {perm.scope === "all" && (
            <div style={{ marginBottom: 18 }}>
              <div className="td-section-title"><Timer size={13} />Time tracking — total {formatMinutes(totalMins)}</div>
              {perm.timeTracking && (
                myRunning
                  ? <button className="timer-btn timer-btn-stop" onClick={() => onStopTimer(ticket)}><StopCircle size={14} />Stop timer — running {formatMinutes((nowTick - myRunning.startedAt) / 60000)}</button>
                  : <button className="timer-btn timer-btn-start" onClick={() => onStartTimer(ticket)}><PlayCircle size={14} />Start timer</button>
              )}
              {timeEntries.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {timeEntries.slice().reverse().map(e => (
                    <div className="timeline-item" key={e.id}>
                      <div className="timeline-dot" style={{ background: e.endedAt ? "#362F9E" : "#E2483B" }} />
                      <div><strong>{e.who}</strong> ({e.roleLabel}) {e.endedAt ? `logged ${formatMinutes((e.endedAt - e.startedAt) / 60000)}` : <span style={{ color: "#E2483B", fontWeight: 600 }}>timer running…</span>} <span className="activity-time">· started {new Date(e.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <div className="td-section-title"><Paperclip size={13} />Attachments ({ticket.attachments.length})</div>
            <AttachmentGrid files={ticket.attachments} />
            <div style={{ marginTop: 8 }}><AttachmentPicker compact files={[]} onChange={(items) => onAddAttachments(ticket, items)} /></div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div className="td-section-title"><MessageSquare size={13} />Comments ({ticket.comments.length})</div>
            {ticket.comments.map(c => (
              <div className="comment-item" key={c.id}>
                <div className="activity-avatar">{initialsOf(c.author)}</div>
                <div className="comment-body"><span className="comment-author">{c.author}<span className="comment-time">{c.time}</span></span><div className="comment-text"><MentionText text={c.text} /></div></div>
              </div>
            ))}
            <div className="comment-input-row">
              <textarea placeholder="Add a comment — use the mention chips to notify a teammate…" value={comment} onChange={e => setComment(e.target.value)} rows={2} />
              <button className="send-btn" onClick={() => { onAddComment(ticket, comment); setComment(""); }}><Send size={15} /></button>
            </div>
            <div className="mention-picker"><span style={{ fontSize: 10.5, color: "var(--ink-faint)", alignSelf: "center", marginRight: 2 }}>Mention:</span>{PEOPLE.slice(0, 6).map(p => <span key={p} className="mention-tag" onClick={() => insertMention(p)}>@{p}</span>)}</div>
          </div>

          <div>
            <div className="td-section-title"><Inbox size={13} />Activity</div>
            {activity.length === 0 && <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>No activity recorded yet.</div>}
            {activity.map(a => <div className="timeline-item" key={a.id}><div className="timeline-dot" /><div><strong>{a.who}</strong> {a.action} <span className="activity-time">· {a.time}</span></div></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   PROJECT DETAIL MODAL — Basecamp-style project hub
--------------------------------------------------------- */
function ProjectDetailModal({ project, tickets, onClose, onAddDocuments, onOpenTicket, onViewDashboard }) {
  const openCt = tickets.filter(t => t.isOpen).length;
  const overdueCt = tickets.filter(t => t.isOverdue).length;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span className="proj-code">{project.code}</span>
            <div className="modal-title">{project.name}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div className="td-meta-grid">
            <div className="td-meta-item"><div className="td-meta-label">Client</div><div className="td-meta-value">{project.client}</div></div>
            <div className="td-meta-item"><div className="td-meta-label">Project manager</div><div className="td-meta-value">{project.lead}</div></div>
            <div className="td-meta-item"><div className="td-meta-label">Status</div><div className="td-meta-value">{project.status}</div></div>
            <div className="td-meta-item"><div className="td-meta-label">Priority</div><div className="td-meta-value"><PrioChip p={project.priority} /></div></div>
            <div className="td-meta-item"><div className="td-meta-label">Start date</div><div className="td-meta-value mono">{fmt(project.start)}</div></div>
            <div className="td-meta-item"><div className="td-meta-label">End date</div><div className="td-meta-value mono">{fmt(project.end)}</div></div>
          </div>

          <div className="td-desc">{project.description}</div>

          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <div className="mom-stat" style={{ flex: 1 }}><div className="mom-label">Total tickets</div><div className="mom-value">{tickets.length}</div></div>
            <div className="mom-stat" style={{ flex: 1 }}><div className="mom-label">Open</div><div className="mom-value">{openCt}</div></div>
            <div className="mom-stat" style={{ flex: 1 }}><div className="mom-label">Overdue</div><div className="mom-value" style={{ color: overdueCt ? "#E2483B" : "inherit" }}>{overdueCt}</div></div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div className="td-section-title"><Folder size={13} />Document folder ({project.documents.length})</div>
            <AttachmentGrid files={project.documents} />
            <div style={{ marginTop: 8 }}><AttachmentPicker compact label="Add BRDs, data files, decks, or other project documents" files={[]} onChange={(items) => onAddDocuments(project, items)} /></div>
          </div>

          <div>
            <div className="td-section-title"><TicketIcon size={13} />Recent tickets</div>
            {tickets.slice(0, 6).map(t => (
              <div key={t.id} className="timeline-item" style={{ cursor: "pointer" }} onClick={() => onOpenTicket(t.id)}>
                <div className="timeline-dot" style={{ background: PRIORITY_COLOR[t.priority] }} />
                <div><span className="tid">{t.id}</span> {t.title} <span className="activity-time">· {t.status}</span></div>
              </div>
            ))}
            {tickets.length > 6 && <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 6 }}>+{tickets.length - 6} more tickets on this project</div>}
          </div>
        </div>
        <div className="modal-foot"><button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-primary" onClick={onViewDashboard}><ExternalLink size={14} />View in dashboard</button></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ROLE & PERMISSION MATRIX MODAL
--------------------------------------------------------- */
function RoleMatrixModal({ onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title" style={{ display: "flex", alignItems: "center", gap: 7 }}><Shield size={15} />Role & permission matrix</div><button className="modal-close" onClick={onClose}><X size={15} /></button></div>
        <div className="modal-body">
          <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 14, lineHeight: 1.5 }}>
            Admin and management roles see every project and dashboard, and Admin can also manage users. Field-team roles can raise tickets, comment, take updates, and close their own team's tickets. Clients can raise, track, comment, close, and reopen only their own tickets.
          </div>
          <div className="table-scroll">
            <table className="perm-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  {ROLES.map(r => (
                    <th key={r.id}><div className="perm-role-head"><span>{r.label}</span><span>{r.group}</span></div></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_ROWS.map(row => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    {ROLES.map(r => {
                      const p = permissionsFor(r.id);
                      return <td key={r.id}>{p[row.key] ? <CheckCircle2 size={15} color="#16946E" /> : <XCircle size={15} color="#D3D6E0" />}</td>;
                    })}
                  </tr>
                ))}
                <tr>
                  <td>Ticket visibility scope</td>
                  {ROLES.map(r => {
                    const p = permissionsFor(r.id);
                    return <td key={r.id} style={{ fontSize: 10 }}>{p.scope === "all" ? "Everything" : p.scope === "source" ? "Own team" : "Own tickets"}</td>;
                  })}
                </tr>
                <tr>
                  <td>Status changes allowed</td>
                  {ROLES.map(r => {
                    const p = permissionsFor(r.id);
                    return <td key={r.id} style={{ fontSize: 10 }}>{!p.restrictedStatuses ? "All statuses" : "Open · In Progress · Closed"}</td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 12 }}>
            This is a live demo of the permission model — use the role switcher next to your avatar to preview the app as any of these roles. A production build would enforce this server-side via real authentication, not just in the UI.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   NOTIFICATION PREVIEW MODAL — Email + Teams tabs
--------------------------------------------------------- */
function NotificationPreviewModal({ notif, onClose }) {
  const [channel, setChannel] = useState("email");
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-md" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title" style={{ display: "flex", alignItems: "center", gap: 7 }}><Bell size={15} />Notification preview</div><button className="modal-close" onClick={onClose}><X size={15} /></button></div>
        <div className="modal-body">
          <div className="np-tabs">
            <div className={`np-tab ${channel === "email" ? "active" : ""}`} onClick={() => setChannel("email")}><Mail size={13} />Email</div>
            <div className={`np-tab ${channel === "teams" ? "active" : ""}`} onClick={() => setChannel("teams")}><MessageCircle size={13} />Teams</div>
          </div>

          {channel === "email" ? (
            <div className="email-frame">
              <div className="email-head">
                <div><b>To</b> {notif.recipient} &lt;{notif.to}&gt;</div>
                <div><b>From</b> Pulse PM &lt;notifications@pulse-pm.io&gt;</div>
                <div><b>Subject</b> {notif.subject}</div>
              </div>
              <div className="email-body">
                <p>Hi {notif.recipient.split(" ")[0]},</p>
                <p>{notif.body}</p>
                <p style={{ color: "var(--ink-soft)", fontSize: 11.5 }}>— View this ticket in Pulse for full details, or reply directly to this email to add a comment.</p>
              </div>
            </div>
          ) : (
            <div className="teams-card">
              <div className="teams-head">
                <div className="teams-bot-avatar"><MessageCircle size={14} /></div>
                <div><div className="teams-head-text">Pulse Bot</div><div className="teams-head-sub">to {notif.recipient} · Just now</div></div>
              </div>
              <div className="teams-body">
                <strong>{notif.subject}</strong>
                <p style={{ margin: "6px 0 0" }}>{notif.body}</p>
                <div className="teams-btn"><ExternalLink size={11} />Open in Pulse</div>
              </div>
            </div>
          )}
          <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 10 }}>
            This is a simulated preview of what would be sent. Wiring it up for real needs an email provider (SES, SendGrid, Postmark) and the Microsoft Teams incoming-webhook / Graph API on the backend.
          </div>
        </div>
      </div>
    </div>
  );
}
