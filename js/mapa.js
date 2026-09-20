// === mapa.js — Inicialização do mapa, globo 3D, marcadores, radar contínuo (PARTE 2 original) (linhas originais 1307-1878 do core-app.js) ===


const CIDADES_MUNDO = [
    {nome:"São Paulo",lat:-23.55,lng:-46.63,pop:22400000,pais:"brasil"},{nome:"São Caetano do Sul",lat:-23.6229,lng:-46.5548,pop:161127,pais:"brasil"},{nome:"Guarulhos",lat:-23.4538,lng:-46.5333,pop:1291784,pais:"brasil"},{nome:"Diadema",lat:-23.6813,lng:-46.6205,pop:393237,pais:"brasil"},{nome:"Osasco",lat:-23.5324,lng:-46.7916,pop:728615,pais:"brasil"},{nome:"Santo André",lat:-23.6737,lng:-46.5432,pop:748919,pais:"brasil"},{nome:"Rio de Janeiro",lat:-22.91,lng:-43.17,pop:13700000,pais:"brasil"},{nome:"Brasília",lat:-15.79,lng:-47.88,pop:4700000,pais:"brasil"},{nome:"Salvador",lat:-12.97,lng:-38.5,pop:2900000,pais:"brasil"},{nome:"Recife",lat:-8.05,lng:-34.9,pop:1650000,pais:"brasil"},{nome:"Fortaleza",lat:-3.72,lng:-38.54,pop:2700000,pais:"brasil"},{nome:"Belo Horizonte",lat:-19.92,lng:-43.94,pop:2500000,pais:"brasil"},{nome:"Curitiba",lat:-25.43,lng:-49.27,pop:1960000,pais:"brasil"},{nome:"Porto Alegre",lat:-30.03,lng:-51.23,pop:1490000,pais:"brasil"},{nome:"Manaus",lat:-3.1,lng:-60.02,pop:2200000,pais:"brasil"},{nome:"Belém",lat:-1.45,lng:-48.49,pop:1500000,pais:"brasil"},{nome:"Goiânia",lat:-16.68,lng:-49.25,pop:1540000,pais:"brasil"},{nome:"Campinas",lat:-22.9,lng:-47.06,pop:1220000,pais:"brasil"},{nome:"Santos",lat:-23.96,lng:-46.33,pop:433000,pais:"brasil"},{nome:"Florianópolis",lat:-27.6,lng:-48.55,pop:508000,pais:"brasil"},{nome:"Vitória",lat:-20.32,lng:-40.34,pop:366000,pais:"brasil"},{nome:"Natal",lat:-5.79,lng:-35.21,pop:890000,pais:"brasil"},{nome:"Maceió",lat:-9.66,lng:-35.73,pop:1025000,pais:"brasil"},
    {nome:"Buenos Aires",lat:-34.6,lng:-58.4,pop:3000000,pais:"argentina"},{nome:"Córdoba",lat:-31.42,lng:-64.18,pop:1390000,pais:"argentina"},{nome:"Montevidéu",lat:-34.9,lng:-56.17,pop:1380000,pais:"uruguai"},{nome:"Santiago",lat:-33.45,lng:-70.66,pop:6200000,pais:"chile"},{nome:"Valparaíso",lat:-33.05,lng:-71.62,pop:900000,pais:"chile"},{nome:"Lima",lat:-12.05,lng:-77.04,pop:11000000,pais:"peru"},{nome:"Arequipa",lat:-16.41,lng:-71.54,pop:1000000,pais:"peru"},{nome:"La Paz",lat:-16.5,lng:-68.15,pop:1900000,pais:"bolívia"},{nome:"Santa Cruz",lat:-17.78,lng:-63.2,pop:1500000,pais:"bolívia"},{nome:"Caracas",lat:10.48,lng:-66.9,pop:2900000,pais:"venezuela"},{nome:"Bogotá",lat:4.71,lng:-74.07,pop:7900000,pais:"colômbia"},{nome:"Medellín",lat:6.24,lng:-75.58,pop:2500000,pais:"colômbia"},{nome:"Quito",lat:-0.18,lng:-78.47,pop:1600000,pais:"equador"},{nome:"Guayaquil",lat:-2.19,lng:-79.89,pop:2700000,pais:"equador"},{nome:"Assunção",lat:-25.28,lng:-57.3,pop:525000,pais:"paraguai"},
    {nome:"Cidade do Panamá",lat:8.98,lng:-79.52,pop:880000,pais:"panamá"},{nome:"San José",lat:9.93,lng:-84.08,pop:288000,pais:"costa rica"},{nome:"Manágua",lat:12.13,lng:-86.25,pop:1050000,pais:"nicarágua"},{nome:"Tegucigalpa",lat:14.07,lng:-87.19,pop:1160000,pais:"honduras"},{nome:"San Salvador",lat:13.69,lng:-89.19,pop:1100000,pais:"el salvador"},{nome:"Cidade da Guatemala",lat:14.63,lng:-90.51,pop:2900000,pais:"guatemala"},{nome:"Havana",lat:23.11,lng:-82.37,pop:2130000,pais:"cuba"},{nome:"Kingston",lat:17.97,lng:-76.79,pop:580000,pais:"jamaica"},{nome:"Porto Príncipe",lat:18.54,lng:-72.34,pop:980000,pais:"haiti"},{nome:"Santo Domingo",lat:18.48,lng:-69.93,pop:965000,pais:"república dominicana"},{nome:"San Juan",lat:18.47,lng:-66.11,pop:342000,pais:"porto rico"},
    {nome:"Cidade do México",lat:19.43,lng:-99.13,pop:22100000,pais:"méxico"},{nome:"Guadalajara",lat:20.67,lng:-103.35,pop:5200000,pais:"méxico"},{nome:"Monterrey",lat:25.67,lng:-100.31,pop:5300000,pais:"méxico"},{nome:"Houston",lat:29.76,lng:-95.37,pop:6300000,pais:"estados unidos"},{nome:"Dallas",lat:32.78,lng:-96.8,pop:1300000,pais:"estados unidos"},{nome:"Nova Orleans",lat:29.95,lng:-90.07,pop:390000,pais:"estados unidos"},{nome:"Miami",lat:25.76,lng:-80.19,pop:6100000,pais:"estados unidos"},{nome:"Orlando",lat:28.54,lng:-81.38,pop:307000,pais:"estados unidos"},{nome:"Atlanta",lat:33.75,lng:-84.39,pop:6100000,pais:"estados unidos"},{nome:"Washington",lat:38.91,lng:-77.04,pop:6300000,pais:"estados unidos"},{nome:"Filadélfia",lat:39.95,lng:-75.17,pop:1600000,pais:"estados unidos"},{nome:"Nova York",lat:40.71,lng:-74.01,pop:18800000,pais:"estados unidos"},{nome:"Boston",lat:42.36,lng:-71.06,pop:4900000,pais:"estados unidos"},{nome:"Chicago",lat:41.88,lng:-87.63,pop:9500000,pais:"estados unidos"},{nome:"Detroit",lat:42.33,lng:-83.05,pop:3800000,pais:"estados unidos"},{nome:"Toronto",lat:43.65,lng:-79.38,pop:6200000,pais:"canadá"},{nome:"Ottawa",lat:45.42,lng:-75.7,pop:990000,pais:"canadá"},{nome:"Montreal",lat:45.5,lng:-73.57,pop:1780000,pais:"canadá"},{nome:"Vancouver",lat:49.28,lng:-123.12,pop:2460000,pais:"canadá"},{nome:"Seattle",lat:47.61,lng:-122.33,pop:4000000,pais:"estados unidos"},{nome:"Portland",lat:45.52,lng:-122.68,pop:2500000,pais:"estados unidos"},{nome:"San Francisco",lat:37.77,lng:-122.42,pop:3300000,pais:"estados unidos"},{nome:"Los Angeles",lat:34.05,lng:-118.24,pop:13200000,pais:"estados unidos"},{nome:"San Diego",lat:32.72,lng:-117.16,pop:1400000,pais:"estados unidos"},{nome:"Las Vegas",lat:36.17,lng:-115.14,pop:2300000,pais:"estados unidos"},{nome:"Phoenix",lat:33.45,lng:-112.07,pop:4900000,pais:"estados unidos"},{nome:"Denver",lat:39.74,lng:-104.99,pop:2960000,pais:"estados unidos"},{nome:"Anchorage",lat:61.19,lng:-149.9,pop:291000,pais:"alasca"},{nome:"Honolulu",lat:21.31,lng:-157.86,pop:345000,pais:"havaí"},
    {nome:"Reykjavik",lat:64.15,lng:-21.94,pop:131000,pais:"islândia"},{nome:"Dublin",lat:53.35,lng:-6.26,pop:1170000,pais:"irlanda"},{nome:"Londres",lat:51.51,lng:-0.13,pop:9500000,pais:"reino unido"},{nome:"Paris",lat:48.85,lng:2.35,pop:11000000,pais:"frança"},{nome:"Madrid",lat:40.42,lng:-3.7,pop:6700000,pais:"espanha"},{nome:"Barcelona",lat:41.39,lng:2.17,pop:5600000,pais:"espanha"},{nome:"Lisboa",lat:38.72,lng:-9.14,pop:2800000,pais:"portugal"},{nome:"Roma",lat:41.9,lng:12.5,pop:4300000,pais:"itália"},{nome:"Milão",lat:45.46,lng:9.19,pop:3100000,pais:"itália"},{nome:"Nápoles",lat:40.85,lng:14.27,pop:2200000,pais:"itália"},{nome:"Atenas",lat:37.98,lng:23.73,pop:3150000,pais:"grécia"},{nome:"Salonica",lat:40.64,lng:22.94,pop:1100000,pais:"grécia"},{nome:"Istambul",lat:41.01,lng:28.98,pop:15500000,pais:"turquia"},{nome:"Ancara",lat:39.93,lng:32.86,pop:5700000,pais:"turquia"},{nome:"Esmirna",lat:38.42,lng:27.13,pop:4400000,pais:"turquia"},{nome:"Berlim",lat:52.52,lng:13.4,pop:3600000,pais:"alemanha"},{nome:"Munique",lat:48.14,lng:11.58,pop:1500000,pais:"alemanha"},{nome:"Viena",lat:48.21,lng:16.37,pop:1900000,pais:"áustria"},{nome:"Praga",lat:50.09,lng:14.44,pop:1300000,pais:"república tcheca"},{nome:"Varsóvia",lat:52.23,lng:21.01,pop:1800000,pais:"polônia"},{nome:"Budapeste",lat:47.5,lng:19.04,pop:1750000,pais:"hungria"},{nome:"Bucareste",lat:44.43,lng:26.1,pop:1830000,pais:"romênia"},{nome:"Sófia",lat:42.7,lng:23.32,pop:1240000,pais:"bulgária"},{nome:"Belgrado",lat:44.82,lng:20.46,pop:1680000,pais:"sérvia"},{nome:"Zagreb",lat:45.81,lng:15.98,pop:800000,pais:"croácia"},{nome:"Moscou",lat:55.75,lng:37.62,pop:12600000,pais:"rússia"},{nome:"São Petersburgo",lat:59.93,lng:30.34,pop:5400000,pais:"rússia"},{nome:"Kiev",lat:50.45,lng:30.52,pop:2960000,pais:"ucrânia"},{nome:"Helsinque",lat:60.17,lng:24.94,pop:650000,pais:"finlândia"},{nome:"Estocolmo",lat:59.33,lng:18.07,pop:975000,pais:"suécia"},{nome:"Oslo",lat:59.91,lng:10.75,pop:700000,pais:"noruega"},{nome:"Copenhague",lat:55.68,lng:12.57,pop:1350000,pais:"dinamarca"},{nome:"Amsterdã",lat:52.37,lng:4.9,pop:1150000,pais:"holanda"},{nome:"Bruxelas",lat:50.85,lng:4.35,pop:1200000,pais:"bélgica"},{nome:"Zurique",lat:47.37,lng:8.54,pop:430000,pais:"suíça"},
    {nome:"Cairo",lat:30.04,lng:31.24,pop:20900000,pais:"egito"},{nome:"Alexandria",lat:31.2,lng:29.92,pop:5200000,pais:"egito"},{nome:"Túnis",lat:36.8,lng:10.18,pop:1050000,pais:"tunísia"},{nome:"Argel",lat:36.75,lng:3.06,pop:2800000,pais:"argélia"},{nome:"Rabat",lat:34.02,lng:-6.84,pop:580000,pais:"marrocos"},{nome:"Casablanca",lat:33.57,lng:-7.59,pop:3350000,pais:"marrocos"},{nome:"Dacar",lat:14.72,lng:-17.47,pop:1150000,pais:"senegal"},{nome:"Abidjan",lat:5.36,lng:-4.03,pop:4900000,pais:"costa do marfim"},{nome:"Acra",lat:5.6,lng:-0.19,pop:2500000,pais:"gana"},{nome:"Lagos",lat:6.52,lng:3.38,pop:15400000,pais:"nigéria"},{nome:"Luanda",lat:-8.84,lng:13.23,pop:8300000,pais:"angola"},{nome:"Nairóbi",lat:-1.29,lng:36.82,pop:4400000,pais:"quênia"},{nome:"Adis Abeba",lat:9.02,lng:38.75,pop:3400000,pais:"etiópia"},{nome:"Dar es Salaam",lat:-6.79,lng:39.28,pop:6700000,pais:"tanzânia"},{nome:"Maputo",lat:-25.97,lng:32.58,pop:1100000,pais:"moçambique"},{nome:"Joanesburgo",lat:-26.2,lng:28.05,pop:5600000,pais:"áfrica do sul"},{nome:"Cidade do Cabo",lat:-33.92,lng:18.42,pop:4600000,pais:"áfrica do sul"},{nome:"Durban",lat:-29.86,lng:31.02,pop:3440000,pais:"áfrica do sul"},{nome:"Lusaka",lat:-15.4,lng:28.3,pop:2500000,pais:"zâmbia"},{nome:"Windhoek",lat:-22.57,lng:17.08,pop:480000,pais:"namíbia"},{nome:"Harare",lat:-17.83,lng:31.05,pop:2100000,pais:"zimbábue"},{nome:"Gaborone",lat:-24.65,lng:25.91,pop:240000,pais:"botsuana"},
    {nome:"Tel Aviv",lat:32.08,lng:34.78,pop:460000,pais:"israel"},{nome:"Beirute",lat:33.89,lng:35.5,pop:2400000,pais:"líbano"},{nome:"Damasco",lat:33.51,lng:36.29,pop:2300000,pais:"síria"},{nome:"Amã",lat:31.95,lng:35.93,pop:4000000,pais:"jordânia"},{nome:"Bagdá",lat:33.31,lng:44.36,pop:8800000,pais:"iraque"},{nome:"Teerã",lat:35.7,lng:51.4,pop:9000000,pais:"irã"},{nome:"Riade",lat:24.7,lng:46.7,pop:7000000,pais:"arábia saudita"},{nome:"Jedá",lat:21.49,lng:39.19,pop:4700000,pais:"arábia saudita"},{nome:"Dubai",lat:25.2,lng:55.27,pop:3500000,pais:"emirados árabes unidos"},{nome:"Mascate",lat:23.59,lng:58.54,pop:1560000,pais:"omã"},{nome:"Cabul",lat:34.53,lng:69.17,pop:4600000,pais:"afeganistão"},{nome:"Islamabad",lat:33.69,lng:73.06,pop:1100000,pais:"paquistão"},{nome:"Karachi",lat:24.86,lng:67.0,pop:16100000,pais:"paquistão"},{nome:"Nova Délhi",lat:28.6,lng:77.2,pop:31000000,pais:"índia"},{nome:"Mumbai",lat:19.08,lng:72.88,pop:20400000,pais:"índia"},{nome:"Calcutá",lat:22.57,lng:88.36,pop:14900000,pais:"índia"},{nome:"Chennai",lat:13.08,lng:80.27,pop:10900000,pais:"índia"},{nome:"Bangalore",lat:12.97,lng:77.59,pop:12300000,pais:"índia"},{nome:"Daca",lat:23.81,lng:90.41,pop:22500000,pais:"bangladesh"},{nome:"Colombo",lat:6.93,lng:79.85,pop:750000,pais:"sri lanka"},{nome:"Catmandu",lat:27.7,lng:85.32,pop:845000,pais:"nepal"},
    {nome:"Bangkok",lat:13.76,lng:100.5,pop:10500000,pais:"tailândia"},{nome:"Hanói",lat:21.03,lng:105.85,pop:8000000,pais:"vietnã"},{nome:"Ho Chi Minh",lat:10.82,lng:106.63,pop:9000000,pais:"vietnã"},{nome:"Phnom Penh",lat:11.56,lng:104.92,pop:2100000,pais:"camboja"},{nome:"Kuala Lumpur",lat:3.14,lng:101.69,pop:8000000,pais:"malásia"},{nome:"Singapura",lat:1.35,lng:103.82,pop:5600000,pais:"singapura"},{nome:"Jacarta",lat:-6.21,lng:106.85,pop:10600000,pais:"indonésia"},{nome:"Surabaya",lat:-7.25,lng:112.75,pop:2900000,pais:"indonésia"},{nome:"Manila",lat:14.6,lng:120.98,pop:14400000,pais:"filipinas"},{nome:"Taipei",lat:25.03,lng:121.57,pop:2650000,pais:"taiwan"},{nome:"Hong Kong",lat:22.32,lng:114.17,pop:7500000,pais:"china"},{nome:"Xangai",lat:31.23,lng:121.47,pop:27000000,pais:"china"},{nome:"Pequim",lat:39.9,lng:116.4,pop:21500000,pais:"china"},{nome:"Seul",lat:37.57,lng:126.98,pop:9700000,pais:"coreia do sul"},{nome:"Busan",lat:35.18,lng:129.08,pop:3400000,pais:"coreia do sul"},{nome:"Pyongyang",lat:39.02,lng:125.75,pop:3200000,pais:"coreia do norte"},{nome:"Osaka",lat:34.69,lng:135.5,pop:2700000,pais:"japão"},{nome:"Tóquio",lat:35.68,lng:139.69,pop:37400000,pais:"japão"},{nome:"Nagoia",lat:35.18,lng:136.91,pop:2300000,pais:"japão"},{nome:"Sapporo",lat:43.06,lng:141.35,pop:1950000,pais:"japão"},{nome:"Fukuoka",lat:33.59,lng:130.4,pop:1600000,pais:"japão"},{nome:"Kumamoto",lat:32.8,lng:130.7,pop:740000,pais:"japão"},{nome:"Ulaanbaatar",lat:47.92,lng:106.91,pop:1500000,pais:"mongólia"},{nome:"Astana",lat:51.17,lng:71.43,pop:1140000,pais:"cazaquistão"},{nome:"Tashkent",lat:41.3,lng:69.24,pop:2500000,pais:"uzbequistão"},{nome:"Baku",lat:40.41,lng:49.87,pop:2300000,pais:"azerbaijão"},{nome:"Tbilisi",lat:41.72,lng:44.79,pop:1150000,pais:"geórgia"},{nome:"Yerevan",lat:40.18,lng:44.51,pop:1080000,pais:"armênia"},
    {nome:"Sydney",lat:-33.87,lng:151.21,pop:5300000,pais:"austrália"},{nome:"Melbourne",lat:-37.81,lng:144.96,pop:5100000,pais:"austrália"},{nome:"Brisbane",lat:-27.47,lng:153.03,pop:2500000,pais:"austrália"},{nome:"Perth",lat:-31.95,lng:115.86,pop:2050000,pais:"austrália"},{nome:"Auckland",lat:-36.85,lng:174.76,pop:1650000,pais:"nova zelândia"},{nome:"Wellington",lat:-41.29,lng:174.78,pop:415000,pais:"nova zelândia"},{nome:"Port Moresby",lat:-9.44,lng:147.18,pop:383000,pais:"papua-nova guiné"},{nome:"Suva",lat:-18.14,lng:178.44,pop:93000,pais:"fiji"}
];

