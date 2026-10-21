import React, { useEffect, useState } from 'react';
import {
  Check,
  FolderKanban,
  KeyRound,
  Pencil,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import type {
  AccountRole,
  Member,
  Project,
  UserAccount,
  UserPermissions,
} from '../types';

interface AccountManagementModalProps {
  isOpen: boolean;
  currentUser: UserAccount;
  projects: Project[];
  members: Member[];
  onClose: () => void;
  onRefreshBootstrap: () => Promise<void>;
  onUpdateCurrentUser: (user: UserAccount) => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ROLE_META: Record<
  AccountRole,
  {
    label: string;
    labelEn: string;
    desc: string;
    descEn: string;
    badgeClass: string;
    defaultPermissions: UserPermissions;
  }
> = {
  admin: {
    label: '管理员',
    labelEn: 'Super Admin',
    desc: '拥有全部项目可视、增删改查以及账号管理权限',
    descEn: 'Full access to all projects, tasks, members, and account management',
    badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    defaultPermissions: {
      visible_project_ids: 'all',
      can_create_project: true,
      can_edit_project: true,
      can_delete_project: true,
      can_create_task: true,
      can_edit_task: true,
      can_delete_task: true,
      can_manage_members: true,
      can_manage_accounts: true,
    },
  },
  boss: {
    label: '老板',
    labelEn: 'Boss',
    desc: '全局项目可视，拥有项目、人员与任务的完整新建/编辑/删除权限',
    descEn: 'All projects visible; full create/edit/delete permissions across projects & tasks',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    defaultPermissions: {
      visible_project_ids: 'all',
      can_create_project: true,
      can_edit_project: true,
      can_delete_project: true,
      can_create_task: true,
      can_edit_task: true,
      can_delete_task: true,
      can_manage_members: true,
      can_manage_accounts: false,
    },
  },
  director: {
    label: '项目主管',
    labelEn: 'Project Director',
    desc: '可新建和编辑项目、管理团队成员及所有任务（默认不可删项目）',
    descEn: 'Can create/edit projects, manage team members & tasks (no project deletion by default)',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    defaultPermissions: {
      visible_project_ids: 'all',
      can_create_project: true,
      can_edit_project: true,
      can_delete_project: false,
      can_create_task: true,
      can_edit_task: true,
      can_delete_task: true,
      can_manage_members: true,
      can_manage_accounts: false,
    },
  },
  lead: {
    label: '组长',
    labelEn: 'Team Lead',
    desc: '可编辑授权项目、新建与流转编辑任务',
    descEn: 'Can edit authorized projects and create/edit tasks',
    badgeClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
    defaultPermissions: {
      visible_project_ids: 'all',
      can_create_project: false,
      can_edit_project: true,
      can_delete_project: false,
      can_create_task: true,
      can_edit_task: true,
      can_delete_task: false,
      can_manage_members: false,
      can_manage_accounts: false,
    },
  },
  member: {
    label: '成员',
    labelEn: 'Member',
    desc: '可查看授权项目、新建与推进任务状态（不可修改/删除项目）',
    descEn: 'Can view authorized projects and create/update tasks',
    badgeClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
    defaultPermissions: {
      visible_project_ids: 'all',
      can_create_project: false,
      can_edit_project: false,
      can_delete_project: false,
      can_create_task: true,
      can_edit_task: true,
      can_delete_task: false,
      can_manage_members: false,
      can_manage_accounts: false,
    },
  },
};

export const AccountManagementModal: React.FC<AccountManagementModalProps> = ({
  isOpen,
  currentUser,
  projects,
  members,
  onClose,
  onRefreshBootstrap,
  onUpdateCurrentUser,
  onShowToast,
}) => {
  const { tr } = useI18n();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AccountRole>('member');
  const [memberId, setMemberId] = useState<string>('');
  const [autoCreateMember, setAutoCreateMember] = useState<boolean>(true);
  const [permissions, setPermissions] = useState<UserPermissions>(
    ROLE_META.member.defaultPermissions
  );

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getUsers();
      setUsers(res.users);
    } catch (err) {
      onShowToast(
        err instanceof Error
          ? err.message
          : tr('加载账号列表失败', 'Failed to load accounts'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditingUser(null);
    setUsername('');
    setDisplayName('');
    setPassword('');
    setRole('member');
    setMemberId('');
    setAutoCreateMember(true);
    setPermissions({ ...ROLE_META.member.defaultPermissions });
  };

  const handleSelectEdit = (u: UserAccount) => {
    setEditingUser(u);
    setUsername(u.username);
    setDisplayName(u.display_name);
    setPassword('');
    setRole(u.role);
    setMemberId(u.member_id || '');
    setAutoCreateMember(false);
    setPermissions({ ...u.permissions });
  };

  const handleRoleChange = (nextRole: AccountRole) => {
    setRole(nextRole);
    setPermissions({
      ...ROLE_META[nextRole].defaultPermissions,
      visible_project_ids:
        nextRole === 'admin' ? 'all' : permissions.visible_project_ids,
    });
  };

  const toggleProjectVisibility = (projId: string) => {
    if (permissions.visible_project_ids === 'all') {
      setPermissions((prev) => ({
        ...prev,
        visible_project_ids: [projId],
      }));
      return;
    }
    const list = permissions.visible_project_ids;
    const next = list.includes(projId)
      ? list.filter((id) => id !== projId)
      : [...list, projId];
    setPermissions((prev) => ({
      ...prev,
      visible_project_ids: next,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      if (editingUser) {
        const updated = await apiClient.updateUser(editingUser.id, {
          username: username.trim(),
          display_name: displayName.trim() || username.trim(),
          password: password.trim() || undefined,
          role,
          member_id: memberId || null,
          permissions,
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === updated.id ? updated : u))
        );
        if (updated.id === currentUser.id) {
          onUpdateCurrentUser(updated);
        }
        await onRefreshBootstrap();
        onShowToast(
          tr(
            `已更新账号「${updated.display_name}」权限配置`,
            `Updated account "${updated.display_name}"`
          )
        );
        resetForm();
      } else {
        if (password.length < 4) {
          onShowToast(
            tr('新建账号密码不能少于 4 位', 'Password must be at least 4 chars'),
            'error'
          );
          return;
        }
        const created = await apiClient.createUser({
          username: username.trim(),
          display_name: displayName.trim() || username.trim(),
          password,
          role,
          member_id: memberId || null,
          auto_create_member: !memberId && autoCreateMember,
          permissions,
        });
        setUsers((prev) => [...prev, created]);
        await onRefreshBootstrap();
        onShowToast(
          tr(
            `已创建账号「${created.display_name}」(${ROLE_META[created.role].label})`,
            `Created account "${created.display_name}"`
          )
        );
        resetForm();
      }
    } catch (err) {
      onShowToast(
        err instanceof Error
          ? err.message
          : tr('保存账号失败', 'Failed to save account'),
        'error'
      );
    }
  };

  const handleDelete = async (u: UserAccount) => {
    if (
      !window.confirm(
        tr(
          `确定要删除账号「${u.display_name} (@${u.username})」吗？`,
          `Delete account "${u.display_name} (@${u.username})"?`
        )
      )
    ) {
      return;
    }
    try {
      await apiClient.deleteUser(u.id);
      setUsers((prev) => prev.filter((item) => item.id !== u.id));
      if (editingUser?.id === u.id) {
        resetForm();
      }
      onShowToast(
        tr(`已删除账号「${u.display_name}」`, `Deleted account "${u.display_name}"`)
      );
    } catch (err) {
      onShowToast(
        err instanceof Error
          ? err.message
          : tr('删除账号失败', 'Failed to delete account'),
        'error'
      );
    }
  };

  if (!isOpen) return null;

  const memberMap = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4">
      <div className="w-full max-w-5xl h-[85vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1522] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {tr(
                  '账号与组织角色权限管理中心 (RBAC)',
                  'Account & Role-Based Permission Management'
                )}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {tr(
                  '支持五级权限（管理员 / 老板 / 项目主管 / 组长 / 成员）、细粒度项目可视与编辑删除控制、绑定现有团队人员',
                  '5-tier roles (Admin / Boss / Director / Lead / Member), project visibility & edit/delete permissions, and team member binding'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Left Account List + Right Create/Edit Form */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden">
          {/* Left Column: Existing Accounts (5 cols) */}
          <div className="lg:col-span-5 flex flex-col min-h-0 bg-slate-50/50 dark:bg-[#0B0F19]/60">
            <div className="px-5 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-500" />
                {tr(`系统账号列表 (${users.length})`, `Accounts (${users.length})`)}
              </span>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold"
              >
                <Plus className="w-3 h-3" />
                {tr('新建账号', 'New Account')}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {loading ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  {tr('正在加载账号...', 'Loading accounts...')}
                </div>
              ) : (
                users.map((u) => {
                  const rMeta = ROLE_META[u.role] || ROLE_META.member;
                  const boundMem = u.member_id
                    ? memberMap.get(u.member_id)
                    : null;
                  const isEditing = editingUser?.id === u.id;
                  const visCount =
                    u.permissions.visible_project_ids === 'all'
                      ? tr('全部项目可视', 'All Projects')
                      : tr(
                          `仅 ${u.permissions.visible_project_ids.length} 个项目可视`,
                          `${u.permissions.visible_project_ids.length} Project(s)`
                        );

                  return (
                    <div
                      key={u.id}
                      onClick={() => handleSelectEdit(u)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isEditing
                          ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 ring-2 ring-indigo-500/20'
                          : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131926] hover:border-indigo-500/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {u.display_name}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              @{u.username}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${rMeta.badgeClass}`}
                            >
                              {tr(rMeta.label, rMeta.labelEn)}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                              <UserCheck className="w-3 h-3 text-emerald-500" />
                              {boundMem
                                ? tr(
                                    `已绑定人员：${boundMem.name}`,
                                    `Bound: ${boundMem.name}`
                                  )
                                : tr('未绑定人员', 'Unbound')}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                              <FolderKanban className="w-3 h-3 text-indigo-500" />
                              {visCount}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectEdit(u);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={tr('编辑账号', 'Edit account')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(u);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={tr('删除账号', 'Delete account')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Account Create/Edit Form (7 cols) */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 flex flex-col min-h-0 overflow-y-auto p-6 space-y-5 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                {editingUser ? (
                  <Pencil className="w-4 h-4 text-indigo-500" />
                ) : (
                  <UserPlus className="w-4 h-4 text-emerald-500" />
                )}
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingUser
                    ? tr(
                        `编辑账号：${editingUser.display_name} (@${editingUser.username})`,
                        `Edit Account: ${editingUser.display_name} (@${editingUser.username})`
                      )
                    : tr('新建系统账号与权限分配', 'Create New Account & Permissions')}
                </h3>
              </div>
              {editingUser && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-indigo-500 hover:underline"
                >
                  {tr('切换为新建账号', 'Switch to Create Mode')}
                </button>
              )}
            </div>

            {/* 1. Basic Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">
                  {tr('登录账号 (Username) *', 'Username *')}
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="zhangming"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {tr('显示名称 / 姓名 *', 'Display Name *')}
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={tr('例如：张明', 'e.g., Alex')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {editingUser
                    ? tr('重置密码 (留空不修改)', 'New Password (optional)')
                    : tr('初始密码 *', 'Password *')}
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required={!editingUser}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      editingUser
                        ? tr('留空保持原密码', 'Leave blank to keep')
                        : tr('至少 4 位', 'Min 4 chars')
                    }
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* 2. Bind to Existing Member */}
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-2.5">
              <label className="block font-semibold text-slate-800 dark:text-slate-100">
                {tr(
                  '绑定已创建的「相关人员」名称（与人员负载看板及项目群聊身份联动）',
                  'Bind to Existing Team Member (Links with Workload Board & Group Chats)'
                )}
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={memberId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMemberId(val);
                    const found = members.find((m) => m.id === val);
                    if (found && !displayName.trim()) {
                      setDisplayName(found.name);
                    }
                  }}
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="">
                    {tr('— 暂不绑定已有人员 —', '— Not bound to existing member —')}
                  </option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>

                {!editingUser && !memberId && (
                  <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCreateMember}
                      onChange={(e) => setAutoCreateMember(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                    />
                    <span>
                      {tr(
                        '自动新建并绑定同名人员',
                        'Auto-create & bind matching member'
                      )}
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* 3. Five-Tier Role Selector */}
            <div>
              <label className="block font-semibold text-slate-800 dark:text-slate-100 mb-2">
                {tr(
                  '选择五级组织权限角色（点击自动填充对应权限模版）',
                  'Select 5-Tier Organization Role (Auto-applies permission template)'
                )}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(
                  ['admin', 'boss', 'director', 'lead', 'member'] as AccountRole[]
                ).map((rKey) => {
                  const meta = ROLE_META[rKey];
                  const active = role === rKey;
                  return (
                    <button
                      key={rKey}
                      type="button"
                      onClick={() => handleRoleChange(rKey)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-indigo-500/50'
                      }`}
                    >
                      <div className="font-bold text-xs">
                        {tr(meta.label, meta.labelEn)}
                      </div>
                      <div
                        className={`text-[10px] mt-0.5 line-clamp-2 ${
                          active ? 'text-indigo-100' : 'text-slate-400'
                        }`}
                      >
                        {tr(meta.desc, meta.descEn)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Project Visibility Scope */}
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-800 dark:text-slate-100">
                  {tr('项目可视权限分配', 'Project Visibility Scope')}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={role === 'admin'}
                    onClick={() =>
                      setPermissions((prev) => ({
                        ...prev,
                        visible_project_ids: 'all',
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                      permissions.visible_project_ids === 'all'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {tr('全部项目可视', 'All Projects Visible')}
                  </button>
                  <button
                    type="button"
                    disabled={role === 'admin'}
                    onClick={() =>
                      setPermissions((prev) => ({
                        ...prev,
                        visible_project_ids: projects.map((p) => p.id),
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                      Array.isArray(permissions.visible_project_ids)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {tr('指定可视项目', 'Specific Projects Only')}
                  </button>
                </div>
              </div>

              {Array.isArray(permissions.visible_project_ids) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {projects.length === 0 ? (
                    <span className="text-[11px] text-slate-400">
                      {tr('当前暂无已创建的项目', 'No projects created yet')}
                    </span>
                  ) : (
                    projects.map((p) => {
                      const checked =
                        permissions.visible_project_ids.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleProjectVisibility(p.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
                            checked
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          <span>
                            [{p.code}] {p.name}
                          </span>
                          {checked && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* 5. Granular Edit / Delete Permissions Matrix */}
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-2.5">
              <label className="block font-semibold text-slate-800 dark:text-slate-100">
                {tr(
                  '细粒度操作权限（项目新建/编辑/删除 & 任务与人员权限）',
                  'Granular Action Permissions (Projects, Tasks & Personnel)'
                )}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  {
                    key: 'can_create_project' as const,
                    label: tr('新建项目', 'Create Projects'),
                  },
                  {
                    key: 'can_edit_project' as const,
                    label: tr('编辑项目', 'Edit Projects'),
                  },
                  {
                    key: 'can_delete_project' as const,
                    label: tr('删除项目', 'Delete Projects'),
                  },
                  {
                    key: 'can_manage_members' as const,
                    label: tr('管理人员', 'Manage Members'),
                  },
                  {
                    key: 'can_create_task' as const,
                    label: tr('新建任务', 'Create Tasks'),
                  },
                  {
                    key: 'can_edit_task' as const,
                    label: tr('编辑/流转任务', 'Edit/Move Tasks'),
                  },
                  {
                    key: 'can_delete_task' as const,
                    label: tr('删除任务', 'Delete Tasks'),
                  },
                  {
                    key: 'can_manage_accounts' as const,
                    label: tr('账号管理菜单', 'Manage Accounts'),
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      disabled={role === 'admin'}
                      checked={Boolean(permissions[item.key])}
                      onChange={(e) =>
                        setPermissions((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                    />
                    <span className="text-[11px] font-medium">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                {tr('关闭', 'Close')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
              >
                {editingUser
                  ? tr('保存账号与权限修改', 'Save Account & Permissions')
                  : tr('立即创建账号', 'Create Account')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
