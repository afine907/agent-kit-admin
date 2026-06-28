/**
 * Agent 适配器注册中心
 */

import { AgentAdapter } from './types.js';
import { ClaudeAdapter } from './claude.js';
import { CodexAdapter } from './codex.js';
import { CursorAdapter } from './cursor.js';
import { WindsurfAdapter } from './windsurf.js';
import { ClineAdapter } from './cline.js';
import { AiderAdapter } from './aider.js';

export class AgentRegistry {
  private adapters: Map<string, AgentAdapter> = new Map();

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.name.toLowerCase(), adapter);
  }

  get(name: string): AgentAdapter | undefined {
    return this.adapters.get(name.toLowerCase());
  }

  getAll(): AgentAdapter[] {
    return Array.from(this.adapters.values());
  }

  async detectAll(): Promise<AgentAdapter[]> {
    const detected: AgentAdapter[] = [];
    for (const adapter of this.adapters.values()) {
      if (await adapter.detect()) {
        detected.push(adapter);
      }
    }
    return detected;
  }
}

// 单例导出
export const agentRegistry = new AgentRegistry();
agentRegistry.register(new ClaudeAdapter());
agentRegistry.register(new CodexAdapter());
agentRegistry.register(new CursorAdapter());
agentRegistry.register(new WindsurfAdapter());
agentRegistry.register(new ClineAdapter());
agentRegistry.register(new AiderAdapter());
