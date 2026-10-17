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
        self.assertEqual(set(hooks), {"pre_llm_call", "on_session_end"})
        self.assertIsNone(hooks["pre_llm_call"](telemetry_schema_version="hermes.observer.v1", session_id="s", turn_id="t", user_message="PRIVATE", future_field="PRIVATE"))
        payload = json.loads(run.call_args.kwargs["input"])
        self.assertNotIn("PRIVATE", json.dumps(payload))
        self.assertEqual(run.call_args.kwargs["timeout"], 1)
        self.assertIsNone(hooks["on_session_end"](telemetry_schema_version="hermes.observer.v1", session_id="s"))
        self.assertEqual(run.call_count, 1)

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
