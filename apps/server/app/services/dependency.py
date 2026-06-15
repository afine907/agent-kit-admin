"""依赖解析和循环检测服务

使用拓扑排序解析包依赖关系，检测循环依赖。
"""

import logging
from collections import deque

logger = logging.getLogger(__name__)


class DependencyResolver:
    """依赖解析器

    使用 Kahn 算法（拓扑排序）解析依赖顺序，
    使用 DFS 检测循环依赖。

    Args:
        dependencies: 依赖图，格式为 {包名: [依赖包名列表]}
    """

    def __init__(self, dependencies: dict[str, list[str]]):
        self.dependencies = dependencies

    def resolve(self) -> list[str]:
        """解析依赖顺序（拓扑排序）

        使用 Kahn 算法，返回拓扑排序后的包列表。
        依赖在前，依赖者在后。

        Returns:
            排序后的包名列表。如果存在循环，抛出 ValueError。

        Raises:
            ValueError: 存在循环依赖时
        """
        if not self.dependencies:
            return []

        # 构建入度表和邻接表
        all_nodes = set(self.dependencies.keys())
        for deps in self.dependencies.values():
            all_nodes.update(deps)

        in_degree: dict[str, int] = {node: 0 for node in all_nodes}
        graph: dict[str, list[str]] = {node: [] for node in all_nodes}

        for node, deps in self.dependencies.items():
            for dep in deps:
                if dep in graph:  # 忽略未知依赖
                    graph[dep].append(node)
                    in_degree[node] += 1

        # Kahn 算法
        queue = deque(node for node in all_nodes if in_degree[node] == 0)
        result: list[str] = []

        while queue:
            node = queue.popleft()
            result.append(node)
            for neighbor in graph[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        # 检查是否有循环
        if len(result) != len(all_nodes):
            cycle = self.find_cycle()
            raise ValueError(f"Circular dependency detected: {' -> '.join(cycle)}")

        return result

    def has_cycle(self) -> bool:
        """检测是否存在循环依赖

        Returns:
            True 如果存在循环依赖
        """
        visited: set[str] = set()
        rec_stack: set[str] = set()

        def dfs(node: str) -> bool:
            visited.add(node)
            rec_stack.add(node)
            for dep in self.dependencies.get(node, []):
                if dep not in self.dependencies:
                    continue  # 跳过未知依赖
                if dep not in visited:
                    if dfs(dep):
                        return True
                elif dep in rec_stack:
                    return True
            rec_stack.discard(node)
            return False

        for node in self.dependencies:
            if node not in visited:
                if dfs(node):
                    return True
        return False

    def find_cycle(self) -> list[str] | None:
        """查找循环路径

        Returns:
            循环路径列表，如 ['A', 'B', 'C', 'A']。
            如果不存在循环，返回 None。
        """
        visited: set[str] = set()
        path: list[str] = []

        def dfs(node: str) -> list[str] | None:
            visited.add(node)
            path.append(node)
            for dep in self.dependencies.get(node, []):
                if dep not in self.dependencies:
                    continue
                if dep in path:
                    # 找到循环
                    idx = path.index(dep)
                    return path[idx:] + [dep]
                if dep not in visited:
                    result = dfs(dep)
                    if result:
                        return result
            path.pop()
            return None

        for node in self.dependencies:
            if node not in visited:
                cycle = dfs(node)
                if cycle:
                    return cycle
        return None

    def get_all_dependencies(self, package: str) -> list[str]:
        """获取包的所有依赖（递归）

        Args:
            package: 包名

        Returns:
            所有依赖包名列表（不包含自身）
        """
        if package not in self.dependencies:
            return []

        result: list[str] = []
        visited: set[str] = set()
        queue = deque(self.dependencies[package])

        while queue:
            dep = queue.popleft()
            if dep in visited:
                continue
            visited.add(dep)
            result.append(dep)
            # 递归获取依赖的依赖
            if dep in self.dependencies:
                for sub_dep in self.dependencies[dep]:
                    if sub_dep not in visited:
                        queue.append(sub_dep)

        return result
