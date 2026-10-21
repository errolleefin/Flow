import React, { useEffect, useState } from 'react';
import { FolderPlus, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import type {
  Member,
  Project,
  Task,
  TaskPriority,
  TaskStatus,
} from '../types';
import { getTodayISO } from '../utils/dateUtils';
import { useI18n } from '../i18n/I18nContext';

export type ModalMode = 'task' | 'project' | 'member' | null;

interface CreateTaskModalProps {
  mode: ModalMode;
  defaults?: Partial<Task>;
  editingProject?: Project | null;
  editingMember?: Member | null;
  projects: Project[];
  members: Member[];
  onClose: () => void;
  onCreateTask: (
    payload: Omit<Partial<Task>, 'subtasks'> & {
      title: string;
      project_id: string;
      project_name?: string;
      subtasks?: string[];
    }
  ) => Promise<void>;
  onCreateProject: (payload: {
    name: string;
    code: string;
    color: string;
    description: string;
  }) => Promise<void>;
  onUpdateProject: (
    id: string,
    payload: {
      name: string;
      code: string;
      color: string;
      description: string;
    }
  ) => Promise<void>;
  onDeleteProject?: (project: Project) => void;
  onCreateMember: (payload: {
    name: string;
    role: string;
    avatar_bg: string;
    capacity_hours: number;
  }) => Promise<void>;
  onUpdateMember: (
    id: string,
    payload: {
      name: string;
      role: string;
      avatar_bg: string;
      capacity_hours: number;
    }
  ) => Promise<void>;
  onDeleteMember?: (member: Member) => void;
}

const PROJECT_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6',
  '#f43f5e',
];

