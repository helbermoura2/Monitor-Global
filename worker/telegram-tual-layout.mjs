export const TUAL_WIDTH = 1024;
export const TUAL_HEIGHT = 1536;
export const TUAL_TSUNAMI_ROWS = [1000, 1068];
const MAP_Y = 292;
const MAP_HEIGHT = 711;
const ANCHOR_Y = 348;
const IVORY = '#f8d29e';
const COPPER = '#d8995c';

function telegramFrame(ev) {
    const frame = globalThis.QuakeCardLayout.frame(ev);
    const span = frame.maxLon - frame.minLon;
    return {...frame, height: MAP_HEIGHT, anchorY: ANCHOR_Y,
        minLat: Number(ev.lat) - span * (MAP_HEIGHT - ANCHOR_Y) / 800,
        maxLat: Number(ev.lat) + span * ANCHOR_Y / 800};
}

function fit(p, value, size, width) {
    const text = String(value).trim();
    let scaled = size;
    while (scaled > size * .65 && p.measure(text, scaled) > width) scaled--;
    if (p.measure(text, scaled) <= width) return [text, scaled];
    let clipped = text;
    while (clipped.length && p.measure(clipped + '…', scaled) > width) clipped = clipped.slice(0, -1);
    return [clipped + '…', scaled];
}

function label(p, value, x, y, size, width, color = IVORY) {
    const [text, scaled] = fit(p, value, size, width);
    p.text(text, x + 1.5, y + 2, scaled, '#130b07');
    p.text(text, x, y, scaled, color);
}

function centered(p, value, x, y, size, width) {
    const [text, scaled] = fit(p, value, size, width);
    label(p, text, x - p.measure(text, scaled) / 2, y, scaled, width);
}

function drawTsunami(p, status) {
    const group = status?.regionalGroups?.find(g => !g.stale && ['warning','watch','advisory'].includes(g.state));
    if (!group && (!status || status.stale || !['warning','watch','advisory'].includes(status.state))) return;
    p.roundRect(44, 940, 712, 59, COPPER);
    p.roundRect(46, 942, 708, 55, '#2d1a13');
    label(p, 'AVISO OFICIAL DE TSUNAMI · ' + (status.source || group?.source || 'Autoridade oficial'), 59, 946, 21, 680);
    const area = status.areas || group?.regions?.join(' · ') || 'Siga as orientações das autoridades locais.';
    label(p, area, 59, 974, 16, 680);
}

function draw(p, ev) {
    const country = /^[A-Z]{2}$/.test(ev.imageCountryCode || '')
        ? new Intl.DisplayNames(['pt-BR'], {type:'region'}).of(ev.imageCountryCode) : '';
    let place = String(globalThis.EventPortuguese?.place?.(ev.place) || ev.place || 'Local não informado').trim();
    if (country && !place.toLocaleLowerCase('pt-BR').includes(country.toLocaleLowerCase('pt-BR'))) {
        place = place.replace(/,\s*(Indonesia|Japan|Chile|Peru|Brazil|Philippines|Russia|Fiji)$/i, '');
        place += ', ' + country;
    }
    const [title, size] = fit(p, place, 37, country ? 630 : 681);
    label(p, title, 61, 222 + (37 - size) / 2, size, 681);
    if (country) p.flag('country', ev.imageCountryCode, 72 + p.measure(title, size), 224, 51, 50);

    const mag = Number(ev.mag);
    centered(p, Number.isFinite(mag) ? 'M' + mag.toFixed(1).replace('.', ',') : 'M—', 140, 324, 104, 175);
    if (ev.test) label(p, 'SIMULAÇÃO', 288, 323, 28, 220);

    const y = MAP_Y + ANCHOR_Y;
    for (const radius of [24, 49, 74, 100, 128, 158, 192, 226]) {
        p.arc(400, y + 3, radius, 3.4, 0, 360, '#201008');
        p.arc(400, y, radius, 1.45, 0, 360, COPPER);
    }
    p.dot(400, y, 10, '#3d2415');
    p.dot(400, y, 7, '#ffc37d');
    if (!ev.imageMapAvailable) centered(p, 'Mapa indisponível na fonte', 400, 695, 23, 440);

    const date = new Date(ev.timeIso || NaN);
    const validDate = Number.isFinite(date.getTime());
    const zone = {timeZone:'America/Sao_Paulo'};
    label(p, validDate ? date.toLocaleDateString('pt-BR', zone) : 'Não informada', 95, 1080, 29, 184);
    if (validDate) label(p, date.toLocaleTimeString('pt-BR', {...zone, hour:'2-digit', minute:'2-digit', hour12:false}) + ' BRT', 95, 1112, 27, 180);
    const depth = ev.depth != null && ev.depth !== '' && Number.isFinite(Number(ev.depth))
        ? Math.abs(Number(ev.depth)).toLocaleString('pt-BR', {maximumFractionDigits:1}) + ' km' : 'Não informada';
    centered(p, depth, 398, 1084, 38, 206);
    centered(p, ev.source || 'Não informada', 629, 1085, 37, 185);
    centered(p, ev.reviewed ? 'Revisado' : ev.reviewStatus === 'unknown' ? 'Revisão não informada' : 'Registro automático', 202, 1174, 34, 235);
    const intensity = ev.mmi && ev.mmi !== '—' ? String(ev.mmi) : 'indisponível';
    const status = ev.shaking?.status === 'available' ? 'oficial' : 'estimada';
    centered(p, 'Intensidade ' + status + ' ' + intensity, 531, 1167, 31, 370);
    drawTsunami(p, ev.imageTsunami);
}

export const tualLayout = {MAP_Y, MAP_HEIGHT, ANCHOR_Y, CONTEXT:{x:0,y:0,width:0,height:0},
    showScale:false, bronze:true, telegramFrame, draw, drawTsunami};
