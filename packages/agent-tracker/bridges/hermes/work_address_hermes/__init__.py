"""Observer only: never return directives, serialize kwargs or log vendor content."""
import json
import os
import subprocess
import sys

_FIELDS = ("session_id", "turn_id", "parent_session_id", "telemetry_schema_version",
           "completed", "failed", "interrupted")
_warned = False


def _observe(name, **kwargs):
    global _warned
    try:
        if os.environ.get("WORK_ADDRESS_EXPERIMENTAL_ADAPTERS") != "1":
            return None
        if kwargs.get("telemetry_schema_version") != "hermes.observer.v1":
            raise ValueError("unsupported schema")
        if not kwargs.get("turn_id"):
            return None  # CLI shutdown callbacks are not turns.
        payload = {key: kwargs[key] for key in _FIELDS if key in kwargs}
        payload["hook_event_name"] = name
        for value in payload.values():
            if not isinstance(value, (str, bool, type(None))) or (isinstance(value, str) and len(value) > 4096):
                raise ValueError("invalid metadata")
        result = subprocess.run(
            [os.environ.get("WORK_ADDRESS_COLLECTOR_BIN", "agent-tracker"), "hook", "hermes"],
            input=json.dumps(payload), text=True, stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE, timeout=1, check=False,
            env={**os.environ, "NODE_NO_WARNINGS": "1"},
        )
        if result.returncode or result.stderr:
            # Do not forward stderr: even a replaced executable might print private data.
            raise RuntimeError("delivery failed")
    except Exception:
        if not _warned:
            print("Work Address: observer delivery unavailable; timing may be incomplete.", file=sys.stderr)
            _warned = True
    return None


def register(ctx):
    def started(**kwargs):
        return _observe("pre_llm_call", **kwargs)

    def ended(**kwargs):
        return _observe("on_session_end", **kwargs)

    ctx.register_hook("pre_llm_call", started)
    ctx.register_hook("on_session_end", ended)
