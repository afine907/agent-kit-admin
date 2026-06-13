/**
 * InstallCommand 组 - 终端风格安装命令
 */

import { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

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
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = command;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/50 border border-border/50 font-mono group">
      <Terminal className="w-4 h-4 text-primary/60 shrink-0" />
      <code className="flex-1 text-sm text-foreground/80 select-all">
        <span className="text-primary">$</span>{' '}
        {command}
      </code>
      <button
        onClick={handleCopy}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
          copied
            ? 'bg-primary/20 text-primary border border-primary/30'
            : 'bg-border/50 text-muted-foreground hover:text-foreground hover:bg-border border border-transparent'
        }`}
      >
        {copied ? (
          <>
            <Check className="w-3 h-3" />
            已复制
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" />
            复制
          </>
        )}
      </button>
    </div>
  );
}
