import pytest

from app.inspect.checks.compliance import check_compliance


def test_compliance_valid_manifest():
    manifest = {
        "name": "my-skill",
        "version": "1.0.0",
        "type": "skill",
        "skill": {"content": "helpful content"},
    }
    result = check_compliance(manifest)
    assert result.status == "pass"
    assert result.detail["manifest_valid"] is True


def test_compliance_missing_fields():
    manifest = {"name": "my-skill"}
    result = check_compliance(manifest)
    assert result.status == "fail"
    assert "缺少必填字段: version" in result.detail["errors"]
    assert "缺少必填字段: type" in result.detail["errors"]


def test_compliance_wrong_type():
    manifest = {"name": "x", "version": "1.0.0", "type": "tool"}
    result = check_compliance(manifest)
    assert result.status == "fail"
    assert any("类型必须是 skill" in e for e in result.detail["errors"])


def test_compliance_invalid_semver():
    manifest = {"name": "x", "version": "not-semver", "type": "skill"}
    result = check_compliance(manifest)
    assert result.status == "fail"
    assert any("semver" in e for e in result.detail["errors"])


def test_compliance_content_too_large():
    manifest = {
        "name": "x",
        "version": "1.0.0",
        "type": "skill",
        "skill": {"content": "x" * 50001},
    }
    result = check_compliance(manifest)
    assert result.status == "fail"
    assert any("50KB" in e for e in result.detail["errors"])
