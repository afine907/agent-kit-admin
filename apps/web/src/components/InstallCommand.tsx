/**
 * InstallCommand 组件 - 安装命令复制
 */

import { useState } from 'react';

interface InstallCommandProps {
  scope: string;
  name: string;
}

export function InstallCommand({ scope, name }: InstallCommandProps) {
  const [copied, setCopied] = useState(false);
  const command = `akit install ${scope}/${name}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = command;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-secondary rounded-md">
      <code className="flex-1 text-sm font-mono">{command}</code>
      <button
        onClick={handleCopy}
        className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  );
}
