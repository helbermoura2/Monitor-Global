// === geo-e-ciclone-utils.js — Traduções, bandeiras, helpers de ciclone/tsunami, mecanismo focal sísmico, formatação genérica (linhas originais 1879-2331 do core-app.js) ===


const traducoesLocais = {
    "japan":"Japão","mexico":"México","chile":"Chile","california":"Califórnia","indonesia":"Indonésia",
    "philippines":"Filipinas","new zealand":"Nova Zelândia","greece":"Grécia","italy":"Itália","turkey":"Turquia",
    "taiwan":"Taiwan","china":"China","peru":"Peru","ecuador":"Equador","colombia":"Colômbia","fiji":"Ilhas Fiji",
    "guatemala":"Guatemala","puerto rico":"Porto Rico","alaska":"Alasca","caribbean":"Caribe","tonga":"Tonga",
    "vanuatu":"Vanuatu","papua new guinea":"Papua-Nova Guiné","solomon islands":"Ilhas Salomão","mediterranean":"Mediterrâneo",
    "afghanistan":"Afeganistão","pakistan":"Paquistão","central america":"América Central","south of":"Sul de","offshore":"Costa de"
};

const dicionarioBandeiras = {
    "república centro-africana":"🇨🇫","república dominicana":"🇩🇴","emirados árabes unidos":"🇦🇪","papua-nova guiné":"🇵🇬","nova zelândia":"🇳🇿","áfrica do sul":"🇿🇦","coreia do sul":"🇰🇷","coreia do norte":"🇰🇵","estados unidos":"🇺🇸","reino unido":"🇬🇧","el salvador":"🇸🇻","costa rica":"🇨🇷","porto rico":"🇵🇷","burkina faso":"🇧🇫","sudão do sul":"🇸🇸",
    "paquistão":"🇵🇰","cazaquistão":"🇰🇿","uzbequistão":"🇺🇿","turcomenistão":"🇹🇲","quirguistão":"🇰🇬","tajiquistão":"🇹🇯","azerbaijão":"🇦🇿","armênia":"🇦🇲","geórgia":"🇬🇪","mongólia":"🇲🇳","bolívia":"🇧🇴","paraguai":"🇵🇾","uruguai":"🇺🇾","argentina":"🇦🇷","venezuela":"🇻🇪","colômbia":"🇨🇴","equador":"🇪🇨","peru":"🇵🇪","chile":"🇨🇱","brasil":"🇧🇷","méxico":"🇲🇽","guatemala":"🇬🇹","honduras":"🇭🇳","nicarágua":"🇳🇮","panamá":"🇵🇦","cuba":"🇨🇺","jamaica":"🇯🇲","haiti":"🇭🇹","canadá":"🇨🇦","alasca":"🇺🇸","havaí":"🇺🇸","islândia":"🇮🇸","noruega":"🇳🇴","suécia":"🇸🇪","finlândia":"🇫🇮","dinamarca":"🇩🇰","marrocos":"🇲🇦","argélia":"🇩🇿","tunísia":"🇹🇳","líbia":"🇱🇾","egito":"🇪🇬","senegal":"🇸🇳","gana":"🇬🇭","nigéria":"🇳🇬","angola":"🇦🇴","quênia":"🇰🇪","etiópia":"🇪🇹","tanzânia":"🇹🇿","moçambique":"🇲🇿","madagascar":"🇲🇬","namíbia":"🇳🇦","zâmbia":"🇿🇲","zimbábue":"🇿🇼","botsuana":"🇧🇼","malawi":"🇲🇼","uganda":"🇺🇬","ruanda":"🇷🇼","burundi":"🇧🇮","somália":"🇸🇴","chade":"🇹🇩","níger":"🇳🇪","mali":"🇲🇱","sudão":"🇸🇩","butão":"🇧🇹","laos":"🇱🇦","nepal":"🇳🇵","índia":"🇮🇳","china":"🇨🇳","taiwan":"🇹🇼","japão":"🇯🇵","turquia":"🇹🇷","grécia":"🇬🇷","itália":"🇮🇹","espanha":"🇪🇸","portugal":"🇵🇹","frança":"🇫🇷","alemanha":"🇩🇪","holanda":"🇳🇱","bélgica":"🇧🇪","suíça":"🇨🇭","áustria":"🇦🇹","polônia":"🇵🇱","hungria":"🇭🇺","romênia":"🇷🇴","bulgária":"🇧🇬","croácia":"🇭🇷","sérvia":"🇷🇸","ucrânia":"🇺🇦","rússia":"🇷🇺","irã":"🇮🇷","iraque":"🇮🇶","israel":"🇮🇱","líbano":"🇱🇧","jordânia":"🇯🇴","síria":"🇸🇾","iêmen":"🇾🇪","omã":"🇴🇲",
    "central african republic":"🇨🇫","dominican republic":"🇩🇴","united arab emirates":"🇦🇪","papua new guinea":"🇵🇬","new zealand":"🇳🇿","south africa":"🇿🇦","south sudan":"🇸🇸","north korea":"🇰🇵","south korea":"🇰🇷","united states":"🇺🇸","united kingdom":"🇬🇧","sri lanka":"🇱🇰","hong kong":"🇭🇰","czech republic":"🇨🇿","kyrgyzstan":"🇰🇬","tajikistan":"🇹🇯","turkmenistan":"🇹🇲","uzbekistan":"🇺🇿","kazakhstan":"🇰🇿","azerbaijan":"🇦🇿","armenia":"🇦🇲","georgia":"🇬🇪","mongolia":"🇲🇳","australia":"🇦🇺","philippines":"🇵🇭","indonesia":"🇮🇩","malaysia":"🇲🇾","singapore":"🇸🇬","cambodia":"🇰🇭","thailand":"🇹🇭","vietnam":"🇻🇳","myanmar":"🇲🇲","bangladesh":"🇧🇩","pakistan":"🇵🇰","afghanistan":"🇦🇫","turkey":"🇹🇷","greece":"🇬🇷","italy":"🇮🇹","spain":"🇪🇸","portugal":"🇵🇹","france":"🇫🇷","germany":"🇩🇪","netherlands":"🇳🇱","belgium":"🇧🇪","switzerland":"🇨🇭","austria":"🇦🇹","poland":"🇵🇱","hungary":"🇭🇺","romania":"🇷🇴","bulgaria":"🇧🇬","croatia":"🇭🇷","serbia":"🇷🇸","ukraine":"🇺🇦","russia":"🇷🇺","iceland":"🇮🇸","norway":"🇳🇴","sweden":"🇸🇪","finland":"🇫🇮","denmark":"🇩🇰","morocco":"🇲🇦","algeria":"🇩🇿","tunisia":"🇹🇳","libya":"🇱🇾","egypt":"🇪🇬","senegal":"🇸🇳","ghana":"🇬🇭","nigeria":"🇳🇬","angola":"🇦🇴","kenya":"🇰🇪","ethiopia":"🇪🇹","tanzania":"🇹🇿","mozambique":"🇲🇿","namibia":"🇳🇦","zambia":"🇿🇲","zimbabwe":"🇿🇼","botswana":"🇧🇼","malawi":"🇲🇼","uganda":"🇺🇬","rwanda":"🇷🇼","burundi":"🇧🇮","somalia":"🇸🇴","eritrea":"🇪🇷","sudan":"🇸🇩","chad":"🇹🇩","niger":"🇳🇪","mali":"🇲🇱","bhutan":"🇧🇹","nepal":"🇳🇵","india":"🇮🇳","china":"🇨🇳","taiwan":"🇹🇼","japan":"🇯🇵","canada":"🇨🇦","alaska":"🇺🇸","hawaii":"🇺🇸","mexico":"🇲🇽","guatemala":"🇬🇹","honduras":"🇭🇳","nicaragua":"🇳🇮","panama":"🇵🇦","jamaica":"🇯🇲","haiti":"🇭🇹","puerto rico":"🇵🇷","cuba":"🇨🇺","bolivia":"🇧🇴","paraguay":"🇵🇾","uruguay":"🇺🇾","argentina":"🇦🇷","venezuela":"🇻🇪","colombia":"🇨🇴","ecuador":"🇪🇨","peru":"🇵🇪","chile":"🇨🇱","brazil":"🇧🇷","iran":"🇮🇷","iraq":"🇮🇶","israel":"🇮🇱","lebanon":"🇱🇧","jordan":"🇯🇴","syria":"🇸🇾","yemen":"🇾🇪","oman":"🇴🇲",
    /* ✅ Complemento — cobertura mundial completa de bandeiras (PT + EN) */
    "filipinas":"🇵🇭","vietnã":"🇻🇳","tailândia":"🇹🇭","camboja":"🇰🇭","malásia":"🇲🇾","singapura":"🇸🇬","indonésia":"🇮🇩","ilhas salomão":"🇸🇧","solomon islands":"🇸🇧","vanuatu":"🇻🇺","nova caledônia":"🇳🇨","new caledonia":"🇳🇨","fiji":"🇫🇯","tonga":"🇹🇴","samoa":"🇼🇸","guam":"🇬🇺","austrália":"🇦🇺","irlanda":"🇮🇪","ireland":"🇮🇪","albânia":"🇦🇱","albania":"🇦🇱","montenegro":"🇲🇪","djibuti":"🇩🇯","djibouti":"🇩🇯","afeganistão":"🇦🇫","arábia saudita":"🇸🇦","saudi arabia":"🇸🇦","costa do marfim":"🇨🇮","ivory coast":"🇨🇮","república tcheca":"🇨🇿","catar":"🇶🇦","qatar":"🇶🇦","kuwait":"🇰🇼","bahrein":"🇧🇭","bahrain":"🇧🇭","chipre":"🇨🇾","cyprus":"🇨🇾","malta":"🇲🇹","luxemburgo":"🇱🇺","luxembourg":"🇱🇺","mônaco":"🇲🇨","monaco":"🇲🇨","andorra":"🇦🇩","liechtenstein":"🇱🇮","san marino":"🇸🇲","vaticano":"🇻🇦","vatican city":"🇻🇦","eslováquia":"🇸🇰","slovakia":"🇸🇰","eslovênia":"🇸🇮","slovenia":"🇸🇮","bósnia e herzegovina":"🇧🇦","bosnia and herzegovina":"🇧🇦","macedônia do norte":"🇲🇰","north macedonia":"🇲🇰","kosovo":"🇽🇰","belarus":"🇧🇾","moldávia":"🇲🇩","moldova":"🇲🇩","lituânia":"🇱🇹","lithuania":"🇱🇹","letônia":"🇱🇻","latvia":"🇱🇻","estônia":"🇪🇪","estonia":"🇪🇪","cabo verde":"🇨🇻","cape verde":"🇨🇻","guiné-bissau":"🇬🇼","guinea-bissau":"🇬🇼","gâmbia":"🇬🇲","gambia":"🇬🇲","serra leoa":"🇸🇱","sierra leone":"🇸🇱","libéria":"🇱🇷","liberia":"🇱🇷","togo":"🇹🇬","benin":"🇧🇯","camarões":"🇨🇲","cameroon":"🇨🇲","gabão":"🇬🇦","gabon":"🇬🇦","república do congo":"🇨🇬","republic of the congo":"🇨🇬","república democrática do congo":"🇨🇩","democratic republic of the congo":"🇨🇩","guiné equatorial":"🇬🇶","equatorial guinea":"🇬🇶","são tomé e príncipe":"🇸🇹","sao tome and principe":"🇸🇹","comores":"🇰🇲","comoros":"🇰🇲","seicheles":"🇸🇨","seychelles":"🇸🇨","maurício":"🇲🇺","mauritius":"🇲🇺","lesoto":"🇱🇸","lesotho":"🇱🇸","essuatíni":"🇸🇿","eswatini":"🇸🇿","eritreia":"🇪🇷","guiné":"🇬🇳","guinea":"🇬🇳","bahamas":"🇧🇸","barbados":"🇧🇧","trinidad e tobago":"🇹🇹","trinidad and tobago":"🇹🇹","granada":"🇬🇩","grenada":"🇬🇩","santa lúcia":"🇱🇨","saint lucia":"🇱🇨","dominica":"🇩🇲","antígua e barbuda":"🇦🇬","antigua and barbuda":"🇦🇬","são cristóvão e neves":"🇰🇳","saint kitts and nevis":"🇰🇳","são vicente e granadinas":"🇻🇨","saint vincent and the grenadines":"🇻🇨","belize":"🇧🇿","guiana":"🇬🇾","guyana":"🇬🇾","suriname":"🇸🇷","guiana francesa":"🇬🇫","french guiana":"🇬🇫","palau":"🇵🇼","micronésia":"🇫🇲","micronesia":"🇫🇲","ilhas marshall":"🇲🇭","marshall islands":"🇲🇭","kiribati":"🇰🇮","nauru":"🇳🇷","tuvalu":"🇹🇻","samoa americana":"🇦🇸","american samoa":"🇦🇸","ilhas cook":"🇨🇰","cook islands":"🇨🇰","polinésia francesa":"🇵🇫","french polynesia":"🇵🇫","brunei":"🇧🇳","timor-leste":"🇹🇱","east timor":"🇹🇱","emirados árabes":"🇦🇪",
    /* ── BANDEIRAS COMPLEMENTARES (edite/adicione aqui) ──────────
       Chave = nome em minúsculas como aparece no texto do evento.
       Valor = emoji da bandeira. Inclui PT e EN. */
    "trindade e tobago":"🇹🇹","trinidad and tobago":"🇹🇹","trinidad":"🇹🇹",
    "congo":"🇨🇬","republic of the congo":"🇨🇬","república do congo":"🇨🇬",
    "rd congo":"🇨🇩","rdc":"🇨🇩","drc":"🇨🇩","democratic republic of the congo":"🇨🇩","república democrática do congo":"🇨🇩","zaire":"🇨🇩",
    "eritréia":"🇪🇷","eritrea":"🇪🇷",
    "bielorrússia":"🇧🇾","belarus":"🇧🇾","bielorussia":"🇧🇾",
    "macedônia":"🇲🇰","macedonia":"🇲🇰","north macedonia":"🇲🇰","macedônia do norte":"🇲🇰",
    "bósnia":"🇧🇦","bosnia":"🇧🇦","bosnia and herzegovina":"🇧🇦","bósnia e herzegovina":"🇧🇦",
    "barein":"🇧🇭","bahrain":"🇧🇭","bareine":"🇧🇭",
    "mianmar":"🇲🇲","myanmar":"🇲🇲","birmânia":"🇲🇲","burma":"🇲🇲",
    "palestina":"🇵🇸","palestine":"🇵🇸","palestinian":"🇵🇸",
    "groenlândia":"🇬🇱","greenland":"🇬🇱",
    "antártida":"🇦🇶","antarctica":"🇦🇶","antarctic":"🇦🇶",
    "escócia":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    "país de gales":"🏴󠁧󠁢󠁷󠁬󠁳󠁿","wales":"🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    "inglaterra":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","england":"🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    "guiana francesa":"🇬🇫","french guiana":"🇬🇫",
    "nova caledônia":"🇳🇨","new caledonia":"🇳🇨",
    "polinésia francesa":"🇵🇫","french polynesia":"🇵🇫",
    "curação":"🇨🇼","curacao":"🇨🇼","curaçao":"🇨🇼",
    "aruba":"🇦🇼",
    "martinica":"🇲🇶","martinique":"🇲🇶",
    "guadalupe":"🇬🇵","guadeloupe":"🇬🇵",
    "reunião":"🇷🇪","reunion":"🇷🇪",
    "mayotte":"🇾🇹",
    "saara ocidental":"🇪🇭","western sahara":"🇪🇭",
    "somalilândia":"🇸🇴","somaliland":"🇸🇴",
    "transnístria":"🇲🇩",
    "abkházia":"🇬🇪","ossetia":"🇬🇪",
    "vaticano":"🇻🇦","vatican":"🇻🇦","holy see":"🇻🇦",
    "são marino":"🇸🇲","san marino":"🇸🇲",
    "liechtenstein":"🇱🇮",
    "andorra":"🇦🇩",
    "mônaco":"🇲🇨","monaco":"🇲🇨",
    "malta":"🇲🇹",
    "chipre":"🇨🇾","cyprus":"🇨🇾",
    "luxemburgo":"🇱🇺","luxembourg":"🇱🇺",
    "eslovênia":"🇸🇮","slovenia":"🇸🇮",
    "eslováquia":"🇸🇰","slovakia":"🇸🇰",
    "república tcheca":"🇨🇿","czech republic":"🇨🇿","czechia":"🇨🇿","tchéquia":"🇨🇿",
    "lituânia":"🇱🇹","lithuania":"🇱🇹",
    "letônia":"🇱🇻","latvia":"🇱🇻",
    "estônia":"🇪🇪","estonia":"🇪🇪",
    "moldávia":"🇲🇩","moldova":"🇲🇩",
    "albânia":"🇦🇱","albania":"🇦🇱",
    "montenegro":"🇲🇪",
    "kosovo":"🇽🇰",
    "irlanda":"🇮🇪","ireland":"🇮🇪","éire":"🇮🇪",
    "kuwait":"🇰🇼",
    "catar":"🇶🇦","qatar":"🇶🇦",
    "afeganistão":"🇦🇫","afghanistan":"🇦🇫",
    "timor-leste":"🇹🇱","east timor":"🇹🇱","timor leste":"🇹🇱",
    "brunei":"🇧🇳",
    "maldives":"🇲🇻","maldivas":"🇲🇻",
    "seicheles":"🇸🇨","seychelles":"🇸🇨",
    "maurício":"🇲🇺","mauritius":"🇲🇺",
    "comores":"🇰🇲","comoros":"🇰🇲",
    "cabo verde":"🇨🇻","cape verde":"🇨🇻",
    "são tomé e príncipe":"🇸🇹","sao tome and principe":"🇸🇹",
    "guiné":"🇬🇳","guinea":"🇬🇳",
    "guiné-bissau":"🇬🇼","guinea-bissau":"🇬🇼",
    "guiné equatorial":"🇬🇶","equatorial guinea":"🇬🇶",
    "serra leoa":"🇸🇱","sierra leone":"🇸🇱",
    "libéria":"🇱🇷","liberia":"🇱🇷",
    "costa do marfim":"🇨🇮","ivory coast":"🇨🇮","côte d'ivoire":"🇨🇮","cote d'ivoire":"🇨🇮",
    "togo":"🇹🇬",
    "benin":"🇧🇯","benim":"🇧🇯",
    "camarões":"🇨🇲","cameroon":"🇨🇲",
    "gabão":"🇬🇦","gabon":"🇬🇦",
    "djibuti":"🇩🇯","djibouti":"🇩🇯",
    "lesoto":"🇱🇸","lesotho":"🇱🇸",
    "essuatíni":"🇸🇿","eswatini":"🇸🇿","suazilândia":"🇸🇿","swaziland":"🇸🇿",
    "gâmbia":"🇬🇲","gambia":"🇬🇲",
    "fiji":"🇫🇯",
    "samoa":"🇼🇸",
    "tonga":"🇹🇴",
    "vanuatu":"🇻🇺",
    "kiribati":"🇰🇮",
    "tuvalu":"🇹🇻",
    "nauru":"🇳🇷",
    "palau":"🇵🇼",
    "micronésia":"🇫🇲","micronesia":"🇫🇲",
    "ilhas marshall":"🇲🇭","marshall islands":"🇲🇭",
    "ilhas salomão":"🇸🇧","solomon islands":"🇸🇧",
    "papua nova guiné":"🇵🇬","papua-nova guiné":"🇵🇬",
    "austrália":"🇦🇺","australia":"🇦🇺",
    "tailândia":"🇹🇭","thailand":"🇹🇭",
    "vietnã":"🇻🇳","vietnam":"🇻🇳","vietname":"🇻🇳",
    "camboja":"🇰🇭","cambodia":"🇰🇭",
    "malásia":"🇲🇾","malaysia":"🇲🇾",
    "singapura":"🇸🇬","singapore":"🇸🇬",
    "indonésia":"🇮🇩","indonesia":"🇮🇩",
    "filipinas":"🇵🇭","philippines":"🇵🇭",
    "laos":"🇱🇦",
    "bangladesh":"🇧🇩",
    "sri lanka":"🇱🇰",
    "butão":"🇧🇹","bhutan":"🇧🇹",
    "mongólia":"🇲🇳","mongolia":"🇲🇳",
    "arábia saudita":"🇸🇦","saudi arabia":"🇸🇦",
    "emirados árabes":"🇦🇪","uae":"🇦🇪",
    "guiana":"🇬🇾","guyana":"🇬🇾",
    "suriname":"🇸🇷","surinam":"🇸🇷",
    "belize":"🇧🇿",
    "bahamas":"🇧🇸",
    "barbados":"🇧🇧",
    "dominica":"🇩🇲",
    "granada":"🇬🇩","grenada":"🇬🇩",
    "santa lúcia":"🇱🇨","saint lucia":"🇱🇨",
    "são vicente e granadinas":"🇻🇨","saint vincent":"🇻🇨",
    "antígua e barbuda":"🇦🇬","antigua":"🇦🇬",
    "são cristóvão e nevis":"🇰🇳","saint kitts":"🇰🇳",
    "oceano":"🌊","ocean":"🌊","mar":"🌊","sea":"🌊",

};

