import React, { useEffect, useRef, useState } from 'react';
import { Check, Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
import type { Task } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface PomodoroWidgetProps {
  activeTask: Task | null;
  onClose: () => void;
  onLogMinutes: (taskId: string, minutesToAdd: number) => void;
}

const FOCUS_SECONDS = 25 * 60;

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({
  activeTask,
  onClose,
  onLogMinutes,
}) => {
  const { tr } = useI18n();
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(true);
  // Count down against a wall-clock deadline: parent re-renders and
  // background-tab timer throttling must not slow the timer.
  const endAtRef = useRef(Date.now() + FOCUS_SECONDS * 1000);
  const onLogMinutesRef = useRef(onLogMinutes);
  onLogMinutesRef.current = onLogMinutes;
  const taskId = activeTask?.id;

  useEffect(() => {
    if (taskId) {
      endAtRef.current = Date.now() + FOCUS_SECONDS * 1000;
      setSecondsLeft(FOCUS_SECONDS);
      setRunning(true);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId || !running) return;
    const id = window.setInterval(() => {
      const remaining = Math.ceil((endAtRef.current - Date.now()) / 1000);
      if (remaining > 0) {
        setSecondsLeft(remaining);
        return;
      }
      window.clearInterval(id);
      setRunning(false);
      setSecondsLeft(FOCUS_SECONDS);
      onLogMinutesRef.current(taskId, 25);
    }, 250);
    return () => window.clearInterval(id);
  }, [taskId, running]);

  if (!activeTask) return null;

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const elapsedMinutes = Math.max(
    1,
    Math.round((FOCUS_SECONDS - secondsLeft) / 60)
  );

  return (
    <div className="fixed bottom-5 right-5 z-30 w-80 rounded-2xl border border-indigo-500/30 bg-white/95 dark:bg-[#131B2E]/95 backdrop-blur-md shadow-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
          <Timer className="w-4 h-4 animate-pulse" />
          <span>{tr('专注番茄钟 · Pomodoro', 'Pomodoro Focus Timer')}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="text-xs">
        <span className="font-mono text-[11px] text-slate-400 mr-1.5">
          [{activeTask.task_key}]
        </span>
        <span className="font-medium text-slate-800 dark:text-slate-100 line-clamp-1">
          {activeTask.title}
        </span>
      </div>

      <div className="flex items-center justify-between bg-slate-100/80 dark:bg-slate-900/90 rounded-xl px-4 py-2.5">
        <span className="font-mono text-2xl font-bold tracking-wider text-slate-900 dark:text-white">
          {mins}:{secs}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (!running) {
                endAtRef.current = Date.now() + secondsLeft * 1000;
              }
              setRunning(!running);
            }}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            title={running ? tr('暂停', 'Pause') : tr('继续', 'Resume')}
          >
            {running ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setSecondsLeft(FOCUS_SECONDS);
            }}
            className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
            title={tr('重置 25 分钟', 'Reset 25 minutes')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              onLogMinutes(activeTask.id, elapsedMinutes);
              onClose();
            }}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold inline-flex items-center gap-1"
            title={tr(
              '结算当前专注时长并写入任务记录',
              'Log elapsed focus time to task'
            )}
          >
            <Check className="w-3.5 h-3.5" />
            {tr(`记入 +${elapsedMinutes}m`, `Log +${elapsedMinutes}m`)}
          </button>
        </div>
      </div>
    </div>
  );
};
