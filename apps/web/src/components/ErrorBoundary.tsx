/**
 * ErrorBoundary - 全局错误边界
 *
 * 捕获子组件渲染错误，展示安全的错误提示。
 * 详细错误信息仅输出到 console，不暴露给终端用户。
 */

import React from 'react';
import { AlertCircle, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 详细错误仅输出到 console，不暴露给用户
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  /** 返回首页，避免重试后因相同根因再次崩溃 */
  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2">页面出错了</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md text-center">
            页面加载时发生错误，请刷新页面或返回首页重试。
          </p>
          <button
            onClick={this.handleGoHome}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <Home className="w-4 h-4" />
            返回首页
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