/*
 * CIDADES PRIORITÁRIAS — REGIÃO DE SÃO PAULO
 * ------------------------------------------------------------
 * Para eventos cujo ponto está na região imediata de São Paulo,
 * a lista do card deve ser estável e não depender da ordem/qualidade
 * dos resultados do Photon/Overpass.
 *
 * Distâncias continuam sendo calculadas pela Haversine a partir
 * das coordenadas do evento. A lista abaixo só define os municípios
 * prioritários para o cenário de São Paulo.
 */
const CIDADES_SP_PRIORITARIAS = [
    { nome: "São Caetano do Sul", lat: -23.6229, lng: -46.5548, pop: 161127, pais: "brasil" },
    { nome: "Guarulhos",         lat: -23.4538, lng: -46.5333, pop: 1291784, pais: "brasil" },
    { nome: "Diadema",           lat: -23.6813, lng: -46.6205, pop: 393237, pais: "brasil" },
    { nome: "Osasco",            lat: -23.5324, lng: -46.7916, pop: 728615, pais: "brasil" },
    { nome: "Santo André",       lat: -23.6737, lng: -46.5432, pop: 748919, pais: "brasil" }
];

function eventoNaRegiaoImediataSP(lat, lng) {
    return Number.isFinite(Number(lat)) &&
           Number.isFinite(Number(lng)) &&
           haversine(Number(lat), Number(lng), SP_LAT, SP_LNG) <= 45;
}

