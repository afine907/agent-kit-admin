/**
 * Dependency resolver with cycle detection and topological sort
 */

import { apiClient } from '../api/client.js';

export interface DepNode {
  scope: string;
  name: string;
  version: string;
  dependencies: DepNode[];
}

export interface ResolvedDeps {
  nodes: DepNode[];
  cycles: string[][];
}

const MAX_DEPTH = 10;

interface DepGraphNode {
  scope: string;
  name: string;
  version: string;
  deps: Record<string, string>; // package -> version constraint
}

interface DepGraphResponse {
  dependencies: Record<string, DepGraphNode>;
  cycles: string[][];
}

/**
 * Resolve full dependency tree with cycle detection
 */
export async function resolveDependencies(
  scope: string,
  name: string,
  visited: Set<string> = new Set(),
  stack: string[] = [],
  depth: number = 0
): Promise<{ node: DepNode; cycles: string[][] }> {
  const key = `${scope}/${name}`;

  if (depth >= MAX_DEPTH) {
    return {
      node: { scope, name, version: 'unknown', dependencies: [] },
      cycles: [],
    };
  }

  if (visited.has(key)) {
    const cycleStartIdx = stack.indexOf(key);
    if (cycleStartIdx !== -1) {
      const cycle = stack.slice(cycleStartIdx).concat(key);
      return {
        node: { scope, name, version: 'cyclic', dependencies: [] },
        cycles: [cycle],
      };
    }
    return {
      node: { scope, name, version: 'visited', dependencies: [] },
      cycles: [],
    };
  }

  visited.add(key);
  stack.push(key);

  let graphResponse: DepGraphResponse;
  try {
    const result = await apiClient.getDependencyGraph(scope, name);
    graphResponse = result as unknown as DepGraphResponse;
  } catch {
    return {
      node: { scope, name, version: 'unavailable', dependencies: [] },
      cycles: [],
    };
  }

  const pkgData = graphResponse.dependencies[key];
  const version = pkgData?.version || 'unknown';
  const depEntries = pkgData?.deps || {};

  const childCycles: string[][] = [];
  const children: DepNode[] = [];

  for (const [depKey] of Object.entries(depEntries)) {
    const [depScope, depName] = depKey.split('/');
    const { node, cycles } = await resolveDependencies(
      depScope || scope,
      depName,
      new Set(visited),
      [...stack],
      depth + 1
    );
    childCycles.push(...cycles);
    children.push(node);
  }

  return {
    node: { scope, name, version, dependencies: children },
    cycles: childCycles,
  };
}

/**
 * Print dependency tree in terminal
 */
export function printDepTree(node: DepNode, cycles: string[][], prefix = '', isLast = true): void {
  const connector = isLast ? '└── ' : '├── ';
  const cycleMark = cycles.some((c) => c.includes(`${node.scope}/${node.name}`)) ? ' [CYCLE]' : '';
  console.log(`${prefix}${connector}${node.scope}/${node.name}@${node.version}${cycleMark}`);

  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  node.dependencies.forEach((dep, i) => {
    printDepTree(dep, cycles, childPrefix, i === node.dependencies.length - 1);
  });
}

/**
 * Flatten tree to list (topological order - leaves first)
 */
export function flattenDeps(node: DepNode, result: DepNode[] = []): DepNode[] {
  for (const dep of node.dependencies) {
    flattenDeps(dep, result);
  }
  if (!result.find((n) => n.scope === node.scope && n.name === node.name)) {
    result.push(node);
  }
  return result;
}

/**
 * Get all unique packages from tree (deduped)
 */
export function getAllPackages(node: DepNode): Array<{ scope: string; name: string; version: string }> {
  const seen = new Set<string>();
  const packages: Array<{ scope: string; name: string; version: string }> = [];

  function collect(n: DepNode): void {
    const key = `${n.scope}/${n.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      packages.push({ scope: n.scope, name: n.name, version: n.version });
    }
    n.dependencies.forEach(collect);
  }

  collect(node);
  return packages;
}