const AVATAR_GRADIENTS = [
  { label: '靛蓝紫', labelEn: 'Indigo', value: 'from-indigo-500 to-purple-600' },
  { label: '翡翠绿', labelEn: 'Emerald', value: 'from-emerald-500 to-teal-600' },
  { label: '深海蓝', labelEn: 'Ocean', value: 'from-blue-500 to-cyan-600' },
  { label: '珊瑚粉', labelEn: 'Coral', value: 'from-rose-500 to-pink-600' },
  { label: '琥珀橙', labelEn: 'Amber', value: 'from-amber-500 to-orange-600' },
];

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  mode,
  defaults,
  editingProject,
  editingMember,
  projects,
  members,
  onClose,
  onCreateTask,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onCreateMember,
  onUpdateMember,
  onDeleteMember,
}) => {
  const { tr } = useI18n();
  // Task form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [inlineProjectName, setInlineProjectName] = useState('默认工作项目');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<string>(getTodayISO());
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [estimateHours, setEstimateHours] = useState<number>(4);
  const [tagsText, setTagsText] = useState<string>('');
  const [subtasksText, setSubtasksText] = useState<string>('');

  // Project form state
  const [projName, setProjName] = useState('');
  const [projCode, setProjCode] = useState('');
  const [projColor, setProjColor] = useState(PROJECT_COLORS[0]);
  const [projDesc, setProjDesc] = useState('');

  // Member form state
  const [memName, setMemName] = useState('');
  const [memRole, setMemRole] = useState('全栈研发工程师');
  const [memAvatarBg, setMemAvatarBg] = useState(AVATAR_GRADIENTS[0].value);
  const [memCapacity, setMemCapacity] = useState(40);

  useEffect(() => {
    if (mode === 'task') {
      setTitle('');
      setDescription('');
      setProjectId(defaults?.project_id || projects[0]?.id || '');
      setInlineProjectName(tr('默认工作项目', 'Default Project'));
      setStatus(defaults?.status || 'todo');
      setPriority(defaults?.priority || 'medium');
      setDueDate(
        defaults?.due_date !== undefined
          ? defaults.due_date || ''
          : getTodayISO()
      );
      setAssigneeId(defaults?.assignee_id || members[0]?.id || '');
      setCollaboratorIds([]);
      setEstimateHours(4);
      setTagsText('');
      setSubtasksText('');
    } else if (mode === 'project') {
      if (editingProject) {
        setProjName(editingProject.name);
        setProjCode(editingProject.code);
        setProjColor(editingProject.color || PROJECT_COLORS[0]);
        setProjDesc(editingProject.description || '');
      } else {
        setProjName('');
        setProjCode('');
        setProjColor(PROJECT_COLORS[0]);
        setProjDesc('');
      }
    } else if (mode === 'member') {
      if (editingMember) {
        setMemName(editingMember.name);
        setMemRole(editingMember.role || tr('团队成员', 'Team Member'));
        setMemAvatarBg(editingMember.avatar_bg || AVATAR_GRADIENTS[0].value);
        setMemCapacity(editingMember.capacity_hours || 40);
      } else {
        setMemName('');
        setMemRole(tr('全栈研发工程师', 'Full-Stack Engineer'));
        setMemAvatarBg(AVATAR_GRADIENTS[0].value);
        setMemCapacity(40);
      }
    }
  }, [mode, defaults, editingProject, editingMember, projects, members, tr]);

  if (!mode) return null;

  const toggleCollab = (id: string) => {
    setCollaboratorIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const tags = tagsText
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const subtasks = subtasksText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    await onCreateTask({
      title: title.trim(),
      description: description.trim(),
      project_id: projectId,
      project_name:
        projects.length === 0
          ? inlineProjectName.trim() || tr('默认工作项目', 'Default Project')
          : undefined,
      status,
      priority,
      due_date: dueDate || null,
      assignee_id: assigneeId || null,
      collaborator_ids: collaboratorIds,
      estimate_hours: estimateHours,
      tags,
      subtasks,
    });
    onClose();
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;
    const payload = {
      name: projName.trim(),
      code:
        projCode.trim().toUpperCase() ||
        projName.trim().slice(0, 3).toUpperCase(),
      color: projColor,
      description: projDesc.trim(),
    };
    if (editingProject) {
      await onUpdateProject(editingProject.id, payload);
    } else {
      await onCreateProject(payload);
    }
    setProjName('');
    setProjCode('');
    setProjDesc('');
    onClose();
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memName.trim()) return;
    const payload = {
      name: memName.trim(),
      role: memRole.trim() || tr('团队成员', 'Team Member'),
      avatar_bg: memAvatarBg,
      capacity_hours: memCapacity,
    };
    if (editingMember) {
      await onUpdateMember(editingMember.id, payload);
    } else {
      await onCreateMember(payload);
    }
    setMemName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'task' && (
              <>
                <Plus className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {tr('新建工作 Todo 任务', 'Create Work Todo Task')}
                </h3>
              </>
            )}
            {mode === 'project' && (
              <>
                {editingProject ? (
                  <Pencil className="w-4 h-4 text-emerald-500" />
                ) : (
                  <FolderPlus className="w-4 h-4 text-emerald-500" />
                )}
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingProject
                    ? tr(
                        `编辑项目：${editingProject.name}`,
                        `Edit Project: ${editingProject.name}`
                      )
                    : tr('新建项目看板维度', 'Create New Project')}
                </h3>
              </>
            )}
            {mode === 'member' && (
              <>
                {editingMember ? (
                  <Pencil className="w-4 h-4 text-amber-500" />
                ) : (
                  <UserPlus className="w-4 h-4 text-amber-500" />
                )}
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingMember
                    ? tr(
                        `编辑成员：${editingMember.name}`,
                        `Edit Member: ${editingMember.name}`
                      )
                    : tr('新增团队相关人员', 'Add Team Member')}
                </h3>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Task Creation Form */}
        {mode === 'task' && (
          <form onSubmit={handleTaskSubmit} className="p-6 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                {tr('任务名称 *', 'Task Title *')}
              </label>
              <input
                type="text"
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={tr(
                  '例如：完成 Q4 核心支付链路压测与监控接入',
                  'e.g., Complete Q4 core payment pipeline load testing & monitoring'
                )}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  {tr('所属项目名 *', 'Project *')}
                </label>
                {projects.length > 0 ? (
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={inlineProjectName}
                    onChange={(e) => setInlineProjectName(e.target.value)}
                    placeholder={tr(
                      '输入首个项目名称（将自动创建）',
                      'Enter first project name (auto-created)'
                    )}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  {tr('截止日期', 'Due Date')}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  {tr('主负责人', 'Primary Assignee')}
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                >
                  <option value="">{tr('暂不指派', 'Unassigned')}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    {tr('初始状态', 'Initial Status')}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  >
                    <option value="backlog">{tr('待规划', 'Backlog')}</option>
                    <option value="todo">{tr('待处理', 'Todo')}</option>
                    <option value="in_progress">
                      {tr('进行中', 'In Progress')}
                    </option>
                    <option value="review">{tr('审核/阻塞', 'Review')}</option>
                    <option value="done">{tr('已完成', 'Done')}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    {tr('优先级', 'Priority')}
                  </label>
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as TaskPriority)
                    }
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  >
                    <option value="urgent">{tr('🔥 紧急', '🔥 Urgent')}</option>
                    <option value="high">{tr('🟠 高优', '🟠 High')}</option>
                    <option value="medium">{tr('🔵 普通', '🔵 Medium')}</option>
                    <option value="low">{tr('⚪ 较低', '⚪ Low')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Collaborators multi-select */}
            {members.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  {tr('协同相关人员（可多选）', 'Collaborators (Multi-select)')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const selected = collaboratorIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleCollab(m.id)}
                        className={`px-2.5 py-1 rounded-full border text-xs transition-all ${
                          selected
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  {tr(
                    '标签（逗号或空格分隔）',
                    'Tags (comma or space separated)'
                  )}
                </label>
                <input
                  type="text"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder={tr(
                    '例如：前端架构, 高优体验',
                    'e.g., frontend, performance'
                  )}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  {tr('预估工时 (小时)', 'Estimated Hours')}
                </label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={estimateHours}
                  onChange={(e) =>
                    setEstimateHours(Number(e.target.value) || 2)
                  }
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                {tr(
                  '快速拆解子任务（每行一条，可选）',
                  'Quick Subtasks Breakdown (one per line, optional)'
                )}
              </label>
              <textarea
                rows={2}
                value={subtasksText}
                onChange={(e) => setSubtasksText(e.target.value)}
                placeholder={tr(
                  '完成接口契约联调\n补充边界用例自测',
                  'Complete API contract integration\nAdd edge-case unit tests'
                )}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                {tr('取消', 'Cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
              >
                {tr('立即创建任务', 'Create Task')}
              </button>
            </div>
          </form>
        )}

        {/* Project Creation / Edit Form */}
        {mode === 'project' && (
          <form onSubmit={handleProjectSubmit} className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block font-semibold mb-1">
                  {tr('项目名称 *', 'Project Name *')}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder={tr(
                    '例如：企业数据安全网关 2.0',
                    'e.g., Enterprise Security Gateway 2.0'
                  )}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {tr('编号前缀 (如 SEC)', 'Key Prefix (e.g. SEC)')}
                </label>
                <input
                  type="text"
                  maxLength={5}
                  value={projCode}
                  onChange={(e) => setProjCode(e.target.value)}
                  placeholder="SEC"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 uppercase font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1.5">
                {tr('项目主题色标', 'Project Accent Color')}
              </label>
              <div className="flex gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setProjColor(c)}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      projColor === c ? 'scale-125 ring-2 ring-indigo-500' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {tr('项目简介', 'Description')}
              </label>
              <input
                type="text"
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                placeholder={tr(
                  '一句话描述该项目的核心目标与里程碑...',
                  'Brief summary of the project goals & milestones...'
                )}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <div>
                {editingProject && onDeleteProject && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteProject(editingProject);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-semibold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {tr('删除项目', 'Delete Project')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  {tr('取消', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  {editingProject
                    ? tr('保存修改', 'Save Changes')
                    : tr('创建项目', 'Create Project')}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Member Creation / Edit Form */}
        {mode === 'member' && (
          <form onSubmit={handleMemberSubmit} className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">
                  {tr('成员姓名 *', 'Member Name *')}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={memName}
                  onChange={(e) => setMemName(e.target.value)}
                  placeholder={tr('例如：沈星回', 'e.g., Alex Chen')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {tr('岗位角色', 'Role / Title')}
                </label>
                <input
                  type="text"
                  value={memRole}
                  onChange={(e) => setMemRole(e.target.value)}
                  placeholder={tr(
                    '例如：资深后端架构师',
                    'e.g., Senior Backend Architect'
                  )}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1.5">
                {tr('头像色彩风格', 'Avatar Color Theme')}
              </label>
              <div className="flex gap-2 flex-wrap">
                {AVATAR_GRADIENTS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setMemAvatarBg(g.value)}
                    className={`px-3 py-1.5 rounded-xl text-white font-semibold bg-gradient-to-br ${
                      g.value
                    } ${
                      memAvatarBg === g.value
                        ? 'ring-2 ring-indigo-500'
                        : 'opacity-75'
                    }`}
                  >
                    {tr(g.label, g.labelEn)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {tr(
                  '每周标准工时容量 (用于人员看板饱和度计算)',
                  'Weekly Capacity Hours (Used for workload saturation calculation)'
                )}
              </label>
              <input
                type="number"
                min={10}
                max={80}
                value={memCapacity}
                onChange={(e) => setMemCapacity(Number(e.target.value) || 40)}
                className="w-32 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <div>
                {editingMember && onDeleteMember && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteMember(editingMember);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-semibold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {tr('删除成员', 'Delete Member')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  {tr('取消', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                >
                  {editingMember
                    ? tr('保存修改', 'Save Changes')
                    : tr('添加成员', 'Add Member')}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