function getCidadesSPPrioritarias(lat, lng, maxC = 6, minDistKm = 0) {
    return dedupeCidades(
        CIDADES_SP_PRIORITARIAS.map(c => ({
            ...c,
            distancia: haversine(lat, lng, c.lat, c.lng)
        })),
        Math.min(maxC, CIDADES_SP_PRIORITARIAS.length),
        minDistKm
    );
}

/* Países de referência (inclui países SEM costa p/ acertar bandeiras no interior) */
const PAISES_COSTEIROS = [
    {n:"japão",lat:36.2,lng:138.3},{n:"coreia do sul",lat:35.8,lng:127},{n:"coreia do norte",lat:39,lng:127.5},{n:"china",lat:31,lng:121.5},{n:"taiwan",lat:23.7,lng:121},
    {n:"filipinas",lat:12.9,lng:121.8},{n:"vietnã",lat:14,lng:108.5},{n:"tailândia",lat:13,lng:100.5},{n:"camboja",lat:11,lng:104},{n:"malásia",lat:4,lng:109.5},
    {n:"singapura",lat:1.3,lng:103.8},{n:"indonésia",lat:-6.5,lng:110},{n:"papua-nova guiné",lat:-6,lng:147},{n:"ilhas salomão",lat:-9,lng:160},{n:"vanuatu",lat:-16,lng:167},
    {n:"nova caledônia",lat:-21.5,lng:165.5},{n:"fiji",lat:-17.7,lng:178},{n:"tonga",lat:-21,lng:-175},{n:"samoa",lat:-13.7,lng:-172},{n:"guam",lat:13.4,lng:144.8},
    {n:"austrália",lat:-25,lng:134},{n:"nova zelândia",lat:-41,lng:172},{n:"havaí",lat:20,lng:-156},{n:"alasca",lat:61,lng:-150},{n:"canadá",lat:49,lng:-125},
    {n:"estados unidos",lat:37,lng:-122},{n:"méxico",lat:23,lng:-109},{n:"guatemala",lat:14,lng:-92},{n:"el salvador",lat:13.5,lng:-89},{n:"nicarágua",lat:12,lng:-87},
    {n:"costa rica",lat:9.5,lng:-84},{n:"panamá",lat:8.5,lng:-80},{n:"colômbia",lat:4,lng:-77},{n:"equador",lat:-1.8,lng:-80},{n:"peru",lat:-9.2,lng:-77},
    {n:"chile",lat:-33,lng:-71.6},{n:"argentina",lat:-40,lng:-62},{n:"uruguai",lat:-34.9,lng:-56},{n:"brasil",lat:-23,lng:-42},{n:"honduras",lat:15.5,lng:-87},
    {n:"cuba",lat:21.5,lng:-79},{n:"jamaica",lat:18.1,lng:-77.3},{n:"haiti",lat:19,lng:-72.8},{n:"república dominicana",lat:18.9,lng:-70.2},{n:"porto rico",lat:18.2,lng:-66.5},
    {n:"venezuela",lat:10.5,lng:-64},{n:"islândia",lat:64.9,lng:-18.6},{n:"noruega",lat:62,lng:6},{n:"reino unido",lat:51.5,lng:-3},{n:"irlanda",lat:53,lng:-8},
    {n:"frança",lat:46,lng:-2},{n:"espanha",lat:40,lng:-2},{n:"portugal",lat:39.5,lng:-9},{n:"marrocos",lat:33,lng:-9},{n:"argélia",lat:36.8,lng:5},{n:"tunísia",lat:36,lng:10},
    {n:"líbia",lat:32.5,lng:20},{n:"egito",lat:31,lng:32},{n:"israel",lat:32,lng:34.8},{n:"líbano",lat:33.8,lng:35.5},{n:"turquia",lat:36.8,lng:30.7},{n:"grécia",lat:38,lng:23},
    {n:"itália",lat:42,lng:12},{n:"croácia",lat:43.5,lng:16},{n:"albânia",lat:41,lng:19.5},{n:"montenegro",lat:42,lng:19},{n:"geórgia",lat:42.2,lng:43.4},
    {n:"rússia",lat:53,lng:142},{n:"índia",lat:20,lng:86},{n:"sri lanka",lat:7.9,lng:80.7},{n:"bangladesh",lat:22,lng:91},{n:"myanmar",lat:17,lng:95},{n:"paquistão",lat:25,lng:66},
    {n:"irã",lat:27,lng:57},{n:"omã",lat:20,lng:57},{n:"iêmen",lat:14,lng:48},{n:"djibuti",lat:11.7,lng:43},{n:"somália",lat:5,lng:46},{n:"quênia",lat:-1,lng:41},
    {n:"tanzânia",lat:-6,lng:39},{n:"moçambique",lat:-15,lng:40},{n:"madagascar",lat:-19,lng:47},{n:"áfrica do sul",lat:-30,lng:25},{n:"namíbia",lat:-22,lng:14.5},
    {n:"bolívia",lat:-16.5,lng:-64},{n:"paraguai",lat:-23.4,lng:-58},{n:"zâmbia",lat:-13.5,lng:27.8},{n:"zimbábue",lat:-19,lng:29.8},{n:"botsuana",lat:-22.3,lng:24.7},
    {n:"malawi",lat:-13.2,lng:34.3},{n:"chade",lat:15.5,lng:18.7},{n:"níger",lat:17.6,lng:8.1},{n:"mali",lat:17.6,lng:-4},{n:"burkina faso",lat:12.3,lng:-1.5},
    {n:"uganda",lat:1.4,lng:32.3},{n:"ruanda",lat:-2,lng:29.9},{n:"burundi",lat:-3.4,lng:29.9},{n:"república centro-africana",lat:6.5,lng:20.5},{n:"sudão",lat:15.6,lng:30.2},
    {n:"sudão do sul",lat:7.3,lng:31.4},{n:"quirguistão",lat:41.2,lng:74.8},{n:"tajiquistão",lat:38.9,lng:71.3},{n:"turcomenistão",lat:38.9,lng:59.6},{n:"butão",lat:27.4,lng:90.4},
    {n:"laos",lat:19.9,lng:102.6},{n:"nepal",lat:28.4,lng:84.1},{n:"mongólia",lat:46.8,lng:103.8},{n:"cazaquistão",lat:48,lng:68},{n:"uzbequistão",lat:41.3,lng:64.6},
    {n:"armênia",lat:40.2,lng:44.5},{n:"geórgia",lat:42.2,lng:43.4},{n:"azerbaijão",lat:40.3,lng:47.8}
];


