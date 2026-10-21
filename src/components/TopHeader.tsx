import React, { useRef } from 'react';
import {
  Bot,
  Command,
  Download,
  FilterX,
  Languages,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import type {
  BoardViewType,
  FilterState,
  Member,
  Project,
  TaskPriority,
} from '../types';
import { useI18n } from '../i18n/I18nContext';
import { BOARD_VIEWS } from './Sidebar';

interface TopHeaderProps {
  activeView: BoardViewType;
  filters: FilterState;
  projects: Project[];
  members: Member[];
  allTags: string[];
  totalFilteredCount: number;
  totalTaskCount: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onUpdateFilter: (patch: Partial<FilterState>) => void;
  onResetFilters: () => void;
  onOpenCreateTask: () => void;
  onOpenCommandPalette: () => void;
  onOpenAiAssistant: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImportJSON: (file: File) => void;
  onResetDemoData: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeView,
  filters,
  projects,
  members,
  allTags,
  totalFilteredCount,
  totalTaskCount,
  darkMode,
  onToggleDarkMode,
  onUpdateFilter,
  onResetFilters,
  onOpenCreateTask,
  onOpenCommandPalette,
  onOpenAiAssistant,
  onExportJSON,
  onExportCSV,
  onImportJSON,
  onResetDemoData,
}) => {
  const { lang, toggleLang, tr } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentViewMeta =
    BOARD_VIEWS.find((v) => v.id === activeView) || BOARD_VIEWS[0];

  const hasActiveFilter =
    filters.search.trim() !== '' ||
    filters.projectId !== 'all' ||
    filters.memberId !== 'all' ||
    filters.priority !== 'all' ||
    filters.tag !== 'all' ||
    filters.onlyOverdue;

  return (
    <header className="shrink-0 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#0E131F]/85 backdrop-blur-md px-6 py-3 space-y-2.5 z-10">
      {/* Top Bar: View Title + Command Search + Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                {tr(currentViewMeta.label, currentViewMeta.labelEn)}
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {tr(
                  `${totalFilteredCount} / ${totalTaskCount} 项任务`,
                  `${totalFilteredCount} / ${totalTaskCount} tasks`
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tr(
                `${currentViewMeta.shortDesc} · 支持跨列拖拽自动同步更新对应属性`,
                `${currentViewMeta.shortDescEn} · Drag across columns to auto-sync attributes`
              )}
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onUpdateFilter({ search: e.target.value })}
              placeholder={tr(
                '搜索任务名、编号、标签...',
                'Search title, key, tags...'
              )}
              className="pl-8 pr-3 py-1.5 w-48 sm:w-60 text-xs rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Command Palette Trigger */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300 hover:border-indigo-500/50 transition-colors"
            title={tr(
              '打开全局命令面板 (Ctrl+K)',
              'Open Command Palette (Ctrl+K)'
            )}
          >
            <Command className="w-3.5 h-3.5 text-indigo-500" />
            <span>{tr('命令面板', 'Commands')}</span>
            <kbd className="px-1 py-0.2 bg-white dark:bg-slate-800 rounded text-[10px] font-mono border border-slate-200 dark:border-slate-700">
              ⌘K
            </kbd>
          </button>

          {/* Data Tools: Export / Import / Reset */}
          <div className="hidden lg:flex items-center gap-1 border-l border-r border-slate-200 dark:border-slate-800 px-2">
            <button
              type="button"
              onClick={onExportJSON}
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs inline-flex items-center gap-1"
              title={tr('导出完整 JSON 备份', 'Export full JSON backup')}
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button
              type="button"
              onClick={onExportCSV}
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs inline-flex items-center gap-1"
              title={tr('导出 Excel/CSV 报表', 'Export Excel/CSV report')}
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs inline-flex items-center gap-1"
              title={tr('从 JSON 备份恢复数据', 'Restore from JSON backup')}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{tr('导入', 'Import')}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onImportJSON(file);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={onResetDemoData}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={tr('清空当前工作区数据', 'Clear workspace data')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Language Toggle (中文 / EN) */}
          <button
            type="button"
            onClick={toggleLang}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={tr('切换语言至 English', 'Switch language to 中文')}
          >
            <Languages className="w-3.5 h-3.5 text-indigo-500" />
            <span>{lang === 'zh' ? '中 / EN' : 'EN / 中'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={
              darkMode
                ? tr('切换至明亮模式', 'Switch to Light Mode')
                : tr('切换至 Linear 暗黑模式', 'Switch to Linear Dark Mode')
            }
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {/* AI Assistant Trigger Button */}
          <button
            type="button"
            onClick={onOpenAiAssistant}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-semibold shadow-sm shadow-indigo-500/25 transition-all"
            title={tr(
              '打开 AI 智能助理 (Ctrl+J) — 对话式录入任务、项目与相关人员',
              'Open AI Assistant (Ctrl+J) — Natural language task & project ingestion'
            )}
          >
            <Bot className="w-4 h-4" />
            <span>{tr('AI 智能助理', 'AI Assistant')}</span>
            <Sparkles className="w-3 h-3 text-amber-300" />
          </button>

          {/* Create Task Button */}
          <button
            type="button"
            onClick={onOpenCreateTask}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{tr('新建任务', 'New Task')}</span>
            <kbd className="hidden sm:inline-block px-1 py-0.2 rounded bg-indigo-700 text-indigo-100 font-mono text-[10px]">
              N
            </kbd>
          </button>
        </div>
      </div>

      {/* Second Bar: Multi-dimensional Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
          {tr('多维筛选：', 'Filters:')}
        </span>

        {/* Project Filter */}
        <select
          value={filters.projectId}
          onChange={(e) => onUpdateFilter({ projectId: e.target.value })}
          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
        >
          <option value="all">{tr('📁 全部项目', '📁 All Projects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              [{p.code}] {p.name}
            </option>
          ))}
        </select>

        {/* Member Filter */}
        <select
          value={filters.memberId}
          onChange={(e) => onUpdateFilter({ memberId: e.target.value })}
          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
        >
          <option value="all">{tr('👤 全部相关人员', '👤 All Members')}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.role})
            </option>
          ))}
        </select>

        {/* Include Collaborators Toggle when filtering by member */}
        {filters.memberId !== 'all' && (
          <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.includeCollaborated}
              onChange={(e) =>
                onUpdateFilter({ includeCollaborated: e.target.checked })
              }
              className="rounded border-indigo-400 text-indigo-600 focus:ring-0"
            />
            <span className="text-[11px]">
              {tr('含作为协同人参与的任务', 'Include collaborated tasks')}
            </span>
          </label>
        )}

        {/* Priority Filter */}
        <select
          value={filters.priority}
          onChange={(e) =>
            onUpdateFilter({
              priority: e.target.value as TaskPriority | 'all',
            })
          }
          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
        >
          <option value="all">{tr('⚡ 全部优先级', '⚡ All Priorities')}</option>
          <option value="urgent">
            {tr('🔥 紧急 (Urgent)', '🔥 Urgent')}
          </option>
          <option value="high">{tr('🟠 高优 (High)', '🟠 High')}</option>
          <option value="medium">{tr('🔵 普通 (Medium)', '🔵 Medium')}</option>
          <option value="low">{tr('⚪ 较低 (Low)', '⚪ Low')}</option>
        </select>

        {/* Tag Filter */}
        <select
          value={filters.tag}
          onChange={(e) => onUpdateFilter({ tag: e.target.value })}
          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
        >
          <option value="all">{tr('🏷️ 全部标签', '🏷️ All Tags')}</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              #{tag}
            </option>
          ))}
        </select>

        {/* Overdue Toggle */}
        <button
          type="button"
          onClick={() => onUpdateFilter({ onlyOverdue: !filters.onlyOverdue })}
          className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
            filters.onlyOverdue
              ? 'bg-rose-500 text-white border-rose-500'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-rose-500/40'
          }`}
        >
          {tr('🚨 仅看已逾期', '🚨 Overdue Only')}
        </button>

        {/* Clear All Filters */}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-rose-500 hover:bg-rose-500/10 text-xs font-medium transition-colors"
          >
            <FilterX className="w-3.5 h-3.5" />
            {tr('清除筛选', 'Clear Filters')}
          </button>
        )}
      </div>
    </header>
  );
};