/* ✅ Bandeira do Estado de São Paulo (não existe emoji unicode p/ bandeiras estaduais,
   então desenhamos um SVG fiel: 13 burelas preto/branco, cantão vermelho, círculo branco
   com o mapa do Brasil em azul e 4 estrelas amarelas nos cantos) para os alertas da Defesa Civil/SP */
const BANDEIRA_SP = (() => {
    const W = 300, H = 200, rows = 13, rowH = H / rows;
    let stripes = '';
    for (let i = 0; i < rows; i++) {
        stripes += `<rect x="0" y="${(i * rowH).toFixed(2)}" width="${W}" height="${(rowH + 0.5).toFixed(2)}" fill="${i % 2 === 0 ? '#111' : '#fff'}"/>`;
    }
    const cw = 128, ch = 96;
    const star = (cx, cy, r) => {
        let pts = [];
        for (let i = 0; i < 10; i++) {
            const ang = Math.PI / 2 + i * Math.PI / 5;
            const rad = i % 2 === 0 ? r : r * 0.42;
            pts.push(`${(cx + rad * Math.cos(ang)).toFixed(1)},${(cy - rad * Math.sin(ang)).toFixed(1)}`);
        }
        return `<polygon points="${pts.join(' ')}" fill="#fedb00" stroke="#00000022" stroke-width="0.5"/>`;
    };
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="height:1em;width:auto;vertical-align:-0.15em;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.15)">
        <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
        ${stripes}
        <rect x="0" y="0" width="${cw}" height="${ch}" fill="#c8102e"/>
        <circle cx="${cw / 2}" cy="${ch / 2}" r="34" fill="#fff"/>
        <path d="M 45 38 Q 55 22 78 28 Q 92 34 88 52 Q 82 70 62 68 Q 44 66 45 38 Z" fill="#0047ab"/>
        ${star(14, 12, 9)}${star(cw - 14, 12, 9)}${star(14, ch - 12, 9)}${star(cw - 14, ch - 12, 9)}
    </svg>`;
})();

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function traduzirEIdentificar(t0) {
    // Texto de local vazio não significa "é oceano" — só significa que essa fonte
    // não preencheu o campo. Devolver bandeira vazia (igual ao fallback de texto
    // sem país reconhecido, logo abaixo) deixa o chamador cair no
    // getFlagByCoords(lat, lon), que acha o país de verdade pelas coordenadas.
    // Antes, "🌊" aqui era truthy e vencia o `info.bandeira || getFlagByCoords(...)`
    // dos chamadores, então um sismo perto do Equador sem texto de local virava
    // "Oceano Global" mesmo estando em terra/costa conhecida.
    if (!t0) return { nome: "", bandeira: "", pais: "" };
    let out = t0, pais = "";
    const txt = t0.toLowerCase();
    for (const [e, p] of Object.entries(traducoesLocais)) {
        if (txt.includes(e)) { out = t0.replace(new RegExp(e, 'gi'), p); break; }
    }
    const low = out.toLowerCase();
    // Ordena chaves por tamanho (maior primeiro) para "coreia do sul" vencer "coreia"
    const keys = Object.keys(dicionarioBandeiras).sort((a, b) => b.length - a.length);
    for (const p of keys) {
        if (low.includes(p)) {
            pais = p[0].toUpperCase() + p.slice(1);
            return { nome: out, bandeira: dicionarioBandeiras[p], pais };
        }
    }
    return { nome: out, bandeira: "", pais: "" };
}

function getCountryByCoords(lat, lng) {
    let mp = null, md = Infinity;
    PAISES_COSTEIROS.forEach(p => {
        const d = haversine(lat, lng, p.lat, p.lng);
        if (d < md) { md = d; mp = p; }
    });
    if (mp) return { nome: mp.n[0].toUpperCase() + mp.n.slice(1), flag: dicionarioBandeiras[mp.n] || '' };

    let mc = null, mcd = Infinity;
    CIDADES_MUNDO.forEach(c => {
        const d = haversine(lat, lng, c.lat, c.lng);
        if (d < mcd) { mcd = d; mc = c; }
    });
    if (mc) return { nome: mc.pais[0].toUpperCase() + mc.pais.slice(1), flag: dicionarioBandeiras[mc.pais.toLowerCase()] || '' };
    return { nome: '', flag: '🌐' };
}

function getFlagByCoords(lat, lng) { return getCountryByCoords(lat, lng).flag; }

function getCycloneMeta(lng, lat) {
    let l = lng;
    while (l > 180) l -= 360;
    while (l < -180) l += 360;
    const sul = (lat != null && lat < 0);
    // Bacia + nome regional (Furacão / Tufão / Ciclone) — não usar bandeira de país
    if (sul && l >= 90 && l < 160) return { label: 'Ciclone', basin: 'S Oeste', basinEmoji: '🌀' };
    if (sul && l >= 160 || (sul && l < -120)) return { label: 'Ciclone', basin: 'S Pacífico', basinEmoji: '🌀' };
    if (sul && l >= 20 && l < 90) return { label: 'Ciclone', basin: 'Índico S', basinEmoji: '🌀' };
    if (sul && l < -30 && l > -80) return { label: 'Ciclone', basin: 'Atlântico S', basinEmoji: '🌀' };
    if (l >= 100 && l <= 180) return { label: 'Tufão', basin: 'Pacífico Oeste', basinEmoji: '🌀' };
    if (l > -180 && l < -140) return { label: 'Furacão', basin: 'Pacífico Central', basinEmoji: '🌀' };
    if (l >= -140 && l < -80) return { label: 'Furacão', basin: 'Pacífico Leste', basinEmoji: '🌀' };
    if (l >= 40 && l < 100) return { label: 'Ciclone', basin: 'Índico N', basinEmoji: '🌀' };
    return { label: 'Furacão', basin: 'Atlântico', basinEmoji: '🌀' };
}

/** Rótulo curto na lista: DT / TT / Cat.1… conforme vento ou código NHC */
function rotuloCicloneCurto(item) {
    if (!item) return 'Ciclone';
    const cls = String(item.classification || '').toUpperCase();
    const mapCls = {
        TD: 'Depressão', TS: 'T. Tropical', STS: 'T. Tropical',
        HU: null, TY: null, STY: 'Super Tufão', TC: null
    };
    let wind = item.windKmh;
    if (wind == null) wind = extractWindKmh(item.detail || item.place || '');
    const classif = classificarCiclone(wind);
    // NHC HU sem vento ainda: Furacão genérico da bacia
    if (cls === 'TD') return 'Depressão';
    if (cls === 'TS' || cls === 'STS') return 'T. Tropical';
    if (cls === 'STY') return 'Super Tufão';
    if (wind != null) {
        if (wind < 63) return 'Depressão';
        if (wind < 118) return 'T. Tropical';
        // A partir de furacão: Cat. N
        const m = /Categoria (\d)/.exec(classif.cat);
        if (m) return 'Cat. ' + m[1];
        return classif.cat;
    }
    if (cls === 'HU' || cls === 'TY') {
        const cyc = item.coords ? getCycloneMeta(item.coords[0], item.coords[1]) : { label: 'Furacão' };
        return cyc.label;
    }
    // Fallback: se o nome diz Tropical Storm
    const t = String(item.place || '');
    if (/tropical\s*storm|tempestade tropical/i.test(t)) return 'T. Tropical';
    if (/tropical\s*depression|depress/i.test(t)) return 'Depressão';
    if (/hurricane|furac/i.test(t)) return (item.coords ? getCycloneMeta(item.coords[0], item.coords[1]).label : 'Furacão');
    if (/typhoon|tuf/i.test(t)) return 'Tufão';
    return item.cycloneLabel || 'Ciclone';
}

function nomeCicloneLimpo(place) {
    return String(place || '')
        .replace(/^(Tropical\s+Storm|Tropical\s+Depression|Hurricane|Typhoon|Cyclone|Furac[aã]o|Tuf[aã]o|Ciclone)\s+/i, '')
        .replace(/-\d{2}$/,'')
        .trim() || place;
}

function detalheCicloneLista(item) {
    const parts = [];
    const wind = item.windKmh != null ? item.windKmh : extractWindKmh(item.detail || '');
    if (wind != null) parts.push(wind + ' km/h');
    if (item.pressureMb != null) parts.push(item.pressureMb + ' hPa');
    if (item.basin) parts.push(item.basin);
    else if (item.coords) {
        const m = getCycloneMeta(item.coords[0], item.coords[1]);
        if (m.basin) parts.push(m.basin);
    }
    if (item.movementInfo && item.movementInfo.compass) parts.push('Mov ' + item.movementInfo.compass);
    parts.push(item.source || '');
    return parts.filter(Boolean).join(' · ');
}

// Extrai velocidade máxima do vento (km/h) de textos como
// "Hurricane/Typhoon > 74 mph (maximum wind speed of 269 km/h)" (comum no GDACS/EONET)
function extractWindKmh(texto) {
    if (!texto) return null;
    const m = /(\d+(?:\.\d+)?)\s*km\/h/i.exec(texto);
    return m ? Math.round(parseFloat(m[1])) : null;
}

// Classificação por velocidade do vento (limiares padrão em km/h, escala Saffir-Simpson
// adaptada + depressão/tempestade tropical)
function classificarCiclone(kmh) {
    if (kmh == null) return { cat: 'Não determinado', cor: '#94a3b8' };
    if (kmh < 63) return { cat: 'Depressão Tropical', cor: '#38bdf8' };
    if (kmh < 118) return { cat: 'Tempestade Tropical', cor: '#22c55e' };
    if (kmh < 154) return { cat: 'Categoria 1', cor: '#facc15' };
    if (kmh < 178) return { cat: 'Categoria 2', cor: '#f97316' };
    if (kmh < 209) return { cat: 'Categoria 3', cor: '#ef4444' };
    if (kmh < 252) return { cat: 'Categoria 4', cor: '#dc2626' };
    return { cat: 'Categoria 5', cor: '#a21caf' };
}

function bearingBetween(a, b) {
    const r = x => x * Math.PI / 180;
    const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat));
    const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function compassLabel(b) {
    return ['N','NE','L','SE','S','SO','O','NO'][Math.round(b / 45) % 8];
}

function destinoGeo(lat, lng, bearingDeg, distKm) {
    const R = 6371;
    const brg = bearingDeg * Math.PI / 180;
    const lat1 = lat * Math.PI / 180, lng1 = lng * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distKm / R) + Math.cos(lat1) * Math.sin(distKm / R) * Math.cos(brg));
    const lng2 = lng1 + Math.atan2(Math.sin(brg) * Math.sin(distKm / R) * Math.cos(lat1), Math.cos(distKm / R) - Math.sin(lat1) * Math.sin(lat2));
    return [lng2 * 180 / Math.PI, lat2 * 180 / Math.PI];
}

// Cone ESTIMADO a partir da direção recente do sistema — não é o cone oficial de
// previsão (NHC/JTWC), que usa modelos numéricos que não temos acesso aqui.
// Alarga com a distância só pra dar noção visual de incerteza crescente.
function cycloneConePolygon(lng, lat, bearingDeg) {
    const distancias = [0, 100, 250, 450, 700];
    const meiaLargura = [15, 40, 75, 115, 160];
    const esquerda = [], direita = [];
    for (let i = 0; i < distancias.length; i++) {
        const centro = destinoGeo(lat, lng, bearingDeg, distancias[i]);
        esquerda.push(destinoGeo(centro[1], centro[0], bearingDeg - 90, meiaLargura[i]));
        direita.push(destinoGeo(centro[1], centro[0], bearingDeg + 90, meiaLargura[i]));
    }
    const coords = [...esquerda, ...direita.reverse(), esquerda[0]];
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

function getPaisesAfetadosTsunami(lat, lng, raio = 2000, max = 8) {
    return PAISES_COSTEIROS
        .map(p => ({ ...p, dist: haversine(lat, lng, p.lat, p.lng) }))
        .filter(p => p.dist <= raio)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, max)
        .map(p => ({ nome: p.n[0].toUpperCase() + p.n.slice(1), dist: Math.round(p.dist), flag: dicionarioBandeiras[p.n] || '' }));
}

async function buscarTrilhaGDACS(gid) {
    try {
        const r = await fetchWithCorsFallback(`https://www.gdacs.org/gdacsapi/api/events/geteventdata/TC/${gid}`);
        const d = await r.json();
        let pts = [];
        const collect = (g) => {
            if (!g) return;
            if (g.type === 'LineString' && Array.isArray(g.coordinates)) pts = pts.concat(g.coordinates.map(c => ({ lng: c[0], lat: c[1] })));
            else if (g.type === 'MultiPoint' && Array.isArray(g.coordinates)) pts = pts.concat(g.coordinates.map(c => ({ lng: c[0], lat: c[1] })));
            else if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) g.coordinates.forEach(l => pts = pts.concat(l.map(c => ({ lng: c[0], lat: c[1] }))));
            else if (g.type === 'Point' && Array.isArray(g.coordinates)) pts.push({ lng: g.coordinates[0], lat: g.coordinates[1] });
        };
        if (d && d.geometry) collect(d.geometry);
        (d.features || []).forEach(f => collect(f.geometry));
        if (Array.isArray(d.episodes)) d.episodes.forEach(ep => collect(ep && ep.geometry));
        if (pts.length >= 2) {
            const a = pts[pts.length - 2], b = pts[pts.length - 1];
            if (haversine(a.lat, a.lng, b.lat, b.lng) > 2) return bearingBetween(a, b);
        }
        return null;
    } catch (e) { return null; }
}