let userInteractingWithGlobe = false, globeSpinEnabled = true;
const GLOBE_SECONDS_PER_REV = 140, GLOBE_MAX_SPIN_ZOOM = 4.2, GLOBE_SLOW_SPIN_ZOOM = 2.5;
const CINEMATIC_EASE = (t) => 1 - Math.pow(1 - t, 3);

function spinGlobe() {
    if (!map) return;
    const z = map.getZoom();
    if (globeSpinEnabled && !userInteractingWithGlobe && z < GLOBE_MAX_SPIN_ZOOM) {
        let dps = 360 / GLOBE_SECONDS_PER_REV;
        if (z > GLOBE_SLOW_SPIN_ZOOM) dps *= (GLOBE_MAX_SPIN_ZOOM - z) / (GLOBE_MAX_SPIN_ZOOM - GLOBE_SLOW_SPIN_ZOOM);
        const c = map.getCenter();
        c.lng -= dps;
        map.easeTo({ center: c, duration: 1000, easing: (n) => n });
    }
}

function getEventoTelaFrac() {
    // Onde o epicentro deve aparecer na tela (0–1, origem no topo/esquerda).
    // No celular vertical o card cobre a metade de baixo do mapa — se usar Y=0.45,
    // o ponto fica “atrás” do painel. Empurramos para o centro da área VISÍVEL.
    let x = EVENTO_TELA_X, y = EVENTO_TELA_Y;
    try {
        const mobilePortrait = window.matchMedia('(max-width:900px) and (orientation:portrait)').matches;
        if (mobilePortrait) {
            x = 0.5;
            if (document.body.classList.contains('mobile-details-open')) y = 0.22;
            else if (document.body.classList.contains('mobile-details-mid')) y = 0.28;
            else y = 0.38;
        } else {
            // Desktop e mobile-paisagem: desde os PRs #52/#61/#68 o mapa
            // ocupa a tela inteira (#mapWrap position:absolute;inset:0) e
            // o cabeçalho (#top-strip) flutua por cima cobrindo só o topo —
            // não existe mais uma "coluna de mapa" menor abaixo do
            // cabeçalho como no layout antigo. Y=0.45 (fixo) foi calibrado
            // pra aquele layout antigo e ficou desatualizado: sem
            // compensar a altura do cabeçalho, o epicentro cai visualmente
            // acima do centro da área realmente visível (o que sobra
            // abaixo do cabeçalho). Calcula a altura do cabeçalho na hora
            // e centraliza dentro da área visível de verdade.
            const header = document.getElementById('top-strip');
            const mapEl = map && typeof map.getContainer === 'function' ? map.getContainer() : null;
            if (header && mapEl) {
                const hh = header.getBoundingClientRect().height;
                const mh = mapEl.clientHeight;
                if (mh > 0) y = Math.min(0.7, (hh + (mh - hh) / 2) / mh);
            }
        }
    } catch (e) {}
    return { x, y };
}
function centroCompensado(lng, lat, zoom) {
    try {
        const w = map.getContainer().clientWidth, h = map.getContainer().clientHeight;
        const frac = getEventoTelaFrac();
        const world = 512 * Math.pow(2, zoom);
        const px = (lng + 180) / 360 * world;
        const rad = lat * Math.PI / 180;
        const py = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * world;
        const cx = px + (w / 2 - w * frac.x);
        const cy = py + (h / 2 - h * frac.y);
        const clng = Math.max(-180, Math.min(180, cx / world * 360 - 180));
        const clat = (2 * Math.atan(Math.exp(Math.PI * (1 - 2 * cy / world))) - Math.PI / 2) * 180 / Math.PI;
        return [clng, clat];
    } catch (e) { return [lng, lat]; }
}


