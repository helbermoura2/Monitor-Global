// Shared HTTP responses, CORS and bounded upstream requests.
const CORS_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
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
        return { ok: r.ok, status: r.status, text, contentType: r.headers.get('Content-Type') || '', retryAfter: r.headers.get('Retry-After') || '' };
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

// Bound request bodies during reading, including chunked uploads without a trustworthy length.
export async function readBoundedText(request,maxBytes=40000,timeoutMs=10000){
 if(Number(request.headers.get('Content-Length'))>maxBytes)throw Object.assign(Error('size'),{status:413});
 const reader=request.body?.getReader();if(!reader)return '';
 let timer,total=0,text='';const decoder=new TextDecoder();const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('timeout'),{status:408})),timeoutMs);});
 try{for(;;){const {done,value}=await Promise.race([reader.read(),deadline]);if(done)break;total+=value.byteLength;if(total>maxBytes)throw Object.assign(Error('size'),{status:413});text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}
 finally{clearTimeout(timer);try{await reader.cancel();}catch{}reader.releaseLock();}
}
