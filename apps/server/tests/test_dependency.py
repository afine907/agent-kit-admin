"""#15 依赖解析和循环检测测试

测试场景：
- 空依赖列表返回空结果
- 线性依赖链正确排序
- 钻石依赖正确排序
- 检测自循环依赖
- 检测两节点循环
- 检测三节点循环
- 未知依赖跳过（不报错）
- get_all_dependencies 正确返回所有依赖
"""

from app.services.dependency import DependencyResolver


class TestDependencyResolver:
    """依赖解析器测试"""

    def test_empty_dependencies(self):
        """空依赖列表应返回空结果"""
        resolver = DependencyResolver({})
        result = resolver.resolve()
        assert result == []

    def test_simple_chain(self):
        """A->B->C 应返回 [C, B, A]"""
        resolver = DependencyResolver(
            {
                "A": ["B"],
                "B": ["C"],
                "C": [],
            }
        )
        result = resolver.resolve()
        assert result == ["C", "B", "A"]

    def test_diamond_dependency(self):
        """钻石依赖: A->B,C; B->D; C->D 应正确排序"""
        resolver = DependencyResolver(
            {
                "A": ["B", "C"],
                "B": ["D"],
                "C": ["D"],
                "D": [],
            }
        )
        result = resolver.resolve()
        assert result.index("D") < result.index("B")
        assert result.index("D") < result.index("C")
        assert result.index("B") < result.index("A")
        assert result.index("C") < result.index("A")

    def test_self_cycle(self):
        """自循环 A->A 应被检测到"""
        resolver = DependencyResolver(
            {
                "A": ["A"],
            }
        )
        assert resolver.has_cycle() is True

    def test_two_node_cycle(self):
        """两节点循环 A->B->A 应被检测到"""
        resolver = DependencyResolver(
            {
                "A": ["B"],
                "B": ["A"],
            }
        )
        assert resolver.has_cycle() is True

    def test_three_node_cycle(self):
        """三节点循环 A->B->C->A 应被检测到"""
        resolver = DependencyResolver(
            {
                "A": ["B"],
                "B": ["C"],
                "C": ["A"],
            }
        )
        assert resolver.has_cycle() is True

    def test_cycle_path(self):
        """循环路径应正确返回"""
        resolver = DependencyResolver(
            {
                "A": ["B"],
                "B": ["C"],
                "C": ["A"],
            }
        )
        cycle = resolver.find_cycle()
        assert cycle is not None
        # 循环路径应以同一节点开始和结束
        assert cycle[0] == cycle[-1]

    def test_unknown_dependency_skipped(self):
        """未知依赖（不在包列表中）应被跳过"""
        resolver = DependencyResolver(
            {
                "A": ["unknown-pkg"],
                "B": [],
            }
        )
        result = resolver.resolve()
        assert "A" in result
        assert "B" in result

    def test_get_all_dependencies(self):
        """应正确返回包的所有依赖"""
        resolver = DependencyResolver(
            {
                "A": ["B", "C"],
                "B": ["D"],
                "C": [],
                "D": [],
            }
        )
        deps = resolver.get_all_dependencies("A")
        assert "B" in deps
        assert "C" in deps
        assert "D" in deps
        assert "A" not in deps  # 不包含自身

    def test_get_all_dependencies_empty(self):
        """无依赖的包应返回空列表"""
        resolver = DependencyResolver(
            {
                "A": [],
            }
        )
        deps = resolver.get_all_dependencies("A")
        assert deps == []

    def test_get_all_dependencies_unknown(self):
        """未知包应返回空列表"""
        resolver = DependencyResolver({"A": ["B"]})
        deps = resolver.get_all_dependencies("unknown")
        assert deps == []

    def test_no_cycle_in_complex_graph(self):
        """复杂无环图应正确识别"""
        resolver = DependencyResolver(
            {
                "A": ["B", "C"],
                "B": ["D"],
                "C": ["D"],
                "D": [],
                "E": ["A"],
            }
        )
        assert resolver.has_cycle() is False
        result = resolver.resolve()
        assert len(result) == 5
