import React, { useState } from 'react';
import {
  KeyRound,
  Languages,
  Lock,
  LogIn,
  Moon,
  ShieldCheck,
  Sun,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { apiClient, setAuthToken } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import type { UserAccount } from '../types';
import { FlowLogo } from './FlowLogo';

interface AuthScreenProps {
  initialized: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAuthenticated: (user: UserAccount) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialized,
  darkMode,
  onToggleDarkMode,
  onAuthenticated,
}) => {
  const { lang, toggleLang, tr } = useI18n();
  const [username, setUsername] = useState(initialized ? '' : 'admin');
  const [displayName, setDisplayName] = useState(
    initialized ? '' : tr('超级管理员', 'Super Admin')
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [createMember, setCreateMember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError(tr('请填写完整的账号与密码', 'Please enter username and password'));
      return;
    }

    if (!initialized) {
      if (password.length < 4) {
        setError(
          tr('密码长度不能少于 4 位', 'Password must be at least 4 characters')
        );
        return;
      }
      if (password !== confirmPassword) {
        setError(
          tr('两次输入的密码不一致', 'Passwords do not match')
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      if (!initialized) {
        const res = await apiClient.setupSuperAdmin({
          username: username.trim(),
          display_name: displayName.trim() || username.trim(),
          password,
          create_member: createMember,
        });
        setAuthToken(res.token);
        onAuthenticated(res.user);
      } else {
        const res = await apiClient.login({
          username: username.trim(),
          password,
        });
        setAuthToken(res.token);
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tr('认证失败，请重试', 'Authentication failed')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-between bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 p-6 select-none">
      {/* Top Bar: Brand + Language & Theme Switcher */}
      <div className="flex items-center justify-between max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <FlowLogo className="w-9 h-9 rounded-xl shadow-md shadow-indigo-500/20" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight">Flow</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                v0.1
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {tr(
                'AI 驱动的多维协同 Todo 与敏捷看板系统',
                'AI-Native Multi-Dimensional Work Todo & Kanban'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLang}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-indigo-500/50 transition-colors"
          >
            <Languages className="w-3.5 h-3.5 text-indigo-500" />
            <span>{lang === 'zh' ? '中 / EN' : 'EN / 中'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-indigo-500/50 transition-colors"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>
        </div>
      </div>

      {/* Center Card */}
      <div className="w-full max-w-md mx-auto my-8">
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#111726] shadow-2xl overflow-hidden">
          {/* Card Header */}
          <div className="px-7 pt-7 pb-5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold mb-3">
              {!initialized ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {tr(
                    '首次部署初始化 · 设置超级管理员',
                    'First-Time Setup · Super Admin'
                  )}
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  {tr('安全工作区登录', 'Workspace Sign In')}
                </>
              )}
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {!initialized
                ? tr(
                    '创建超级管理员账号',
                    'Create Super Administrator Account'
                  )
                : tr('欢迎回到 Flow 工作台', 'Welcome back to Flow')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {!initialized
                ? tr(
                    '检测到当前为首次部署运行。请设置您的超级管理员账号，后续可在「账号管理」中创建老板、项目主管、组长与成员账号并分配项目权限。',
                    'First deployment detected. Set up your Super Admin account to manage Boss, Director, Lead, and Member accounts and project permissions.'
                  )
                : tr(
                    '请使用管理员分配的账号登录，系统将根据您的角色加载对应可视项目与操作权限。',
                    'Sign in with your account to access your authorized projects and boards.'
                  )}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-7 space-y-4 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                {tr('登录账号 (Username) *', 'Username *')}
              </label>
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={tr('例如：admin 或 zhangming', 'e.g., admin')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {!initialized && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  {tr(
                    '显示名称 / 绑定人员姓名 *',
                    'Display Name / Bound Member Name *'
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={tr('例如：陈默 (超级管理员)', 'e.g., Alex Chen')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                {tr('登录密码 (Password) *', 'Password *')}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tr('输入密码（至少 4 位）', 'Enter password (min 4 chars)')}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {!initialized && (
              <>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    {tr('确认密码 *', 'Confirm Password *')}
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={tr('再次输入密码', 'Re-enter password')}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createMember}
                    onChange={(e) => setCreateMember(e.target.checked)}
                    className="mt-0.5 rounded border-indigo-400 text-indigo-600 focus:ring-0"
                  />
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    <span className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                      {tr(
                        '自动在「相关人员」中创建并绑定同名成员',
                        'Auto-create and bind a matching Member in Team Personnel'
                      )}
                    </span>
                    {tr(
                      '开启后您的账号将直接关联至人员看板，方便指派任务与在项目群聊中发言。',
                      'Links your account directly to the Member Workload board and Project Group Chats.'
                    )}
                  </div>
                </label>
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all mt-2"
            >
              {!initialized ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  {submitting
                    ? tr('正在初始化...', 'Initializing...')
                    : tr(
                        '完成初始化并进入工作台',
                        'Complete Setup & Enter Workspace'
                      )}
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  {submitting
                    ? tr('登录中...', 'Signing in...')
                    : tr('登录 Flow 工作台', 'Sign In')}
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-400">
        Flow Workspace v0.1 · Released under GPL-3.0 License
      </div>
    </div>
  );
};
