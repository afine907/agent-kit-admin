# apps/server/tests/inspect/test_inspector.py
from app.inspect.inspector import overall_status
from app.inspect.checks.types import CheckResult


def test_overall_healthy():
    results = [
        CheckResult.pass_(),
        CheckResult.pass_(),
        CheckResult.pass_(),
        CheckResult.pass_(),
    ]
    assert overall_status(results) == "healthy"


def test_overall_degraded_on_fail():
    results = [
        CheckResult.pass_(),
        CheckResult.fail({"error": "bad"}),
        CheckResult.pass_(),
        CheckResult.pass_(),
    ]
    assert overall_status(results) == "degraded"


def test_overall_degraded_on_warn():
    results = [
        CheckResult.pass_(),
        CheckResult.pass_(),
        CheckResult.pass_(),
        CheckResult.warn({"message": "stale"}),
    ]
    assert overall_status(results) == "degraded"


def test_overall_error_priority():
    """error 优先级最高"""
    results = [
        CheckResult.pass_(),
        CheckResult.error({"error": "timeout"}),
        CheckResult.pass_(),
        CheckResult.pass_(),
    ]
    assert overall_status(results) == "error"


def test_overall_error_overrides_fail():
    results = [
        CheckResult.fail({}),
        CheckResult.error({}),
        CheckResult.pass_(),
        CheckResult.pass_(),
    ]
    assert overall_status(results) == "error"
