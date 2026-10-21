import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  FolderPlus,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  UserPlus,
  Wand2,
  X,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import { FlowLogo } from './FlowLogo';
import type {
  AiChatMessage,
  AiOperationReceipt,
  AiSettings,
  BootstrapPayload,
} from '../types';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncBootstrap: (data: BootstrapPayload) => void;
  onSelectTaskById: (taskId: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

const PROVIDER_PRESETS = [
  {
    name: 'DeepSeek 官方',
    nameEn: 'DeepSeek Official',
    base_url: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    name: 'OpenAI 官方',
    nameEn: 'OpenAI Official',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    name: '硅基流动 SiliconFlow',
    nameEn: 'SiliconFlow',
    base_url: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-72B-Instruct',
  },
  {
    name: '阿里云百炼 DashScope',
    nameEn: 'Alibaba DashScope',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    name: 'OpenRouter',
    nameEn: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
  },
  {
    name: '本地 Ollama',
    nameEn: 'Local Ollama',
    base_url: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:14b',
  },
];

const QUICK_PROMPTS = [
  {
    label: '📋 会议纪要自动拆单',
    labelEn: '📋 Parse Meeting Notes',
    prompt:
      '帮我把刚开完的周会纪要整理录入数据库：新建项目「核心产品研发」，添加成员「张明」（前端架构师）与「李薇」（UI设计师），让张明主负责、李薇协同，在3天后完成「完成新版工作台响应式布局与深色模式适配」任务（优先级紧急，预估8小时，拆分为：1.设计Token规范对齐 2.核心看板组件适配 3.多分辨率走查 三个子任务）。',
    promptEn:
      'Organize our sprint meeting notes into the database: create project "Core Product R&D", add members "Alex" (Frontend Architect) and "Maya" (UI Designer), assign Alex as owner and Maya as collaborator to finish "Responsive workspace layout & dark mode adaptation" in 3 days (urgent priority, 8h estimate, with 3 subtasks: 1. Align design tokens 2. Adapt core board components 3. Multi-resolution QA).',
  },
  {
    label: '🚀 批量创建项目与排期',
    labelEn: '🚀 Batch Create Project & Tasks',
    prompt:
      '新建一个「后端架构升级」项目（前缀 API），添加新同事「王拓」（岗位：后端专家），并指派他在本周五前完成「接入接口鉴权与慢查询监控告警」，优先级高优。',
    promptEn:
      'Create a new project "Backend Architecture Upgrade" (prefix API), add team member "Ryan" (Backend Lead), and assign him to complete "API auth & slow-query monitoring alerts" by this Friday with high priority.',
  },
  {
    label: '⚡ 自然语言状态更新',
    labelEn: '⚡ Natural Language Update',
    prompt:
      '帮我把当前所有待处理（todo）任务的优先级调为高优，或者把指定任务状态更新为已完成（done）。',
    promptEn:
      'Update all current todo tasks to high priority, or mark specific completed tasks as done.',
  },
];

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  onSyncBootstrap,
  onSelectTaskById,
  onShowToast,
}) => {
  const { tr } = useI18n();
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [settings, setSettings] = useState<AiSettings>({
    base_url: 'https://api.openai.com/v1',
    api_key: '',
    model: 'gpt-4o-mini',
    temperature: 0.2,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingModels, setTestingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([apiClient.getAiSettings(), apiClient.getAiMessages()])
      .then(([cfg, msgRes]) => {
        setSettings(cfg);
        setMessages(msgRes.messages);
      })
      .catch((err) => {
        onShowToast(
          err instanceof Error
            ? err.message
            : tr('加载 AI 助理配置失败', 'Failed to load AI assistant settings'),
          'error'
        );
      });
  }, [isOpen, onShowToast, tr]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending, activeTab]);

  if (!isOpen) return null;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const updated = await apiClient.updateAiSettings(settings);
      setSettings(updated);
      onShowToast(
        tr(
          'AI 接口配置已永久保存至本地 SQLite 数据库',
          'AI endpoint settings permanently saved to SQLite database'
        )
      );
      setActiveTab('chat');
    } catch (err) {
      onShowToast(
        err instanceof Error
          ? err.message
          : tr('保存配置失败', 'Failed to save settings'),
        'error'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestAndFetchModels = async () => {
    try {
      setTestingModels(true);
      const res = await apiClient.fetchAiModels(
        settings.base_url,
        settings.api_key
      );
      setAvailableModels(res.models);
      if (res.models.length > 0 && !res.models.includes(settings.model)) {
        setSettings((prev) => ({ ...prev, model: res.models[0] }));
      }
      onShowToast(
        res.models.length > 0
          ? tr(
              `连接成功！已拉取 ${res.models.length} 个可用模型`,
              `Connected! Fetched ${res.models.length} available models`
            )
          : tr(
              '接口连接成功（服务端未返回模型列表，可直接手动输入模型名）',
              'Connected (server did not list models; enter model name manually)'
            )
      );
    } catch (err) {
      onShowToast(
        err instanceof Error
          ? err.message
          : tr(
              '测试连接失败，请检查 URL 与 API Key',
              'Connection failed. Please verify URL and API Key'
            ),
        'error'
      );
    } finally {
      setTestingModels(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const optimisticUserMsg: AiChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      operations: [],
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await apiClient.sendAiChat(text);
      setMessages(res.messages);
      onSyncBootstrap(res.bootstrap);
      const opCount = res.assistantMessage.operations?.length || 0;
      if (opCount > 0) {
        onShowToast(
          tr(
            `AI 已自动整理并向数据库录入 ${opCount} 项变更！`,
            `AI organized and committed ${opCount} change(s) to the database!`
          )
        );
      }
    } catch (err) {
      onShowToast(
        err instanceof Error
          ? err.message
          : tr(
              'AI 请求失败，请检查接口配置',
              'AI request failed. Please check endpoint settings'
            ),
        'error'
      );
    } finally {
      setSending(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await apiClient.clearAiMessages();
      setMessages(res.messages);
      onShowToast(tr('已清空 AI 对话历史', 'AI chat history cleared'));
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : tr('清空失败', 'Failed to clear'),
        'error'
      );
    }
  };

  const renderOperationBadge = (op: AiOperationReceipt, idx: number) => {
    const isTask = op.kind === 'task_created' || op.kind === 'task_updated';
    return (
      <div
        key={`${op.id}-${idx}`}
        onClick={() => {
          if (isTask && op.id) {
            onSelectTaskById(op.id);
          }
        }}
        className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 transition-all ${
          isTask
            ? 'bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500 cursor-pointer'
            : 'bg-emerald-500/10 border-emerald-500/30'
        }`}
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {op.kind === 'task_created' && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold">
                {tr('+ 新录入任务', '+ Task Created')}
              </span>
            )}
            {op.kind === 'task_updated' && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold">
                {tr('↻ 更新任务', '↻ Task Updated')}
              </span>
            )}
            {op.kind === 'project_created' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                <FolderPlus className="w-3 h-3" />{' '}
                {tr('新建项目', 'Project Created')}
              </span>
            )}
            {op.kind === 'member_created' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-600 text-white text-[10px] font-bold">
                <UserPlus className="w-3 h-3" />{' '}
                {tr('新增人员', 'Member Added')}
              </span>
            )}
            {op.task_key && (
              <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                {op.task_key}
              </span>
            )}
            <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
              {op.title}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {op.summary}
            {op.subtask_count
              ? tr(
                  ` · 含 ${op.subtask_count} 项拆解子任务`,
                  ` · ${op.subtask_count} subtasks`
                )
              : ''}
          </p>
        </div>
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[2px]">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-label={tr('关闭 AI 助理背景', 'Close AI Assistant')}
      />
      <aside className="relative z-10 w-full max-w-xl h-full bg-white dark:bg-[#0D1320] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-600/10 via-violet-600/5 to-transparent">
          <div className="flex items-center gap-2.5">
            <FlowLogo className="w-9 h-9 shrink-0 shadow-md shadow-indigo-500/20 rounded-xl" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {tr('Flow AI 智能助理', 'Flow AI Assistant')}
                </h2>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  {settings.model || tr('未配置模型', 'No model')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {tr(
                  '自然语言指令解析 · 自动拆解项目/人员/任务/死线并写入 SQLite',
                  'Natural language command parser · Auto-ingest projects, members & tasks'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setActiveTab(activeTab === 'chat' ? 'settings' : 'chat')
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-500'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              {activeTab === 'settings'
                ? tr('返回对话', 'Back to Chat')
                : tr('接口配置', 'API Settings')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings Tab (Permanent SQLite Persistence) */}
        {activeTab === 'settings' ? (
          <form
            onSubmit={handleSaveSettings}
            className="flex-1 overflow-y-auto p-6 space-y-5 text-xs"
          >
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Database className="w-4 h-4" />
                {tr('永久化本地存储说明', 'Permanent Database Storage')}
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {tr(
                  '以下配置（URL / Model / API Key）直接保存在本地 data/flow.sqlite 的 ai_settings 表中，关闭网页或重启电脑均永久保留。',
                  'Your endpoint configuration (URL / Model / API Key) is stored directly in the local data/flow.sqlite database and persists across restarts.'
                )}
              </p>
            </div>

            {/* Quick Provider Presets */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-2">
                {tr(
                  '⚡ 一键填入主流 OpenAI 兼容服务商预设',
                  '⚡ Quick OpenAI-Compatible Provider Presets'
                )}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PROVIDER_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        base_url: preset.base_url,
                        model: preset.model,
                      }))
                    }
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 hover:border-indigo-500 text-left transition-all"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      {tr(preset.name, preset.nameEn)}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 truncate">
                      {preset.model}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Base URL */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                API Base URL (OpenAI Compatible) *
              </label>
              <input
                type="text"
                required
                value={settings.base_url}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, base_url: e.target.value }))
                }
                placeholder={tr(
                  '例如：https://api.openai.com/v1 或 https://api.deepseek.com/v1',
                  'e.g., https://api.openai.com/v1 or https://api.deepseek.com/v1'
                )}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="block text-[11px] text-slate-400 mt-1">
                {tr(
                  '支持自动识别并补全 /v1/chat/completions 路径',
                  'Automatically normalizes /v1/chat/completions endpoint paths'
                )}
              </span>
            </div>

            {/* API Key */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                {tr('API Key (密钥)', 'API Key')}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.api_key}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      api_key: e.target.value,
                    }))
                  }
                  placeholder="sk-..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Model Name + Fetch Models Button */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-200">
                  {tr('Model (模型名称) *', 'Model Name *')}
                </label>
                <button
                  type="button"
                  disabled={testingModels}
                  onClick={handleTestAndFetchModels}
                  className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${testingModels ? 'animate-spin' : ''}`}
                  />
                  {testingModels
                    ? tr('正在探测接口...', 'Probing endpoint...')
                    : tr('测试连接并拉取模型列表', 'Test & Fetch Models')}
                </button>
              </div>
              <input
                type="text"
                required
                value={settings.model}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, model: e.target.value }))
                }
                placeholder={tr(
                  '例如：deepseek-chat / gpt-4o-mini / qwen-plus',
                  'e.g., deepseek-chat / gpt-4o-mini / qwen-plus'
                )}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />

              {availableModels.length > 0 && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <span className="text-[11px] text-slate-500">
                    {tr(
                      '检测到服务端支持以下模型（点击即选）：',
                      'Available models from endpoint (click to select):'
                    )}
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {availableModels.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          setSettings((prev) => ({ ...prev, model: m }))
                        }
                        className={`px-2 py-1 rounded-lg font-mono text-[11px] border ${
                          settings.model === m
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                {tr('取消', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
              >
                <Save className="w-4 h-4" />
                {savingSettings
                  ? tr('保存中...', 'Saving...')
                  : tr('永久保存配置', 'Save Settings')}
              </button>
            </div>
          </form>
        ) : (
          /* Chat & Natural Language DB Ingestion View */
          <>
            {/* Status Bar */}
            <div className="px-5 py-2 bg-slate-100/80 dark:bg-slate-900/80 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 truncate">
                <span
                  className={`w-2 h-2 rounded-full ${
                    settings.api_key || settings.base_url.includes('11434')
                      ? 'bg-emerald-500'
                      : 'bg-amber-500 animate-pulse'
                  }`}
                />
                <span className="text-slate-500 dark:text-slate-400 truncate">
                  {tr('接口：', 'Endpoint: ')}
                  {settings.base_url}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!settings.api_key && !settings.base_url.includes('11434') && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                  >
                    {tr('去填写 API Key →', 'Configure API Key →')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-slate-400 hover:text-rose-500 inline-flex items-center gap-1"
                  title={tr('清空对话记录', 'Clear chat history')}
                >
                  <Trash2 className="w-3 h-3" />
                  {tr('清空对话', 'Clear')}
                </button>
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-xs shadow-sm'
                        : 'bg-slate-100 dark:bg-[#151E30] text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-bl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>

                  {/* Render DB Operation Receipts */}
                  {msg.operations && msg.operations.length > 0 && (
                    <div className="w-full max-w-[92%] mt-2 space-y-1.5">
                      <div className="text-[10px] font-semibold text-indigo-500 flex items-center gap-1 px-1">
                        <Sparkles className="w-3 h-3" />
                        {tr(
                          '已自动同步至 SQLite 数据库（点击任务卡片可查看详情）：',
                          'Synced to SQLite database (click task card to inspect):'
                        )}
                      </div>
                      {msg.operations.map((op, i) =>
                        renderOperationBadge(op, i)
                      )}
                    </div>
                  )}
                </div>
              ))}

              {sending && (
                <div className="flex items-center gap-2 text-xs text-indigo-500 px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {tr(
                      'AI 正在解析指令、匹配项目与相关人员并写入数据库...',
                      'AI is parsing instructions, matching projects/members, and updating database...'
                    )}
                  </span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompt Templates */}
            <div className="px-5 pt-2 pb-1 border-t border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0B0F19]">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5">
                <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                  <Wand2 className="w-3 h-3 text-indigo-500" />
                  {tr('一键示例：', 'Examples:')}
                </span>
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    type="button"
                    onClick={() => setInput(tr(qp.prompt, qp.promptEn))}
                    className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 text-[11px] text-slate-600 dark:text-slate-300 shrink-0 transition-colors"
                  >
                    {tr(qp.label, qp.labelEn)}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Box */}
            <form
              onSubmit={handleSend}
              className="p-4 bg-white dark:bg-[#0D1320] border-t border-slate-200 dark:border-slate-800 space-y-2"
            >
              <textarea
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={tr(
                  '直接输入自然语言指令或粘贴会议纪要（例如：让陈默和苏晚晴在本周五前完成移动端手势优化，归属移动端项目，高优先级，包含两个子任务...）按 Enter 发送',
                  'Type a natural language command or paste meeting notes (e.g. Assign Alex and Maya to finish mobile gesture optimization by Friday under Mobile Project, high priority...) Press Enter to send'
                )}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {tr(
                    'Enter 发送 · Shift + Enter 换行',
                    'Enter to send · Shift + Enter for new line'
                  )}
                </span>
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  {sending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {tr('发送并自动录入数据库', 'Send & Ingest to DB')}
                  </span>
                </button>
              </div>
            </form>
          </>
        )}
      </aside>
    </div>
  );
};
