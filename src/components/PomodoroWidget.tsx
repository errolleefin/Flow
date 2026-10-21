import React, { useEffect, useState } from 'react';
import { Check, Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
import type { Task } from '../types';

interface PomodoroWidgetProps {
  activeTask: Task | null;
  onClose: () => void;
  onLogMinutes: (taskId: string, minutesToAdd: number) => void;
}

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({
  activeTask,
  onClose,
  onLogMinutes,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (activeTask) {
      setSecondsLeft(25 * 60);
      setRunning(true);
    }
  }, [activeTask?.id]);

  useEffect(() => {
    if (!activeTask || !running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          onLogMinutes(activeTask.id, 25);
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeTask, running, onLogMinutes]);

  if (!activeTask) return null;

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const elapsedMinutes = Math.max(1, Math.round((25 * 60 - secondsLeft) / 60));

  return (
    <div className="fixed bottom-5 right-5 z-30 w-80 rounded-2xl border border-indigo-500/30 bg-white/95 dark:bg-[#131B2E]/95 backdrop-blur-md shadow-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
          <Timer className="w-4 h-4 animate-pulse" />
          <span>专注番茄钟 · Pomodoro</span>
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
            onClick={() => setRunning(!running)}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            title={running ? '暂停' : '继续'}
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
              setSecondsLeft(25 * 60);
            }}
            className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
            title="重置 25 分钟"
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
            title="结算当前专注时长并写入任务记录"
          >
            <Check className="w-3.5 h-3.5" />
            记入 +{elapsedMinutes}m
          </button>
        </div>
      </div>
    </div>
  );
};
