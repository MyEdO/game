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
    poing: '<path d="M7 11V7.500a1.500 1.500 0 0 1 3 0V7a1.500 1.500 0 0 1 3 0v.5a1.500 1.500 0 0 1 3 0V9a1.500 1.500 0 0 1 3 0v5c0 4-2.500 6.500-6.500 6.500S6 18 5 15l-1-3c-.4-1.500 1.500-2.500 3-1z"/>',
    plus: '<path d="M12 6v12M6 12h12"/>',
    moins: '<path d="M6 12h12"/>',
    ancre: '<circle cx="12" cy="5.500" r="2"/><path d="M12 7.500V20M5 13c0 4 3 7 7 7s7-3 7-7M8.500 11h7"/>',
    sablier: '<path d="M7 3h10M7 21h10M8.500 3c0 5 7 6.500 7 9s-7 4-7 9M15.500 3c0 5-7 6.500-7 9s7 4 7 9"/>',
    lune: '<path d="M19 14.500A8 8 0 0 1 9.500 5a8 8 0 1 0 9.500 9.500z"/>',
    ville: '<path d="M4 20V9l2-2 2 2v3h3V6l3-2.500L17 6v6h3v8zM4 20h16M13 9.500h2M7 14h.01M13 14h2"/>',
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
    refaire: '<path d="M15 6.500L19.500 11 15 15.500M19.500 11H10a4.500 4.500 0 0 0 0 9h4"/>',
    couches: '<path d="M12 4l9 4.500-9 4.500-9-4.500zM3 12.500l9 4.500 9-4.500M3 16.500l9 4.500 9-4.500"/>',
  };
  /* le tracé prend la teinte de la pièce qui le porte ; `couleur` ne se passe que hors pièce */
  const picto = (nom, taille = 22, couleur = 'currentColor', trait = 1.6) => `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="${couleur}" stroke-width="${trait}" stroke-linecap="round" stroke-linejoin="round">${PICTOS[nom]}</svg>`;

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
    astrid: BASE + '<path d="M21 26c1-9 9-15 20-14 9 1 15 6 14 13-11-3-23-3-34 1z" class="s"/><path d="M23 34c-1 8 0 16 2 22l5-3c-2-7-2-13 0-19zM55 34c1 8 0 16-2 22l-5-3c2-7 2-13 0-19z" class="s"/>',
    /* le héros qui se dessine : au trait de sanguine, avec ses repères */
    esquisse: '<path d="M14 90c0-18 8-26 20-28l-2-8c-6-5-8-16-4-24 4-7 18-7 22 0 4 8 2 19-4 24l-2 8c12 2 20 10 20 28"/><path d="M21 26c1-9 9-15 20-14 9 1 15 6 14 13-11-3-23-3-34 1z" class="s"/><path d="M39 2v88M10 42h58" class="repere"/>',
  };
  const CAMP = { hote: 'pnj', docteur: 'pnj', brasseur: 'pnj', batelier: 'pnj', cocher: 'pnj', drapier: 'pnj', esquisse: 'esquisse' };
  const MATIERE = { heros: 'laiton', esquisse: 'laiton', ennemi: 'fer', pnj: 'fer' };
  /* `taille` : menu, petit, moyen, grand, maitre, affiche ; sans `genre`, la place est libre */
  const portrait = (genre, { camp = CAMP[genre] ?? 'heros', taille = 'moyen', choisi = false, classe = '', style = '' } = {}) => `<div class="portrait ${genre ? `${MATIERE[camp]} ${camp}` : 'fer vide'} ${taille}${choisi ? ' choisi' : ''} ${classe}" style="${style}"><div>${genre ? `<svg viewBox="0 0 78 90" preserveAspectRatio="xMidYMax slice">${BUSTES[genre]}</svg>` : picto('plus', 26, undefined, 1.4)}</div></div>`;

  /* le bouton rond : `contenu` = nom de pictogramme ou chiffre ; `taille` menu, petit, moyen, grand, maitre ; le pictogramme suit */
  const ROND = { menu: [11, 3], petit: [18, 1.6], moyen: [20, 1.6], grand: [24, 1.6], maitre: [44, 1.6] };
  const rond = (contenu, taille = 'moyen', { ferme = false, arme = false, survol = false } = {}) => `<div class="bouton-rond ${ferme ? 'fer ferme' : 'laiton'} ${taille}${arme ? ' arme' : ''}${survol ? ' survol' : ''}"><div>${PICTOS[contenu] ? picto(contenu, ROND[taille][0], undefined, ROND[taille][1]) : `<b>${contenu}</b>`}</div></div>`;
  /* la plaque : `taille` appel, moyenne ou petite ; `numero` : sa touche, en tête ; `prix` à droite */
  const plaque = (libelle, { armee = false, fermee = false, survol = false, icone = null, numero = null, prix = null, taille = 'moyenne', classe = '', style = '' } = {}) => `<div class="plaque ${fermee ? 'fer fermee' : 'laiton'} ${taille}${armee ? ' armee' : ''}${survol ? ' survol' : ''} ${classe}" style="${style}"><div>${numero == null ? '' : `<b class="numero">${numero}</b>`}${icone ? picto(icone, 19, undefined, 1.7) : ''}${libelle}${prix ? `<span class="prix chiffres">${prix}</span>` : ''}</div></div>`;
  /* choisir par carte : la plaque haute, un portrait et deux lignes */
  const carte = (nom, sous, { armee = false, fermee = false, portrait: buste = '', classe = '' } = {}) => `<div class="plaque ${fermee ? 'fer fermee' : 'laiton'} carte${armee ? ' armee' : ''} ${classe}"><div>${buste}<div class="qui"><div class="n gothique">${nom}</div><div class="c">${sous}</div></div></div></div>`;
  /* l'outil : un rond et son libellé ; `ouvert` : son écran est posé ; `taille` du rond, `grand` hors du jeu */
  const outil = (nom, libelle, { ouvert = false, ferme = false, taille = 'petit' } = {}) => `<div class="outil${ouvert ? ' ouvert' : ''}">${rond(nom, taille, { ferme, arme: ouvert })}<span class="rubrique">${libelle}</span></div>`;
  /* le médaillon à pictogramme : `taille` grand, moyen, petit ; `inerte` : il ne se presse pas */
  const MEDAILLON = { grand: 27, moyen: 20, petit: 15 };
  const medaillon = (nom, { taille = 'grand', ferme = false, inerte = false } = {}) => `<div class="medaillon ${ferme || inerte ? 'fer' : 'laiton'} ${taille}${ferme ? ' ferme' : ''}${inerte ? ' inerte' : ''}"><div>${picto(nom, MEDAILLON[taille])}</div></div>`;
  /* le disque numéroté : `taille` grand, moyen, petit ; `vide` : la réserve est épuisée */
  const disque = (n, { taille = 'moyen', vide = false } = {}) => `<div class="disque fer ${taille}${vide ? ' vide' : ''}"><div>${n}</div></div>`;
  const compteur = (n, libelle) => `<div class="compteur">${disque(n, { taille: 'grand' })}<span class="rubrique">${libelle}</span></div>`;
  /* le d10 du d100, vu de face : la silhouette et la face du dé de `navigation/des` (src/data/icons/defs/navigation.ts:11-13), à 36×40 */
  const d10 = (texte) => `<svg width="36" height="40" viewBox="0.5 -0.5 23 25"><path d="M12 1L21.5 9.9V14.1L12 23L2.5 14.1V9.9Z" fill="#b8a67e"/><path d="M12 23V18.4L4.8 13.6L2.5 14.1ZM12 23V18.4L19.2 13.6L21.5 14.1Z" fill="#2a1d12" fill-opacity=".16"/><path d="M12 1L19.2 13.6L12 18.4L4.8 13.6Z" fill="#f1e6cc"/><path d="M12 1L19.2 13.6L12 18.4L4.8 13.6ZM4.8 13.6L2.5 14.1M19.2 13.6L21.5 14.1M12 18.4V23" fill="none" stroke="#2a1d12" stroke-width=".55" stroke-linejoin="round"/><path d="M12 1L21.5 9.9V14.1L12 23L2.5 14.1V9.9Z" fill="none" stroke="#2a1d12" stroke-width=".8" stroke-linejoin="round"/><text x="12" y="${texte.length > 1 ? 14.2 : 14.8}" text-anchor="middle" font-family="Grenze Gotisch" font-weight="600" font-size="${texte.length > 1 ? 6.6 : 8.4}" fill="#2a1d12">${texte}</text></svg>`;
  /* le sceau de cire : `contenu` = nom de pictogramme ou chiffre ; `taille` menu, petit, moyen, grand, maitre ; `etat` reussite ou vide ;
     `de` : le dé dont le chiffre est le jet, écrit dessous */
  const SCEAU = { menu: 12, petit: 15, moyen: 20, grand: 26, maitre: 32 };
  const sceau = (contenu, taille = 'petit', { etat = '', classe = '', de = '' } = {}) => `<div class="sceau ${taille} ${etat}${de ? ' de' : ''} ${classe}">${PICTOS[contenu] ? picto(contenu, SCEAU[taille], undefined, 1.9) : `<b>${contenu}</b>`}${de ? `<i>${de}</i>` : ''}</div>`;
  /* le ruban : centré sur son `left` ; `gothique` : le titre d'un panneau */
  const ruban = (texte, { gothique = false, style = '' } = {}) => `<div class="ruban ${gothique ? 'gothique' : 'rubrique'}" style="${style}">${texte}</div>`;
  /* le cadre de chêne ferré : géométrie en px (une cote `null` reste à la feuille), `matiere` du fond, `ruban` gothique,
     `tete` : ce qui se pose sur le bord haut */
  const cadre = (id, x, y, w, h, matiere, contenu, { ruban: titre = null, classe = '', tete = '' } = {}) => `<div id="${id}" class="cadre bois ${classe}" data-piece="${id}" style="${[['left', x], ['top', y], ['width', w], ['height', h]].filter(([, v]) => v != null).map(([k, v]) => `${k}:${v}px`).join(';')}"><div class="fond ${matiere}">${contenu}</div>${tete}${ferrures}${titre ? ruban(titre, { gothique: true }) : ''}</div>`;
  /* une rangée de cartes se lit en liste à partir de quatre, ou quand ses cartes n'y tiennent pas à 200 de large */
  const ranger = () => document.querySelectorAll('.cartes').forEach((r) => {
    const n = r.querySelectorAll(':scope>.carte').length;
    r.classList.toggle('liste', n > 3 || r.clientWidth < n * 200 + (n - 1) * 9);
  });
  /* aucun clou du haut d'un cadre à moins de 12 px de son ruban, queues comprises : le clou se retire */
  const degager = () => document.querySelectorAll('.cadre>.ruban').forEach((r) => {
    const q = r.getBoundingClientRect();
    r.parentElement.querySelectorAll(':scope>.clou[style*="top"]').forEach((c) => { const k = c.getBoundingClientRect(); if (k.right > q.left - 12 && k.left < q.right + 12) c.remove(); });
  });
  /* les clous d'un meuble (barre, jet, arrêt), ou d'un bandeau de `cases` héros : aux bords et entre deux cases */
  const MEUBLE = [[.0593, .2797, .7203, .9407], [.0593, .2797, .5, .7203, .9407]];
  const clouer = (cases = null) => (cases ? [0, 1].map(() => [.05, ...Array.from({ length: cases - 1 }, (_, k) => (k + 1) / cases), .945]) : MEUBLE)
    .map((ligne, k) => ligne.map((t) => `<i class="clou" style="left:${(100 * t).toFixed(2)}%;${k ? 'bottom' : 'top'}:3px"></i>`).join('')).join('');
  /* le cartouche : le médaillon de ce dont on parle, son nom et ce qu'il est ; `taille` ligne, ou titre : celui de
     l'écran, dans son cadre au coin haut-gauche, large de `largeur` */
  const cartouche = ({ icone, nom, sous = '', marque = '', texte = nom, taille = 'ligne', largeur = null }) => {
    const titre = taille === 'titre';
    const corps = `${medaillon(icone, titre ? { inerte: true } : { taille: 'moyen' })}<div><div class="n gothique" data-texte="${texte}">${nom}${marque ? `<span class="marque">${marque}</span>` : ''}</div>${sous ? `<div class="s rubrique">${sous}</div>` : ''}</div>`;
    return titre ? cadre('titre', null, null, largeur, null, 'bois cartouche', corps) : `<div class="cartouche">${corps}</div>`;
  };
  /* le rang d'un personnage : son portrait, son nom (`gothique` : celui qui agit), `sous` ce qu'il est, `corps` sous son nom,
     `fin` au bout du rang */
  const rang = (genre, { camp, taille = 'moyen', choisi = false, nom, gothique = false, sous = '', corps = '', fin = '', classe = '' }) => `<div class="rang ${camp === 'ennemi' ? 'ennemi' : ''} ${classe}">${portrait(genre, { camp, taille, choisi })}
    <div class="qui"><div class="nom ${gothique ? 'gothique' : 'rubrique'} ombre" data-texte="rang ${nom}">${nom}</div>${sous ? `<div class="s rubrique">${sous}</div>` : ''}${corps}</div>${fin}</div>`;
  /* les sections d'un panneau en onglets, sur son bord haut : l'active est le ruban, les autres des plaques */
  const onglets = (noms, active) => `<div class="onglets">${noms.map((s) => (s === active ? ruban(s, { gothique: true }) : plaque(s, { taille: 'petite' }))).join('')}</div>`;
  /* les sections d'un panneau en signets, au bord droit de son registre : `sections` = [{ nom, compte, marque }], le
     signet `ouverte` est de laiton ; `marque` : une règle de la section est modifiée */
  const signets = (sections, ouverte) => `<div class="signets" data-piece="signets">${sections.map(({ nom, compte = null, marque = false }) => `<div class="signet${nom === ouverte ? ` ouvert${nom.length > 12 ? ' serre' : ''}` : ''}"><span class="rubrique">${nom}</span>${marque ? '<i class="cire"></i>' : ''}${compte == null ? '' : `<em class="chiffres">${compte}</em>`}</div>`).join('')}</div>`;
  /* l'aperçu au survol : son nom, à droite ce qu'il est, son corps ; `vers` : le bord dont la pointe montre l'élément
     survolé (gauche, droite, haut, bas) ; `style` le place */
  const apercu = ({ nom, sous = '', corps = '', vers = 'gauche', style = '' }) => `<div class="apercu parchemin vers-${vers}" data-piece="apercu" style="${style}"><div class="tete"><span class="n gothique">${nom}</span>${sous ? `<span class="c rubrique">${sous}</span>` : ''}</div>${corps}</div>`;
  /* la bannière d'issue d'un combat, et sous elle sa sortie, une plaque d'appel ; `suite` : ce que l'issue laisse */
  const issue = (texte, { action = '', suite = '' } = {}) => `<div class="issue-du-combat" data-piece="issue"><div class="banniere"><span class="gothique" data-texte="issue">${texte}</span></div>${suite ? `<p class="ombre" data-texte="suite de l'issue">${suite}</p>` : ''}${action ? plaque(action, { armee: true, taille: 'appel' }) : ''}</div>`;
  /* le filet : `fondu` s'éteint vers les bords, `losange` au milieu, `or` sur un fond sombre */
  const filet = ({ fondu = false, losange = false, or = false } = {}) => `<div class="filet${fondu ? ' fondu' : ''}${or ? ' or' : ''}">${losange ? '<i class="losange"></i>' : ''}</div>`;
  /* un choix parmi quelques valeurs nommées : la valeur tenue est dorée ; `egaux` : cases de même largeur */
  const segments = (options, la, { egaux = false } = {}) => `<span class="segments${egaux ? ' egaux' : ''}">${options.map((o) => `<b class="${o === la ? 'la' : ''}">${o}</b>`).join('')}</span>`;
  const ouiNon = (v) => segments(['Non', 'Oui'], v ? 'Oui' : 'Non', { egaux: true });
  /* le curseur : `part` de 0 à 1 ; `largeur` null : celle de son hôte */
  const reglette = (part, largeur = 118) => `<span class="reglette"${largeur == null ? '' : ` style="width:${largeur}px"`}><u style="width:${100 * part}%"></u><i style="left:${100 * part}%"></i></span>`;
  /* la jauge : `teinte` cire (la vie) ou or ; `taille` fine ou forte ; `ajout` : la part prévue, hachurée */
  const jauge = (part, { teinte = 'cire', taille = 'fine', ajout = 0 } = {}) => `<div class="jauge ${teinte} ${taille}"><i style="width:${100 * part}%"></i>${ajout ? `<u style="left:${100 * part}%;width:${100 * ajout}%"></u>` : ''}</div>`;
  const vie = (pv, max) => jauge(pv / max);
  /* un rang de pas en losanges : `pleins` sur `total` */
  const rangDePas = (pleins, total, classe = '') => `<div class="pas ${classe}">${Array.from({ length: total }, (_, k) => `<i class="${k < pleins ? '' : 'vide'}"></i>`).join('')}</div>`;
  /* pose les pièces ; une fois les polices chargées, range les cartes et dégage les rubans de leurs clous ; passe le grain */
  const monter = (pieces) => {
    document.getElementById('ui').innerHTML = pieces.join('');
    document.fonts.ready.then(() => { ranger(); degager(); });
    document.getElementById('grain').style.backgroundImage = svgUrl(`<svg xmlns='${NS}' width='300' height='300'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='9'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`);
  };

  /* ───────── la charte des gestes ───────── */
  /* fermer un panneau posé sur le jeu : la croix de laiton, en haut à droite de l'écran. `dansLePanneau` : elle se pose
     dans le cadre qu'elle ferme, dont la feuille la place */
  const croix = ({ dansLePanneau = false } = {}) => `<div class="croix"${dansLePanneau ? '' : ' data-piece="fermer"'}>${rond('croix')}</div>`;
  /* quitter un lieu ou un écran de jeu : la pastille du bas à gauche, son libellé dit où l'on retourne */
  /* hors combat : le journal, et le système sous lui, au coin bas droit (`../dispositions.md`) */
  const coins = () => `<div id="coins" data-piece="coins">${rond('journal', 'grand')}${rond('systeme', 'grand')}</div>`;
  const retour = (libelle, icone = 'sortie') => `<div class="retour" data-piece="retour">${rond(icone, 'grand')}<span class="rubrique ombre">${libelle}</span></div>`;
  /* ouvrir un écran posé sur celui-ci (carte, dossier du navire, postes de bord) : la pastille du bord droit, à la hauteur `haut` */
  const ouvrir = (libelle, icone, haut) => `<div class="ouvrir" data-piece="ouvrir ${libelle}" style="top:${haut}px"><span class="rubrique ombre">${libelle}</span>${rond(icone)}</div>`;
  /* régler une quantité : − et +, la valeur réglée entre les deux ; un bord atteint se ferme */
  const moinsPlus = ({ moins = true, plus = true, entre = '' } = {}) => `<div class="moins-plus">${rond('moins', 'menu', { ferme: !moins })}${entre}${rond('plus', 'menu', { ferme: !plus })}</div>`;
  /* fiche `user-arbitrage-raison-de-refus-au-survol-jamais-inline` : la bulle du geste fermé que le curseur survole */
  const raison = (texte) => `<span class="bulle-refus parchemin">${texte}</span>`;
  /* #3004. Acte individuel : `bourse({ heros, avoir })`, la bourse de celui qui agit. Entreprise commune ou tarif par
     personne : `bourse({ parts: [[nom, part, avoir]], total })`, la part de chacun réglable avant validation ;
     `reglable: false` pour qui regarde sans régler (l'invité d'une partie à plusieurs). */
  const bourse = ({ heros, avoir, parts, total, reglable = true }) => `<div class="qui-paie${parts ? ' parts' : ''}">${medaillon('bourse', { taille: 'moyen' })}<div class="q">${parts
    ? `<span class="rubrique">Bourses du groupe</span>${parts.map(([nom, part, reste]) => `<div class="part"><span>${nom}</span>${reglable ? moinsPlus({ entre: `<b class="chiffres">${part}</b>` }) : `<b class="chiffres">${part}</b>`}<i>sur ${reste}</i></div>`).join('')}<div class="total"><span class="rubrique">Total</span><b class="chiffres">${total}</b></div>`
    : `<span class="rubrique">Bourse de ${heros}</span><b class="chiffres">${avoir}</b>`}</div></div>`;
  /* saisir un texte : le libellé de rubrique s'il y en a un, la valeur et son curseur, ou l'attente d'un champ vide */
  const champ = (libelle, valeur, { attente = '', classe = '' } = {}) => `<label class="champ ${classe}">${libelle ? `<span class="rubrique">${libelle}</span>` : ''}<b class="${valeur ? '' : 'vide'}">${valeur || attente}${valeur ? '<i class="curseur-texte"></i>' : ''}</b></label>`;

  Object.assign(globalThis, {
    W, H, alea, melange,
    PICTOS, picto, BASE, BUSTES, portrait, rond, plaque, carte, outil, medaillon, disque, compteur, sceau, d10, ruban, cadre, clouer, cartouche, rang, onglets, signets, apercu, issue,
    filet, segments, ouiNon, reglette, jauge, vie, rangDePas, monter, croix, coins, retour, ouvrir, moinsPlus, raison, bourse, champ,
  });
}
