// Telegram transport with explicit rendering, exposure and caption dependencies.
export function createTelegramTransport({renderAlertCardPng,patchAlertTsunami,queryImageTsunami,queryImageExposure,telegramCaption,enrichBrazilEpicenter,originalImageButton}){


/** Gera o card PNG (magnitude + textos + marca) e envia no Telegram. */
async function telegramSendPhoto(env, ev, caption) {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados');

    let png;
    try { ev.imageExposure = await queryImageExposure(ev, env); png = await renderAlertCardPng(ev); }
    catch (error) { error.cardFailed = true; throw error; }

    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', caption.slice(0, 1024));
    form.append('parse_mode', 'Markdown');
    if(env.ARCHIVE_TELEGRAM_IMAGE)try{ev.originalImageKey=await env.ARCHIVE_TELEGRAM_IMAGE(png,ev.originalImageKey);form.append('reply_markup',JSON.stringify(originalImageButton(ev.originalImageKey)));}catch(error){console.warn('Original Full HD indisponível');}
    form.append('photo', new Blob([png], { type: 'image/png' }), 'monitor-global-alerta.png');

    const api = `https://api.telegram.org/bot${token}/sendPhoto`;
    const r = await fetch(api, { method: 'POST', body: form });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) {
        const error = new Error(data.description || `Telegram HTTP ${r.status}`);
        error.telegramRejected = !r.ok && r.status >= 400 && r.status < 500 || data.ok === false;
        throw error;
    }
    return data;
}

async function telegramSendMessage(env, text, replyTo) {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados');

    const api = `https://api.telegram.org/bot${token}/sendMessage`;
    const r = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text.slice(0, 4000),
            parse_mode: 'Markdown',
            disable_web_page_preview: false,
            ...(replyTo ? {reply_parameters: {message_id: replyTo, allow_sending_without_reply: false}} : {})
        })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) {
        const error = new Error(data.description || `Telegram HTTP ${r.status}`);
        error.telegramRejected = !r.ok && r.status >= 400 && r.status < 500 || data.ok === false;
        throw error;
    }
    return data;
}
async function telegramEditAlert(env, ev, record) {
    await enrichBrazilEpicenter(ev);
    if(queryImageTsunami)ev.imageTsunami=ev.imageTsunami||await queryImageTsunami(ev);
    const caption = telegramCaption(ev, record).slice(0, 1024);
    let body, method;
    if (record.messageType === 'text') {
        method = 'editMessageText';
        body = JSON.stringify({chat_id: record.chatId, message_id: record.messageId, text: caption, parse_mode: 'Markdown'});
    } else {
        method = 'editMessageMedia';
        ev.imageExposure = ev.imageExposure || await queryImageExposure(ev, env);
        const revisions=record.revisions||[],previous= revisions.length>1?revisions[revisions.length-2].mag:record.initialMag;
        const revisionText=revisions.length?'M'+globalThis.EventPortuguese.number(previous,1)+' → M'+globalThis.EventPortuguese.number(ev.mag,1):'';
        ev.originalImageKey=record.originalImageKey||record.currentEvent?.originalImageKey;
        const png = ev.tsunamiOnly?await patchAlertTsunami(await env.READ_TELEGRAM_IMAGE(ev.originalImageKey),ev.imageTsunami,record.cardImageVersion):await renderAlertCardPng({...ev,revisionText});
        body = new FormData();
        body.append('chat_id', String(record.chatId));
        body.append('message_id', String(record.messageId));
        body.append('media', JSON.stringify({type: 'photo', media: 'attach://card', caption, parse_mode: 'Markdown'}));
        if(env.ARCHIVE_TELEGRAM_IMAGE)try{ev.originalImageKey=await env.ARCHIVE_TELEGRAM_IMAGE(png,ev.originalImageKey);record.originalImageKey=ev.originalImageKey;body.append('reply_markup',JSON.stringify(originalImageButton(ev.originalImageKey)));}catch(error){console.warn('Original Full HD indisponível');}
        body.append('card', new Blob([png], {type: 'image/png'}), 'monitor-global-atualizado.png');
    }
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
        method: 'POST', ...(typeof body === 'string' ? {headers: {'Content-Type': 'application/json'}} : {}), body
    });
    const data = await response.json().catch(() => ({}));
    if ((!response.ok || !data.ok) && !/message is not modified/i.test(data.description || ''))
        throw new Error(data.description || `Telegram edição HTTP ${response.status}`);
}
async function telegramDailyRequest(env, method, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
        const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
            {method:'POST',body,signal:controller.signal});
        const data = await r.json().catch(()=>({}));
        if(!r.ok || !data.ok) {
            const error=new Error(data.description || `Telegram HTTP ${r.status}`);
            // Só a recusa explícita da API permite repetir com segurança.
            error.definitelyRejected=data.ok===false;
            throw error;
        }
        return data;
    } finally {
        clearTimeout(timer);
    }
}
return { telegramSendPhoto, telegramSendMessage, telegramEditAlert, telegramDailyRequest };
}