function applyGeoZoom() {
    if (!map) return;
    const z = map.getZoom();
    setGeoVis('country', z >= 2 && z < 7);
    setGeoVis('state', z >= 4 && z < 11);
    setGeoVis('city', z >= 3.5 && z < 11);
}

function setGeoVis(cls, vis) {
    geoLabels[cls].forEach(m => { m.getElement().style.display = vis ? 'block' : 'none'; });
}


function initMap() {
    const estilo = { version: 8, sources: {}, layers: [ { id: 'ocean-bg', type: 'background', paint: { 'background-color': '#0b2a4a' } } ] };

    map = new GL.Map({
        container: 'mapContainer',
        style: estilo,
        center: [-46.63, -23.55],
        zoom: 1.6,
        maxZoom: ZOOM_MAX,
        attributionControl: false,
        // Sem isso, o navegador descarta o buffer de desenho do WebGL logo
        // depois de cada frame — e o backdrop-filter (blur do vidro em
        // css/desktop-layout-lock.css) não consegue "ler" um canvas WebGL
        // nesse estado em vários browsers/GPUs, então o painel/sidebar
        // ficam com o vidro composto sobre um fundo que o navegador enxerga
        // como vazio, em vez do mapa de verdade (mesmo com o CSS 100% certo).
        preserveDrawingBuffer: true
    });

    // Attribution removido: o app é de uso pessoal, então o botão "ⓘ" de
    // créditos (Esri/HERE/OSM etc.) do MapLibre não precisa aparecer no mapa.

    try { map.setProjection({ type: 'globe' }); } catch (e) {}

    // Botão de zoom +/- removido a pedido do usuário (pinça no celular e
    // scroll no desktop já bastam) — em todas as versões, não só mobile.
    map.addControl(new GL.ScaleControl({ unit: 'metric' }), 'bottom-left');

    // Debounce do syncAllMarkers: evita travar o mapa ao arrastar
    // (especialmente com muitos focos de incêndio). Só roda ~180ms depois
    // que o usuário parar de mover/zoom.
    let __syncMarkersTimer = null;
    function scheduleSyncMarkers() {
        if (__syncMarkersTimer) clearTimeout(__syncMarkersTimer);
        // Debounce um pouco maior sob carga (muitos markers) — evita sync a cada frame de zoom
        const nMarkers = (markerStores && markerStores.quake) ? markerStores.quake.size : 0;
        const delay = nMarkers > 80 ? 280 : 180;
        __syncMarkersTimer = setTimeout(() => {
            __syncMarkersTimer = null;
            try { syncAllMarkers(); } catch (e) { console.error('[monitor] syncAllMarkers:', e); }
        }, delay);
    }

    map.on('mousedown', () => { userInteractingWithGlobe = true; });
    map.on('touchstart', () => { userInteractingWithGlobe = true; });
    map.on('dragstart', () => { userInteractingWithGlobe = true; });
    map.on('moveend', () => { spinGlobe(); scheduleSyncMarkers(); });
    map.on('zoomend', () => { scheduleSyncMarkers(); applyGeoZoom(); });

    map.on('load', () => {
        // Esri World Imagery — satélite, base do mapa
        map.addSource('satellite', {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '© Esri, Maxar, Earthstar Geographics'
        });
        map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite' });

        // Esri World Boundaries and Places — fronteiras (país/estado/condado) e
        // nomes de lugares, camada oficial da Esri feita pra ficar sobre imagery
        map.addSource('esri-boundaries-places', {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '© Esri, HERE, Garmin, © OpenStreetMap contributors'
        });
        map.addLayer({ id: 'esri-boundaries-places', type: 'raster', source: 'esri-boundaries-places' });

        // Ruas via OpenFreeMap (vetor, só aparece em zoom alto)
        map.addSource('ofm', {
            type: 'vector',
            tiles: ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'],
            attribution: '© OpenMapTiles © OpenStreetMap'
        });
        map.addLayer({
            id: 'ofm-ruas',
            type: 'line',
            source: 'ofm',
            'source-layer': 'transportation',
            minzoom: 9,
            // MapLibre 5.x não aceita mais o operador legado "!in" — precisa
            // ser a expressão "in" (que aceita ['get',...]/['literal',...])
            // negada por fora com "!". A sintaxe antiga só validava em
            // versões anteriores do MapLibre/Mapbox GL JS.
            filter: ['!', ['in', ['get', 'class'], ['literal', ['path', 'rail', 'ferry']]]],
            paint: {
                'line-color': ['match', ['get', 'class'], 'motorway', '#ffb300', 'trunk', '#ffc53d', 'primary', '#ffe082', '#ffffff'],
                'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 14, 2, 18, 6],
                'line-opacity': 0.85
            }
        });

        // Placas tectônicas
        fetch('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json')
            .then(r => r.json())
            .then(d => {
                map.addSource('tectonic-plates', { type: 'geojson', data: d });
                map.addLayer({
                    id: 'tectonic-plates',
                    type: 'line',
                    source: 'tectonic-plates',
                    paint: { 'line-color': '#dc2626', 'line-width': 1.5, 'line-opacity': 0.6 }
                });
            }).catch(() => {});

        // Trilha de ciclones
        map.addSource('cyclone-track', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
            id: 'cyclone-track-line',
            type: 'line',
            source: 'cyclone-track',
            paint: {
                'line-color': '#a855f7',
                'line-width': 2,
                'line-opacity': 0.85,
                'line-dasharray': [2, 2]
            }
        });

        // Cone de incerteza (ESTIMATIVA própria a partir da direção recente — não é o
        // cone oficial de previsão de NHC/JTWC, que depende de modelos que não temos acesso)
        map.addSource('cyclone-cone', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
            id: 'cyclone-cone-fill',
            type: 'fill',
            source: 'cyclone-cone',
            paint: { 'fill-color': '#a855f7', 'fill-opacity': 0.12 }
        }, 'cyclone-track-line');
        map.addLayer({
            id: 'cyclone-cone-outline',
            type: 'line',
            source: 'cyclone-cone',
            paint: { 'line-color': '#a855f7', 'line-width': 1, 'line-opacity': 0.4 }
        }, 'cyclone-track-line');

        map.on('movestart', (e) => {
            if (e.originalEvent) {
                window.preAlertCamera = null;
                if (window.returnCameraTimeout) {
                    clearTimeout(window.returnCameraTimeout);
                    window.returnCameraTimeout = null;
                }
            }
        });

        syncAllMarkers();
    });
}

