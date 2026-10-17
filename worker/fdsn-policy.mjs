// Magnitude floors and row limits accepted by each FDSN provider.
// Piso real de magnitude e limite máximo por host FDSN. O frontend pede
// minmagnitude=0.1&limit=1000 para todas as agências, mas cada servidor
// tem um teto diferente de cobertura e de linhas. Ajustar aqui evita que
// GEOFON/ISC/INGV devolvam HTTP 400 ("Error 400: ...") para o cliente.
const FDSN_CLAMPS = {
    'geofon.gfz-potsdam.de': { minmagFloor: 3.5, maxLimit: 500 },
    'www.isc.ac.uk':         { minmagFloor: 4.0, maxLimit: 500 },
    'webservices.ingv.it':   { minmagFloor: 1.5, maxLimit: 500 },
    'earthquake.usgs.gov':   { minmagFloor: 0.1, maxLimit: 1000 },
    'www.seismicportal.eu':  { minmagFloor: 0.1, maxLimit: 1000 }
};

function clampFdsnValue(hostname, minmag, limit) {
    const clamp = FDSN_CLAMPS[hostname];
    if (!clamp) return { minmag, limit };
    return {
        minmag: (Number.isFinite(minmag) && minmag < clamp.minmagFloor) ? clamp.minmagFloor : minmag,
        limit:  (Number.isFinite(limit)  && limit  > clamp.maxLimit)    ? clamp.maxLimit    : limit
    };
}

function clampFdsnParams(url) {
    const clamp = FDSN_CLAMPS[url.hostname];
    if (!clamp) return url;
    if (url.pathname.indexOf('/fdsnws/event') < 0) return url;
    const minmag = parseFloat(url.searchParams.get('minmagnitude'));
    const limit  = parseInt(url.searchParams.get('limit'), 10);
    const out = clampFdsnValue(url.hostname, minmag, limit);
    if (Number.isFinite(out.minmag) && out.minmag !== minmag) url.searchParams.set('minmagnitude', String(out.minmag));
    if (Number.isFinite(out.limit)  && out.limit  !== limit)  url.searchParams.set('limit', String(out.limit));
    return url;
}
export { clampFdsnValue, clampFdsnParams };
