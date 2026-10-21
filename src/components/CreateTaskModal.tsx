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
  { label: '靛蓝紫', value: 'from-indigo-500 to-purple-600' },
  { label: '翡翠绿', value: 'from-emerald-500 to-teal-600' },
  { label: '深海蓝', value: 'from-blue-500 to-cyan-600' },
  { label: '珊瑚粉', value: 'from-rose-500 to-pink-600' },
  { label: '琥珀橙', value: 'from-amber-500 to-orange-600' },
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
  const [tagsText, setTagsText] = useState<string>('核心交付');
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
        setMemRole(editingMember.role || '团队成员');
        setMemAvatarBg(editingMember.avatar_bg || AVATAR_GRADIENTS[0].value);
        setMemCapacity(editingMember.capacity_hours || 40);
      } else {
        setMemName('');
        setMemRole('全栈研发工程师');
        setMemAvatarBg(AVATAR_GRADIENTS[0].value);
        setMemCapacity(40);
      }
    }
  }, [mode, defaults, editingProject, editingMember, projects, members]);

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
      project_name: projects.length === 0 ? inlineProjectName.trim() || '默认工作项目' : undefined,
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
      role: memRole.trim() || '团队成员',
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
                  新建工作 Todo 任务
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
                  {editingProject ? `编辑项目：${editingProject.name}` : '新建项目看板维度'}
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
                  {editingMember ? `编辑成员：${editingMember.name}` : '新增团队相关人员'}
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
                任务名称 *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：完成 Q4 核心支付链路压测与监控接入"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  所属项目名 *
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
                    placeholder="输入首个项目名称（将自动创建）"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  截止日期
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
                  主负责人
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                >
                  <option value="">暂不指派</option>
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
                    初始状态
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  >
                    <option value="backlog">待规划</option>
                    <option value="todo">待处理</option>
                    <option value="in_progress">进行中</option>
                    <option value="review">审核/阻塞</option>
                    <option value="done">已完成</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    优先级
                  </label>
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as TaskPriority)
                    }
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  >
                    <option value="urgent">🔥 紧急</option>
                    <option value="high">🟠 高优</option>
                    <option value="medium">🔵 普通</option>
                    <option value="low">⚪ 较低</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Collaborators multi-select */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                协同相关人员（可多选）
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  标签（逗号或空格分隔）
                </label>
                <input
                  type="text"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="例如：前端架构, 高优体验"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  预估工时 (小时)
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
                快速拆解子任务（每行一条，可选）
              </label>
              <textarea
                rows={2}
                value={subtasksText}
                onChange={(e) => setSubtasksText(e.target.value)}
                placeholder={'完成接口契约联调\n补充边界用例自测'}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
              >
                立即创建任务
              </button>
            </div>
          </form>
        )}

        {/* Project Creation Form */}
        {mode === 'project' && (
          <form onSubmit={handleProjectSubmit} className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block font-semibold mb-1">项目名称 *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="例如：企业数据安全网关 2.0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  编号前缀 (如 SEC)
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
              <label className="block font-semibold mb-1.5">项目主题色标</label>
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
              <label className="block font-semibold mb-1">项目简介</label>
              <input
                type="text"
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                placeholder="一句话描述该项目的核心目标与里程碑..."
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
                    删除项目
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  {editingProject ? '保存修改' : '创建项目'}
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
                <label className="block font-semibold mb-1">成员姓名 *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={memName}
                  onChange={(e) => setMemName(e.target.value)}
                  placeholder="例如：沈星回"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">岗位角色</label>
                <input
                  type="text"
                  value={memRole}
                  onChange={(e) => setMemRole(e.target.value)}
                  placeholder="例如：资深后端架构师"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1.5">头像色彩风格</label>
              <div className="flex gap-2">
                {AVATAR_GRADIENTS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setMemAvatarBg(g.value)}
                    className={`px-3 py-1.5 rounded-xl text-white font-semibold bg-gradient-to-br ${
                      g.value
                    } ${
                      memAvatarBg === g.value ? 'ring-2 ring-indigo-500' : 'opacity-75'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">
                每周标准工时容量 (用于人员看板饱和度计算)
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
                    删除成员
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                >
                  {editingMember ? '保存修改' : '添加成员'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
