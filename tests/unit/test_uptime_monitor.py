import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('uptime', Path(__file__).parents[2] / 'tools/uptime-monitor.py')
uptime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(uptime)


class UptimeTests(unittest.TestCase):
    def test_transient_failure_does_not_alert(self):
        attempts = iter([False, True])
        pauses = []
        self.assertEqual(uptime.confirmed_status(lambda: next(attempts), pauses.append), 'up')
        self.assertEqual(pauses, [5])

    def test_three_failures_required(self):
        attempts = []
        def fail():
            attempts.append(1)
            raise TimeoutError('do not print transport URLs')
        self.assertEqual(uptime.confirmed_status(fail, lambda _: None), 'down')
        self.assertEqual(len(attempts), 3)

    def test_alert_once_then_recovery_once(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(uptime, 'STATE', Path(directory) / 'state.json'), patch.object(uptime, 'send') as send:
            env = {'UPTIME_TELEGRAM_BOT_TOKEN': 'fake', 'UPTIME_TELEGRAM_CHAT_ID': 'private'}
            for current in ['down', 'down', 'up', 'up']:
                with patch.object(uptime, 'confirmed_status', return_value=current):
                    if current == 'down':
                        with self.assertRaises(RuntimeError): uptime.run(env)
                    else: uptime.run(env)
            self.assertEqual(send.call_count, 2)
            self.assertIn('voltou', send.call_args.args[0])
            self.assertEqual(json.loads(uptime.STATE.read_text())['notified'], 'up')

    def test_failed_delivery_is_retried_and_state_survives(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(uptime, 'STATE', Path(directory) / 'state.json'), patch.object(uptime, 'confirmed_status', return_value='down'), patch.object(uptime, 'send', side_effect=[TimeoutError(), None]) as send:
            env = {'UPTIME_TELEGRAM_BOT_TOKEN': 'fake', 'UPTIME_TELEGRAM_CHAT_ID': 'private'}
            with self.assertRaises(RuntimeError): uptime.run(env)
            self.assertEqual(json.loads(uptime.STATE.read_text())['notified'], 'up')
            with self.assertRaises(RuntimeError): uptime.run(env)
            self.assertEqual(json.loads(uptime.STATE.read_text())['notified'], 'down')
            self.assertEqual(send.call_count, 2)

    def test_unconfigured_does_not_send_and_corrupt_state_is_not_reset(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(uptime, 'STATE', Path(directory) / 'state.json'), patch.object(uptime, 'confirmed_status', return_value='down'), patch.object(uptime, 'send') as send:
            with self.assertRaises(RuntimeError): uptime.run({})
            self.assertFalse(json.loads(uptime.STATE.read_text())['telegramConfigured'])
            send.assert_not_called()
            uptime.STATE.write_text('broken')
            with self.assertRaises(json.JSONDecodeError): uptime.run({})
            self.assertEqual(uptime.STATE.read_text(), 'broken')

    def test_probe_rejects_wrong_html_or_wrong_type(self):
        from unittest.mock import MagicMock
        for body, content_type, expected in [(b'<html>Monitor Global mapWrap</html>', 'text/html', True), (b'Maintenance', 'text/html', False), (b'Monitor Global mapWrap', 'text/plain', False)]:
            response = MagicMock()
            response.status = 200
            response.headers = {'Content-Type': content_type}
            response.read.return_value = body
            response.__enter__.return_value = response
            with patch.object(uptime.urllib.request, 'urlopen', return_value=response):
                self.assertEqual(uptime.probe(), expected)


if __name__ == '__main__':
    unittest.main()
