import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  FolderKanban,
  ListChecks,
  MessageSquare,
  Play,
  Plus,
  Send,
  Tag,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  Member,
  Project,
  Task,
  TaskPriority,
  TaskStatus,
} from '../types';
import { addDaysISO, formatDueLabel, getTodayISO } from '../utils/dateUtils';
import { useI18n } from '../i18n/I18nContext';

interface TaskDetailDrawerProps {
  task: Task | null;
  projects: Project[];
  members: Member[];
  canEditTask?: boolean;
  canDeleteTask?: boolean;
  onClose: () => void;
  onUpdateTask: (taskId: string, patch: Partial<Task>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAddSubtask: (taskId: string, title: string) => Promise<void>;
  onToggleSubtask: (subId: string, completed: boolean) => Promise<void>;
  onDeleteSubtask: (subId: string) => Promise<void>;
  onAddComment: (taskId: string, content: string) => Promise<void>;
  onStartPomodoro: (task: Task) => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  task,
  projects,
  members,
  canEditTask = true,
  canDeleteTask = true,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onAddComment,
  onStartPomodoro,
}) => {
  const { lang, tr } = useI18n();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newTagText, setNewTagText] = useState('');
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
    }
  }, [task]);

  if (!task) return null;

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const completedSubCount = task.subtasks.filter((s) => s.completed).length;
  const totalSubCount = task.subtasks.length;
  const subPct =
    totalSubCount > 0 ? Math.round((completedSubCount / totalSubCount) * 100) : 0;

  const toggleCollaborator = (memId: string) => {
    const exists = task.collaborator_ids.includes(memId);
    const next = exists
      ? task.collaborator_ids.filter((id) => id !== memId)
      : [...task.collaborator_ids, memId];
    onUpdateTask(task.id, { collaborator_ids: next });
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTagText.trim();
    if (!clean) return;
    if (!task.tags.includes(clean)) {
      onUpdateTask(task.id, { tags: [...task.tags, clean] });
    }
    setNewTagText('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateTask(task.id, {
      tags: task.tags.filter((t) => t !== tagToRemove),
    });
  };

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    await onAddSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await onAddComment(task.id, commentText.trim());
    setCommentText('');
  };

  const todayISO = getTodayISO();

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40 backdrop-blur-[2px]">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-label={tr('关闭详情抽屉背景', 'Close task detail drawer')}
      />
      <aside className="relative z-10 w-full max-w-2xl h-full bg-white dark:bg-[#0F1522] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              {task.task_key}
            </span>
            <span className="text-xs text-slate-400">
              {tr('创建于 ', 'Created ')}
              {new Date(task.created_at).toLocaleDateString(
                lang === 'en' ? 'en-US' : 'zh-CN'
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStartPomodoro(task)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {tr('开启番茄专注', 'Start Pomodoro')}
            </button>
            {canDeleteTask && (
              <button
                type="button"
                onClick={() => onDeleteTask(task.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                title={tr('删除此任务', 'Delete task')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* 1. Task Title & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {tr('任务名称', 'Task Title')}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  if (title.trim() && title.trim() !== task.title) {
                    onUpdateTask(task.id, { title: title.trim() });
                  }
                }}
                className="w-full text-base font-bold text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:outline-none pb-1 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {tr('任务背景与详细说明', 'Description & Acceptance Criteria')}
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  if (description !== task.description) {
                    onUpdateTask(task.id, { description });
                  }
                }}
                placeholder={tr(
                  '输入详细的任务验收标准、技术方案或相关文档链接...',
                  'Enter detailed acceptance criteria, technical specs, or links...'
                )}
                className="w-full text-xs leading-relaxed rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 2. Core 4-Dimension Attributes Grid */}
          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Project */}
            <div>
              <label className="flex items-center gap-1.5 text-slate-400 font-medium mb-1">
                <FolderKanban className="w-3.5 h-3.5 text-indigo-500" />
                {tr('所属项目名', 'Project')}
              </label>
              <select
                value={task.project_id}
                onChange={(e) =>
                  onUpdateTask(task.id, { project_id: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="flex items-center gap-1.5 text-slate-400 font-medium mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {tr('流转状态', 'Status')}
              </label>
              <select
                value={task.status}
                onChange={(e) =>
                  onUpdateTask(task.id, {
                    status: e.target.value as TaskStatus,
                  })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="backlog">
                  {tr('待规划 (Backlog)', 'Backlog')}
                </option>
                <option value="todo">{tr('待处理 (Todo)', 'Todo')}</option>
                <option value="in_progress">
                  {tr('进行中 (In Progress)', 'In Progress')}
                </option>
                <option value="review">
                  {tr('审核/阻塞 (In Review)', 'In Review / Blocked')}
                </option>
                <option value="done">{tr('已完成 (Done)', 'Done')}</option>
              </select>
            </div>

            {/* Due Date + Quick Shortcuts */}
            <div>
              <label className="flex items-center justify-between text-slate-400 font-medium mb-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-500" />
                  {tr('截止日期', 'Due Date')} (
                  {formatDueLabel(task.due_date, undefined, lang)})
                </span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={task.due_date || ''}
                  onChange={(e) =>
                    onUpdateTask(task.id, {
                      due_date: e.target.value || null,
                    })
                  }
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => onUpdateTask(task.id, { due_date: todayISO })}
                  className="px-2 py-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 hover:bg-indigo-500 hover:text-white text-[11px] transition-colors"
                >
                  {tr('今天', 'Today')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateTask(task.id, {
                      due_date: addDaysISO(todayISO, 1),
                    })
                  }
                  className="px-2 py-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 hover:bg-indigo-500 hover:text-white text-[11px] transition-colors"
                >
                  {tr('明天', 'Tmrw')}
                </button>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="flex items-center gap-1.5 text-slate-400 font-medium mb-1">
                {tr('⚡ 优先级', '⚡ Priority')}
              </label>
              <select
                value={task.priority}
                onChange={(e) =>
                  onUpdateTask(task.id, {
                    priority: e.target.value as TaskPriority,
                  })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="urgent">
                  {tr('🔥 紧急 (Urgent)', '🔥 Urgent')}
                </option>
                <option value="high">{tr('🟠 高优 (High)', '🟠 High')}</option>
                <option value="medium">
                  {tr('🔵 普通 (Medium)', '🔵 Medium')}
                </option>
                <option value="low">{tr('⚪ 较低 (Low)', '⚪ Low')}</option>
              </select>
            </div>

            {/* Primary Assignee */}
            <div>
              <label className="flex items-center gap-1.5 text-slate-400 font-medium mb-1">
                <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                {tr('主负责人 (Assignee)', 'Primary Assignee')}
              </label>
              <select
                value={task.assignee_id || ''}
                onChange={(e) =>
                  onUpdateTask(task.id, {
                    assignee_id: e.target.value || null,
                  })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">
                  {tr('未指派负责人', 'Unassigned')}
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.role}
                  </option>
                ))}
              </select>
            </div>

            {/* Estimate & Logged Time */}
            <div>
              <label className="flex items-center gap-1.5 text-slate-400 font-medium mb-1">
                <Clock className="w-3.5 h-3.5 text-cyan-500" />
                {tr(
                  `预估工时 (h) / 已记录 (${task.logged_minutes} 分钟)`,
                  `Estimate (h) / Logged (${task.logged_minutes}m)`
                )}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={task.estimate_hours}
                  onChange={(e) =>
                    onUpdateTask(task.id, {
                      estimate_hours: Number(e.target.value) || 1,
                    })
                  }
                  className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() =>
                    onUpdateTask(task.id, {
                      logged_minutes: (task.logged_minutes || 0) + 30,
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold"
                >
                  {tr('+30m 工时', '+30m Log')}
                </button>
              </div>
            </div>
          </div>

          {/* 3. Related Collaborators Multi-Select */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              {tr(
                '协同相关人员（点击切换参与人，与人员看板实时联动）',
                'Collaborators (Click to toggle participation, synced with Team Workload board)'
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {members.map((mem) => {
                const isCollab = task.collaborator_ids.includes(mem.id);
                const isMain = task.assignee_id === mem.id;
                return (
                  <button
                    key={mem.id}
                    type="button"
                    onClick={() => toggleCollaborator(mem.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all ${
                      isCollab
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-500/50'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-gradient-to-br ${mem.avatar_bg} text-white text-[9px] font-bold flex items-center justify-center`}
                    >
                      {mem.name.slice(0, 1)}
                    </span>
                    <span>{mem.name}</span>
                    {isMain && (
                      <span className="text-[10px] opacity-80">
                        {tr('(主负责)', '(Owner)')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Tags Management */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Tag className="w-3.5 h-3.5 text-indigo-500" />
              {tr('任务标签', 'Tags')}
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <form onSubmit={handleAddTag} className="inline-flex items-center">
                <input
                  type="text"
                  value={newTagText}
                  onChange={(e) => setNewTagText(e.target.value)}
                  placeholder={tr('+ 输入标签回车', '+ Add tag & Enter')}
                  className="px-2.5 py-1 w-32 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-transparent text-xs focus:outline-none focus:border-indigo-500"
                />
              </form>
            </div>
          </div>

          {/* 5. Subtasks Checklist */}
          <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                <ListChecks className="w-4 h-4 text-indigo-500" />
                {tr(
                  `子任务拆解清单 (${completedSubCount}/${totalSubCount})`,
                  `Subtasks Checklist (${completedSubCount}/${totalSubCount})`
                )}
              </label>
              <span className="text-xs font-mono text-indigo-500 font-semibold">
                {subPct}%
              </span>
            </div>

            {totalSubCount > 0 && (
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${subPct}%` }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {task.subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/80 group"
                >
                  <button
                    type="button"
                    disabled={!canEditTask}
                    onClick={() => onToggleSubtask(sub.id, !sub.completed)}
                    className="flex items-center gap-2.5 text-left flex-1 min-w-0 disabled:cursor-not-allowed"
                  >
                    {sub.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span
                      className={`text-xs truncate ${
                        sub.completed
                          ? 'line-through text-slate-400'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {sub.title}
                    </span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {sub.completed && sub.completed_at && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px]"
                        title={tr(
                          `完成时间：${new Date(sub.completed_at).toLocaleString('zh-CN')}`,
                          `Completed at: ${new Date(sub.completed_at).toLocaleString('en-US')}`
                        )}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(sub.completed_at).toLocaleString(
                          lang === 'en' ? 'en-US' : 'zh-CN',
                          {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </span>
                    )}
                    {canEditTask && (
                      <button
                        type="button"
                        onClick={() => onDeleteSubtask(sub.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateSubtask} className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder={tr(
                  '添加新的拆解子步骤，按回车保存...',
                  'Add a new subtask step and press Enter...'
                )}
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {tr('添加', 'Add')}
              </button>
            </form>
          </div>

          {/* 6. Comments & Activity Audit Stream */}
          <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-slate-800">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              {tr(
                `协作评论与属性变更动态 (${task.activities.length})`,
                `Comments & Activity Stream (${task.activities.length})`
              )}
            </label>

            {/* Post Comment Form */}
            <form onSubmit={handlePostComment} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={tr(
                    '同步最新进展或 @相关人员...',
                    'Share an update or @mention team members...'
                  )}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium inline-flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  {tr('发送', 'Send')}
                </button>
              </div>
            </form>

            {/* Activity Feed */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {task.activities.map((act) => {
                const actor = act.member_id
                  ? memberMap.get(act.member_id)
                  : null;
                return (
                  <div
                    key={act.id}
                    className={`p-3 rounded-xl text-xs border ${
                      act.type === 'comment'
                        ? 'bg-indigo-500/5 border-indigo-500/20 text-slate-800 dark:text-slate-100'
                        : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/60 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {actor
                          ? actor.name
                          : act.actor_name || tr('系统动态', 'System')}
                        {act.type === 'system' && (
                          <span className="ml-1.5 text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-500">
                            {tr('自动审计', 'Audit')}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(act.created_at).toLocaleString(
                          lang === 'en' ? 'en-US' : 'zh-CN',
                          {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </span>
                    </div>
                    <p className="leading-relaxed">{act.content}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