/* ============================ MARKERS ============================ */
function syncAllMarkers() {
    if (!map) return;
    const now = Date.now(), cut = now - 864e5;
    const z = map.getZoom();

    // Performance: no zoom baixo só mostra sismos mais fortes
    const dynMin = z < 3 ? 5.5 : (z < 5 ? 4.0 : minMagnitude);

    // --- SISMOS ---
    const wantQ = new Set();
    if (layerVisibility.earthquakes) {
        globalEvents.forEach(ev => {
            if (ev.time < eventDisplayCutMs(ev) || ev.mag < dynMin) return;
            wantQ.add(ev.id);
            if (!markerStores.quake.has(ev.id)) {
                const el = document.createElement('div');
                el.className = 'quake-dot';
                const size = ev.mag >= 6 ? 18 : ev.mag >= 5 ? 14 : ev.mag >= 4 ? 11 : 8;
                const cor = getHexColor(ev.mag);
                el.style.width = el.style.height = size + 'px';
                el.style.background = cor;
                el.style.boxShadow = `0 0 ${size}px ${cor}`;
                el.title = `M${ev.mag.toFixed(1)} — ${ev.place}`;
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const i = globalEvents.findIndex(x => x.id === ev.id);
                    if (i !== -1) {
                        selectMapEvent(globalEvents[i], true);
                    }
                });
                markerStores.quake.set(ev.id, new GL.Marker({ element: el }).setLngLat(ev.coords).addTo(map));
            }
        });
    }
    markerStores.quake.forEach((m, id) => {
        if (!wantQ.has(id)) {
            m.remove();
            markerStores.quake.delete(id);
        }
    });

    // --- OUTROS TIPOS ---
    const syncType = (store, list, builder) => {
        const want = new Set();
        list.forEach(item => {
            if (!item.coords || item.time < cut) return;
            want.add(item.id);
            if (!store.has(item.id)) {
                const rec = builder(item);
                rec.marker = new GL.Marker({ element: rec.el }).setLngLat(item.coords).addTo(map);
                store.set(item.id, rec);
            } else if (store.get(item.id).update) {
                store.get(item.id).update(item);
            }
        });
        store.forEach((rec, id) => {
            if (!want.has(id)) {
                rec.marker.remove();
                store.delete(id);
            }
        });
    };

    if (layerVisibility.fires) {
        syncType(markerStores.fire, globalAlerts.filter(a => a.type === 'fire'), (item) => {
            const el = document.createElement('div');
            el.className = 'emoji-marker';
            el.style.fontSize = '22px';
            el.textContent = '🔥';
            el.title = item.place;
            el.addEventListener('click', (e) => { e.stopPropagation(); selectMapEvent(item, false); });
            return { el };
        });
    } else {
        markerStores.fire.forEach(r => r.marker.remove());
        markerStores.fire.clear();
    }

    if (layerVisibility.hurricanes) {
        syncType(markerStores.cyclone, globalAlerts.filter(a => a.type === 'hurricane'), (item) => {
            const el = document.createElement('div');
            el.className = 'cyclone-marker';
            el.innerHTML = `<div class="cyclone-arrow" style="display:none;">➤</div><div class="cyclone-emoji">🌀</div><div class="cyclone-name"></div><div class="cyclone-wind" style="display:none;"></div>`;
            el.addEventListener('click', (e) => { e.stopPropagation(); selectMapEvent(item, false); });
            const rec = {
                el,
                update: (it) => {
                    el.querySelector('.cyclone-name').textContent = `${it.cycloneLabel || ''} ${it.place}`.trim();
                    const ar = el.querySelector('.cyclone-arrow');
                    if (it.movementInfo) {
                        ar.style.display = 'block';
                        ar.style.transform = `rotate(${Math.round(it.movementInfo.bearing - 90)}deg)`;
                        ar.title = `Movimento: ${it.movementInfo.compass} (${Math.round(it.movementInfo.bearing)}°)`;
                    } else {
                        ar.style.display = 'none';
                    }
                    const wEl = el.querySelector('.cyclone-wind');
                    const windKmh = (it.windKmh != null) ? it.windKmh : extractWindKmh(it.detail);
                    if (windKmh) {
                        const classif = classificarCiclone(windKmh);
                        wEl.style.display = 'block';
                        wEl.style.color = classif.cor;
                        wEl.style.border = `1px solid ${classif.cor}`;
                        wEl.textContent = `${windKmh} km/h`;
                        wEl.title = classif.cat;
                    } else {
                        wEl.style.display = 'none';
                    }
                }
            };
            rec.update(item);
            return rec;
        });
    } else {
        markerStores.cyclone.forEach(r => r.marker.remove());
        markerStores.cyclone.clear();
    }

    if (layerVisibility.tsunami) {
        syncType(markerStores.tsunami, globalAlerts.filter(a => a.type === 'tsunami'), (item) => {
            const el = document.createElement('div');
            el.className = 'emoji-marker';
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.alignItems = 'center';
            el.innerHTML = `<span style="font-size:26px;">🌊</span><span class="tsunami-name"></span>`;
            el.querySelector('.tsunami-name').textContent = (item.place || '').substring(0, 22);
            el.addEventListener('click', (e) => { e.stopPropagation(); selectMapEvent(item, false); });
            return { el };
        });
    } else {
        markerStores.tsunami.forEach(r => r.marker.remove());
        markerStores.tsunami.clear();
    }

    if (layerVisibility.volcano) {
        syncType(markerStores.volcano, globalAlerts.filter(a => a.type === 'volcano'), (item) => {
            const el = document.createElement('div');
            el.className = 'emoji-marker';
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.alignItems = 'center';
            el.innerHTML = `<span style="font-size:26px;">🌋</span><span class="tsunami-name"></span>`;
            el.querySelector('.tsunami-name').textContent = (item.place || '').substring(0, 22);
            el.addEventListener('click', (e) => { e.stopPropagation(); selectMapEvent(item, false); });
            return { el };
        });
    } else {
        markerStores.volcano.forEach(r => r.marker.remove());
        markerStores.volcano.clear();
    }

    if (layerVisibility.tornado) {
        syncType(markerStores.tornado, globalAlerts.filter(a => a.type === 'tornado'), (item) => {
            const el = document.createElement('div');
            el.className = 'emoji-marker';
            el.style.fontSize = '24px';
            el.textContent = '🌪️';
            el.addEventListener('click', (e) => { e.stopPropagation(); selectMapEvent(item, false); });
            return { el };
        });
    } else {
        markerStores.tornado.forEach(r => r.marker.remove());
        markerStores.tornado.clear();
    }

    if (layerVisibility.lightning) {
        syncType(markerStores.storm, globalAlerts.filter(a => a.type === 'storm'), (item) => {
            const el = document.createElement('div');
            el.className = 'emoji-marker';
            el.style.fontSize = '20px';
            el.textContent = '⚡';
            el.title = item.place;
            el.addEventListener('click', (e) => { e.stopPropagation(); selectMapEvent(item, false); });
            return { el };
        });
    } else {
        markerStores.storm.forEach(r => r.marker.remove());
        markerStores.storm.clear();
    }

    if (layerVisibility.wind) {
        syncType(markerStores.wind, globalAlerts.filter(a => a.type === 'wind'), (item) => {
            const el = document.createElement('div');
            el.className = 'emoji-marker';
            el.style.fontSize = '22px';
            el.textContent = '💨';
            el.title = item.place;
            el.addEventListener('click', (e) => { e.stopPropagation(); selectMapEvent(item, false); });
            return { el };
        });
    } else {
        markerStores.wind.forEach(r => r.marker.remove());
        markerStores.wind.clear();
    }

    if (layerVisibility.flood) {
        syncType(markerStores.flood, globalAlerts.filter(a => a.type === 'flood'), (item) => {
            const el = document.createElement('div');
            el.className = 'emoji-marker';
            el.style.fontSize = '22px';
            el.textContent = '💧';
            el.title = item.place;
            el.addEventListener('click', (e) => { e.stopPropagation(); selectMapEvent(item, false); });
            return { el };
        });
    } else {
        markerStores.flood.forEach(r => r.marker.remove());
        markerStores.flood.clear();
    }

    if (layerVisibility.civil) {
        syncType(markerStores.civil, globalAlerts.filter(a => a.type === 'civil'), (item) => {
            const el = document.createElement('div');
            el.className = 'emoji-marker';
            el.style.fontSize = '22px';
            el.textContent = '🚨';
            el.title = item.place;
            el.addEventListener('click', (e) => { e.stopPropagation(); selectMapEvent(item, false); });
            return { el };
        });
    } else {
        markerStores.civil.forEach(r => r.marker.remove());
        markerStores.civil.clear();
    }
}


