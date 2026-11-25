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

// This is model agreement, NOT a calibrated probability of rain.
export function modelConsensus(data, now) {
  const times = data?.hourly?.time;
  if (data?.utc_offset_seconds !== 0 || !Array.isArray(times)) return null;
  const hours = [];
  for (let i = 0; i < times.length && hours.length < 6; i++) {
    const at = times[i] * 1000;
    if (!Number.isSafeInteger(times[i]) || at < now || at >= now + 6 * HOUR) continue;
    const values = MODELS.map(model => data.hourly['precipitation_' + model]?.[i]);
    const valid = values.filter(value => Number.isFinite(value) && value >= 0 && value <= 300);
    if (valid.length < 2) continue;
    const wet = valid.filter(value => value >= 0.2);
    const orderedWet = wet.slice().sort((a, b) => a - b);
    const median = orderedWet.length ? orderedWet[Math.floor((orderedWet.length - 1) / 2)] : 0;
    hours.push({at, votes: wet.length, available: valid.length, medianMm: median});
  }
  if (!hours.length) return null;
  const wet = hours.filter(hour => hour.votes >= 2);
  const first = wet[0] || null;
  const amount = wet.reduce((sum, hour) => sum + hour.medianMm, 0);
  const peakVotes = Math.max(...hours.map(hour => hour.votes));
  return {
    kind: 'consensus', at: now, expiresAt: now + 10 * MINUTE,
    windowHours: 6, models: MODELS.length, peakVotes,
    arrivalMinutes: first ? Math.max(0, Math.round((first.at - now) / MINUTE)) : null,
    wetHours: wet.length, medianMmPerWetHour: first ? first.medianMm : null,
    accumulatedMedianMm: Math.round(amount * 10) / 10,
    label: peakVotes + '/' + MODELS.length + ' modelos concordam',
    calibration: 'consenso entre modelos; não é probabilidade calibrada'
  };
}

export function hourlyEvidence(data, now) {
  const consensus = modelConsensus(data, now);
  if (!consensus || consensus.peakVotes < 2) return null;
  return {kind: 'hourly', at: now, expiresAt: consensus.expiresAt, consensus};
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
    '&longitude=' + loc.lng + '&hourly=precipitation&forecast_hours=6&timeformat=unixtime&timezone=UTC&models=' + MODELS.join(',');
  const [gauges, models] = await Promise.all([
    token ? read(CEMADEN, {token, Accept: 'application/json'}, fetcher) : null,
    read(modelUrl, {Accept: 'application/json'}, fetcher)
  ]);
  const gauge = gaugeEvidence(gauges, loc, now);
  const consensus = modelConsensus(models, now);
  if (gauge) return {...gauge, ...(consensus ? {consensus} : {})};
  return consensus ? {kind: 'hourly', at: now, expiresAt: consensus.expiresAt, consensus} : null;
}
