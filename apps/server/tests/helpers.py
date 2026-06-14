"""测试辅助函数"""

import io
import json
import tarfile


def create_test_tarball(
    name: str = "test-mcp",
    version: str = "1.0.0",
    pkg_type: str = "mcp",
    content: bytes = b"test content",
) -> io.BytesIO:
    """创建测试 tarball

    Args:
        name: 包名
        version: 版本号
        pkg_type: 包类型 (mcp/skill)
        content: index.js 文件内容

    Returns:
        BytesIO 对象，包含 tarball 数据
    """
    tarball = io.BytesIO()
    with tarfile.open(fileobj=tarball, mode="w:gz") as tar:
        # 添加 akit.json
        manifest = json.dumps(
            {
                "name": name,
                "version": version,
                "type": pkg_type,
                "mcp": {
                    "transport": "stdio",
                    "command": "node",
                    "args": ["index.js"],
                },
            }
        ).encode()
        info = tarfile.TarInfo(name="akit.json")
        info.size = len(manifest)
        tar.addfile(info, io.BytesIO(manifest))

        # 添加 index.js
        info = tarfile.TarInfo(name="index.js")
        info.size = len(content)
        tar.addfile(info, io.BytesIO(content))

    tarball.seek(0)
    return tarball
