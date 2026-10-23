"""Homepage availability only. No event feeds, Durable calls or test messages."""
import json
import os
from pathlib import Path
import time
import urllib.request

SITE = 'https://monitorglobal.top/'
STATE = Path('uptime-state/state.json')


def probe():
    req = urllib.request.Request(SITE, headers={'User-Agent': 'MonitorGlobal-availability/1.0'})
    with urllib.request.urlopen(req, timeout=15) as response:
        body = response.read(2_000_001)
        return (response.status == 200 and len(body) <= 2_000_000
                and 'text/html' in response.headers.get('Content-Type', '').lower()
                and b'mapWrap' in body and b'Monitor Global' in body)


def confirmed_status(check=probe, pause=time.sleep):
    for attempt in range(3):
        try:
            if check():
                return 'up'
        except Exception:
            pass  # Never print URLs from exceptions: transports can include credentials.
        if attempt < 2:
            pause(5)
    return 'down'


def notification(previous, current):
    if current == 'down' and previous.get('notified', 'up') != 'down':
        return '⚠️ Monitor Global: página inicial indisponível após 3 tentativas.\n' + SITE
    if current == 'up' and previous.get('notified') == 'down':
        return '✅ Monitor Global: a página inicial voltou a responder.\n' + SITE
    return None


def send(text, token, chat):
    data = json.dumps({'chat_id': chat, 'text': text, 'disable_web_page_preview': True}).encode()
    req = urllib.request.Request('https://api.telegram.org/bot' + token + '/sendMessage',
                                 data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as response:
        if not json.load(response).get('ok'):
            raise RuntimeError('Telegram delivery rejected')


def run(env=os.environ):
    previous = json.loads(STATE.read_text()) if STATE.exists() else {'notified': 'up'}
    if previous.get('notified') not in ('up', 'down'):
        raise ValueError('Invalid notification state')
    current = confirmed_status()
    token, chat = env.get('UPTIME_TELEGRAM_BOT_TOKEN', ''), env.get('UPTIME_TELEGRAM_CHAT_ID', '')
    configured = bool(token and chat)
    text = notification(previous, current)
    error = None
    if configured and text:
        try:
            send(text, token, chat)
            previous['notified'] = current
        except Exception:
            error = 'Falha ao entregar aviso; nova tentativa na próxima execução. Credenciais omitidas.'
    result = {**previous, 'observed': current, 'checkedAtUtc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'telegramConfigured': configured}
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(result, ensure_ascii=False) + '\n')
    print('Página inicial:', current, '| Telegram:', 'configurado' if configured else 'aguardando os dois Secrets UPTIME_TELEGRAM_*')
    summary = env.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as output:
            output.write(f'Página inicial: **{current}**. Telegram configurado: **{configured}**. Verifica somente disponibilidade da página, não saúde de todas as fontes.\n')
    if error:
        raise RuntimeError(error)
    if current == 'down':
        raise RuntimeError('Página inicial indisponível após três tentativas; estado preservado.')


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        # Do not print raw transport exceptions or credential-bearing URLs.
        print('Monitor falhou:', type(error).__name__, '(consulte o estado e a configuração).')
        raise SystemExit(1)
