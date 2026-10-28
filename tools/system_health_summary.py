"""Portuguese owner summary from existing aggregate reports and read-only Actions metadata."""
import datetime as dt
import json
import os
import urllib.request

WORKFLOWS = {
    'uptime-monitor.yml': 'Disponibilidade da página inicial',
    'smoke-test.yml': 'Verificações do site',
    'android-tv-preview.yml': 'Verificações do aplicativo TV',
    'android-tv-release.yml': 'Publicação oficial do aplicativo TV',
    'cloudflare-worker-maintenance.yml': 'Manutenção do Worker',
}

def automation_snapshot(runs):
    selected = {}
    for run in sorted(runs, key=lambda r: r.get('created_at', ''), reverse=True):
        name = str(run.get('path', '')).split('/')[-1]
        if name not in WORKFLOWS or name in selected or run.get('head_branch') != 'main':
            continue
        if run.get('status') != 'completed' or run.get('conclusion') in ('cancelled', 'skipped'):
            continue
        # A manual configuration-only uptime check does not test the homepage.
        if name == 'uptime-monitor.yml' and run.get('event') != 'schedule':
            continue
        selected[name] = {'label': WORKFLOWS[name], 'conclusion': run.get('conclusion'),
                          'at': run.get('updated_at'), 'id': run.get('id')}
    return {'available': True, 'runs': selected, 'coverage': 'Últimas execuções disponíveis na janela consultada; ausência não significa sucesso.'}

def read_automations():
    token = os.environ.get('GH_TOKEN')
    if not token:
        return {'available': False, 'reason': 'Metadados das Actions não consultados nesta execução.'}
    try:
        req = urllib.request.Request('https://api.github.com/repos/helbermoura2/Monitor-Global/actions/runs?branch=main&per_page=100',
            headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'User-Agent': 'Monitor-Global-health'})
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.load(response)
        return automation_snapshot(data.get('workflow_runs', []))
    except (OSError, ValueError, TypeError):
        return {'available': False, 'reason': 'Não foi possível consultar as Actions; não significa que os serviços falharam.'}

def pt_number(value):
    return f'{value:,.2f}'.rstrip('0').rstrip('.').replace(',', '_').replace('.', ',').replace('_', '.')

def owner_summary(report):
    lines = ['## Saúde do Monitor Global — leitura rápida', '', 'Consulta: ' + report['queriedAt'] + ' (UTC).', '']
    quotas = report.get('freeQuotas', {})
    day = next((x for x in reversed(quotas.get('days', [])) if x.get('complete')), None)
    expected = (dt.datetime.fromisoformat(report['queriedAt']).date() - dt.timedelta(days=1)).isoformat()
    if day:
        lines += [f"**Cotas do último dia completo disponível: {day['day']} (UTC).**"]
        if day['day'] != expected:
            lines += ['Atenção: o dia de ontem ainda não está disponível; não interpretar este relatório como consumo de ontem.']
        for key in ('workerRequests', 'durableRequests', 'kvWrite'):
            value = day['quotas'].get(key, {})
            lines += ['- ' + value.get('label', key) + ': ' + (pt_number(value['value']) + ' de ' + pt_number(value['limit']) + ' — **' + pt_number(value['percent']) + '%**.' if value.get('available') else '**não medido**; ausência não é zero.')]
        families = report.get('durableFamilies', {}).get(day['day'], [])
        if families:
            top = max(families, key=lambda x: x['requests'])
            name = {'population': 'População', 'earthquake': 'Sismos', 'earthquake-alerts': 'Alertas sísmicos', 'tsunami': 'Tsunami', 'metrics': 'Métricas de operação', 'publicSources': 'Fontes públicas compartilhadas', 'global-rainbow-nowcast-v1': 'Previsão imediata de chuva', 'global-rainbow-products-weather-v1': 'Produtos meteorológicos', 'portuguese-translations-v1': 'Traduções para português', 'global-shared-voice-v1': 'Voz compartilhada'}.get(top['family'], top['family'])
            lines += [f"- Maior consumidor Durable medido: **{name}**, {pt_number(top['requests'])} chamadas ({pt_number(top['percentOfMeasuredDORequests'])}% das chamadas Durable detalhadas; não do Worker inteiro)."]
        else:
            lines += ['- Maior consumidor Durable: detalhamento indisponível para esse dia.']
        attention = [v.get('label', k) for k, v in day['quotas'].items() if v.get('level') in ('watch', 'high', 'critical', 'exceeded')]
        lines += ['- Atenção nas cotas medidas: ' + (', '.join(attention) if attention else 'nenhuma atingiu 70%; métricas ausentes continuam desconhecidas') + '.']
    else:
        lines += ['**Cotas: nenhum dia completo disponível. Não é possível concluir que o consumo está baixo.**']
    recent = {expected, report['queriedAt'][:10]}
    excess = sum(sum(states.values()) for date, states in report.get('resourceExcesses', {}).items() if date in recent)
    measured = any(date in report.get('workerStatuses', {}) for date in recent)
    excess_text = str(excess) if measured else 'não medido'
    lines += ['', f'Excessos de recursos retornados no detalhamento disponível de ontem/hoje: **{excess_text}**. A contagem não identifica sozinha CPU, memória ou rota; ausência de registros não prova ausência de falha.', '', '**Automações: últimas execuções observadas**', '']
    health = report.get('automationHealth', {})
    runs = health.get('runs', {})
    for key, label in WORKFLOWS.items():
        run = runs.get(key)
        if not run:
            lines += ['- ' + label + ': não observada nesta consulta.']
            continue
        result = {'success': 'concluída com sucesso', 'failure': 'falhou', 'timed_out': 'tempo esgotado', 'action_required': 'requer atenção'}.get(run.get('conclusion'), 'resultado não confirmado')
        lines += [f"- {label}: **{result}**, em {run.get('at') or 'horário indisponível'} (UTC) — [abrir execução](https://github.com/helbermoura2/Monitor-Global/actions/runs/{run['id']})."]
    if not health.get('available'):
        lines += ['', health.get('reason', 'Consulta de automações indisponível.')]
    lines += ['', 'Uma Action verde não confirma a atualidade de todas as fontes, a entrega no Telegram ou o funcionamento em cada TV. A disponibilidade acima se refere ao teste registrado, não a uma nova verificação ao vivo. No site, use **Situação das fontes** para a cobertura atual.', '', 'Plano Free. Sem orçamento em dólares, projeção de dias parciais, mudança de cotas ou envio de mensagens. Falhas de consulta e minutos mensais de builds continuam explícitos no relatório detalhado.', '']
    return '\n'.join(lines)
