// === ana-rios.js — Nível de rio via ANA/HidroWebService (estações telemétricas oficiais) ===
// A ANA está migrando pra uma API nova que exige credencial (token, pedido
// por e-mail em hidro@ana.gov.br) — não dá pra self-service isso por aqui.
// Usa o serviço legado, ainda público e sem autenticação:
// snirh.gov.br/hidroweb/rest/api/estacaotelemetrica?id=<código>. Cobertura
// inicial pequena DE PROPÓSITO: só estações cujo código foi confirmado de
// verdade (fonte oficial/notícia da própria ANA), pra nunca mostrar o rio
// errado por causa de um código chutado. Pra expandir, só adicionar um item
// na lista ANA_ESTACOES.
const ANA_ESTACOES = [
    { codigo: '87450020', nome: 'Rio Guaíba — Porto Alegre, RS', uf: 'RS', coords: [-51.230, -30.027] },
    { codigo: '14990000', nome: 'Rio Negro — Porto de Manaus, AM', uf: 'AM', coords: [-60.023, -3.130] },
    { codigo: '15400000', nome: 'Rio Madeira — Porto Velho, RO', uf: 'RO', coords: [-63.904, -8.760] },
    { codigo: '14620000', nome: 'Rio Branco — Boa Vista, RR', uf: 'RR', coords: [-60.676, 2.824] }
];

// Guarda a última leitura de cada estação pra comparar com a próxima —
// é a subida RELATIVA e recente que dispara alerta, não um nível absoluto
// fixo: cada régua tem seu próprio zero e sua própria cota de cheia (a do
// Guaíba, por exemplo, não é comparável à do Rio Negro em Manaus, que tem
// variação sazonal natural de mais de 10m sem ser enchente nenhuma) — cravar
// um limiar "X metros = risco" pra todas as estações estaria errado.
const anaUltimaLeitura = new Map();
const ANA_SUBIDA_RAPIDA_M = 0.30;   // alerta se subir isso ou mais...
const ANA_SUBIDA_JANELA_MS = 3 * 3600000; // ...numa janela de até 3h

async function fetchAnaRios() {
    let algumaOk = false;
    for (const est of ANA_ESTACOES) {
        try {
            const url = 'https://www.snirh.gov.br/hidroweb/rest/api/estacaotelemetrica?id=' + est.codigo;
            const r = await fetchWithCorsFallback(url, 15000);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.json();
            const serie = Array.isArray(d) ? d : (Array.isArray(d?.items) ? d.items : (Array.isArray(d?.itens) ? d.itens : []));
            if (!serie.length) throw new Error('sem série retornada');

            const dataHoraDe = (x) => (x && x.id && x.id.horDataHora) || x?.horDataHora || '';
            const ultima = serie.reduce((a, b) => (Date.parse(dataHoraDe(b)) || 0) > (Date.parse(dataHoraDe(a)) || 0) ? b : a);
            const nivel = Number(ultima.horNivelAdotado ?? ultima.nivel);
            const time = Date.parse(dataHoraDe(ultima));
            if (!Number.isFinite(nivel) || !Number.isFinite(time)) throw new Error('leitura sem nível/hora válidos');
            algumaOk = true;

            const prev = anaUltimaLeitura.get(est.codigo);
            anaUltimaLeitura.set(est.codigo, { nivel, time });

            const dtMs = prev ? time - prev.time : null;
            const subida = (prev && dtMs > 0 && dtMs <= ANA_SUBIDA_JANELA_MS) ? (nivel - prev.nivel) : null;
            const subindoRapido = subida != null && subida >= ANA_SUBIDA_RAPIDA_M;

            const id = 'ana-rio-' + est.codigo;
            if (!subindoRapido) {
                // Nível normal/estável: só atualiza os dados internos (pra
                // próxima comparação) sem virar card/alerta — mostrar TODA
                // estação monitorada na lista o tempo todo, mesmo parada,
                // poluiria os registros com "não-eventos".
                globalAlerts = globalAlerts.filter(a => a.id !== id);
                continue;
            }

            const obj = {
                id, type: 'flood', place: est.nome,
                bandeira: '🇧🇷', pais: 'Brasil', uf: est.uf,
                time: Date.now(), coords: est.coords,
                source: 'ANA', sev: 2,
                detail: `Subiu ${subida.toFixed(2)} m em ${(dtMs / 3600000).toFixed(1)}h · nível atual ${nivel.toFixed(2)} m · Rede Hidrometeorológica Nacional`,
                nivelRio: nivel, nivelSubidaRecente: subida,
                link: 'https://www.snirh.gov.br/hidroweb/apresentacao'
            };
            const isNew = upsertAlert(obj, { fonte: 'anaRio', expiraMs: ANA_SUBIDA_JANELA_MS, skipRemove: true });
            if (isNew) {
                playAlertTone('flood');
                showToast(`💧 ${est.nome}: subindo rápido (+${subida.toFixed(2)} m)`, 'warning');
                notificarNavegador(`💧 ${est.nome}`, `Subiu ${subida.toFixed(2)} m em ${(dtMs / 3600000).toFixed(1)}h`);
            }
        } catch (e) {
            console.warn('ANA rio', est.codigo, ':', e?.message || e);
        }
    }
    try { if (typeof setSource === 'function') setSource('ANA', algumaOk ? 'ok' : 'off', null, algumaOk ? null : 'nenhuma estação respondeu'); } catch (e) {}
    applyFilters();
}
