// ANA: the legacy public endpoint is paused pending a validated API credential.
async function fetchAnaRios() {
    globalAlerts=globalAlerts.filter(a=>!String(a.id).startsWith('ana-rio-'));
    setSource('ANA','paused',null,'Integração legada pausada; a API atual requer credenciais.');
}
