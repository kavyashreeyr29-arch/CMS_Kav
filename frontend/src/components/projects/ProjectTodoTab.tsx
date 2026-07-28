import { useEffect, useState } from 'react';
import { ListChecks, Plus, Trash2 } from 'lucide-react';
import { projectTodosApi, ProjectTodoRow } from '../../api/projectTodos';
import { projectsApi } from '../../api/projects';
import { AttachmentUploader } from '../ui/AttachmentUploader';
import { AttachmentGrid } from '../ui/AttachmentGrid';
import { UserRow } from '../../api/users';
import { Project } from '../../types/project';

interface Props {
  project: Project;
  users: UserRow[];
  onChange: () => void;
}

export function ProjectTodoTab({ project, users, onChange }: Props) {
  const [items, setItems] = useState<ProjectTodoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [dueDate, setDueDate] = useState('');

  function load() {
    setLoading(true);
    projectTodosApi.listForProject(project.code).then(setItems).finally(() => setLoading(false));
  }
  useEffect(load, [project.code]);

  const todoFiles = project.documents.filter((d) => d.section === 'todo');

  async function addTodo() {
    if (!title.trim()) return;
    await projectTodosApi.create({
      projectCode: project.code,
      title: title.trim(),
      assigneeUserId: assigneeUserId || undefined,
      dueDate: dueDate || undefined,
    });
    setTitle('');
    setAssigneeUserId('');
    setDueDate('');
    load();
  }

  async function toggleDone(item: ProjectTodoRow) {
    await projectTodosApi.update(item.id, { done: !item.done });
    load();
  }

  async function remove(id: string) {
    await projectTodosApi.remove(id);
    load();
  }

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <div>
      <div className="td-section-title"><ListChecks size={13} />To-do list ({pending.length} open)</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a to-do…"
          style={{ flex: 1, minWidth: 180 }}
          onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }}
        />
        <select value={assigneeUserId} onChange={(e) => setAssigneeUserId(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">Unassigned</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ maxWidth: 150 }} />
        <button className="btn-primary" onClick={addTodo} disabled={!title.trim()}><Plus size={13} />Add</button>
      </div>

      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No to-dos yet — quick checklist items that don't need a full ticket.</div>
      ) : (
        <div style={{ marginBottom: 18 }}>
          {[...pending, ...done].map((item) => (
            <div key={item.id} className={`todo-row ${item.done ? 'done' : ''}`}>
              <input type="checkbox" checked={item.done} onChange={() => toggleDone(item)} aria-label={`Mark "${item.title}" ${item.done ? 'not done' : 'done'}`} />
              <span className="todo-title">{item.title}</span>
              {item.assignee && <span className="todo-meta">{item.assignee.name}</span>}
              {item.dueDate && <span className="todo-meta">Due {new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>}
              <button className="icon-btn" onClick={() => remove(item.id)} title="Delete" aria-label={`Delete "${item.title}"`}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="td-section-title">To-do attachments ({todoFiles.length})</div>
      <AttachmentGrid files={todoFiles} getDownloadUrl={(id) => projectsApi.getDocumentDownloadUrl(project.code, id)} />
      <div style={{ marginTop: 8 }}>
        <AttachmentUploader
          label="Add checklists, references, or supporting files"
          requestUploadUrl={(fileName) => projectsApi.requestDocumentUploadUrl(project.code, fileName)}
          onUploaded={async (meta) => {
            await projectsApi.addDocument(project.code, { ...meta, section: 'todo' });
            onChange();
          }}
        />
      </div>
    </div>
  );
}