/* ============================ RADAR PULSANTE ============================ */
function startContinuousRadar(lng, lat, mag, corOverride) {
    stopContinuousRadar();
    stopCascadeRipple();
    try { if (typeof stopFeltZone === 'function') stopFeltZone(); } catch (e) {}
    if (!map) return;
    const cor = corOverride || getHexColor(mag);
    const mc = document.getElementById('mapContainer');
    const w = document.createElement('div');
    w.style.cssText = 'position:absolute;left:0;top:0;z-index:9999;pointer-events:none;';
    mc.appendChild(w);

    const t = document.createElement('div');
    t.className = 'radar-center';
    t.style.background = cor;
    t.style.boxShadow = `0 0 10px ${cor},0 0 20px ${cor}`;
    w.appendChild(t);

    const dur = Math.max(1.4, 7.2 - Math.min(mag, 7));
    const p = document.createElement('div');
    p.className = 'radar-ring';
    p.style.borderColor = cor;
    p.style.animationDuration = dur.toFixed(2) + 's';
    w.appendChild(p);

    let _radarRaf = 0;
    const updCore = () => {
        if (!map) return;
        const pt = map.project([lng, lat]);
        if (pt) {
            w.style.left = pt.x + 'px';
            w.style.top = pt.y + 'px';
        }
    };
    const upd = () => {
        if (_radarRaf) return;
        _radarRaf = requestAnimationFrame(() => {
            _radarRaf = 0;
            updCore();
        });
    };
    setTimeout(updCore, 50);
    map.on('move', upd);
    map.on('zoom', upd);
    currentRadar = { wrapper: w, h: upd };
}

