"""Observer only: never return directives, serialize kwargs or log vendor content.

Identity, outcome flags and the prompt that starts a turn cross to the collector;
nothing else does.
"""
import atexit
import json
import os
import subprocess
import sys

_FIELDS = ("session_id", "turn_id", "parent_session_id", "telemetry_schema_version",
           "completed", "failed", "interrupted", "retryable")
# The prompt that starts a turn, cut to what the collector keeps; never sent
# when WORK_ADDRESS_PROMPTS=off.
_PROMPT_CHARS = 4000
_DEFAULT_TIMEOUT = 5.0
# Turns started in this process and not yet ended, by (session_id, turn_id).
_open = {}
# True once Hermes Agent passed its live check (servers.status "available" in
# @work-address/agent-tracking-contract); until then the bridge needs the opt-in.
_QUALIFIED = False
_warned = False


def _timeout():
    """Seconds one collector call may take; a busy host starts Node slowly."""
    try:
        value = float(os.environ.get("WORK_ADDRESS_BRIDGE_TIMEOUT", ""))
    except ValueError:
        return _DEFAULT_TIMEOUT
    return value if 0 < value <= 60 else _DEFAULT_TIMEOUT


def _observe(name, **kwargs):
    global _warned
    try:
        if not _QUALIFIED and os.environ.get("WORK_ADDRESS_EXPERIMENTAL_ADAPTERS") != "1":
            return None
        if kwargs.get("telemetry_schema_version") != "hermes.observer.v1":
            raise ValueError("unsupported schema")
        if not kwargs.get("turn_id"):
            return None  # CLI shutdown callbacks are not turns.
        payload = {key: kwargs[key] for key in _FIELDS if key in kwargs}
        payload["hook_event_name"] = name
        prompt = kwargs.get("user_message")
        if (name == "pre_llm_call" and isinstance(prompt, str) and prompt.strip()
                and os.environ.get("WORK_ADDRESS_PROMPTS") != "off"):
            payload["user_message"] = prompt[:_PROMPT_CHARS]
        for value in payload.values():
            if not isinstance(value, (str, bool, type(None))) or (isinstance(value, str) and len(value) > 4096):
                raise ValueError("invalid metadata")
        result = subprocess.run(
            [os.environ.get("WORK_ADDRESS_COLLECTOR_BIN", "agent-tracker"), "hook", "hermes"],
            input=json.dumps(payload), text=True, stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE, timeout=_timeout(), check=False,
            env={**os.environ, "NODE_NO_WARNINGS": "1"},
        )
        key = (payload.get("session_id"), payload.get("turn_id"))
        if name == "pre_llm_call" and not payload.get("parent_session_id"):
            _open[key] = payload.get("telemetry_schema_version")
        else:
            _open.pop(key, None)
        if result.returncode or result.stderr:
            # Do not forward stderr: even a replaced executable might print private data.
            raise RuntimeError("delivery failed")
    except Exception:
        if not _warned:
            print("Work Address: observer delivery unavailable; timing may be incomplete.", file=sys.stderr)
            _warned = True
    return None


@atexit.register
def _interrupted_at_exit():
    """Ctrl+C on a one-shot `hermes -z` exits inside the turn without
    on_session_end: a turn still open when Hermes exits was interrupted."""
    for (session_id, turn_id), schema in list(_open.items()):
        _observe("on_session_end", telemetry_schema_version=schema, session_id=session_id,
                 turn_id=turn_id, completed=False, failed=False, interrupted=True)


def register(ctx):
    def started(**kwargs):
        return _observe("pre_llm_call", **kwargs)

    def ended(**kwargs):
        return _observe("on_session_end", **kwargs)

    def failed(**kwargs):
        # A one-shot `hermes -z` that hits a model error exits without
        # on_session_end: a non-retryable request error is the turn's end.
        if kwargs.get("retryable") is False:
            return _observe("api_request_error", **kwargs)
        return None

    ctx.register_hook("pre_llm_call", started)
    ctx.register_hook("on_session_end", ended)
    ctx.register_hook("api_request_error", failed)
