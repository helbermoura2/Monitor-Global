// Shared HTTP responses, CORS and bounded upstream requests.
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Vary': 'Origin'
};


function resposta(body, status = 200, contentType = 'application/json', extra = {}) {
    return new Response(body, {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': contentType, ...extra }
    });
}

function json(data, status = 200) {
    return resposta(JSON.stringify(data), status, 'application/json');
}

function nowIso() { return new Date().toISOString(); }

async function fetchText(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const r = await fetch(url, { ...options, signal: controller.signal });
        const text = await r.text();
        return { ok: r.ok, status: r.status, text, contentType: r.headers.get('Content-Type') || '' };
    } finally {
        clearTimeout(timer);
    }
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
    const r = await fetchText(url, options, timeoutMs);
    if (!r.ok) throw new Error(`${new URL(url).hostname} ${r.status}`);
    try { return JSON.parse(r.text); }
    catch { throw new Error(`Resposta não-JSON de ${new URL(url).hostname}`); }
}
export { fetchText, nowIso, fetchJson, resposta, json, CORS_HEADERS };
