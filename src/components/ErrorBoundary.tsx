import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Flow Workspace Uncaught Error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage =
        this.state.error?.message || '未知渲染异常 (Unknown rendering error)';

      return (
        <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 p-6 select-none">
          <div className="max-w-md w-full p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                工作台遇到异常
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                应用程序渲染过程中捕获到了未预期的错误，已自动阻止崩溃蔓延。
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-left">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                错误详情 (Error Details)
              </div>
              <p className="text-xs font-mono text-rose-600 dark:text-rose-400 break-all leading-relaxed max-h-36 overflow-y-auto">
                {errorMessage}
              </p>
            </div>

            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-bold shadow-lg shadow-blue-500/20 inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              重新加载工作台 (Reload Workspace)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