function atualizarDirecaoPainel(obj) {
    if (eventoSelecionadoId !== obj.id || !obj.movementInfo) return;
    const el = document.getElementById('pd-cities');
    const tit = document.getElementById('pd-cities-title');
    if (el && tit && tit.textContent.includes('Direção')) {
        el.insertAdjacentHTML('afterbegin', `<div class="city-item"><span class="city-name">➤ Direção recente: ${obj.movementInfo.compass} (${Math.round(obj.movementInfo.bearing)}°)</span></div>`);
    }
}

function calcularMecanismoFocal(depth, lat, lng, place) {
    const n = place.toLowerCase();
    if (n.includes("califórnia") || n.includes("san andreas") || n.includes("turquia") || n.includes("caribe")) {
        return { tipo: "Lateral (Transcorrência)", desc: "As placas deslizaram horizontalmente.", emoji: '↔️' };
    }
    if (depth > 70) return { tipo: "Inversa (Para Cima)", desc: "Ação compressiva extrema.", emoji: '⬆️' };
    if (n.includes("islândia") || n.includes("ocean")) return { tipo: "Normal (Para Baixo)", desc: "Força de extensão.", emoji: '⬇️' };
    return { tipo: "Não determinado (estimativa)", desc: "Sem dados suficientes.", emoji: '❓' };
}

