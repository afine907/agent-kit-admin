"""依赖解析和循环检测服务

使用拓扑排序解析包依赖关系，检测循环依赖。
"""

import logging
from collections import deque
import semver

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
        """检测是否存在循环依赖"""
        visited: set[str] = set()
        rec_stack: set[str] = set()

        def dfs(node: str) -> bool:
            visited.add(node)
            rec_stack.add(node)
            for dep in self.dependencies.get(node, []):
                if dep not in self.dependencies:
                    continue
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
        """查找循环路径"""
        visited: set[str] = set()
        path: list[str] = []

        def dfs(node: str) -> list[str] | None:
            visited.add(node)
            path.append(node)
            for dep in self.dependencies.get(node, []):
                if dep not in self.dependencies:
                    continue
                if dep in path:
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
        """获取包的所有依赖（递归）"""
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
            if dep in self.dependencies:
                for sub_dep in self.dependencies[dep]:
                    if sub_dep not in visited:
                        queue.append(sub_dep)

        return result

    @staticmethod
    def check_constraint(version: str, constraint: str) -> bool:
        """检查版本是否满足约束"""
        try:
            v = semver.Version.parse(version)
        except ValueError:
            return False

        if not constraint.startswith(("^", "~", ">", "<", "=", "!")):
            if "x" in constraint or "*" in constraint:
                parts = constraint.replace("x", "0").replace("*", "0").split(".")
                while len(parts) < 3:
                    parts.append("0")
                base = ".".join(parts)
                next_parts = list(parts)
                for i in range(len(next_parts) - 1, -1, -1):
                    if next_parts[i] == "0":
                        continue
                    next_val = int(next_parts[i]) + 1
                    next_parts[i] = str(next_val)
                    for j in range(i + 1, len(next_parts)):
                        next_parts[j] = "0"
                    break
                upper = ".".join(next_parts)
                try:
                    return v >= semver.Version.parse(base) and v < semver.Version.parse(upper)
                except ValueError:
                    return False
            try:
                return v == semver.Version.parse(constraint)
            except ValueError:
                return False

        if constraint.startswith("^"):
            base_str = constraint[1:]
            try:
                base = semver.Version.parse(base_str)
            except ValueError:
                return False
            if base.major != 0:
                upper = base.bump_major()
            elif base.minor != 0:
                upper = base.bump_minor()
            else:
                upper = base.bump_patch()
            return v >= base and v < upper

        if constraint.startswith("~"):
            base_str = constraint[1:]
            try:
                base = semver.Version.parse(base_str)
            except ValueError:
                return False
            upper = base.bump_minor()
            return v >= base and v < upper

        try:
            return semver.Version.match(v, constraint)
        except ValueError:
            return False


class DependencyGraphResolver:
    """递归依赖图解析器（带循环检测和深度限制）

    用于 GET /packages/{scope}/{name}/dependencies

    依赖图格式: {pkg: {"version": "1.0.0", "deps": {...}}}
    """

    MAX_DEPTH = 10

    def __init__(self, graph: dict[str, dict]):
        """graph: {pkg_name: {"version": "1.0.0", "deps": {...}}}"""
        self.graph = graph
        self._cycles: list[list[str]] = []

    def has_cycle(self) -> bool:
        visited: set[str] = set()
        rec_stack: set[str] = set()

        def dfs(node: str, depth: int) -> bool:
            if depth > self.MAX_DEPTH:
                return False
            visited.add(node)
            rec_stack.add(node)
            deps = self.graph.get(node, {}).get("deps", {})
            for dep in deps:
                if dep not in visited:
                    if dfs(dep, depth + 1):
                        return True
                elif dep in rec_stack:
                    return True
            rec_stack.discard(node)
            return False

        for node in self.graph:
            if node not in visited:
                if dfs(node, 0):
                    return True
        return False

    def find_cycle(self) -> list[str] | None:
        visited: set[str] = set()
        path: list[str] = []

        def dfs(node: str, depth: int) -> list[str] | None:
            if depth > self.MAX_DEPTH:
                return None
            visited.add(node)
            path.append(node)
            deps = self.graph.get(node, {}).get("deps", {})
            for dep in deps:
                if dep in path:
                    idx = path.index(dep)
                    return path[idx:] + [dep]
                if dep not in visited:
                    result = dfs(dep, depth + 1)
                    if result:
                        return result
            path.pop()
            return None

        for node in self.graph:
            if node not in visited:
                cycle = dfs(node, 0)
                if cycle:
                    return cycle
        return None

    def resolve(self) -> dict:
        """递归解析依赖图，返回完整依赖树

        Returns:
            {
                "dependencies": {pkg: {"version": "x.x.x", "deps": {...}}},
                "cycles": [["a","b","a"], ...]
            }
        """
        visited: set[str] = set()
        cycles: list[list[str]] = []
        result: dict[str, dict] = {}

        def dfs(node: str, depth: int) -> None:
            if depth > self.MAX_DEPTH:
                return
            if node in visited:
                return
            visited.add(node)

            node_data = self.graph.get(node, {})
            direct_deps = node_data.get("deps", {})
            resolved_deps: dict[str, dict] = {}

            for dep_name, dep_info in direct_deps.items():
                if isinstance(dep_info, dict):
                    dep_version = dep_info.get("version")
                    sub_deps = dep_info.get("deps", {})
                else:
                    dep_version = dep_info
                    sub_deps = {}

                resolved_sub: dict[str, dict] = {}
                for sub_name, sub_info in sub_deps.items():
                    if isinstance(sub_info, dict):
                        resolved_sub[sub_name] = {
                            "version": sub_info.get("version"),
                            "deps": sub_info.get("deps", {}),
                        }
                    else:
                        resolved_sub[sub_name] = {"version": sub_info, "deps": {}}

                resolved_deps[dep_name] = {"version": dep_version, "deps": resolved_sub}

            result[node] = {"version": node_data.get("version"), "deps": resolved_deps}

        def detect_cycle(node: str, depth: int, path: list[str]) -> list[str] | None:
            if depth > self.MAX_DEPTH:
                return None
            if node in path:
                idx = path.index(node)
                return path[idx:] + [node]
            path.append(node)
            for dep in self.graph.get(node, {}).get("deps", {}):
                if dep not in self.graph:
                    continue
                c = detect_cycle(dep, depth + 1, path[:])
                if c:
                    return c
            return None

        visited_cycle: set[str] = set()
        for node in self.graph:
            if node not in visited_cycle:
                c = detect_cycle(node, 0, [])
                if c:
                    cycles.append(c)
                    for n in c[:-1]:
                        visited_cycle.add(n)

        for node in self.graph:
            dfs(node, 0)

        return {"dependencies": result, "cycles": cycles}
