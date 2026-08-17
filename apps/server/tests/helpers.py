"""测试辅助函数"""

import io
import json
import tarfile


def create_test_tarball(
    name: str = "test-skill",
    version: str = "1.0.0",
    pkg_type: str = "skill",
    content: bytes = b"test content",
) -> io.BytesIO:
    """创建测试 tarball

    Args:
        name: 包名
        version: 版本号
        pkg_type: 包类型 (skill)
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
                "skill": {
                    "content": "## 测试 Skill\n\n这是一个用于测试的 Skill 内容。",
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