async function buscarMecanismoFocalReal(item) {
    if (!item.detailUrl || item.source !== 'USGS' || item.mag < 4.5) return null;
    try {
        const r = await fetch(item.detailUrl);
        if (!r.ok) return null;
        const d = await r.json();
        const pr = d.properties && d.properties.products;
        if (!pr) return null;
        const l = pr['moment-tensor'] || pr['focal-mechanism'];
        if (!l || !l.length) return null;
        const rake = parseFloat(l[0].properties['nodal-plane-1-rake']);
        if (isNaN(rake)) return null;
        if (rake >= 45 && rake <= 135) return { tipo: "Inversa (Para Cima)", emoji: '⬆️', desc: `Dado real: rake ${rake.toFixed(0)}°.`, real: true };
        if (rake <= -45 && rake >= -135) return { tipo: "Normal (Para Baixo)", emoji: '⬇️', desc: `Dado real: rake ${rake.toFixed(0)}°.`, real: true };
        return { tipo: "Lateral (Transcorrência)", emoji: '↔️', desc: `Dado real: rake ${rake.toFixed(0)}°.`, real: true };
    } catch (e) { return null; }
}

/* ============================ FUNÇÕES AUXILIARES ============================ */
function getEnergyLevel(m) { return Math.min(10, Math.max(1, Math.round(((m - 2) / 7) * 10))); }
function getMagColorClass(m) { if (m >= 6) return 'c-high'; if (m >= 5) return 'c-orange'; if (m >= 4) return 'c-med'; return 'c-low'; }
function formatBrasiliaDateTime(t) {
    return new Date(t).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    }) + " BRT";
}
function getHexColor(m) { if (m >= 6) return '#ef4444'; if (m >= 5) return '#fb923c'; if (m >= 4) return '#facc15'; return '#4ade80'; }
function formatTime(t) {
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 0) return `${Math.floor(-m / 60)>0?Math.floor(-m/60)+'h':(-m)+'m'} (data suspeita)`;
    if (m < 1) return 'Agora mesmo';
    if (m < 60) return `${m}m atrás`;
    return `${Math.floor(m / 60)}h atrás`;
}
function haversine(a, b, c, d) {
    const R = 6371, dLa = (c - a) * Math.PI / 180, dLo = (d - b) * Math.PI / 180;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
// Calcula o zoom necessário pra caber um círculo de raioKm de raio dentro da tela atual,
// ocupando no máximo `margem` da menor dimensão do viewport (deixa borda de sobra).
// Usado pra garantir que o anel tracejado "detectável" não fique cortado ao focar num sismo.
function calcZoomParaAlcance(lat, raioKm, margem = 0.8) {
    try {
        if (!map) return 6;
        const cont = map.getContainer();
        const dim = Math.min(cont.clientWidth, cont.clientHeight);
        if (!dim || !raioKm) return 6;
        const diametroMetros = raioKm * 1000 * 2;
        const pxDesejados = dim * margem;
        const mppNecessario = diametroMetros / pxDesejados;
        const z = Math.log2(156543.03392 * Math.cos(lat * Math.PI / 180) / mppNecessario);
        return z;
    } catch (e) { return 6; }
}
function formatarPopulacao(p) {
    if (p >= 1e6) return (p / 1e6).toFixed(1) + "M hab";
    if (p >= 1e3) return Math.round(p / 1e3) + "k hab";
    return p + " hab";
}
