/* Le kit des images d'intention (#3935, #4411) : le fond commun (dessin du décor, textures, ferrures) et la définition
   unique de chaque pièce d'interface, quel que soit le socle de la page. Cotes, teintes et signatures :
   `../kit.md`. Se charge avant tout socle. Maquette hors du jeu. */
/* ───────── le fond commun : dessin du décor, textures, ferrures ───────── */
const NS = 'http://www.w3.org/2000/svg';
const W = 1280, H = 720;
const el = (hote, tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; hote.appendChild(e); return e; };
const alea = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const melange = (c1, c2, t) => { const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); const a = p(c1), b = p(c2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const svgUrl = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
document.documentElement.style.setProperty('--tex-bois', svgUrl(`<svg xmlns='${NS}' width='600' height='300'><filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.006 0.22' numOctaves='4' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.30  0.9 0.9 0.9 0 -0.75'/></filter><rect width='100%' height='100%' fill='#c9a57a'/><rect width='100%' height='100%' filter='url(#f)'/></svg>`));
document.documentElement.style.setProperty('--tex-parchemin', svgUrl(`<svg xmlns='${NS}' width='500' height='400'><filter id='a' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='4' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.16  0.9 0.9 0.9 0 -0.95'/></filter><filter id='b' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' fill='#fff'/><rect width='100%' height='100%' filter='url(#a)'/><rect width='100%' height='100%' filter='url(#b)'/></svg>`));
const S = document.getElementById('scene');
const defs = el(S, 'defs');
const grad = (id, stops, attrs = { x1: 0, y1: 0, x2: 0, y2: 1 }, type = 'linearGradient') => { const g = el(defs, type, { id, ...attrs }); stops.forEach(([o, c, a]) => el(g, 'stop', { offset: o, 'stop-color': c, 'stop-opacity': a ?? 1 })); return g; };
const ferrures = '<i class="ferrure hg"></i><i class="ferrure hd"></i><i class="ferrure bg"></i><i class="ferrure bd"></i>';
/* les flous et les dégradés d'écran que les décors appellent par `url(#…)` */
for (const [id, d] of [['f1', .8], ['f2', 2], ['f4', 4], ['f6', 6], ['f8', 8], ['f18', 18]]) el(el(defs, 'filter', { id, x: '-40%', y: '-40%', width: '180%', height: '180%' }), 'feGaussianBlur', { stdDeviation: d });
grad('vignette', [[.5, '#000', 0], [.82, '#000', .4], [1, '#000', .8]], { cx: .5, cy: .44, r: .74 }, 'radialGradient');
grad('haut', [[0, '#000', .6], [1, '#000', 0]]);
grad('bas', [[0, '#000', 0], [1, '#000', .85]]);

/* ───────── les pièces : une définition chacune, publiées sur `globalThis` (`../kit.md` § 5) ───────── */
{
  const PICTOS = {
    attaque: '<path d="M4 4l11 11M4 4v3.500M4 4h3.500M13 17l4-4M16.500 16.500L20 20M20 4L9 15M20 4v3.500M20 4h-3.500M11 17l-4-4M7.500 16.500L4 20"/>',
    defensive: '<path d="M12 3l7.500 2.500v5.500c0 4.800-3.200 8-7.500 9.500-4.300-1.500-7.500-4.700-7.500-9.500V5.500zM12 3v17.500M4.500 10.500h15"/>',
    sort: '<path d="M12 2.500l1.800 6.200 6.200-1.700-4.400 4.700 4.400 4.800-6.200-1.800L12 21l-1.800-6.300L4 16.500l4.400-4.800L4 7l6.200 1.700z"/>',
    focaliser: '<circle cx="12" cy="12" r="2.200"/><path d="M12 4.500a7.500 7.500 0 1 0 7.500 7.500M12 8a4 4 0 1 1-4 4M19.500 12a7.500 7.500 0 0 0-3-6"/>',
    competence: '<path d="M12 2.500l8 8-3.500 10.500h-9L4 10.500zM12 2.500l4 9.500-4 4-4-4zM4 10.500L8 12M20 10.500L16 12M12 16v5"/>',
    poser: '<path d="M12 3.500v11M7.500 10.500l4.500 4.500 4.500-4.500M4.500 20h15"/>',
    armes: '<path d="M4.500 8.500h13l-3.500-3.500M19.500 15.500h-13l3.500 3.500"/>',
    fin: '<path d="M7 3h10M7 21h10M8.500 3c0 5 7 6.500 7 9s-7 4-7 9M15.500 3c0 5-7 6.500-7 9s7 4 7 9M10.500 18.500h3"/>',
    annuler: '<path d="M9 6.500L4.500 11 9 15.500M4.500 11h9.500a4.500 4.500 0 0 1 0 9H10"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    journal: '<path d="M4 5c3-1.200 5.500-1.200 8 0v14c-2.500-1.200-5-1.200-8 0zM20 5c-3-1.200-5.500-1.200-8 0v14c2.500-1.200 5-1.200 8 0z"/>',
    systeme: '<circle cx="12" cy="12" r="3.200"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100"/>',
    epee: '<path d="M6 18L17 7l2-3-3 2L5 17zM8 13l3 3M4 20l2-2"/>',
    croix: '<path d="M6 6l12 12M18 6L6 18"/>',
    munition: '<path d="M5 19L18 6M18 6h-5.500M18 6v5.500M5 19l.500-4.500M5 19l4.500-.500"/>',
    objet: '<path d="M8.500 8.500c-3 3-4.500 6-4.500 8.500a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3c0-2.500-1.500-5.500-4.500-8.500zM9 4h6l-1 4.500h-4z"/>',
    monter: '<path d="M5 20v-6l4-6.500 5-3.500 1 3.500 4 3-2 3-4-1-2.500 3V20"/>',
    servir: '<circle cx="12" cy="12" r="7.500"/><path d="M12 4.500v15M4.500 12h15M6.700 6.700l10.600 10.600M17.300 6.700L6.700 17.300"/>',
    pousser: '<path d="M4 12h11M11 7l5 5-5 5M20 5v14"/>',
    aTerre: '<path d="M3.500 18.500h17M6 14.500h8.500l3.500-3.500"/><circle cx="19.500" cy="9" r="1.800"/>',
    sortie: '<path d="M10 4H5v16h5M10 12h10M16 8l4 4-4 4"/>',
    route: '<circle cx="12" cy="12" r="8.500"/><path d="M15.500 8.500l-2 5-5 2 2-5z"/>',
    lit: '<path d="M3 18V7M3 15h18v3M21 15v-3a2 2 0 0 0-2-2h-8v5M5 12.500a1.800 1.800 0 1 0 3.600 0a1.800 1.800 0 1 0-3.600 0"/>',
    chope: '<path d="M6 7h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM16 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 7c0-2 2-3 3.500-2C10.500 3.500 13 3.500 13.500 5c1.500-.5 2.500.5 2.500 2"/>',
    bulle: '<path d="M4 5h16v11h-9l-4 3.500V16H4zM8 9h8M8 12h5"/>',
    des: '<rect x="4" y="4" width="16" height="16" rx="2.500"/><circle cx="8.500" cy="8.500" r=".8"/><circle cx="15.500" cy="15.500" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="15.500" cy="8.500" r=".8"/><circle cx="8.500" cy="15.500" r=".8"/>',
    soin: '<path d="M9.500 4h5v5.500H20v5h-5.500V20h-5v-5.500H4v-5h5.500z"/>',
    scalpel: '<path d="M4 20l6-6M10 14l9-9c1.500 2 1.500 4.500 0 6l-6 6zM8 16l1.500 1.500"/>',
    porte: '<path d="M6 21V8a6 6 0 0 1 12 0v13zM12 3v18M14.500 13h.01"/>',
    tente: '<path d="M12 4L3 20h18zM12 4v-1.500M12 11l-3.500 9M12 11l3.500 9"/>',
    oeil: '<path d="M2.500 12C5 7.500 8.300 5.500 12 5.500s7 2 9.500 6.500c-2.500 4.500-5.800 6.500-9.500 6.500S5 16.500 2.500 12z"/><circle cx="12" cy="12" r="3"/>',
    carte: '<path d="M3.500 6l5.500-2 6 2 5.500-2v14l-5.500 2-6-2-5.500 2zM9 4v14M15 6v14"/>',
    arc: '<path d="M6 3c8 2 12 8 12 18M6 3l12 18M5 21l9-12M5 21l1.500-4M5 21l4-1"/>',
    ciel: '<path d="M7 17a4 4 0 0 1 .5-8 5 5 0 0 1 9.500 1.500 3.300 3.300 0 0 1 0 6.500zM9 20.500h7"/>',
    sommeil: '<path d="M19 14.500A8 8 0 0 1 9.500 5a8 8 0 1 0 9.500 9.500zM15 4h4l-4 4.500h4"/>',
    feu: '<path d="M12 21c-4 0-6.500-2.500-6.500-6 0-3 2-4.500 3-7 1.500 1 2 2.500 2 4 1.500-2 2.500-5 1.500-8.500 4 2 6.500 6 6.500 11 0 4-2.500 6.500-6.500 6.500z"/>',
    vivres: '<path d="M4 13c0-4 3.500-7 8-7s8 3 8 7v4H4zM8 10v3M12 9v4M16 10v3"/>',
    flocon: '<path d="M12 3v18M4.200 7.500l15.600 9M19.800 7.500l-15.600 9M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2"/>',
    bol: '<path d="M3.500 11h17c0 5-3.500 8.500-8.500 8.500S3.500 16 3.500 11zM9 8c0-1.500 1.500-1.500 1.500-3M13.500 8c0-1.500 1.500-1.500 1.500-3"/>',
    fer_a_cheval: '<path d="M7 20V11a5 5 0 0 1 10 0v9M5 20h4M15 20h4"/>',
    bourse: '<path d="M9 7h6l-1-3h-4zM9 7c-3 2.500-4.500 5.500-4.500 8.500 0 3 3 4.500 7.500 4.500s7.500-1.500 7.500-4.500c0-3-1.500-6-4.500-8.500"/>',
    balance: '<path d="M12 4v16M7 20h10M4 8h16M4 8l-2 6a3.200 3.200 0 0 0 6 0L6 8M20 8l-2 6a3.200 3.200 0 0 0 6 0l-2-6" transform="translate(-.5 0) scale(.96)"/>',
    bouclier: '<path d="M12 3l7.500 2.500v5.500c0 4.800-3.200 8-7.500 9.500-4.300-1.500-7.500-4.700-7.500-9.500V5.500z"/>',
    enclume: '<path d="M4 8h13c0 2-1.500 3.500-4 3.500v3.500h3v4H7v-4h3v-3.500C7 11.500 4 10.500 4 8zM17 8h3.500"/>',
    livre: '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M9 8h6"/>',
    pieces: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.700 3.100 3 7 3s7-1.300 7-3V7M5 12v5c0 1.700 3.100 3 7 3s7-1.300 7-3v-5"/>',
    cible: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.500"/>',
    poing: '<path d="M4.500 9.500a1.900 1.900 0 0 1 3.800 0 1.900 1.900 0 0 1 3.800 0 1.900 1.900 0 0 1 3.800 0 1.900 1.900 0 0 1 3.800 0v4.500c0 3.600-3 6.500-7.600 6.500s-7.600-2.900-7.600-6.500zM4.500 14h6.500a2 2 0 0 0 0-4"/>',
    plus: '<path d="M12 6v12M6 12h12"/>',
    moins: '<path d="M6 12h12"/>',
    ancre: '<circle cx="12" cy="5.500" r="2"/><path d="M12 7.500V20M5 13c0 4 3 7 7 7s7-3 7-7M8.500 11h7"/>',
    sablier: '<path d="M7 3h10M7 21h10M8.500 3c0 5 7 6.500 7 9s-7 4-7 9M15.500 3c0 5-7 6.500-7 9s7 4 7 9"/>',
    noeud: '<path d="M3.500 17.500c3.500 0 5-2.500 6.200-5.500S12.500 6.500 16 6.500a3 3 0 0 1 0 6c-3.500 0-5-2.200-8-2.200a2.400 2.400 0 0 1 0-4.800c3.500 0 4.800 3 6 6s2.700 5.500 6.500 5.500"/>',
    lune: '<path d="M19 14.500A8 8 0 0 1 9.500 5a8 8 0 1 0 9.500 9.500z"/>',
    ville: '<path d="M4 20V9l2-2 2 2v3h3V6l3-2.500L17 6v6h3v8zM4 20h16M13 9.500h2M7 14h.01M13 14h2"/>',
    fer: '<path d="M7 4.500v7a5 5 0 0 0 10 0v-7M5.500 4.500h3M15.500 4.500h3"/><path d="M8.300 9h.01M8.600 13h.01M15.700 9h.01M15.400 13h.01" stroke-width="2.200"/>',
    cle: '<circle cx="8" cy="8" r="4"/><path d="M11 11l9 9M16.500 16.500l2-2M14 14l2-2"/>',
    coche: '<path d="M5 12.500l4.500 4.500L19 7"/>',
    goutte: '<path d="M12 4c3 4 5 6.500 5 9.500a5 5 0 0 1-10 0C7 10.500 9 8 12 4z"/>',
    botte: '<path d="M9 3v9.500l-4 3.500v4h14v-2.500c0-2-2.500-3-6-3.500V3zM9 7h4M9 10.500h4M5 17.500h14"/>',
    reseau: '<circle cx="6" cy="12" r="2.500"/><circle cx="18" cy="6" r="2.500"/><circle cx="18" cy="18" r="2.500"/><path d="M8.200 10.900l7.600-3.800M8.200 13.100l7.600 3.800"/>',
    roue: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="2"/><path d="M12 3.500v6.500M12 14v6.500M3.500 12H10M14 12h6.500M6 6l4.500 4.500M13.500 13.500L18 18M6 18l4.500-4.500M13.500 10.500L18 6"/>',
    soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/>',
    pluie: '<path d="M7 14a4 4 0 0 1 .6-8 5.500 5.500 0 0 1 10.600 1.500A3.300 3.300 0 0 1 17.500 14zM8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
    brume: '<path d="M4 8h13M7 12h13M4 16h11M9 20h9"/>',
    vent: '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7"/>',
    barre: '<circle cx="12" cy="12" r="5.500"/><circle cx="12" cy="12" r="1.500"/><path d="M12 2v4.500M12 17.500V22M2 12h4.500M17.500 12H22M4.900 4.900l3.200 3.200M15.900 15.900l3.200 3.200M4.900 19.100l3.200-3.200M15.900 8.100l3.200-3.200"/>',
    canon: '<path d="M3 10h13l5 1.500v3L16 16H3zM3 10v6"/><circle cx="8" cy="18.500" r="2.500"/>',
    voile: '<path d="M2.500 16h19l-2.500 4.500H5zM9 16V3M9 4l8 4.500-8 4.500M14 16v-5"/>',
    etoile: '<path d="M12 3l2.300 6.200 6.700.3-5.200 4.100 1.800 6.400L12 16.300 6.400 20l1.800-6.400L3 9.500l6.700-.3z"/>',
    couronne: '<path d="M4 18h16M4 18L3 8l5 4 4-7 4 7 5-4-1 10"/>',
    cordage: '<path d="M6 3c5 3-3 6 2 9s-3 6 2 9M14 3c5 3-3 6 2 9s-3 6 2 9"/>',
    marmite: '<path d="M4 10h16v5a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6zM2 10h20M9 6c0-2 2-2 2-4M14 6c0-2 2-2 2-4"/>',
    chant: '<path d="M9 18V5l10-2v13"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/>',
    coque: '<path d="M3 8h18c0 6-3 11-9 12C6 19 3 14 3 8zM12 8v12M7 12h10"/>',
    dresse: '<path d="M4 17h13l3-4M6 17a2 2 0 1 0 .1 0M15 17a2 2 0 1 0 .1 0M4 13V8h9v5M13 10h4l3 3"/>',
    nerveux: '<path d="M12 3l2 5 5-2-3 5 5 2-5 2 2 5-5-3-3 4-1-5-5 1 4-4-4-3 5-1z"/>',
    caisse: '<path d="M4 8l8-4 8 4v9l-8 4-8-4zM4 8l8 4 8-4M12 12v9"/>',
    tonneau: '<path d="M7 3h10c2 4 2 14 0 18H7C5 17 5 7 7 3zM5.700 8h12.600M5.700 16h12.600"/>',
    virer: '<path d="M4 14a8 8 0 0 1 14-5l2 2M20 5v6h-6"/>',
    grappin: '<path d="M12 3v12M6 13c0 4 3 6 6 6s6-2 6-6M6 13l-2 2M18 13l2 2"/><circle cx="12" cy="4" r="1.500"/>',
    loupe: '<circle cx="10.500" cy="10.500" r="6"/><path d="M15 15l5.500 5.500"/>',
    plume: '<path d="M20 4c-8 0-13 5-14 13l-2 3M6 17c5 0 9-2 11-6M9 13h6"/>',
    fuite: '<path d="M4 12h12M12 7l5 5-5 5M20 5v14"/>',
    coeur: '<path d="M12 20s-7-4.500-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.500-7 10-7 10z"/>',
    gauche: '<path d="M14.500 5.500L8 12l6.500 6.500"/>',
    droite: '<path d="M9.500 5.500L16 12l-6.500 6.500"/>',
    disque: '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>',
    jouer: '<path d="M8 5l11 7-11 7z"/>',
    note: '<path d="M12 3v12.500M12 3l6 2v4l-6-2"/><ellipse cx="9" cy="16.500" rx="3.200" ry="2.500"/>',
    sceau: '<circle cx="12" cy="10" r="5.500"/><path d="M8.500 14.500L7 21l5-2.500L17 21l-1.500-6.500"/>',
    palette: '<path d="M12 4c-4.700 0-8.500 3.400-8.500 7.600 0 4 3.300 7.400 7.500 7.400 1.300 0 1.800-.900 1.300-1.900-.6-1.200.2-2.400 1.600-2.400h2.300c2.400 0 4.300-1.800 4.300-4.100C20.500 6.900 16.700 4 12 4z"/><circle cx="8" cy="10" r=".9"/><circle cx="12" cy="7.800" r=".9"/><circle cx="16" cy="9.500" r=".9"/>',
    epi: '<path d="M12 21V9M12 9c-2-1-3-3-3-5 2 .5 3 2 3 5zM12 9c2-1 3-3 3-5-2 .5-3 2-3 5zM12 14c-2-1-4-1-5-3M12 14c2-1 4-1 5-3M12 18c-2-1-4-1-5-3M12 18c2-1 4-1 5-3"/>',
    chariot: '<circle cx="8" cy="17" r="2.500"/><circle cx="17" cy="17" r="2.500"/><path d="M3 14V8h12v6M15 10h3.500l2.500 3v1"/>',
    masque: '<path d="M4 7c5-2 11-2 16 0 0 6-3 11-8 11S4 13 4 7zM8 10.500h2.500M13.500 10.500H16M9.500 14.500c1.500 1 3.500 1 5 0"/>',
    chevron_d: '<path d="M9 6l6 6-6 6"/>',
    chevron_g: '<path d="M15 6l-6 6 6 6"/>',
    de20: '<path d="M12 3l8 4.500v9L12 21l-8-4.500v-9zM12 3v5.500M4 7.500l8 1 8-1M12 8.500l-5 8.500h10zM4 16.500l3 .500M20 16.500l-3 .500M12 21v-4"/>',
    cadenas: '<rect x="5.500" y="11" width="13" height="9" rx="1.500"/><path d="M8.500 11V8a3.500 3.500 0 0 1 7 0v3"/>',
    panier: '<path d="M4 10h16l-2 9H6zM8 10l4-6 4 6M9.500 13v3M12 13v3M14.500 13v3"/>',
    ballot: '<rect x="4" y="7" width="16" height="11" rx="3"/><path d="M9 7v11M15 7v11M4 12.500h16"/>',
    charrette: '<path d="M3 7h13v8H3zM16 10h4l1 5h-5"/><circle cx="8" cy="17.500" r="2.500"/><circle cx="17.500" cy="17.500" r="2"/>',
    navire: '<path d="M3 15h18l-2.500 5h-13zM12 15V3M12 4l6 8h-6M12 6l-5 6h5"/>',
    deplacer: '<path d="M4 8h13M13.500 4.500L17 8l-3.500 3.500M20 16H7M10.500 12.500L7 16l3.500 3.500"/>',
    marteau: '<path d="M14 4l6 6-3 3-6-6zM12.500 8.500L4 17l3 3 8.500-8.500"/>',
    equipage: '<circle cx="8" cy="8" r="3"/><circle cx="16.500" cy="9" r="2.500"/><path d="M2.500 20c0-4 2.500-6 5.500-6s5.500 2 5.500 6M14 20c0-3 1.500-5 4-5 2 0 3.500 1.500 3.500 4"/>',
    planches: '<path d="M3 8h18v3H3zM3 13h18v3H3zM7 8v3M15 13v3"/>',
    joyau: '<path d="M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l-1.500 5L12 20M15 4l1.500 5L12 20"/>',
    moitie: '<path d="M5 19L19 5"/><circle cx="7.500" cy="7.500" r="2.500"/><circle cx="16.500" cy="16.500" r="2.500"/>',
    main: '<path d="M8 13V6.500a1.500 1.500 0 0 1 3 0V11M11 11V5a1.500 1.500 0 0 1 3 0v6M14 11V6.500a1.500 1.500 0 0 1 3 0V14c0 4-2.500 6.500-6 6.500S6 18 5 15.500l-1.200-3c-.5-1.500 1.500-2.300 2.500-1l1.700 2"/>',
    sac: '<path d="M8 8h8l3 11a1.500 1.500 0 0 1-1.500 2h-11A1.500 1.500 0 0 1 5 19zM9 8V6a3 3 0 0 1 6 0v2"/>',
    habit: '<path d="M9 4l3 2 3-2 5 3-2 4-2-1v10H8V10l-2 1-2-4z"/>',
    lettre: '<path d="M4 6h16v12H4zM4 7l8 6 8-6"/>',
    de: '<path d="M12 3l8 6-3 11H7L4 9zM12 3l4 9-4 4-4-4zM4 9l4 3M20 9l-4 3M12 16v4"/>',
    baton: '<path d="M6 20L18 4M15.500 5.500l2.500 2M7 17.500l2 1.500"/>',
    dague: '<path d="M5 19l3.500-3.500M7 14l3 3M9.500 15.500L19 5l-1 5-7 7z"/>',
    fiole: '<path d="M10 4h4M10.500 4v5.500L6.500 18a1.500 1.500 0 0 0 1.400 2h8.200a1.500 1.500 0 0 0 1.400-2l-4-8.500V4M8.500 15h7"/>',
    jambe: '<path d="M9 3h6l-1 8h-4zM10 11l1 8h2l1-8M9 19h6v2H9z"/>',
    parchemin: '<path d="M7 4h11v13a3 3 0 0 1-3 3H6a2 2 0 0 0 2-2zM6 20a2 2 0 0 1-2-2v-1h4M10.500 8.500h4.500M10.500 12h4.500"/>',
    selection: '<path d="M6 3.500l12 9-5.500 1 3 6-2.500 1.200-3-6L6 18.500z"/>',
    terrain: '<path d="M12 4l9 5-9 5-9-5zM3 14l9 5 9-5"/>',
    hauteur: '<path d="M4 20h16M7 20V10M7 10l-3 3M7 10l3 3M15 20V5M15 5l-3 3M15 5l3 3"/>',
    murs: '<path d="M3 6h18v12H3zM3 10h18M3 14h18M9 6v4M15 10v4M9 14v4M15 6v0"/>',
    volee: '<path d="M3 20h5v-4h5v-4h5V8h3"/>',
    crenelage: '<path d="M3 20V8h4v4h3V8h4v4h3V8h4v12z"/>',
    decor: '<path d="M7 4h10c2 5 2 11 0 16H7C5 15 5 9 7 4zM5.800 9h12.400M5.800 15h12.400"/>',
    personnage: '<circle cx="12" cy="7.500" r="3.500"/><path d="M5 20c0-4.500 3-7 7-7s7 2.500 7 7"/>',
    baliste: '<path d="M4 18l14-9M6 8c5 0 9 4 9 9M4 18l1-4M4 18l4 .5M18 9l2-3"/>',
    depart: '<path d="M6 21V4M6 4h11l-3 4 3 4H6"/>',
    zone: '<path d="M4 4h4M11 4h3M17 4h3v3M20 10v4M20 17v3h-3M14 20h-3M8 20H4v-3M4 14v-4M4 7V4"/>',
    gomme: '<path d="M4 16l9-10 7 6-7 8H8zM9.500 10.500l6.500 6M12 20h8"/>',
    epingle: '<path d="M12 21c-4-5-6-8-6-11a6 6 0 0 1 12 0c0 3-2 6-6 11z"/><circle cx="12" cy="10" r="2.200"/>',
    chemin: '<circle cx="5.500" cy="18" r="2"/><circle cx="18.500" cy="6" r="2"/><path d="M7.500 18h6a3 3 0 0 0 0-6h-3a3 3 0 0 1 0-6h6"/>',
    copier: '<rect x="8" y="8" width="12" height="12" rx="1.500"/><path d="M16 8V4H4v12h4"/>',
    coller: '<rect x="5" y="5" width="14" height="16" rx="1.500"/><path d="M9 5V3h6v2M8.500 11h7M8.500 15h5"/>',
    dupliquer: '<rect x="4" y="4" width="12" height="12" rx="1.500"/><path d="M20 8v12H8M10 7v6M7 10h6"/>',
    refaire: '<path d="M15 6.500L19.500 11 15 15.500M19.500 11H10a4.500 4.500 0 0 0 0 9h4"/>',
    couches: '<path d="M12 4l9 4.500-9 4.500-9-4.500zM3 12.500l9 4.500 9-4.500M3 16.500l9 4.500 9-4.500"/>',
  };
  /* le tracé prend la teinte de la pièce qui le porte ; `couleur` ne se passe que hors pièce */
  const picto = (nom, taille = 22, couleur = 'currentColor', trait = 1.6) => `<svg data-primitive="picto" width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="${couleur}" stroke-width="${trait}" stroke-linecap="round" stroke-linejoin="round">${PICTOS[nom]}</svg>`;

  /* les bustes : silhouette de la teinte du camp, détails sombres `.s`, clairs `.c` */
  const BASE = '<path d="M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z"/>';
  const BUSTES = {
    ilyanwe: '<path d="M16 90c0-17 7-25 19-27l-2-8c-6-5-8-15-5-23 3-8 19-8 22 0 3 8 1 18-5 23l-2 8c12 2 19 10 19 27z"/><path d="M25 37l-10-10 10 3zM53 37l10-10-10 3z"/><path d="M21 41c-3-17 5-30 18-30s21 13 18 30c4 10 5 23 3 36l-9-7c2-10 1-21-3-28-4-5-14-5-18 0-4 7-5 18-3 28l-9 7c-2-13-1-26 3-36z" class="s"/>',
    berta: '<path d="M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28z"/><path d="M24 31c0-12 7-19 15-19s15 7 15 19c-10-5-20-5-30 0z" class="s"/><path d="M52 33c7 9 7 22 2 33l-6-3c4-10 4-19-1-27z" class="s"/>',
    gobelin: '<path d="M18 90c0-14 8-20 17-22l-1-5c-8-4-11-13-8-21 3-8 23-8 26 0 3 8 0 17-8 21l-1 5c9 2 17 8 17 22z"/><path d="M27 45L5 34l20 21zM51 45l22-11-20 21z"/><path d="M24 47c-2-16 5-27 15-31 10 4 17 15 15 31-10-6-20-6-30 0z" class="s"/>',
    orc: '<path d="M4 90c0-22 11-30 25-32l-1-6c-8-5-11-17-7-26 4-9 32-9 36 0 4 9 1 21-7 26l-1 6c14 2 25 10 25 32z"/><path d="M21 33c7-6 29-6 36 0l-3 5c-9-4-21-4-30 0z" class="s"/><path d="M29 54l-2-11 6 8zM49 54l2-11-6 8z" class="c"/>',
    cheval: '<path d="M10 90c0-24 6-38 18-46l-6-20 9 6c4-8 10-12 18-12l2-12 7 13c8 6 13 16 14 28l-12 10-8-10c-4 6-5 14-3 22l6 21z"/><path d="M33 22c-2 14 0 26 6 36l-9 6c-6-12-7-26-3-40z" class="s"/>',
    bjorn: BASE + '<path d="M24 31c0-12 7-19 15-19s15 7 15 19c-10-5-20-5-30 0z" class="s"/>',
    mira: BASE + '<path d="M22 40c-3-17 5-29 17-29s20 12 17 29c4 10 4 22 2 33l-8-6c2-10 1-20-3-27-4-5-12-5-16 0-4 7-5 17-3 27l-8 6c-2-11-2-23 2-33z" class="s"/>',
    aldric: BASE + '<path d="M25 30c0-11 6-18 14-18s14 7 14 18c-9-4-19-4-28 0z" class="s"/><path d="M25 27c9-4 19-4 28 0v5c-9-4-19-4-28 0z" class="c"/>',
    greta: BASE + '<circle cx="39" cy="8" r="6.500" class="s"/><path d="M24 33c-1-13 6-21 15-21s16 8 15 21c-4-7-9-10-15-10s-11 3-15 10z" class="s"/>',
    hote: BASE + '<path d="M22 34c-2-14 6-23 17-23s19 9 17 23c-3-8-9-12-17-12s-14 4-17 12z" class="s"/><circle cx="39" cy="9" r="5" class="s"/>',
    docteur: BASE + '<path d="M21 28h36l-3 6H24zM27 28c0-11 5-17 12-17s12 6 12 17z" class="s"/>',
    brasseur: '<path d="M8 90c0-20 10-27 24-29l-1-7c-7-5-9-17-5-25 4-8 22-8 26 0 4 8 2 20-5 25l-1 7c14 2 24 9 24 29z"/><path d="M25 30c0-10 6-16 14-16s14 6 14 16c-9-3-19-3-28 0z" class="s"/>',
    batelier: BASE + '<path d="M18 30h42l-2 5H20zM25 30c1-12 6-18 14-18s13 6 14 18z" class="s"/>',
    cocher: BASE + '<path d="M17 27h44v4H17zM27 27V13h24v14z" class="s"/>',
    drapier: BASE + '<path d="M22 31c0-13 8-20 17-20s17 7 17 20c-5-5-11-7-17-7s-12 2-17 7z" class="s"/><path d="M22 30h34v4H22z" class="s"/>',
    gustav: '<path d="M6 90c0-21 11-28 25-30l-1-6c-8-5-10-18-6-27 4-9 26-9 30 0 4 9 2 22-6 27l-1 6c14 2 25 9 25 30z"/><path d="M24 30c1-4 3-7 6-9-3 4-4 7-4 11zM54 30c-1-4-3-7-6-9 3 4 4 7 4 11z" class="s"/><path d="M30 48c6 4 12 4 18 0-2 6-16 6-18 0z" class="s"/>',
    astrid: BASE + '<path d="M21 26c1-9 9-15 20-14 9 1 15 6 14 13-11-3-23-3-34 1z" class="s"/><path d="M23 34c-1 8 0 16 2 22l5-3c-2-7-2-13 0-19zM55 34c1 8 0 16-2 22l-5-3c2-7 2-13 0-19z" class="s"/>',
    /* les voyageurs à recruter de la nouvelle partie */
    kirsten: BASE + '<path d="M23 36c-3-15 5-25 16-25s19 10 16 25l-3 8c1-9-1-17-4-20-5-4-13-4-18 0-3 3-5 11-4 20z" class="s"/>',
    harbull: '<path d="M16 90c0-15 8-21 19-23l-1-6c-8-4-11-14-7-22 4-8 20-8 24 0 4 8 1 18-7 22l-1 6c11 2 19 8 19 23z"/><path d="M24 40c-3-13 4-22 15-22s18 9 15 22c-2-7-8-10-15-10s-13 3-15 10z" class="s"/>',
    sigrid: BASE + '<path d="M22 34c-2-14 6-23 17-23s19 9 17 23c-3-8-9-12-17-12s-14 4-17 12z" class="s"/><path d="M36 13h6v12h-6zM31 17h16v4H31z" class="c"/>',
    malmir: '<path d="M16 90c0-17 7-25 19-27l-2-8c-6-5-8-15-5-23 3-8 19-8 22 0 3 8 1 18-5 23l-2 8c12 2 19 10 19 27z"/><path d="M25 37l-10-10 10 3zM53 37l10-10-10 3z"/><path d="M24 30c0-12 7-19 15-19s15 7 15 19c-10-5-20-5-30 0z" class="s"/>',
    /* les possessions : le navire, la bête, le véhicule */
    navire: '<path d="M6 66h66l-9 17H16z"/><path d="M37 12h4v54h-4z"/><path d="M13 23c17 5 35 5 52 0 3 12 3 25-1 35-17 5-33 5-50 0-4-10-4-23-1-35z"/><path d="M41 12l14 4-14 4z"/>',
    mule: '<path d="M18 90c0-20 5-33 13-41-6-8-8-17-6-27l-7-18 11 13c3-2 6-3 10-3s7 1 10 3l10-13-6 18c2 10 0 19-6 27 8 8 14 21 14 41z"/><path d="M33 22c2 8 2 16 0 24M45 22c-2 8-2 16 0 24" stroke="#1c1410" stroke-width="2" fill="none"/>',
    charrette: '<path d="M8 30h54l6 8v20H8z"/><path d="M62 44h14v4H62z"/><circle cx="26" cy="66" r="15" fill="none" stroke="#2a1f17" stroke-width="5"/><path d="M26 51v30M11 66h30M15.500 55.500l21 21M36.500 55.500l-21 21" stroke="#2a1f17" stroke-width="2.500"/>',
    /* le héros qui se dessine : au trait de sanguine, avec ses repères */
    esquisse: '<path d="M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28"/><path d="M21 26c1-9 9-15 20-14 9 1 15 6 14 13-11-3-23-3-34 1z" class="s"/><path d="M39 2v88M10 42h58" class="repere"/>',
  };
  /* Wanda, voyageuse à recruter, porte le buste de Mira */
  BUSTES.wanda = BUSTES.mira;
  const CAMP = { hote: 'pnj', docteur: 'pnj', brasseur: 'pnj', batelier: 'pnj', cocher: 'pnj', drapier: 'pnj', gustav: 'pnj', esquisse: 'esquisse' };
  const MATIERE = { heros: 'laiton', esquisse: 'laiton', ennemi: 'fer', pnj: 'fer' };
  /* `taille` : menu, petit, moyen, grand, maitre, affiche ; sans `genre`, la place est libre */
  const portrait = (genre, { camp = CAMP[genre] ?? 'heros', taille = 'moyen', choisi = false, classe = '', style = '' } = {}) => `<div class="portrait ${genre ? `${MATIERE[camp]} ${camp}` : 'fer vide'} ${taille}${choisi ? ' choisi' : ''} ${classe}" data-primitive="portrait" style="${style}"><div>${genre ? `<svg viewBox="0 0 78 90" preserveAspectRatio="xMidYMax slice">${BUSTES[genre]}</svg>` : picto('plus', 26, undefined, 1.4)}</div></div>`;

  /* le bouton rond : `contenu` = nom de pictogramme ou chiffre ; `taille` menu, petit, moyen, grand, maitre ; le pictogramme suit */
  const ROND = { menu: [11, 3], petit: [18, 1.6], moyen: [20, 1.6], grand: [24, 1.6], maitre: [44, 1.6] };
  const rond = (contenu, taille = 'moyen', { ferme = false, arme = false, survol = false } = {}) => `<div class="bouton-rond ${ferme ? 'fer ferme' : 'laiton'} ${taille}${arme ? ' arme' : ''}${survol ? ' survol' : ''}" data-primitive="rond"><div>${PICTOS[contenu] ? picto(contenu, ROND[taille][0], undefined, ROND[taille][1]) : `<b>${contenu}</b>`}</div></div>`;
  /* la plaque : `taille` appel, moyenne, petite, ou geste (la rangée des gestes de la fenêtre du bas, sur trois lignes au
     plus) ; `numero` : sa touche, en tête ; `prix` : un nombre, à droite du libellé, seul au centre sans libellé */
  const plaque = (libelle, { armee = false, fermee = false, survol = false, icone = null, numero = null, prix = null, taille = 'moyenne', classe = '', style = '' } = {}) => `<div class="plaque ${fermee ? 'fer fermee' : 'laiton'} ${taille}${armee ? ' armee' : ''}${survol ? ' survol' : ''} ${classe}" data-primitive="plaque" style="${style}"><div>${numero == null ? '' : `<b class="numero">${numero}</b>`}${icone ? picto(icone, 19, undefined, 1.7) : ''}${libelle}${prix ? `<span class="prix chiffres${libelle ? '' : ' seul'}">${prix}</span>` : ''}</div></div>`;
  /* choisir par carte : la plaque haute, un portrait et deux lignes ; `marque` : son étiquette, sur sa ligne sous le texte ;
     `refus` : la bulle de la carte fermée survolée ; `detail` : tout son détail, dans la bulle de son survol */
  const carte = (nom, sous, { armee = false, fermee = false, portrait: buste = '', classe = '', refus = '', detail = '', marque = '' } = {}) => `<div class="plaque ${fermee ? 'fer fermee' : 'laiton'} carte${armee ? ' armee' : ''} ${classe}" data-primitive="carte"><div>${buste}<div class="qui"><div class="n gothique">${nom}</div><div class="c" data-secondaire>${sous}</div></div>${marque ? `<div class="marque-de-carte">${etiquette({ texte: marque })}</div>` : ''}</div>${refus ? raison(refus) : ''}${detail ? raison(detail, { survolee: false }) : ''}</div>`;
  /* l'outil : un rond et son libellé ; `ouvert` : son écran est posé ; `taille` du rond, `grand` hors du jeu */
  const outil = (nom, libelle, { ouvert = false, ferme = false, taille = 'petit' } = {}) => `<div class="outil${ouvert ? ' ouvert' : ''}" data-primitive="outil">${rond(nom, taille, { ferme, arme: ouvert })}<span class="rubrique">${libelle}</span></div>`;
  /* le médaillon à pictogramme : `taille` grand, moyen, petit ; `inerte` : il ne se presse pas ; `vise` : ce qu'il
     désigne est visé */
  const MEDAILLON = { grand: 27, moyen: 20, petit: 15 };
  const medaillon = (nom, { taille = 'grand', ferme = false, inerte = false, vise = false } = {}) => `<div class="medaillon ${ferme || inerte ? 'fer' : 'laiton'} ${taille}${ferme ? ' ferme' : ''}${inerte ? ' inerte' : ''}${vise ? ' vise' : ''}" data-primitive="medaillon"><div>${picto(nom, MEDAILLON[taille])}</div></div>`;
  /* le disque numéroté : `taille` grand, moyen, petit ; `vide` : la réserve est épuisée */
  const disque = (n, { taille = 'moyen', vide = false } = {}) => `<div class="disque fer ${taille}${vide ? ' vide' : ''}" data-primitive="disque"><div>${n}</div></div>`;
  /* les réserves d'un héros : un jeton par réserve, chacun dans sa case de largeur fixe, son icône
     (un pictogramme, ou le portrait de qui la porte) et son disque ; son nom et sa valeur dans la bulle de son survol
     (`survol`), comme les influences du seuil (fiche `user-doctrine-icone-identifie-survol-detaille`) ; `taille` du disque */
  const reserves = (r, taille = 'petit') => `<div class="en-reserve ${taille}" data-primitive="reserves">${r.map(({ valeur, icone, nom, survol = false }) => `<div class="res${valeur ? '' : ' vide'}">${icone}${disque(valeur, { taille, vide: !valeur })}${survol ? raison(`${nom} : ${valeur}`) : ''}</div>`).join('')}</div>`;
  /* le d10 du d100, vu de face : la silhouette et la face du dé de `navigation/des` (src/data/icons/defs/navigation.ts:11-13), à 36×40 */
  const d10 = (texte) => `<svg data-primitive="d10" width="36" height="40" viewBox="0.5 -0.5 23 25"><path d="M12 1L21.5 9.9V14.1L12 23L2.5 14.1V9.9Z" fill="#b8a67e"/><path d="M12 23V18.4L4.8 13.6L2.5 14.1ZM12 23V18.4L19.2 13.6L21.5 14.1Z" fill="#2a1d12" fill-opacity=".16"/><path d="M12 1L19.2 13.6L12 18.4L4.8 13.6Z" fill="#f1e6cc"/><path d="M12 1L19.2 13.6L12 18.4L4.8 13.6ZM4.8 13.6L2.5 14.1M19.2 13.6L21.5 14.1M12 18.4V23" fill="none" stroke="#2a1d12" stroke-width=".55" stroke-linejoin="round"/><path d="M12 1L21.5 9.9V14.1L12 23L2.5 14.1V9.9Z" fill="none" stroke="#2a1d12" stroke-width=".8" stroke-linejoin="round"/><text x="12" y="${texte.length > 1 ? 14.2 : 14.8}" text-anchor="middle" font-family="Grenze Gotisch" font-weight="600" font-size="${texte.length > 1 ? 6.6 : 8.4}" fill="#2a1d12">${texte}</text></svg>`;
  /* le sceau de cire : `contenu` = nom de pictogramme ou chiffre ; `taille` menu, petit, moyen, grand, maitre ; `etat` reussite, reussite critique ou
     vide ; `de` : le dé dont le chiffre est le jet, écrit dessous */
  const SCEAU = { menu: 12, petit: 15, moyen: 20, grand: 26, maitre: 32 };
  const sceau = (contenu, taille = 'petit', { etat = '', classe = '', de = '' } = {}) => `<div class="sceau ${taille} ${etat}${de ? ' de' : ''} ${classe}" data-primitive="sceau">${PICTOS[contenu] ? picto(contenu, SCEAU[taille], undefined, 1.9) : `<b>${contenu}</b>`}${de ? `<i>${de}</i>` : ''}</div>`;
  /* le ruban : le titre d'un cadre, centré sur son `left` */
  const ruban = (texte, { style = '' } = {}) => `<div class="ruban gothique" data-primitive="ruban" style="${style}">${texte}</div>`;
  /* le cadre de chêne ferré : géométrie en px (une cote `null` reste à la feuille), `matiere` du fond, `ruban`,
     `tete` : ce qui se pose sur le bord haut ; `piece` : son rôle au relevé du rendu, son `id` sans autre rôle */
  const cadre = (id, x, y, w, h, matiere, contenu, { ruban: titre = null, classe = '', tete = '', piece = id } = {}) => `<div id="${id}" class="cadre bois ${classe}" data-primitive="cadre" data-piece="${piece}" style="${[['left', x], ['top', y], ['width', w], ['height', h]].filter(([, v]) => v != null).map(([k, v]) => `${k}:${v}px`).join(';')}"><div class="fond ${matiere}" data-emplacement="contenu">${contenu}</div>${tete}${ferrures}${titre ? ruban(titre) : ''}</div>`;
  /* une rangée de cartes se lit en liste à partir de quatre, paginée, ou quand ses cartes n'y tiennent pas à 200 de large */
  const ranger = () => document.querySelectorAll('.cartes').forEach((r) => {
    const n = r.querySelectorAll(':scope>.carte').length;
    r.classList.toggle('liste', r.classList.contains('paginee') || n > 3 || r.clientWidth < n * 200 + (n - 1) * 9);
    r.querySelectorAll(':scope>.carte').forEach((c) => {
      c.classList.remove('deux-lignes');
      const l = c.querySelector('.c');
      if (r.classList.contains('liste') && l && l.scrollHeight > 1.5 * parseFloat(getComputedStyle(l).lineHeight)) c.classList.add('deux-lignes');
    });
  });
  /* aucun clou du haut d'un cadre à moins de 12 px de son ruban, queues comprises : le clou se retire */
  const degager = () => document.querySelectorAll('.cadre>.ruban').forEach((r) => {
    const q = r.getBoundingClientRect();
    r.parentElement.querySelectorAll(':scope>.clou[style*="top"]').forEach((c) => { const k = c.getBoundingClientRect(); if (k.right > q.left - 12 && k.left < q.right + 12) c.remove(); });
  });
  /* la bulle reste dans son cadre (dans la vue hors cadre, sous ce qui la rogne) et ne couvre aucun texte libre, pas
     même le libellé de l'élément qu'elle qualifie, ni d'abord un autre contrôle : au-dessus de lui, centrée, puis alignée
     sur son bord droit ou gauche, décalée pour rester dans le cadre ; sinon dessous, de même, puis sous les lignes de texte qui le bordent ; sinon à sa droite, puis à sa
     gauche, centrée sur sa hauteur ; sinon la raison prend la place de
     la ligne secondaire de l'élément refusé (`data-secondaire`) ; sans elle, la bulle peut couvrir un autre contrôle,
     son libellé compris, jamais un texte libre : sans aucune pose, elle porte `data-sans-pose`, que le relevé refuse */
  const poserLesBulles = () => {
    const lignesDe = (e) => [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).flatMap((n) => { const g = document.createRange(); g.selectNodeContents(n); return [...g.getClientRects()].filter((l) => l.width && l.height); });
    const CONTROLE = '.plaque, .bouton-rond, .champ, .portrait, .jauge, .sceau, .disque, .medaillon, .etiquette.pastille, .facettes .etiquette, .niche';
    const textes = [...document.querySelectorAll('#ui *')].filter((e) => !e.closest('.bulle-refus') && e.checkVisibility({ opacityProperty: true, visibilityProperty: true })).map((e) => ({ e, lignes: lignesDe(e) }));
    const controles = [...document.querySelectorAll(`#ui :is(${CONTROLE})`)];
    document.querySelectorAll('.bulle-refus:not([hidden])').forEach((b) => {
      const refuse = b.parentElement;
      /* l'élément survolé est en vue : ce qui le fait défiler l'y amène */
      refuse.scrollIntoView({ block: 'nearest' });
      const r = refuse.getBoundingClientRect();
      const bord = [...(function* ancetres(a) { for (; a && a.id !== 'ui'; a = a.parentElement) yield a; })(refuse)].filter((a) => a.matches('.cadre') || getComputedStyle(a).overflow !== 'visible')
        .reduce((c, a) => { const q = a.getBoundingClientRect(); return new DOMRect(Math.max(c.left, q.left), Math.max(c.top, q.top), Math.min(c.right, q.right) - Math.max(c.left, q.left), Math.min(c.bottom, q.bottom) - Math.max(c.top, q.top)); }, document.getElementById('ui').getBoundingClientRect());
      const autres = controles.filter((c) => !c.contains(b)).map((c) => c.getBoundingClientRect());
      /* les textes libres : hors de tout contrôle, sauf celui que la bulle qualifie */
      const libres = textes.filter(({ e }) => !e.closest(CONTROLE) || e.closest(CONTROLE).contains(b)).flatMap((t) => t.lignes);
      const libre = (obstacles) => (q, [x, y]) => q.left + x >= bord.left && q.right + x <= bord.right && q.top + y >= bord.top && q.bottom + y <= bord.bottom
        && !obstacles.some((l) => Math.min(l.right, q.right + x) - Math.max(l.left, q.left + x) > 1 && Math.min(l.bottom, q.bottom + y) - Math.max(l.top, q.top + y) > 1);
      /* le décalage de côté qui garde la bulle `q`, déplacée de `x`, dans le cadre */
      const dans = (q, x = 0) => x + Math.max(bord.left + 6 - q.left - x, Math.min(0, bord.right - 6 - q.right - x));
      const cotes = [() => 0, (q) => r.right - q.right, (q) => r.left - q.left];
      const sousLesLignes = (q, x) => Math.max(r.bottom, ...textes.flatMap((t) => t.lignes).filter((l) => l.right > q.left + x && l.left < q.right + x && l.top >= r.bottom - 1 && l.top < r.bottom + 11 + q.height).map((l) => l.bottom));
      const milieu = (q) => (r.top + r.bottom) / 2 - (q.top + q.bottom) / 2;
      const places = [
        ...cotes.map((cote) => ['dessus', (q) => [dans(q, cote(q)), 0]]),
        ...cotes.map((cote) => ['dessous', (q) => [dans(q, cote(q)), r.bottom + 11 - q.top]]),
        /* dessous, passé sous les lignes de texte qui le bordent (l'issue sous le camp) */
        ...cotes.map((cote) => ['dessous', (q) => { const x = dans(q, cote(q)); return [x, sousLesLignes(q, x) + 11 - q.top]; }]),
        ['cote-droit', (q) => [r.right + 11 - q.left, milieu(q)]],
        ['cote-gauche', (q) => [r.left - 11 - q.right, milieu(q)]],
      ];
      const poser = (obstacles) => places.find(([, ou]) => { const q = b.getBoundingClientRect(); return libre(obstacles)(q, ou(q)); });
      const secondaire = refuse.querySelector('[data-secondaire]');
      const pose = poser([...textes.flatMap((t) => t.lignes), ...autres]) ?? (secondaire ? null : poser(libres));
      if (!pose && secondaire) {
        secondaire.textContent = b.textContent;
        secondaire.classList.add('raison-de-refus');
        b.remove();
        refuse.scrollIntoView({ block: 'nearest' });
        return;
      }
      /* aucune pose ne laisse libre tout texte libre : la bulle reste au-dessus, marquée, et le relevé refuse l'état */
      if (!pose) b.dataset.sansPose = '';
      const [nom, ou] = pose ?? places[0];
      const [x, y] = ou(b.getBoundingClientRect());
      b.style.translate = `${x}px ${y}px`;
      if (!nom.startsWith('cote-')) b.style.setProperty('--pointe', `${-x}px`);
      b.classList.add(nom);
    });
  };
  /* les clous d'un meuble (barre, jet, arrêt), ou d'un bandeau de `cases` héros : aux bords et entre deux cases */
  const MEUBLE = [[.0593, .2797, .7203, .9407], [.0593, .2797, .5, .7203, .9407]];
  const clouer = (cases = null) => (cases ? [0, 1].map(() => [.05, ...Array.from({ length: cases - 1 }, (_, k) => (k + 1) / cases), .945]) : MEUBLE)
    .map((ligne, k) => ligne.map((t) => `<i class="clou" data-primitive="clouer" style="left:${(100 * t).toFixed(2)}%;${k ? 'bottom' : 'top'}:3px"></i>`).join('')).join('');
  /* le cartouche : le médaillon de ce dont on parle, son nom et ce qu'il est (`sous`, une ligne ou une liste de lignes) ; `taille` ligne, ou titre : celui de
     l'écran, dans son cadre au coin haut-gauche */
  const cartouche = ({ icone, nom: nomme, sous = '', marque = '', texte = nomme, taille = 'ligne' }) => {
    const deTitre = taille === 'titre';
    const tenu = `${nomme}${marque ? etiquette({ texte: marque, teinte: 'or' }) : ''}`;
    const corps = `${medaillon(icone, deTitre ? { inerte: true } : { taille: 'moyen' })}<div>${deTitre ? `<div class="n gothique" data-texte="${texte}">${tenu}</div>` : nom({ texte: tenu, taille: 'grand', cle: texte })}${[sous].flat().filter(Boolean).map((s) => sousTitre({ texte: s })).join('')}</div>`;
    return deTitre ? cadre('titre', null, null, null, null, 'bois cartouche', corps, { piece: 'cartouche' }) : `<div class="cartouche" data-primitive="cartouche">${corps}</div>`;
  };
  /* le rang d'un personnage : son portrait, son nom (`gothique` : celui qui agit, la taille de son `nom`), `sous` ce qu'il
     est, `corps` sous son nom, `fin` au bout du rang */
  const rang = (genre, { camp, taille = 'moyen', choisi = false, nom: nomme, gothique = '', sous = '', corps = '', fin = '', classe = '' }) => `<div class="rang ${camp === 'ennemi' ? 'ennemi' : ''} ${classe}" data-primitive="rang">${portrait(genre, { camp, taille, choisi })}
    <div class="qui">${gothique ? nom({ texte: nomme, taille: gothique, cle: `rang ${nomme}` }) : `<div class="nom rubrique ombre" data-texte="rang ${nomme}">${nomme}</div>`}${sous ? sousTitre({ texte: sous }) : ''}${corps}</div>${fin}</div>`;
  /* le contenu de chaque place d'un cadre (`cadre/place`), que `rendu.js` pose au rect de sa ligne (`PLACES`) ; une
     place sans contenu n'est pas posée */
  const places = (cadre, contenus) => Object.entries(contenus).filter(([, html]) => html).map(([nom, html]) => `<div class="place" data-primitive="places" data-emplacement="place" data-place="${cadre}/${nom}">${html}</div>`).join('');
  /* la grille d'une colonne (`cadre` : son rôle) : sa tête, son corps qui défile, ses entrées à écarts uniformes, ce
     qui décide au pied du corps (`pied` : une place fixe entre le corps et le geste, que le corps laisse dans tous les
     états), son geste au pied fixe et la note sous lui, chacun à sa place (`cadre/tete`, `cadre/corps`, `cadre/pied`,
     `cadre/geste`, `cadre/note`) ; sans tête, le corps prend aussi sa bande (`cadre/plein`, qu'aucun état ne porte avec
     la tête) ; `liste` : le corps est une liste longue par nature (`defile`) */
  const colonne = (cadre, { tete = '', corps = '', pied = '', geste = '', note = '', liste = false }) => `<div class="colonne" data-primitive="colonne">${places(cadre, { tete, [tete ? 'corps' : 'plein']: corps && defile(corps, 'corps', { liste }), pied, geste, note })}</div>`;
  /* les sections d'un panneau en onglets, sur son bord haut : l'active est le ruban, les autres des plaques ; `cadre` :
     chaque onglet à sa place `cadre/onglet-k`, de même largeur, une section absente (`null`) laisse la sienne vide */
  const onglets = (noms, active, cadre = '') => {
    const onglet = (s) => (s === active ? ruban(s) : plaque(s, { taille: 'petite' }));
    return `<div class="onglets" data-primitive="onglets">${cadre ? places(cadre, Object.fromEntries(noms.map((s, k) => [`onglet-${k + 1}`, s && onglet(s)]))) : noms.map(onglet).join('')}</div>`;
  };
  /* les sections d'un panneau en signets, au bord droit de son registre : `sections` = [{ nom, compte, marque }], le
     signet `ouverte` est de laiton ; `marque` : une règle de la section est modifiée */
  const signets = (sections, ouverte) => `<div class="signets" data-primitive="signets" data-piece="signets">${sections.map(({ nom, compte = null, marque = false }) => `<div class="signet${nom === ouverte ? ` ouvert${nom.length > 12 ? ' serre' : ''}` : ''}"><span class="rubrique">${nom}</span>${marque ? '<i class="cire"></i>' : ''}${compte == null ? '' : `<em class="chiffres">${compte}</em>`}</div>`).join('')}</div>`;
  /* ce qui suit ce qu'il désigne, hors de la table des cadres (`../rendu.js`) : `ancre` survol (aperçu, bulle de refus),
     scene (marque, pastille, poste) ou ancre (liste déroulée, fiche d'un combattant) */
  const mobile = (ancre) => ` data-mobile data-ancre="${ancre}"`;
  /* l'aperçu au survol : son nom, à droite ce qu'il est, son corps ; `vers` : le bord dont la pointe montre l'élément
     survolé (gauche, droite, haut, bas) ; `style` le place */
  /* la table d'un aperçu, à hauteur fixe, qui défile si elle déborde */
  const tableDApercu = (lignes) => defile(`<table>${lignes}</table>`, 'table');
  const apercu = ({ nom: nomme, sous = '', corps = '', vers = 'gauche', style = '' }) => `<div class="apercu parchemin vers-${vers}" data-primitive="apercu" data-piece="apercu"${mobile('survol')} style="${style}"><div class="tete">${nom({ texte: nomme, taille: 'grand' })}${sous ? sousTitre({ texte: sous }) : ''}</div>${corps}</div>`;
  /* la bannière d'issue d'un combat, et sous elle, chacun à sa place (`issue/suite`, `issue/geste`), ce que l'issue
     laisse (`suite`) et sa sortie, une plaque d'appel */
  const issue = (texte, { action = '', suite = '' } = {}) => `<div class="issue-du-combat" data-primitive="issue" data-piece="issue"><div class="banniere"><span class="gothique" data-texte="issue">${texte}</span></div>${places('issue', { suite: suite && `<p class="ombre" data-texte="suite de l'issue">${suite}</p>`, geste: action && plaque(action, { armee: true, taille: 'appel' }) })}</div>`;
  /* le titre d'un panneau, ou d'un écran hors cartouche (`ecran`, la forme du cartouche de titre) ; `cle` : son rôle au relevé */
  const titre = ({ texte, cle = '', ecran = false }) => `<div class="titre${ecran ? ' ecran' : ''} gothique" data-primitive="titre"${cle ? ` data-texte="${cle}"` : ''}>${texte}</div>`;
  /* le nom d'une personne, d'un lieu, d'un objet : `taille` grand, moyen ou petit ; `cle` : son rôle au relevé */
  const nom = ({ texte, taille = 'moyen', cle = '' }) => `<div class="nom-propre ${taille} gothique" data-primitive="nom"${cle ? ` data-texte="${cle}"` : ''}>${texte}</div>`;
  /* ce qu'est ce que nomme le titre ou le nom au-dessus de lui ; `cle` : son rôle au relevé */
  const sousTitre = ({ texte, cle = '' }) => `<div class="sous-titre" data-primitive="sousTitre"${cle ? ` data-texte="${cle}"` : ''}>${texte}</div>`;
  /* l'intertitre d'un bloc, sa note et ce qui se pose à sa fin ; nu : un trait voulu est un `filet()` posé au-dessus */
  const rubrique = ({ texte, note = '', fin = '' }) => `<div class="rub" data-primitive="rubrique">${texte}${note ? ` ${glose({ texte: note })}` : ''}${fin}</div>`;
  /* la ligne libellé-valeur, son libellé en rubrique : `courante`, la valeur à droite ; `empilee`, la valeur dessous ;
     `mesure`, la valeur « x / y » à droite et sa jauge dessous (`dessous`) ; `tabulaire`, la rangée d'un tableau, son
     libellé en entrée. `format` : `texte`, ou `nombre` en chiffres ; `etat` : `somme`, `tombee`, `seuil` ou `grise` ;
     `cle` : le rôle de la valeur au relevé */
  const ligne = ({ libelle, valeur, variante = 'courante', format = 'texte', dessous = '', etat = '', cle = '' }) => {
    const texte = cle ? ` data-texte="${cle}"` : '';
    return variante === 'tabulaire'
      ? `<tr class="libelle-valeur tabulaire${etat ? ` ${etat}` : ''}" data-primitive="ligne"><td>${libelle}</td><td class="valeur ${format}"${texte}>${valeur}</td></tr>`
      : `<div class="libelle-valeur ${variante}${etat ? ` ${etat}` : ''}" data-primitive="ligne">${rubrique({ texte: libelle })}<div class="valeur ${format}"${texte}>${valeur}</div>${dessous}</div>`;
  };
  /* la note : une précision, une aide ; `variante` courante, consigne (ce que le joueur a à faire) ou avertissement (un
     coût, un refus) ; `cle` : son rôle au relevé ; `secondaire` : une raison de refus peut prendre sa place (`poserLesBulles`) */
  const glose = ({ texte, variante = 'courante', cle = '', secondaire = false }) => `<span class="glose ${variante}" data-primitive="glose"${cle ? ` data-texte="${cle}"` : ''}${secondaire ? ' data-secondaire' : ''}>${texte}</span>`;
  /* l'étiquette : `variante` rectangle, pastille ou compte (en chiffres) ; `teinte` or, cire ou fer, sinon au repos ; `valeur` : le
     nombre qui suit le texte */
  const etiquette = ({ texte, variante = 'rectangle', teinte = '', valeur = null }) => `<span class="etiquette ${variante}${teinte ? ` ${teinte}` : ''}" data-primitive="etiquette">${texte}${valeur == null ? '' : `<em>${valeur}</em>`}</span>`;
  /* la puce d'une ligne, de la teinte de son texte : `losange`, ou `coche` (la ligne choisie) */
  const puce = (forme) => (forme === 'coche' ? `<i class="coche" data-primitive="puce">${picto('coche', 15, undefined, 2)}</i>` : '<i class="losange" data-primitive="puce"></i>');
  /* la ligne d'une liste, 28 de haut : sa `puce` (`losange`, `coche`) ou sa `marque` (un emplacement : pictogramme,
     portrait, sceau, case) devant le nom ; sa `precision`, sous le nom, la porte à 44 ; `fin` (un emplacement : chiffres,
     étiquette, plaques, raison) au bout ; `choisie` : bordure de laiton ; `refusee` : pâlie ; `cle` : le rôle du nom au
     relevé */
  const ligneDeListe = ({ puce: forme = '', marque = '', nom, precision = '', fin = '', choisie = false, refusee = false, cle = '' }) => `<div class="ligne-de-liste${precision ? ' a-precision' : ''}${choisie ? ' choisie' : ''}${refusee ? ' refusee' : ''}" data-primitive="ligneDeListe">${forme ? puce(forme) : ''}${marque}<span class="n"${cle ? ` data-texte="${cle}"` : ''}>${precision ? `<span>${nom}</span><small class="precision">${precision}</small>` : nom}</span>${fin}</div>`;
  /* entre deux textes d'une même ligne : `median`, le point médian entre deux espaces, où la ligne peut se couper */
  const separateur = (forme) => `<span class="separateur ${forme}" data-primitive="separateur"> · </span>`;
  /* le filet : `fondu` s'éteint vers les bords, `losange` au milieu, `or` sur un fond sombre */
  const filet = ({ fondu = false, losange = false, or = false } = {}) => `<div class="filet${fondu ? ' fondu' : ''}${or ? ' or' : ''}" data-primitive="filet">${losange ? puce('losange') : ''}</div>`;
  /* un choix parmi quelques valeurs nommées : la valeur tenue est dorée ; `egaux` : cases de même largeur */
  const segments = (options, la, { egaux = false } = {}) => `<span class="segments${egaux ? ' egaux' : ''}" data-primitive="segments">${options.map((o) => `<b class="${o === la ? 'la' : ''}">${o}</b>`).join('')}</span>`;
  const ouiNon = (v) => segments(['Non', 'Oui'], v ? 'Oui' : 'Non', { egaux: true });
  /* le curseur : `part` de 0 à 1 ; `largeur` null : celle de son hôte */
  const reglette = (part, largeur = 118) => `<span class="reglette" data-primitive="reglette"${largeur == null ? '' : ` style="width:${largeur}px"`}><u style="width:${100 * part}%"></u><i style="left:${100 * part}%"></i></span>`;
  /* la jauge : `teinte` cire (la vie) ou or ; `taille` fine ou forte ; `ajout` : la part prévue, hachurée */
  const jauge = (part, { teinte = 'cire', taille = 'fine', ajout = 0 } = {}) => `<div class="jauge ${teinte} ${taille}" data-primitive="jauge"><i style="width:${100 * part}%"></i>${ajout ? `<u style="left:${100 * part}%;width:${100 * ajout}%"></u>` : ''}</div>`;
  const vie = (pv, max) => jauge(pv / max);
  /* un rang de pas : `pleins` sur `total` ; en losanges, `taille` moyen ou petit, `teinte` cire ; `forme` clous : des ronds
     d'or par groupes de cinq */
  const rangDePas = ({ pleins, total, taille = 'moyen', teinte = '', forme = 'losanges' }) => `<div class="pas ${forme === 'clous' ? 'clous' : `${taille}${teinte ? ` ${teinte}` : ''}`}" data-primitive="rangDePas">${Array.from({ length: total }, (_, k) => `<i class="${k < pleins ? '' : 'vide'}"></i>`).join('')}</div>`;
  /* ce qui défile dans son cadre, qui garde sa taille : `data-defile` au relevé du rendu ; la suite cachée s'annonce
     par un fondu au pied, ce qui a défilé par un fondu en tête (`suites`), hors ce qui se pagine ; `au-pied` : il montre
     sa fin ; sinon, sa dernière action principale (plaque armée, étape en cours) vient au-dessus du fondu du pied ;
     `liste` : une liste longue par nature (`data-defile="liste"`), la seule que le relevé `masque` laisse déborder ; `cle` : l'id
     stable de ce qu'il porte, sa clé au relevé `contenu` */
  const defile = (contenu, classe = '', { liste = false, cle = '' } = {}) => `<div class="defile ${classe}" data-primitive="defile" data-emplacement="contenu" data-defile${liste ? '="liste"' : ''}${cle ? ` data-cle="${cle}"` : ''}>${contenu}</div>`;
  const suites = () => document.querySelectorAll('.defile:not(.pages)').forEach((d) => {
    const action = [...d.querySelectorAll('.plaque.armee, .en-cours')].at(-1);
    if (d.classList.contains('au-pied')) d.scrollTop = d.scrollHeight;
    else if (action) d.scrollTop += Math.max(0, action.getBoundingClientRect().bottom - d.getBoundingClientRect().bottom + parseFloat(getComputedStyle(d).getPropertyValue('--fondu')));
    d.classList.toggle('suite', d.scrollTop + d.clientHeight < d.scrollHeight - 1);
    d.classList.toggle('avant', d.scrollTop > 1);
  });
  /* ce qui se pagine (`defile(contenu, 'pages')`) : sa page tient un nombre entier de ses lignes, la suite est aux pages
     suivantes ; le folio de son cadre dit la page lue et leur nombre, à partir de deux */
  const paginer = () => document.querySelectorAll('.defile.pages').forEach((d) => {
    const ligne = parseFloat(getComputedStyle(d).lineHeight), hauteur = Math.floor(d.clientHeight / ligne) * ligne;
    Object.assign(d.style, { flex: 'none', height: `${hauteur}px` });
    const n = Math.ceil(d.scrollHeight / d.clientHeight);
    const folio = d.closest('.cadre').querySelector('.folio');
    folio.querySelector('b').textContent = `Page 1 sur ${n}`;
    folio.hidden = n < 2;
  });
  /* une ligne de liste dont le nom ne tient pas sur une ligne le passe sur deux, à 44 de haut */
  const plier = () => document.querySelectorAll('.ligne-de-liste:not(.a-precision)').forEach((l) => {
    const n = l.querySelector(':scope>.n');
    l.classList.toggle('a-deux-lignes', n.scrollWidth > n.clientWidth);
  });
  /* pose les pièces ; une fois les polices chargées, range les cartes, dégage les rubans de leurs clous, plie les lignes
     trop longues, pose les bulles, annonce les suites et les pages ; passe le grain */
  const monter = (pieces) => {
    document.getElementById('ui').innerHTML = pieces.join('');
    document.fonts.ready.then(() => { ranger(); degager(); plier(); poserLesBulles(); suites(); paginer(); });
    document.getElementById('grain').style.backgroundImage = svgUrl(`<svg xmlns='${NS}' width='300' height='300'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='9'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`);
  };

  /* ───────── la charte des gestes ───────── */
  /* fermer un panneau posé sur le jeu : la croix de laiton, en haut à droite de l'écran. `dansLePanneau` : elle se pose
     dans le cadre qu'elle ferme, dont la feuille la place */
  const croix = ({ dansLePanneau = false } = {}) => `<div class="croix" data-primitive="croix"${dansLePanneau ? '' : ' data-piece="fermer"'}>${rond('croix')}</div>`;
  /* quitter un lieu ou un écran de jeu : la pastille du bas à gauche, son libellé dit où l'on retourne */
  /* hors combat : le journal, et le système sous lui, au coin bas droit (`../dispositions.md`) */
  const coins = () => `<div id="coins" data-primitive="coins" data-piece="coins">${rond('journal', 'grand')}${rond('systeme', 'grand')}</div>`;
  const retour = (libelle, icone = 'sortie') => `<div class="retour" data-primitive="retour" data-piece="retour">${rond(icone, 'grand')}<span class="rubrique ombre">${libelle}</span></div>`;
  /* ouvrir un écran posé sur celui-ci (carte, dossier du navire, postes de bord) : la pastille du bord droit, la `rang`-ième */
  const ouvrir = (libelle, icone, rang) => `<div class="ouvrir" data-primitive="ouvrir" data-piece="ouvrir-${rang}"><span class="rubrique ombre">${libelle}</span>${rond(icone)}</div>`;
  /* régler une quantité : − et +, la valeur réglée entre les deux ; un bord atteint se ferme */
  const moinsPlus = ({ moins = true, plus = true, entre = '' } = {}) => `<div class="moins-plus" data-primitive="moinsPlus">${rond('moins', 'menu', { ferme: !moins })}${entre}${rond('plus', 'menu', { ferme: !plus })}</div>`;
  /* fiche `user-arbitrage-raison-de-refus-au-survol-jamais-inline` : la bulle du geste fermé que le curseur survole, ou
     le détail de ce qu'il survole (fiche `user-doctrine-icone-identifie-survol-detaille`) ; `survolee: false` : ce
     qu'elle qualifie n'est pas sous le curseur, la bulle est cachée et ne se pose au-dessus de rien */
  const raison = (texte, { survolee = true } = {}) => `<span class="bulle-refus parchemin" data-primitive="raison"${mobile('survol')}${survolee ? ' data-dessus' : ' hidden'}>${texte}</span>`;
  /* #3004. Acte individuel : `bourse({ heros, avoir })`, la bourse de celui qui agit. Entreprise commune ou tarif par
     personne : `bourse({ parts: [[nom, part, avoir]], total })`, la part de chacun réglable avant validation ;
     `reglable: false` pour qui regarde sans régler (l'invité d'une partie à plusieurs). */
  const bourse = ({ heros, avoir, parts, total, reglable = true }) => `<div class="qui-paie${parts ? ' parts' : ''}" data-primitive="bourse">${medaillon('bourse', { taille: 'moyen' })}<div class="q">${parts
    ? `<span class="rubrique">Bourses du groupe</span>${parts.map(([nom, part, reste]) => `<div class="part"><span>${nom}</span>${reglable ? moinsPlus({ entre: `<b class="chiffres">${part}</b>` }) : `<b class="chiffres">${part}</b>`}<i>sur ${reste}</i></div>`).join('')}<div class="total"><span class="rubrique">Total</span><b class="chiffres">${total}</b></div>`
    : `<span class="rubrique">Bourse ${de(heros)}</span><b class="chiffres">${avoir}</b>`}</div></div>`;
  /* les bourses du groupe au pied d'une page : une case fixe par héros, son portrait et sa part, puis le total ; le −/+
     de la part réglée (`reglee`) autour du portrait, ce que la bourse contient dans la bulle du survol (fiche
     `user-doctrine-icone-identifie-survol-detaille`) ; `reglable: false` comme `bourse` */
  const rangeeDeBourses = ({ parts, total, reglable = true }) => `<div class="bourses" data-primitive="rangeeDeBourses">${parts.map(({ id, nom, part, avoir, reglee }) => `<div class="case-bourse">${reglable && reglee ? moinsPlus({ entre: portrait(id, { taille: 'menu' }) }) : portrait(id, { taille: 'menu' })}<b class="chiffres" data-texte="part ${nom}">${part}</b>${raison(`${nom} : ${part} sur ${avoir}`, { survolee: false })}</div>`).join('')}<div class="case-bourse total">${medaillon('bourse', { taille: 'petit' })}<b class="chiffres" data-texte="total">${total}</b></div></div>`;
  /* « de » devant un nom, élidé devant une voyelle (« Bourse d’Ilyanwe », « Test d’Intuition ») */
  const de = (nom) => (/^[aeiouàâäéèêëîïôöùûüœæ]/i.test(String(nom)) ? `d’${nom}` : `de ${nom}`);
  /* saisir un texte : le libellé de rubrique s'il y en a un, la valeur et son curseur, ou l'attente d'un champ vide ;
     `defile` : la valeur, plus haute que le champ, y défile */
  const champ = (libelle, valeur, { attente = '', classe = '', defile = false } = {}) => `<label class="champ ${classe}" data-primitive="champ">${libelle ? `<span class="rubrique">${libelle}</span>` : ''}<b class="${valeur ? '' : 'vide'}"${defile ? ' data-defile' : ''}>${valeur || attente}${valeur ? '<i class="curseur-texte"></i>' : ''}</b></label>`;

  Object.assign(globalThis, {
    W, H, alea, melange,
    PICTOS, picto, BASE, BUSTES, portrait, rond, plaque, carte, outil, medaillon, disque, reserves, sceau, d10, ruban, cadre, clouer, cartouche, titre, nom, sousTitre, rubrique, ligne, glose, etiquette, rang, places, colonne, onglets, signets, apercu, tableDApercu, issue,
    puce, ligneDeListe, separateur, filet, segments, ouiNon, reglette, jauge, vie, rangDePas, monter, croix, coins, retour, ouvrir, moinsPlus, raison, bourse, rangeeDeBourses, champ, mobile, defile, de,
  });
}
