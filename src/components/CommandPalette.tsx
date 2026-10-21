import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Command,
  Languages,
  Moon,
  Plus,
  Search,
  Sun,
  X,
} from 'lucide-react';
import type { BoardViewType, Project, Task } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { BOARD_VIEWS } from './Sidebar';

interface CommandPaletteProps {
  isOpen: boolean;
  tasks: Task[];
  projects: Project[];
  darkMode: boolean;
  onClose: () => void;
  onSelectView: (view: BoardViewType) => void;
  onSelectTask: (task: Task) => void;
  onOpenCreateTask: () => void;
  onToggleDarkMode: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  tasks,
  projects,
  darkMode,
  onClose,
  onSelectView,
  onSelectTask,
  onOpenCreateTask,
  onToggleDarkMode,
}) => {
  const { lang, toggleLang, tr } = useI18n();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const matchingTasks = tasks
    .filter(
      (t) =>
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.task_key.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    )
    .slice(0, 6);

  const matchingViews = BOARD_VIEWS.filter(
    (v) =>
      !q ||
      v.label.toLowerCase().includes(q) ||
      v.labelEn.toLowerCase().includes(q) ||
      v.shortDesc.toLowerCase().includes(q) ||
      v.shortDescEn.toLowerCase().includes(q)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/50 backdrop-blur-xs p-4">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-label={tr('关闭命令面板', 'Close command palette')}
      />
      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-indigo-500 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr(
              '输入指令、看板名称、任务编号（如 AI-101）或关键词...',
              'Type a command, board name, task key (e.g. AI-101), or keyword...'
            )}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3 space-y-4 text-xs">
          {/* Quick Actions */}
          <div>
            <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {tr('快捷指令', 'Quick Actions')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateTask();
                }}
                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-indigo-500/10 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Plus className="w-4 h-4 text-indigo-500" />
                  {tr('新建任务', 'New Task')}
                </span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">
                  N
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleDarkMode();
                  onClose();
                }}
                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-indigo-500/10 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-2 font-medium">
                  {darkMode ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-indigo-500" />
                  )}
                  {darkMode
                    ? tr('切换明亮主题', 'Light Theme')
                    : tr('切换深色主题', 'Dark Theme')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleLang();
                  onClose();
                }}
                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-indigo-500/10 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Languages className="w-4 h-4 text-indigo-500" />
                  {lang === 'zh' ? 'Switch to English' : '切换为简体中文'}
                </span>
              </button>
            </div>
          </div>

          {/* Switch Board Views */}
          {matchingViews.length > 0 && (
            <div>
              <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {tr('切换多维看板视图', 'Switch Board Views')}
              </div>
              <div className="space-y-1">
                {matchingViews.map((view) => {
                  const Icon = view.icon;
                  return (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => {
                        onSelectView(view.id);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${view.badgeColor}`} />
                        <span className="font-semibold">
                          {tr(view.label, view.labelEn)}
                        </span>
                        <span className="text-slate-400">
                          — {tr(view.shortDesc, view.shortDescEn)}
                        </span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matching Tasks */}
          <div>
            <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {tr(
                `直达任务详情 (${matchingTasks.length})`,
                `Jump to Task (${matchingTasks.length})`
              )}
            </div>
            <div className="space-y-1">
              {matchingTasks.map((t) => {
                const proj = projectMap.get(t.project_id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelectTask(t);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        {t.task_key}
                      </span>
                      {proj && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: proj.color }}
                        />
                      )}
                      <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                        {t.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                      {t.due_date || tr('未排期', 'Unscheduled')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Command className="w-3 h-3" />{' '}
            {tr('Flow 极客命令中心', 'Flow Command Center')}
          </span>
          <span>{tr('按 ESC 退出', 'Press ESC to close')}</span>
        </div>
      </div>
    </div>
  );
};
