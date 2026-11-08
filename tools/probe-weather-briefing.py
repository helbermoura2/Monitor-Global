"""One live, shared hourly generation; no arbitrary inputs or message delivery."""
import json
import time
import urllib.request

url = 'https://black-sky-9ba0.terrestre.workers.dev/weather-briefing?kind=hourly'
for attempt in range(20):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'MonitorGlobalWeatherAIProbe'}), timeout=20) as response:
        raw = response.read(6001)
    if len(raw) > 6000:
        raise SystemExit('Oversized AI briefing response')
    data = json.loads(raw)
    print(json.dumps(data, ensure_ascii=False), flush=True)
    if data.get('engine') != 'validated-insight-selection-v4':
        time.sleep(2)
        continue
    if data.get('status') == 'ready':
        assert data.get('policy') == 'source-grounded-weather-v1'
        assert data.get('model') in ('gemini-3.8-flash', '@cf/meta/llama-3.1-8b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct-fp8', 'validated-facts-v1')
        assert 0 < len(data.get('text', '')) <= 185
        assert data.get('expiresAt', 0) > time.time()*1000
        break
    if data.get('status') == 'not_applicable':
        # The ordinary weather card already includes all useful facts.
        # Skipping redundant AI is now a valid, zero-inference outcome.
        print('No added meteorological insight; standard card remains available')
        break
    if data.get('status') != 'pending':
        raise SystemExit('Live AI briefing unavailable; normal meteorological cards remain usable')
    time.sleep(2)
else:
    raise SystemExit('Shared AI generation did not finish within the probe window')
