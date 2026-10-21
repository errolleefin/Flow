import React, { useEffect, useRef, useState } from 'react';
import {
  AtSign,
  FolderKanban,
  Hash,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import type {
  ChatGroup,
  ChatGroupMessage,
  Member,
  Project,
  Task,
  UserAccount,
} from '../types';

interface ProjectChatDrawerProps {
  isOpen: boolean;
  initialGroupId?: string | null;
  activeProjectId?: string | null;
  currentUser: UserAccount | null;
  chatGroups: ChatGroup[];
  projects: Project[];
  members: Member[];
  tasks: Task[];
  onClose: () => void;
  onSyncGroups: (groups: ChatGroup[]) => void;
  onSelectTask: (task: Task) => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ProjectChatDrawer: React.FC<ProjectChatDrawerProps> = ({
  isOpen,
  initialGroupId,
  activeProjectId,
  currentUser,
  chatGroups,
  projects,
  members,
  tasks,
  onClose,
  onSyncGroups,
  onSelectTask,
  onShowToast,
}) => {
  const { lang, tr } = useI18n();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatGroupMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedSenderMemId, setSelectedSenderMemId] = useState<string>('');

  // Group Form State (Create / Edit)
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ChatGroup | null>(null);
  const [grpName, setGrpName] = useState('');
  const [grpDesc, setGrpDesc] = useState('');
  const [grpProjectId, setGrpProjectId] = useState<string>('');
  const [grpMemberIds, setGrpMemberIds] = useState<string[]>([]);

  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (currentUser?.member_id) {
      setSelectedSenderMemId(currentUser.member_id);
    } else if (members[0]?.id) {
      setSelectedSenderMemId(members[0].id);
    }
    if (initialGroupId) {
      setActiveGroupId(initialGroupId);
      return;
    }
    // If a project is currently selected on the board, prefer selecting its bound chat group
    if (activeProjectId && activeProjectId !== 'all') {
      const matched = chatGroups.find((g) => g.project_id === activeProjectId);
      if (matched) {
        setActiveGroupId(matched.id);
        return;
      }
    }
    if (chatGroups.length > 0 && !activeGroupId) {
      setActiveGroupId(chatGroups[0].id);
    }
  }, [
    isOpen,
    initialGroupId,
    activeProjectId,
    chatGroups,
    currentUser,
    members,
  ]);

  useEffect(() => {
    if (!isOpen || !activeGroupId) {
      setMessages([]);
      return;
    }
    apiClient
      .getChatGroupMessages(activeGroupId)
      .then((res) => {
        setMessages(res.messages);
      })
      .catch(() => {
        setMessages([]);
      });
  }, [isOpen, activeGroupId]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const activeGroup =
    chatGroups.find((g) => g.id === activeGroupId) || null;
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const taskByKey = new Map(tasks.map((t) => [t.task_key.toUpperCase(), t]));

  // Resolve active project theme color dynamically
  const resolvedProject = showGroupForm
    ? grpProjectId
      ? projectMap.get(grpProjectId) || null
      : null
    : activeGroup?.project_id
      ? projectMap.get(activeGroup.project_id) || null
      : activeProjectId && activeProjectId !== 'all'
        ? projectMap.get(activeProjectId) || null
        : projects[0] || null;

  const themeColor = resolvedProject?.color || '#6366f1';

  const openCreateGroupForm = () => {
    setEditingGroup(null);
    setGrpName('');
    setGrpDesc('');
    setGrpProjectId(
      activeProjectId && activeProjectId !== 'all'
        ? activeProjectId
        : projects[0]?.id || ''
    );
    setGrpMemberIds(members.map((m) => m.id));
    setShowGroupForm(true);
  };

  const openEditGroupForm = (grp: ChatGroup) => {
    setEditingGroup(grp);
    setGrpName(grp.name);
    setGrpDesc(grp.description || '');
    setGrpProjectId(grp.project_id || '');
    setGrpMemberIds(grp.member_ids || []);
    setShowGroupForm(true);
  };

  const toggleGroupMember = (id: string) => {
    setGrpMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grpName.trim()) return;
    try {
      if (editingGroup) {
        const updated = await apiClient.updateChatGroup(editingGroup.id, {
          name: grpName.trim(),
          description: grpDesc.trim(),
          project_id: grpProjectId || null,
          member_ids: grpMemberIds,
        });
        onSyncGroups(
          chatGroups.map((g) => (g.id === updated.id ? updated : g))
        );
        onShowToast(
          tr(`已更新群聊「${updated.name}」`, `Updated group "${updated.name}"`)
        );
      } else {
        const created = await apiClient.createChatGroup({
          name: grpName.trim(),
          description: grpDesc.trim(),
          project_id: grpProjectId || null,
          member_ids: grpMemberIds,
        });
        onSyncGroups([...chatGroups, created]);
        setActiveGroupId(created.id);
        onShowToast(
          tr(
            `已新建项目沟通群聊「${created.name}」`,
            `Created group chat "${created.name}"`
          )
        );
      }
      setShowGroupForm(false);
    } catch (err) {
      onShowToast(
        err instanceof Error
          ? err.message
          : tr('保存群聊失败', 'Failed to save group chat'),
        'error'
      );
    }
  };

  const handleDeleteGroup = async (grp: ChatGroup) => {
    if (
      !window.confirm(
        tr(
          `确定要删除沟通群聊「${grp.name}」及其聊天记录吗？`,
          `Delete group chat "${grp.name}" and all its messages?`
        )
      )
    ) {
      return;
    }
    try {
      await apiClient.deleteChatGroup(grp.id);
      const next = chatGroups.filter((g) => g.id !== grp.id);
      onSyncGroups(next);
      if (activeGroupId === grp.id) {
        setActiveGroupId(next[0]?.id || null);
      }
      onShowToast(
        tr(`已删除群聊「${grp.name}」`, `Deleted group "${grp.name}"`)
      );
    } catch (err) {
      onShowToast(
        err instanceof Error
          ? err.message
          : tr('删除群聊失败', 'Failed to delete group'),
        'error'
      );
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeGroup || !input.trim()) return;
    try {
      const created = await apiClient.sendChatGroupMessage(activeGroup.id, {
        content: input.trim(),
        sender_member_id: selectedSenderMemId || currentUser?.member_id || null,
        sender_name: currentUser?.display_name || undefined,
      });
      setMessages((prev) => [...prev, created]);
      setInput('');
      onSyncGroups(
        chatGroups.map((g) =>
          g.id === activeGroup.id
            ? {
                ...g,
                message_count: (g.message_count || 0) + 1,
                last_message_at: created.created_at,
              }
            : g
        )
      );
    } catch (err) {
      onShowToast(
        err instanceof Error
          ? err.message
          : tr('发送消息失败', 'Failed to send message'),
        'error'
      );
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!activeGroup) return;
    try {
      await apiClient.deleteChatGroupMessage(activeGroup.id, msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err) {
      onShowToast(
        err instanceof Error
          ? err.message
          : tr('删除消息失败', 'Failed to delete message'),
        'error'
      );
    }
  };

  // Render message content with clickable #TASK-KEY references styled with project color
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(#[A-Z0-9]+-\d+)/gi);
    return parts.map((part, idx) => {
      if (part.startsWith('#')) {
        const key = part.slice(1).toUpperCase();
        const linkedTask = taskByKey.get(key);
        if (linkedTask) {
          const taskProj = projectMap.get(linkedTask.project_id);
          const chipColor = taskProj?.color || themeColor;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onClose();
                onSelectTask(linkedTask);
              }}
              style={{
                backgroundColor: `${chipColor}20`,
                color: chipColor,
                borderColor: `${chipColor}40`,
              }}
              className="mx-0.5 px-1.5 py-0.5 rounded border font-mono text-[11px] font-bold hover:underline"
              title={linkedTask.title}
            >
              {part} ({linkedTask.title})
            </button>
          );
        }
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const groupTasks = activeGroup?.project_id
    ? tasks.filter((t) => t.project_id === activeGroup.project_id)
    : tasks;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[2px]">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-label={tr('关闭项目群聊抽屉', 'Close project chat drawer')}
      />
      <aside className="relative z-10 w-full max-w-4xl h-full bg-white dark:bg-[#0D1320] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header — Dynamically Styled with Project Theme Color */}
        <div
          style={{
            background: `linear-gradient(90deg, ${themeColor}22 0%, ${themeColor}08 55%, transparent 100%)`,
          }}
          className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div
              style={{ backgroundColor: themeColor }}
              className="w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-sm transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {tr(
                    '自定义项目沟通群聊中心',
                    'Custom Project Communication Channels'
                  )}
                </h2>
                {resolvedProject && (
                  <span
                    style={{
                      backgroundColor: `${themeColor}20`,
                      color: themeColor,
                      borderColor: `${themeColor}40`,
                    }}
                    className="px-2 py-0.5 rounded-md border text-[10px] font-bold"
                  >
                    [{resolvedProject.code}] {resolvedProject.name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {tr(
                  '按项目或跨部门专项自定义建群 · 主题色随关联项目自动同步',
                  'Custom project or cross-team channels · Theme color automatically syncs with linked project'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreateGroupForm}
              style={{ backgroundColor: themeColor }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:opacity-90 text-white text-xs font-semibold shadow-sm transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              {tr('新建自定义群聊', 'New Channel')}
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

        {/* Main Split Body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden">
          {/* Left Channels List (4 cols) */}
          <div className="md:col-span-4 flex flex-col min-h-0 bg-slate-50/60 dark:bg-[#0A0F1A]">
            <div className="px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {tr(
                `沟通群聊频道 (${chatGroups.length})`,
                `Group Channels (${chatGroups.length})`
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              {chatGroups.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                  <p>
                    {tr(
                      '暂无项目沟通群聊',
                      'No project communication channels yet'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={openCreateGroupForm}
                    style={{ color: themeColor }}
                    className="font-semibold hover:underline"
                  >
                    {tr('+ 立即创建首个项目群聊', '+ Create your first channel')}
                  </button>
                </div>
              ) : (
                chatGroups.map((grp) => {
                  const proj = grp.project_id
                    ? projectMap.get(grp.project_id)
                    : null;
                  const channelColor = proj?.color || '#6366f1';
                  const isSelected = grp.id === activeGroup?.id && !showGroupForm;
                  return (
                    <div
                      key={grp.id}
                      onClick={() => {
                        setShowGroupForm(false);
                        setActiveGroupId(grp.id);
                      }}
                      style={
                        isSelected
                          ? {
                              backgroundColor: channelColor,
                              borderColor: channelColor,
                            }
                          : undefined
                      }
                      className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'text-white shadow-sm'
                          : 'bg-white dark:bg-[#121928] border-slate-200/70 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Hash
                              style={
                                !isSelected ? { color: channelColor } : undefined
                              }
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected ? 'text-white/85' : ''
                              }`}
                            />
                            <span className="text-xs font-bold truncate">
                              {grp.name}
                            </span>
                          </div>
                          {proj ? (
                            <span
                              style={
                                !isSelected
                                  ? {
                                      backgroundColor: `${channelColor}18`,
                                      color: channelColor,
                                    }
                                  : undefined
                              }
                              className={`inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                isSelected ? 'bg-white/20 text-white' : ''
                              }`}
                            >
                              <FolderKanban className="w-2.5 h-2.5" />
                              [{proj.code}] {proj.name}
                            </span>
                          ) : (
                            <span
                              className={`inline-block mt-1 text-[10px] ${
                                isSelected ? 'text-white/80' : 'text-slate-400'
                              }`}
                            >
                              {tr('跨项目综合频道', 'Cross-Project Channel')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditGroupForm(grp);
                            }}
                            className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                              isSelected
                                ? 'hover:bg-white/20 text-white'
                                : 'text-slate-400 hover:text-indigo-500'
                            }`}
                            title={tr('编辑群聊', 'Edit channel')}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGroup(grp);
                            }}
                            className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                              isSelected
                                ? 'hover:bg-white/20 text-white'
                                : 'text-slate-400 hover:text-rose-500'
                            }`}
                            title={tr('删除群聊', 'Delete channel')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Pane: Create/Edit Channel Form OR Active Chat Stream (8 cols) */}
          <div className="md:col-span-8 flex flex-col min-h-0">
            {showGroupForm ? (
              <form
                onSubmit={handleSaveGroup}
                className="flex-1 overflow-y-auto p-6 space-y-4 text-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: themeColor }}
                    />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {editingGroup
                        ? tr(
                            `编辑沟通群聊：${editingGroup.name}`,
                            `Edit Channel: ${editingGroup.name}`
                          )
                        : tr(
                            '新建自定义项目沟通群聊',
                            'Create Custom Project Group Chat'
                          )}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGroupForm(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    {tr('返回聊天', 'Back to Chat')}
                  </button>
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    {tr('群聊名称 *', 'Channel Name *')}
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={grpName}
                    onChange={(e) => setGrpName(e.target.value)}
                    placeholder={tr(
                      '例如：核心支付网关上线作战群 / 设计走查同步群',
                      'e.g., Q4 Payment Launch War Room / Design QA Sync'
                    )}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    {tr('绑定关联项目（主题色自动跟随项目）', 'Linked Project (Theme color follows project)')}
                  </label>
                  <select
                    value={grpProjectId}
                    onChange={(e) => setGrpProjectId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  >
                    <option value="">
                      {tr(
                        '🌐 跨项目综合沟通群（不绑定单一项目）',
                        '🌐 Cross-Project General Channel'
                      )}
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    {tr('群公告 / 沟通主题说明', 'Channel Topic / Notice')}
                  </label>
                  <input
                    type="text"
                    value={grpDesc}
                    onChange={(e) => setGrpDesc(e.target.value)}
                    placeholder={tr(
                      '例如：每日站会阻塞同步、联调排期与紧急死线沟通',
                      'e.g., Daily standup blockers, API integration & urgent deadlines'
                    )}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1.5">
                    {tr('选择群聊参与人员', 'Select Participating Members')}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const selected = grpMemberIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleGroupMember(m.id)}
                          style={
                            selected
                              ? {
                                  backgroundColor: themeColor,
                                  borderColor: themeColor,
                                }
                              : undefined
                          }
                          className={`px-2.5 py-1 rounded-full border text-xs transition-all ${
                            selected
                              ? 'text-white font-semibold'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {m.name} ({m.role})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowGroupForm(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                  >
                    {tr('取消', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    style={{ backgroundColor: themeColor }}
                    className="px-5 py-2 rounded-xl hover:opacity-90 text-white font-semibold transition-opacity"
                  >
                    {editingGroup
                      ? tr('保存修改', 'Save Changes')
                      : tr('立即创建群聊', 'Create Channel')}
                  </button>
                </div>
              </form>
            ) : !activeGroup ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-slate-400 space-y-3">
                <MessageSquare
                  className="w-10 h-10 opacity-40"
                  style={{ color: themeColor }}
                />
                <p>
                  {tr(
                    '请在左侧选择一个项目沟通群聊，或点击右上角「新建自定义群聊」',
                    'Select a channel on the left or click "New Channel" above'
                  )}
                </p>
              </div>
            ) : (
              <>
                {/* Active Channel Header */}
                <div
                  style={{
                    borderBottomColor: `${themeColor}30`,
                    backgroundColor: `${themeColor}08`,
                  }}
                  className="px-5 py-3 border-b flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: themeColor }}
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        # {activeGroup.name}
                      </span>
                      {activeGroup.project_id &&
                        projectMap.get(activeGroup.project_id) && (
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-semibold"
                            style={{
                              backgroundColor: `${
                                projectMap.get(activeGroup.project_id)!.color
                              }20`,
                              color: projectMap.get(activeGroup.project_id)!
                                .color,
                            }}
                          >
                            {projectMap.get(activeGroup.project_id)!.name}
                          </span>
                        )}
                    </div>
                    {activeGroup.description && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {activeGroup.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      style={{ color: themeColor }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold"
                    >
                      <Users className="w-3.5 h-3.5" />
                      {activeGroup.member_ids.length}
                    </span>
                  </div>
                </div>

                {/* Messages Stream */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-400">
                      <p>
                        {tr(
                          '群聊已就绪，发送第一条项目同步消息吧！（支持点击下方快捷按钮 @人员 或引用 #任务编号）',
                          'Channel ready! Send the first update (use quick chips below to @mention members or reference #TASK-KEY).'
                        )}
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        style={{ borderLeftColor: themeColor }}
                        className="group flex items-start gap-3 p-3 rounded-2xl border-l-2 bg-slate-50/80 dark:bg-[#131B2C] border border-slate-200/60 dark:border-slate-800/80"
                      >
                        <div
                          className={`w-8 h-8 rounded-full bg-gradient-to-br ${msg.avatar_bg} text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs`}
                        >
                          {msg.sender_name.slice(0, 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {msg.sender_name}
                              </span>
                              {msg.sender_role && (
                                <span
                                  style={{
                                    backgroundColor: `${themeColor}18`,
                                    color: themeColor,
                                  }}
                                  className="px-1.5 py-0.2 rounded text-[10px] font-medium"
                                >
                                  {msg.sender_role}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400">
                                {new Date(msg.created_at).toLocaleString(
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
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity"
                              title={tr('删除消息', 'Delete message')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="mt-1 text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                            {renderMessageContent(msg.content)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={msgEndRef} />
                </div>

                {/* Quick @Member & #Task Reference Bar */}
                <div className="px-4 py-2 border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0B0F19] flex flex-wrap items-center gap-1.5 text-[11px]">
                  {members.length > 0 && (
                    <div className="flex items-center gap-1 mr-2">
                      <AtSign
                        className="w-3 h-3"
                        style={{ color: themeColor }}
                      />
                      {members.slice(0, 5).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setInput((prev) => `${prev}@${m.name} `)
                          }
                          className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:opacity-80 text-slate-600 dark:text-slate-300"
                        >
                          @{m.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {groupTasks.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Hash className="w-3 h-3" style={{ color: themeColor }} />
                      {groupTasks.slice(0, 4).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            setInput((prev) => `${prev}#${t.task_key} `)
                          }
                          style={{
                            borderColor: `${themeColor}45`,
                            color: themeColor,
                          }}
                          className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border font-mono text-[10px] hover:opacity-80"
                          title={t.title}
                        >
                          #{t.task_key}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Message Composer */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1320] flex items-center gap-2"
                >
                  {members.length > 0 && (
                    <select
                      value={selectedSenderMemId}
                      onChange={(e) => setSelectedSenderMemId(e.target.value)}
                      className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs max-w-[140px]"
                      title={tr('选择发言人员身份', 'Select sender identity')}
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={tr(
                      `在 #${activeGroup.name} 中输入消息（支持 @姓名 或 #任务编号）...`,
                      `Message #${activeGroup.name} (@mention or #TASK-KEY)...`
                    )}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    style={{ backgroundColor: themeColor }}
                    className="px-4 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-opacity"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {tr('发送', 'Send')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};
