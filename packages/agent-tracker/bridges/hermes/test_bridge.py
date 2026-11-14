import json
import os
import subprocess
import unittest
from unittest.mock import patch
import work_address_hermes as bridge


class BridgeTest(unittest.TestCase):
    def setUp(self):
        bridge._warned = False

    @patch.dict(os.environ, {"WORK_ADDRESS_EXPERIMENTAL_ADAPTERS": "1"})
    @patch("work_address_hermes.subprocess.run")
    def test_allowlist_and_neutral_callbacks(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, stderr="")
        hooks = {}
        class Context:
            def register_hook(self, name, fn):
                hooks[name] = fn
        bridge.register(Context())
        self.assertEqual(set(hooks), {"pre_llm_call", "on_session_end", "api_request_error"})
        self.assertIsNone(hooks["pre_llm_call"](telemetry_schema_version="hermes.observer.v1", session_id="s", turn_id="t", user_message="Fix the build " * 400, conversation_history=["PRIVATE"], future_field="PRIVATE"))
        payload = json.loads(run.call_args.kwargs["input"])
        self.assertNotIn("PRIVATE", json.dumps(payload))
        # The prompt that starts the turn is the one thing beyond identity, cut to fit.
        self.assertEqual(len(payload["user_message"]), 4000)
        self.assertEqual(run.call_args.kwargs["timeout"], 5.0)
        self.assertIsNone(hooks["on_session_end"](telemetry_schema_version="hermes.observer.v1", session_id="s"))
        self.assertEqual(run.call_count, 1)
        # Only a request error that will not be retried ends the turn.
        self.assertIsNone(hooks["api_request_error"](telemetry_schema_version="hermes.observer.v1", session_id="s", turn_id="t", retryable=True, error={"message": "PRIVATE"}))
        self.assertEqual(run.call_count, 1)
        hooks["api_request_error"](telemetry_schema_version="hermes.observer.v1", session_id="s", turn_id="t", retryable=False, status_code=400, error={"message": "PRIVATE"})
        payload = json.loads(run.call_args.kwargs["input"])
        self.assertEqual(payload["hook_event_name"], "api_request_error")
        self.assertIs(payload["retryable"], False)
        self.assertNotIn("PRIVATE", json.dumps(payload))

    @patch.dict(os.environ, {"WORK_ADDRESS_EXPERIMENTAL_ADAPTERS": "1", "WORK_ADDRESS_PROMPTS": "off"})
    @patch("work_address_hermes.subprocess.run")
    def test_prompts_stay_local_when_turned_off(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, stderr="")
        bridge._observe("pre_llm_call", telemetry_schema_version="hermes.observer.v1", session_id="s", turn_id="t", user_message="PRIVATE")
        self.assertNotIn("PRIVATE", run.call_args.kwargs["input"])

    @patch.dict(os.environ, {"WORK_ADDRESS_EXPERIMENTAL_ADAPTERS": "1"})
    @patch("work_address_hermes.subprocess.run")
    def test_a_turn_open_at_exit_was_interrupted(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, stderr="")
        bridge._open.clear()
        v1 = "hermes.observer.v1"
        bridge._observe("pre_llm_call", telemetry_schema_version=v1, session_id="s", turn_id="open")
        bridge._observe("pre_llm_call", telemetry_schema_version=v1, session_id="s", turn_id="done")
        bridge._observe("on_session_end", telemetry_schema_version=v1, session_id="s", turn_id="done", completed=True)
        bridge._interrupted_at_exit()
        payload = json.loads(run.call_args.kwargs["input"])
        self.assertEqual((payload["turn_id"], payload["interrupted"], payload["completed"]), ("open", True, False))
        self.assertEqual(run.call_count, 4)
        self.assertEqual(bridge._open, {})

    def test_timeout_override_falls_back_when_unusable(self):
        cases = {"2.5": 2.5, "60": 60.0, "0": 5.0, "-1": 5.0, "61": 5.0, "nan": 5.0, "soon": 5.0, "": 5.0}
        for raw, expected in cases.items():
            with patch.dict(os.environ, {"WORK_ADDRESS_BRIDGE_TIMEOUT": raw}):
                self.assertEqual(bridge._timeout(), expected, raw)

    @patch.dict(os.environ, {"WORK_ADDRESS_EXPERIMENTAL_ADAPTERS": "1"})
    @patch("work_address_hermes.subprocess.run", side_effect=TimeoutError("PRIVATE"))
    @patch("sys.stderr")
    def test_fail_open_without_vendor_errors(self, stderr, run):
        for _ in range(2):
            self.assertIsNone(bridge._observe("pre_llm_call", telemetry_schema_version="hermes.observer.v1", session_id="s", turn_id="t"))
        self.assertNotIn("PRIVATE", str(stderr.write.call_args_list))
        self.assertEqual(str(stderr.write.call_args_list).count("delivery unavailable"), 1)


if __name__ == "__main__":
    unittest.main()