function stopContinuousRadar() {
    if (currentRadar) {
        if (map) {
            map.off('move', currentRadar.h);
            map.off('zoom', currentRadar.h);
        }
        if (currentRadar.wrapper.parentNode) {
            currentRadar.wrapper.parentNode.removeChild(currentRadar.wrapper);
        }
        currentRadar = null;
    }
}

const RADAR_COR = {
    hurricane: '#a855f7',
    tornado: '#f43f5e',
    tsunami: '#38bdf8',
    storm: '#facc15',
    fire: '#f97316',
    civil: '#e11d48',
    wind: '#5eead4',
    flood: '#0ea5e9',
    volcano: '#dc2626'
};

/* ============================ ONDAS EM CASCATA ============================
   Substitui o radar de anel único (startContinuousRadar) pra todo tipo de
   alerta MENOS furacão/ciclone (que segue com o radar simples por enquanto,
   até decidirmos como mostrar a rota prevista) e sismo (que tem seu próprio
   sistema, ver startFeltZone em sismo-metrics.js). 3 ondas finas saem em
   sequência (delay escalonado) em vez de um anel duro solitário — mesma
   ideia de "Ondas em Cascata" já usada como referência de design pro
   marcador de epicentro. Fica rodando enquanto esse evento for o
   selecionado/exibido (novo ou revisitado no ciclo automático), substituído
   assim que outro evento tomar seu lugar — nunca mais de um por vez. */
function startCascadeRipple(lng, lat, color) {
    stopContinuousRadar();
    stopCascadeRipple();
    try { if (typeof stopFeltZone === 'function') stopFeltZone(); } catch (e) {}
    if (!map) return;
    const mc = document.getElementById('mapContainer');
    const w = document.createElement('div');
    w.className = 'cascade-wrap';
    w.style.cssText = 'position:absolute;left:0;top:0;z-index:9999;pointer-events:none;';
    mc.appendChild(w);

    const core = document.createElement('div');
    core.className = 'cascade-core';
    core.style.background = color;
    core.style.boxShadow = `0 0 10px ${color},0 0 20px ${color}`;
    w.appendChild(core);

    ['', 'r2', 'r3'].forEach(cls => {
        const r = document.createElement('div');
        r.className = 'cascade-ring' + (cls ? ' ' + cls : '');
        r.style.borderColor = color;
        r.style.boxShadow = `0 0 6px 0 ${color}`;
        w.appendChild(r);
    });

    let _cascadeRaf = 0;
    const updCore = () => {
        if (!map) return;
        const pt = map.project([lng, lat]);
        if (pt) {
            w.style.left = pt.x + 'px';
            w.style.top = pt.y + 'px';
        }
    };
    const upd = () => {
        if (_cascadeRaf) return;
        _cascadeRaf = requestAnimationFrame(() => {
            _cascadeRaf = 0;
            updCore();
        });
    };
    setTimeout(updCore, 50);
    map.on('move', upd);
    map.on('zoom', upd);
    currentCascade = { wrapper: w, h: upd };
}

function stopCascadeRipple() {
    if (currentCascade) {
        if (map) {
            map.off('move', currentCascade.h);
            map.off('zoom', currentCascade.h);
        }
        if (currentCascade.wrapper.parentNode) {
            currentCascade.wrapper.parentNode.removeChild(currentCascade.wrapper);
        }
        currentCascade = null;
    }
}

/* Escolhe o efeito certo por tipo — furacão/ciclone mantém o radar simples
   de sempre (RADAR_COR), os demais tipos (menos sismo, tratado à parte)
   ganham a onda em cascata. */
function triggerEventoMapaFx(item, corFallback) {
    try {
        const cor = RADAR_COR[item.type] || corFallback;
        if (item.type === 'hurricane') {
            startContinuousRadar(item.coords[0], item.coords[1], 5, cor);
        } else {
            startCascadeRipple(item.coords[0], item.coords[1], cor);
        }
    } catch (e) {}
}
/* ====== ✅ FIM DA PARTE 2 — cole a PARTE 3 logo abaixo ====== */
