const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const MODELS = ['ecmwf_ifs025', 'gfs_seamless', 'icon_seamless'];
const CEMADEN = 'https://sws.cemaden.gov.br/PED/rest/pcds/pcds-dados-recentes?rede=11&codibge=3550308&sensor=10&formato=JSON';

export function gaugeEvidence(rows, loc, now) {
  if (!Array.isArray(rows)) return null;
  const latest = new Map();
  for (const row of rows) {
    if (row?.id_sensor !== 10 || row.qualificacao !== '0000' ||
        typeof row.codestacao !== 'string' || !/^3550308\w{3}$/.test(row.codestacao) ||
        !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude) ||
        !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(row.datahora) ||
        !Number.isFinite(row.valor) || row.valor < 0 || row.valor > 300) continue;
    const at = Date.parse(row.datahora.replace(' ', 'T') + ':00Z');
    const distance = Math.hypot((row.latitude - loc.lat) * 111.32,
      (row.longitude - loc.lng) * 111.32 * Math.cos(loc.lat * Math.PI / 180));
    if (!Number.isFinite(at) || at > now || now - at >= 20 * MINUTE || distance > 3) continue;
    const previous = latest.get(row.codestacao);
    if (!previous || at > previous.at) latest.set(row.codestacao, {row, at, distance});
  }
  const nearby = [...latest.values()].filter(({row}) => row.valor > 0)
    .sort((a, b) => a.distance - b.distance || b.at - a.at)[0];
  if (!nearby) return null;
  return {kind: 'gauge', at: nearby.at, expiresAt: nearby.at + 20 * MINUTE,
    station: String(nearby.row.nome || nearby.row.codestacao).trim().slice(0, 60),
    distanceKm: Math.round(nearby.distance * 10) / 10, amount: nearby.row.valor};
}

export function hourlyEvidence(data, now) {
  if (data?.utc_offset_seconds !== 0 || !Array.isArray(data.hourly?.time)) return null;
  for (const [index, end] of data.hourly.time.entries()) {
    if (!Number.isSafeInteger(end) || end * 1000 <= now || end * 1000 - HOUR >= now + HOUR) continue;
    const values = MODELS.map(model => data.hourly['precipitation_' + model]?.[index]);
    if (values.filter(value => Number.isFinite(value) && value >= 0.2 && value <= 300).length >= 2) {
      return {kind: 'hourly', at: now, expiresAt: Math.min(now + 10 * MINUTE, end * 1000)};
    }
  }
  return null;
}

async function read(url, headers, fetcher) {
  try {
    const response = await fetcher(url, {headers, redirect: 'error', signal: AbortSignal.timeout(4500)});
    if (response.ok) return await response.json();
  } catch {}
  return null;
}

export async function collectRainEvidence(loc, env, now, fetcher = fetch) {
  const token = env.CEMADEN_API_TOKEN;
  const modelUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat +
    '&longitude=' + loc.lng + '&hourly=precipitation&forecast_hours=4&timeformat=unixtime&timezone=UTC&models=' + MODELS.join(',');
  const [gauges, models] = await Promise.all([
    token ? read(CEMADEN, {token, Accept: 'application/json'}, fetcher) : null,
    read(modelUrl, {Accept: 'application/json'}, fetcher)
  ]);
  return gaugeEvidence(gauges, loc, now) ?? hourlyEvidence(models, now);
}
