/* Voyage (#3935, #4411) : les décors de la famille, peints à 1707 × 780 et posés dans la `toile()` qui les rogne à la vue
   (`../lieux-et-nuit/commun.js`) : route, relais, fleuve, mer ; les véhicules en silhouette, les vignettes des arrêts ;
   l'objet du temps et la carte du trajet. Maquette hors du jeu. */
const V = {}, D = {};
  // ── décors ──
  V.rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  V.sapins = (x0, x1, y, h, fill, seed = 1, pas = 26) => { const r = V.rng(seed); let s = ''; for (let x = x0; x < x1; x += pas * (0.6 + r() * 0.8)) { const hh = h * (0.55 + r() * 0.6), w = hh * 0.36; s += `<path d="M${x} ${y - hh}l${w * .45} ${hh * .3}h-${w * .2}l${w * .5} ${hh * .3}h-${w * .25}l${w * .55} ${hh * .4}h-${w * 2.1}l${w * .55}-${hh * .4}h-${w * .25}l${w * .5}-${hh * .3}h-${w * .2}z"/>`; } return `<g fill="${fill}">${s}</g>`; };
  V.feuillus = (x0, x1, y, h, fill, seed = 1, pas = 34) => { const r = V.rng(seed); let s = ''; for (let x = x0; x < x1; x += pas * (0.6 + r() * 0.9)) { const hh = h * (0.6 + r() * 0.6); s += `<ellipse cx="${x}" cy="${y - hh * .6}" rx="${hh * .55}" ry="${hh * .5}"/><ellipse cx="${x + hh * .4}" cy="${y - hh * .4}" rx="${hh * .4}" ry="${hh * .38}"/><rect x="${x - 2}" y="${y - hh * .3}" width="4" height="${hh * .3}"/>`; } return `<g fill="${fill}">${s}</g>`; };
  V.monts = (y, amp, fill, seed = 1, pas = 90, w = 1707) => { const r = V.rng(seed); let d = `M0 ${y}`; for (let x = 0; x <= w + pas; x += pas * (0.5 + r())) d += `L${x} ${y - amp * (0.25 + r() * 0.75)}L${x + pas * .3} ${y - amp * (0.1 + r() * 0.4)}`; return `<path d="${d}L${w} 780L0 780z" fill="${fill}"/>`; };
  V.collines = (y, amp, fill, seed = 1, w = 1707) => { const r = V.rng(seed); let d = `M0 ${y}`; let x = 0; while (x < w) { const dx = 160 + r() * 240; d += `Q${x + dx / 2} ${y - amp * (0.4 + r())} ${x + dx} ${y - amp * r() * .4}`; x += dx; } return `<path d="${d}L${w} 780L0 780z" fill="${fill}"/>`; };
  V.etoiles = (n, hmax = 420, seed = 7) => { const r = V.rng(seed); let s = ''; for (let i = 0; i < n; i++) s += `<circle cx="${r() * 1707}" cy="${r() * hmax}" r="${0.4 + r() * 0.9}" opacity="${0.3 + r() * 0.6}"/>`; return `<g fill="#fff">${s}</g>`; };
  V.pluie = (n, seed = 3) => { const r = V.rng(seed); let s = ''; for (let i = 0; i < n; i++) { const x = r() * 1707, y = r() * 780, l = 10 + r() * 14; s += `<path d="M${x} ${y}l-${l * .25} ${l}"/>`; } return `<g stroke="#cfd6e6" stroke-width="1" opacity=".33">${s}</g>`; };
  V.nuages = (n, y0, y1, fill, seed = 5) => { const r = V.rng(seed); let s = ''; for (let i = 0; i < n; i++) { const x = r() * 1707, y = y0 + r() * (y1 - y0), w = 120 + r() * 260; s += `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${5 + r() * 9}" opacity="${0.25 + r() * 0.4}"/>`; } return `<g fill="${fill}">${s}</g>`; };
  V.vagues = (y0, y1, stroke, n = 60, seed = 9) => { const r = V.rng(seed); let s = ''; for (let i = 0; i < n; i++) { const x = r() * 1707, y = y0 + r() * (y1 - y0), w = 14 + (y - y0) / (y1 - y0) * 40 + r() * 20; s += `<path d="M${x} ${y}q${w / 4} -${w / 9} ${w / 2} 0t${w / 2} 0"/>`; } return `<g fill="none" stroke="${stroke}" stroke-width="1.2" opacity=".5">${s}</g>`; };
  V.roseaux = (x0, x1, y, fill, seed = 4) => { const r = V.rng(seed); let s = ''; for (let x = x0; x < x1; x += 7 + r() * 16) { const h = 40 + r() * 90, c = (r() - .5) * 22; s += `<path d="M${x} ${y}q${c} -${h / 2} ${c * 1.4} -${h}" stroke="${fill}" stroke-width="2" fill="none"/>`; if (r() > .6) s += `<ellipse cx="${x + c * 1.4}" cy="${y - h - 6}" rx="2.6" ry="9" fill="${fill}"/>`; } return s; };
  /** Le symbole de carte : petits arbres et collines à l'encre, pour les parchemins. */
  V.encreArbres = (zones, seed = 11) => { const r = V.rng(seed); let s = ''; for (const [x0, y0, x1, y1, n] of zones) for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0); s += `<path d="M${x} ${y}l4 9h-8zM${x} ${y + 9}v3"/>`; } return `<g fill="none" stroke="#6a4f33" stroke-width="1" opacity=".75">${s}</g>`; };
  V.encreMonts = (pts) => `<g fill="none" stroke="#6a4f33" stroke-width="1.1" opacity=".8">${pts.map(([x, y, w = 26]) => `<path d="M${x - w / 2} ${y}q${w / 2} -${w * .7} ${w} 0M${x - w * .2} ${y - w * .22}l${w * .12} ${w * .1}"/>`).join('')}</g>`;
  V.rose = (x, y, r = 22) => `<g transform="translate(${x} ${y})" fill="none" stroke="#5a4028" stroke-width="1"><circle r="${r * .7}"/><circle r="${r * .45}"/><path d="M0 -${r}L${r * .16} 0 0 ${r} -${r * .16} 0zM-${r} 0L0 -${r * .16} ${r} 0 0 ${r * .16}z" fill="rgba(90,64,40,.25)"/><text y="-${r + 4}" text-anchor="middle" font-family="Fell SC" font-size="10" fill="#5a4028" stroke="none">N</text></g>`;

  const CIELS = {
    soir: ['#141a3f', '#3b3568', '#8a5f86', '#e9a063'],
    jour: ['#5d86b5', '#8fb1cf', '#c9d9de', '#efe2c0'],
    aube: ['#2a3158', '#6b5f8f', '#d79a8a', '#f4cf96'],
    nuit: ['#070a1c', '#101737', '#1d2550', '#2c3261'],
    gris: ['#2c3440', '#4a5560', '#77838a', '#a9b0ab'],
  };
  D.ciel = (t, horizon = 520) => { const c = CIELS[t]; return `<defs><linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".45" stop-color="${c[1]}"/><stop offset=".8" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[3]}"/></linearGradient><radialGradient id="halo"><stop offset="0" stop-color="#ffe0a0" stop-opacity=".95"/><stop offset=".25" stop-color="#ffc878" stop-opacity=".5"/><stop offset="1" stop-color="#ffb060" stop-opacity="0"/></radialGradient><radialGradient id="lant"><stop offset="0" stop-color="#fff0b8"/><stop offset=".2" stop-color="#ffd27a" stop-opacity=".75"/><stop offset="1" stop-color="#ffb050" stop-opacity="0"/></radialGradient></defs><rect width="1707" height="${horizon + 20}" fill="url(#ciel)"/>`; };
  D.avantForet = (fill = '#06040a') => `<g fill="${fill}"><path d="M0 0h70c30 120 20 300 40 420l30 360H0z"/><path d="M60 150c60-10 130 20 190 60-50-10-120-20-180-10zM70 250c70 0 150 30 210 80-60-20-140-40-205-40zM80 60c50-20 110-10 160 20-50-5-110 0-150 15z"/><path d="M1707 0h-60c-30 160-10 330-40 470l-30 310h130z"/><path d="M1650 300c-60 10-110 40-150 90 50-30 100-50 150-55zM1640 420c-50 20-90 50-120 100 40-30 80-50 120-65z"/></g>${V.roseaux(1500, 1700, 780, fill, 4)}${V.roseaux(0, 160, 780, fill, 8)}`;
  D.diligence = (x, y, s = 1, lanterne = true) => `<g transform="translate(${x} ${y}) scale(${s})">
    ${lanterne ? '<circle cx="250" cy="-104" r="90" fill="url(#lant)" opacity=".8"/>' : ''}
    <g fill="#07050a"><rect x="0" y="-150" width="200" height="118" rx="10"/><rect x="18" y="-172" width="44" height="24"/><rect x="74" y="-166" width="50" height="18"/><rect x="134" y="-178" width="34" height="30"/><path d="M-6 -152h212v10H-6z"/>
    <path d="M200 -120h46v60h-46z"/><path d="M212 -168c0-12 26-12 26 0v48h-26z"/><path d="M203 -176h44l-8 8h-28z"/><circle cx="225" cy="-178" r="9"/>
    <path d="M246 -70l150 4v6l-150 2z"/></g>
    <g fill="#f1c56a"><path d="M40 -128a16 16 0 0 1 32 0v34H40z"/><rect x="92" y="-128" width="34" height="34" rx="2"/></g>
    <g fill="none" stroke="#07050a" stroke-width="5"><circle cx="48" cy="-14" r="38"/><circle cx="172" cy="-22" r="30"/></g><g stroke="#07050a" stroke-width="3"><path d="M48 -52v76M10 -14h76M21 -41l54 54M21 13l54-54M172 -52v60M142 -22h60M151 -43l42 42M151 -1l42-42"/></g>
    ${lanterne ? '<rect x="246" y="-112" width="9" height="13" fill="#fff0b8"/><path d="M244 -114h13M250 -114v-5" stroke="#07050a" stroke-width="2"/>' : ''}
    ${D.cheval(300, 0, 1)}<path d="M250 -96L420 -86" stroke="#07050a" stroke-width="1.5"/>
  </g>`;
  D.cheval = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#07050a"><path d="M10 -70c20-14 70-12 96-4l22-30c8-10 22-8 26 2l10 22-14 8-12-8-10 30c-2 22-10 30-20 34l4 46h-10l-10-42H52l-12 42H30l6-48c-14-6-22-20-22-34L4 -40z"/><path d="M12 -68c-10 10-12 30-8 48l8-4c-2-14 2-26 8-34z"/><path d="M40 -30l-16 60h9l18-52zM104 -28l22 56h-9l-22-46z"/></g>`;
  D.cavalier = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${D.cheval(0, 0, 1)}<g fill="#07050a"><path d="M52 -128c10-6 24-2 26 10l6 44-30 6-8-40z"/><circle cx="62" cy="-140" r="11"/><path d="M44 -146h36l-6-8H52z"/><path d="M72 -110l34-64 3 2-30 68z"/></g></g>`;
  D.marcheur = (x, y, s = 1, lance = false) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#07050a"><circle cx="0" cy="-74" r="8"/><path d="M-9 -64h18l5 34-6 2 3 28h-8l-4-24-5 24h-8l5-30-6-2z"/>${lance ? '<path d="M14 -96l2 0 0 96-2 0z"/>' : '<path d="M-12 -62l-8 22 4 2z"/>'}</g>`;
  /** Barge du Reik : chaland à voile carrée et cabine arrière. */
  D.barge = (x, y, s = 1, lanterne = false, voile = '#3a1818') => `<g transform="translate(${x} ${y}) scale(${s})">
    ${lanterne ? '<circle cx="-150" cy="-66" r="80" fill="url(#lant)" opacity=".8"/>' : ''}
    <path d="M-250 -34h470c20 0 40-10 50-22l-30 60c-6 10-16 16-30 16h-420c-20 0-36-18-40-54z" fill="#07050a"/>
    <path d="M-250 -34h470" stroke="#3b2a1c" stroke-width="3"/>
    <rect x="-220" y="-78" width="130" height="46" fill="#07050a"/><path d="M-228 -78h146l-10-12h-126z" fill="#07050a"/>
    <g fill="#f1c56a"><rect x="-200" y="-64" width="18" height="16"/><rect x="-166" y="-64" width="18" height="16"/><rect x="-132" y="-64" width="18" height="16"/></g>
    <path d="M30 -34v-250" stroke="#07050a" stroke-width="7"/><path d="M-70 -262h200" stroke="#07050a" stroke-width="5"/>
    <path d="M-66 -258h192c8 60 6 120-4 176h-184c-10-56-12-116-4-176z" fill="${voile}"/><path d="M-66 -258h192c8 60 6 120-4 176h-184c-10-56-12-116-4-176z" fill="url(#ombreVoile)"/>
    <path d="M30 -284L250 -50M30 -284L-240 -80M-70 -82l-20 46M126 -82l40 46" stroke="#07050a" stroke-width="1.4" fill="none"/>
    <path d="M30 -284l34 8-34 8z" fill="#7d2020"/>
    <g fill="#07050a"><path d="M-236 -34l-30-40 6-4 34 40z"/><circle cx="-236" cy="-98" r="8"/><path d="M-246 -88h20l4 54h-26z"/><path d="M-258 -70l30 6v5l-30-4z"/></g>
    <g fill="#07050a"><circle cx="120" cy="-74" r="7"/><path d="M112 -66h16l3 32h-22z"/><circle cx="170" cy="-70" r="7"/><path d="M162 -62h16l3 28h-22z"/><path d="M178 -60l40 -30 2 3-38 32z"/></g>
    <g fill="#0d0a0e"><rect x="-60" y="-56" width="34" height="22"/><rect x="-22" y="-50" width="26" height="16"/><ellipse cx="62" cy="-44" rx="12" ry="10"/><ellipse cx="88" cy="-44" rx="12" ry="10"/></g>
  </g>`;
  /** Cogue : un mât, voile carrée, châteaux avant et arrière. */
  D.cogue = (x, y, s = 1, o = {}) => `<g transform="translate(${x} ${y}) scale(${s})">
    ${o.lanterne ? '<circle cx="-196" cy="-128" r="90" fill="url(#lant)" opacity=".8"/>' : ''}
    <path d="M-250 -60c20 50 60 76 110 80h250c60-4 110-40 140-96l-60 14h-380z" fill="${o.coque || '#07050a'}"/>
    <path d="M-262 -110h120v52h-110z" fill="${o.coque || '#07050a'}"/><path d="M-268 -110h132v-8h-132z" fill="${o.coque || '#07050a'}"/>
    <path d="M150 -92h96l6 30-110 6z" fill="${o.coque || '#07050a'}"/><path d="M144 -98h108v8H144z" fill="${o.coque || '#07050a'}"/>
    <g stroke="${o.coque || '#07050a'}" stroke-width="3"><path d="M-256 -110v-14M-236 -110v-14M-216 -110v-14M-196 -110v-14M-176 -110v-14M-156 -110v-14M158 -98v-12M178 -98v-12M198 -98v-12M218 -98v-12M238 -98v-12"/></g>
    <path d="M-10 -60v-330" stroke="${o.coque || '#07050a'}" stroke-width="9"/><path d="M-150 -330h280" stroke="${o.coque || '#07050a'}" stroke-width="6"/>
    <path d="M-144 -326c40 14 228 14 268 0 16 70 14 150-8 214-60 18-192 18-252 0-22-64-24-144-8-214z" fill="${o.voile || '#5a1a1a'}"/>
    <path d="M-144 -326c40 14 228 14 268 0 16 70 14 150-8 214-60 18-192 18-252 0-22-64-24-144-8-214z" fill="url(#ombreVoile)"/>
    <path d="M-26 -392h32v16h-32z" fill="${o.coque || '#07050a'}"/><path d="M-10 -420v30" stroke="${o.coque || '#07050a'}" stroke-width="3"/><path d="M-10 -420l44 9-44 9z" fill="${o.pavillon || '#7d2020'}"/>
    <path d="M-10 -388L290 -76M-10 -388L-262 -116M-136 -112l-40 50M116 -112l50 40M-10 -388L196 -98" stroke="${o.coque || '#07050a'}" stroke-width="1.4" fill="none"/>
    <path d="M246 -86l90 -34 2 5-88 36z" fill="${o.coque || '#07050a'}"/>
    <path d="M-250 -42h390" stroke="#3b2a1c" stroke-width="2" opacity=".8"/>
    ${o.vapeur ? `<path d="M-128 -60v-128h-8v-12h54v12h-8v128z" fill="${o.coque || '#07050a'}"/><path d="M-130 -150h42" stroke="#8c7446" stroke-width="5"/>
    <g fill="#c9cfce"><ellipse cx="-122" cy="-232" rx="30" ry="22" opacity=".75"/><ellipse cx="-164" cy="-286" rx="44" ry="30" opacity=".6"/><ellipse cx="-232" cy="-350" rx="62" ry="40" opacity=".45"/><ellipse cx="-330" cy="-416" rx="84" ry="50" opacity=".3"/></g>
    <g fill="#f1f4f2"><path d="M-74 -96c26-30 60-34 92-22-30 0-52 12-70 34z" opacity=".85"/><ellipse cx="34" cy="-128" rx="30" ry="15" opacity=".7"/><ellipse cx="82" cy="-150" rx="38" ry="19" opacity=".45"/></g>` : ''}
  </g>`;
  D.ombreVoile = `<defs><linearGradient id="ombreVoile" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>`;
  /** La route au crépuscule, la diligence arrêtée devant un pont effondré quand `pont`. */
  D.route = ({ teinte = 'soir', pont = false, pluie = false, lanterne = true } = {}) => `${D.ciel(teinte)}${D.ombreVoile}
    ${teinte === 'soir' || teinte === 'nuit' ? V.etoiles(90, 260) : ''}${V.nuages(16, 120, 420, teinte === 'soir' ? '#b56f8e' : '#fff', 5)}
    <g transform="translate(0 -96)"><ellipse cx="640" cy="520" rx="330" ry="150" fill="url(#halo)" opacity=".75"/>
    ${V.monts(560, 230, '#7d6a9a', 3, 120)}${V.monts(580, 150, '#5b4a78', 8, 80)}
    ${V.feuillus(0, 1707, 585, 60, '#2b2140', 5, 30)}${V.sapins(0, 1707, 612, 110, '#15101f', 2, 24)}
    <rect y="600" width="1707" height="300" fill="#17121d"/><rect y="640" width="1707" height="34" fill="#221b29" opacity=".8"/><path d="M0 646h1707" stroke="#2b2433" stroke-width="2" opacity=".6"/>
    ${pont ? `<g fill="#07050a"><path d="M1130 660v-52c40-34 90-34 130 0v6h-20c-26-22-64-22-90 0v46z"/><path d="M1330 596l34 10 6 54h-40z"/><path d="M1250 600l40-14 6 8-34 18z"/><path d="M1256 640l30 4-6 12-26-4zM1296 652l22-6 4 12-22 4z"/></g>` : ''}
    ${D.cavalier(pont ? 420 : 610, 656, 0.9)}${D.diligence(pont ? 640 : 860, 648, 1, lanterne)}
    <g fill="#07050a"><rect x="${pont ? 1090 : 1455}" y="596" width="24" height="56" rx="8"/></g></g>
    ${pluie ? V.pluie(260) : ''}${D.avantForet()}`;

/* la cour d'une auberge-relais, vue du dedans de son enceinte : `rempart` de pierre et son portail, `palissade` de pieux
   sous sa tour de guet dans la forêt, ou `aucune`, la route ouverte sur les champs */
D.relais = (enceinte = 'rempart') => {
  const fen = (x, y, w = 22, h = 22, c = '#f1c56a') => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/><path d="M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}" stroke="#1a1016" stroke-width="2"/></g>`;
  const toits = (() => { const r = V.rng(12); let s = ''; for (let x = -20; x < 1730; x += 60 + r() * 70) { const w = 70 + r() * 80, h = 60 + r() * 90, y = 500 - h; s += `<path d="M${x} 520V${y + 30}l${w / 2}-${30 + r() * 20} ${w / 2} ${30}V520z"/>`; if (r() > .5) s += `<rect x="${x + w * .6}" y="${y - 6}" width="10" height="30"/>`; } return s; })();
  const lum = (() => { const r = V.rng(31); let s = ''; for (let i = 0; i < 46; i++) { const x = r() * 1707, y = 420 + r() * 80; if (x > 430 && x < 1260) continue; s += `<rect x="${x}" y="${y}" width="9" height="12" fill="#d9a44e" opacity="${.5 + r() * .5}"/>`; } return s; })();
  const ENCEINTES = {
    rempart: `<g fill="#2a2038">${toits}</g>${lum}
    <g fill="#1d1626"><rect x="0" y="430" width="1707" height="110"/><path d="M0 430h1707v-8H0z"/>${Array.from({ length: 44 }, (_, i) => `<rect x="${i * 40}" y="412" width="22" height="12"/>`).join('')}
      <path d="M800 540V380h160v160z"/><path d="M790 380h180l-20-34H810z"/></g>
    <path d="M826 540V440a54 54 0 0 1 108 0v100z" fill="#f0b869"/><path d="M826 540V440a54 54 0 0 1 108 0v100z" fill="url(#halo)"/>
    <g stroke="#1d1626" stroke-width="3"><path d="M880 388v152M846 404v136M914 404v136"/></g>
    <path d="M880 346v-40" stroke="#1d1626" stroke-width="3"/><path d="M880 306l34 8-34 8z" fill="#7d2020"/>`,
    palissade: `${V.sapins(0, 1707, 470, 170, '#3b2f52', 12, 30)}
    <g fill="#1d1626">${Array.from({ length: 96 }, (_, i) => `<path d="M${i * 18} 540V${448 + (i % 3) * 4}l9 -16 9 16V540z"/>`).join('')}
      <path d="M806 540V380h16v160zM938 540V380h16v160z"/><path d="M790 380h180v-12H790z"/><path d="M796 368l84-36 84 36z"/></g>
    <path d="M822 540V430h116v110z" fill="#f0b869"/><path d="M822 540V430h116v110z" fill="url(#halo)"/>
    <g stroke="#1d1626" stroke-width="4"><path d="M822 430h116"/></g>${D.marcheur(880, 368, 0.4)}`,
    aucune: `${V.collines(470, 40, '#3a2c44', 21)}${V.sapins(1180, 1707, 474, 70, '#2a2038', 5, 22)}
    <g fill="#2a2038"><path d="M120 470v-34l40-26 40 26v34zM1380 470v-30l34-22 34 22v30z"/></g><rect x="1394" y="446" width="9" height="12" fill="#d9a44e"/>
    <path d="M826 540L874 462h12L934 540z" fill="#4a3a40"/><path d="M826 540L874 462h12L934 540z" fill="url(#halo)" opacity=".6"/>
    <g fill="none" stroke="#2a2038" stroke-width="3">${Array.from({ length: 6 }, (_, i) => `<path d="M${i * 120} 540l${60 + i * 10} -70M${1707 - i * 120} 540l-${60 + i * 10} -70"/>`).join('')}</g>`,
  };
  return `${D.ciel('soir', 520)}${V.etoiles(70, 240)}${V.nuages(14, 110, 380, '#b56f8e', 9)}
    <g transform="translate(0 -72)"><ellipse cx="880" cy="470" rx="420" ry="190" fill="url(#halo)" opacity=".85"/>
    ${ENCEINTES[enceinte]}
    <!-- l'auberge-relais -->
    <g fill="#140e1a"><path d="M300 600V372h420v228z"/><path d="M280 380l230-150 230 150z"/><rect x="620" y="250" width="34" height="80"/><path d="M300 600h420v14H300z"/></g>
    <g stroke="#0b0710" stroke-width="5" fill="none"><path d="M300 460h420M400 380v220M560 380v220M640 380v220M300 460l100 140M720 460l-80 140"/></g>
    ${fen(330, 400, 44, 40)}${fen(430, 400, 44, 40)}${fen(580, 400, 40, 40)}${fen(660, 400, 40, 40)}${fen(430, 490, 44, 46)}${fen(580, 490, 40, 46)}${fen(660, 490, 40, 46)}
    <path d="M326 600v-90a34 34 0 0 1 68 0v90z" fill="#e9a955"/><path d="M360 478v122" stroke="#140e1a" stroke-width="3"/>
    <g><path d="M720 440h50" stroke="#0b0710" stroke-width="4"/><rect x="742" y="446" width="40" height="34" fill="#140e1a" stroke="#c9a24a" stroke-width="2"/><g transform="translate(750 451) scale(1)" fill="none" stroke="#f3dc93" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M6.300 6.300l11.400 11.400M6.300 17.700 17.700 6.300"/></g></g>
    <!-- la remise et les écuries -->
    <g fill="#140e1a"><path d="M1010 610V440h430v170z"/><path d="M990 446l236-96 236 96z"/></g>
    <g fill="#e9a955"><path d="M1050 610v-100h110v100z"/><path d="M1190 610v-100h110v100z" opacity=".55"/></g><path d="M1330 610v-100h90v100z" fill="#0b0710"/>
    <g stroke="#0b0710" stroke-width="4"><path d="M1105 510v100M1245 510v100"/></g>${fen(1200, 400, 46, 30)}
    <!-- la cour pavée -->
    <path d="M0 596h1707v300H0z" fill="#221a26"/><path d="M826 540h108l260 240H520z" fill="#3a2c34" opacity=".8"/>
    <g fill="none" stroke="#4d3d44" stroke-width="1.5" opacity=".7">${Array.from({ length: 9 }, (_, i) => `<path d="M${560 + i * 70} ${612 + (i % 2) * 30}q20 -10 40 0"/>`).join('')}</g>
    <ellipse cx="1150" cy="640" rx="260" ry="40" fill="#e9a955" opacity=".14"/>
    <!-- trois diligences à l'arrêt -->
    ${D.diligence(40, 700, 1.05, false).replace(D.cheval(300, 0, 1), '').replace(/<path d="M250 -96L420 -86"[^>]*>/, '')}
    ${D.diligence(1040, 652, 0.62, false).replace(D.cheval(300, 0, 1), '').replace(/<path d="M250 -96L420 -86"[^>]*>/, '')}
    ${D.diligence(1420, 672, 0.8, false).replace(D.cheval(300, 0, 1), '').replace(/<path d="M250 -96L420 -86"[^>]*>/, '')}
    ${D.cheval(860, 668, 0.62)}${D.marcheur(960, 668, 0.75)}${D.marcheur(790, 640, 0.55)}${D.marcheur(905, 590, 0.4)}${D.marcheur(1270, 640, 0.6)}${D.marcheur(700, 650, 0.6, true)}
    <g fill="#06040a"><path d="M1560 780V420h14v360z"/><path d="M1574 440h96l18 14-18 14h-96zM1560 500h-90l-18 14 18 14h90z"/></g></g>`;
};

/* le Reik de jour : la barge sous voile entre deux berges boisées */
D.fleuve = ({ teinte = 'jour', barrage = false } = {}) => `${D.ciel(teinte, 430)}${D.ombreVoile}
  <defs><linearGradient id="eau" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb6bd"/><stop offset=".35" stop-color="#5f858f"/><stop offset="1" stop-color="#1d3a44"/></linearGradient></defs>
  ${V.nuages(12, 60, 300, '#fff', 4)}<ellipse cx="1180" cy="150" rx="260" ry="170" fill="url(#halo)" opacity=".7"/>
  ${V.monts(420, 150, '#9fb3c6', 3, 130)}${V.collines(424, 70, '#7f99a6', 6)}
  ${V.feuillus(0, 1707, 432, 54, '#4f6f5e', 5, 26)}${V.sapins(0, 1707, 440, 70, '#2f4a42', 2, 30)}
  <rect y="436" width="1707" height="344" fill="url(#eau)"/><rect y="436" width="1707" height="10" fill="#1f3a36" opacity=".55"/>
  <g opacity=".28" transform="translate(0 876) scale(1 -1)">${V.sapins(0, 1707, 440, 70, '#16302c', 2, 30)}</g>
  ${V.vagues(450, 620, '#d7e6e6', 70, 9)}
  ${barrage ? `<g fill="#0c0a0c"><path d="M1090 520l80-34 14 10-70 40zM1150 540l130-22 6 12-124 26zM1230 500l60-40 12 8-50 46zM1120 556h230l20 14h-270zM1290 530l90 14-4 12-92-10z"/><path d="M1180 486l-14-40 8-3 16 40zM1320 506l22-46 8 4-18 46z"/></g>` : ''}
  <g opacity=".3" transform="translate(${barrage ? 620 : 1040} 1052) scale(1 -1)"><g transform="translate(${barrage ? -620 : -1040} 0)">${D.barge(barrage ? 620 : 1040, 526, 0.86, false, '#2c1414')}</g></g>
  ${D.barge(barrage ? 620 : 1040, 526, 0.86, false)}
  <path d="M${barrage ? 400 : 820} 532h440" stroke="#e6f0ee" stroke-width="2" opacity=".5"/>
  <g fill="#081410"><path d="M0 780V560c120-20 200 0 300 40l60 180z"/><path d="M1707 780V600c-90-24-170-10-240 30l-50 150z"/></g>
  ${V.roseaux(0, 330, 640, '#06100c', 4)}${V.roseaux(1440, 1707, 660, '#06100c', 8)}${D.avantForet('#050c0a')}`;
/* la mer des Griffes : la cogue sous voile, la côte au loin ; `cogue` : ses options (`vapeur` : cheminée, fumée et jet de vapeur, MDG 12 l.305-311) */
D.mer = ({ teinte = 'gris', s = 0.86, x = 800, navire = true, cogue = {} } = {}) => `${D.ciel(teinte, 450)}${D.ombreVoile}
  <defs><linearGradient id="eau" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${teinte === 'gris' ? '#8d9a9c' : '#c2a98c'}"/><stop offset=".3" stop-color="#48616c"/><stop offset="1" stop-color="#0d1c26"/></linearGradient></defs>
  ${V.nuages(22, 40, 400, teinte === 'gris' ? '#dfe3df' : '#f2c9a4', 11)}<ellipse cx="1240" cy="330" rx="300" ry="170" fill="url(#halo)" opacity=".55"/>
  <path d="M0 452c90-16 170-22 250-14 60 6 120 10 190 14z" fill="#5d6a72" opacity=".8"/>
  <rect y="450" width="1707" height="330" fill="url(#eau)"/>
  ${V.vagues(458, 640, '#e6ecea', 110, 9)}
  <g fill="none" stroke="#0a1620" stroke-width="2" opacity=".6">${Array.from({ length: 9 }, (_, i) => `<path d="M${-40 + i * 220} ${600 + (i % 3) * 14}q55 -26 110 0t110 0"/>`).join('')}</g>
  ${navire ? `${D.cogue(x, 540, s, cogue)}<path d="M${x - 300 * s} ${540 + 22 * s}q${300 * s} 26 ${640 * s} 0" stroke="#e6ecea" stroke-width="2.500" fill="none" opacity=".6"/>` : ''}
  <path d="M0 780V690q200 -40 420 0t440 0 420 0 427 0V780z" fill="#07111a"/>`;

/* ───────── l'interface du voyage ───────── */
const ARCHES = { soir: ['#232a5c', '#e79a5c', '#f6d27a'], jour: ['#6f98c4', '#e9dfc0', '#fff2b8'], aube: ['#3a3f6e', '#f0b48a', '#ffe0a0'], nuit: ['#070a1c', '#2c3261', '#e8ecff'], gris: ['#39424e', '#9aa39f', '#d8d8cc'] };
/* l'objet du temps, à la place du cartouche du lieu : l'arche du ciel, le jour, la date et le jour de route, la météo */
const temps = ({ teinte = 'soir', jour, date, meteo, icone = 'soleil' }) => { const [c1, c2, astre] = ARCHES[teinte]; return `<div id="titre" class="cadre bois temps" data-piece="cartouche"><div class="fond bois">
  <svg width="112" height="58" viewBox="0 0 112 58" style="flex:none"><defs><linearGradient id="arche" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient><clipPath id="arche-c"><path d="M4 54a52 52 0 0 1 104 0z"/></clipPath></defs><g clip-path="url(#arche-c)"><rect width="112" height="58" fill="url(#arche)"/>${teinte === 'nuit' || teinte === 'soir' ? '<g fill="#fff"><circle cx="30" cy="22" r=".8"/><circle cx="48" cy="12" r=".8"/><circle cx="70" cy="18" r=".8"/><circle cx="40" cy="34" r=".7"/></g>' : ''}<circle cx="84" cy="${teinte === 'jour' ? 22 : 44}" r="6" fill="${astre}"/><path d="M0 54l14-7 10 3 12-6 14 5 16-4 14 6 16-5 16 8H0z" fill="#150d0a"/></g><path d="M4 54a52 52 0 0 1 104 0M1 55h110" fill="none" stroke="#c9a24a" stroke-width="2.5"/></svg>
  <div><div class="n gothique" data-texte="jour">${jour}</div><div class="s rubrique">${date}</div><div class="m">${picto(icone, 14, '#c9b995')}<i>${meteo}</i></div></div></div>${ferrures}</div>`; };
/* la carte du trajet : fragment de parchemin encadré ; `part` : la part faite ; `eau` : le fleuve qui la traverse, celui
   qu'on descend, ou la mer */
const carteDuTrajet = ({ titre: t, de, vers, part = .5, eau = 'fleuve' }) => {
  const a = [70, 168], b = [286, 58], c = [170, 150]; const q = (u) => [(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1]];
  const fait = Array.from({ length: 21 }, (_, k) => q(part * k / 20).join(',')).join('L'), reste = Array.from({ length: 21 }, (_, k) => q(part + (1 - part) * k / 20).join(',')).join('L'); const [ix, iy] = q(part);
  const terre = eau === 'mer'
    ? `<path d="M0 0H130C150 40 120 70 90 90S40 150 0 160z" fill="rgba(90,60,30,.16)" stroke="#3a2a18" stroke-width="1.2"/><path d="M342 0H250C240 30 262 44 280 70S310 110 342 120z" fill="rgba(90,60,30,.16)" stroke="#3a2a18" stroke-width="1.2"/>${V.vagues(20, 200, '#5f7a80', 26, 6).replace(/M(\d+\.?\d*) /g, (m, x) => 'M' + (x / 5) + ' ')}`
    : `${V.encreArbres([[10, 16, 190, 100, 20], [190, 130, 330, 205, 16], [10, 186, 110, 210, 4]], 4)}${V.encreMonts([[36, 56], [66, 44, 30]])}`;
  const voie = eau === 'fleuve-voie' ? `<path d="M${fait}" fill="none" stroke="#5f7a80" stroke-width="11" opacity=".9"/><path d="M${reste}" fill="none" stroke="#5f7a80" stroke-width="11" opacity=".9"/><path d="M${fait}L${reste}" fill="none" stroke="#a9bdbd" stroke-width="8"/>` : eau === 'fleuve' ? '<path d="M0 92C80 76 190 106 250 82S320 46 342 26" fill="none" stroke="#5f7a80" stroke-width="10" opacity=".9"/><path d="M0 92C80 76 190 106 250 82S320 46 342 26" fill="none" stroke="#a9bdbd" stroke-width="7"/>' : '';
  return `<div id="trajet" class="cadre bois" data-piece="vignette"><div class="fond parchemin"><svg viewBox="0 0 342 214" preserveAspectRatio="none">${terre}${voie}
    <path d="M${reste}" fill="none" stroke="#3a2a18" stroke-width="1.6" stroke-dasharray="6 4" opacity=".8"/><path d="M${fait}" fill="none" stroke="#8a2416" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${a[0]}" cy="${a[1]}" r="4.500" fill="#e6d5ad" stroke="#3a2a18" stroke-width="1.6"/><g transform="translate(${b[0]} ${b[1]})" fill="#3a2a18"><path d="M-11 4v-8h4v-4h3v4h3v-8h5v8h3v-4h4v12z"/></g>
    <circle cx="${ix}" cy="${iy}" r="7" fill="#9c2a1a" stroke="#5a130b" stroke-width="2"/>
    <g font-family="Fell SC" letter-spacing="1" fill="#2a1d12"><text x="${a[0] + 12}" y="${a[1] + 16}" font-size="12">${de}</text><text x="${b[0]}" y="${b[1] - 14}" text-anchor="middle" font-size="12.500">${vers}</text></g>
    ${V.rose(310, 184, 17)}</svg></div>${ruban(t)}${ferrures}</div>`;
};
/* les vignettes des arrêts, à l'encre deux tons sur 250 × 250 : le pont effondré, le barrage de débris, le port, la paie,
   la chaudière */
const VIGNETTES = {
  pont: () => `<rect width="250" height="250" fill="#d8c493"/><g opacity=".35">${V.monts(150, 70, '#5c4326', 3, 40, 250).replace('780L0 780', '250L0 250')}</g>
  ${V.sapins(0, 250, 168, 60, '#2a1d12', 6, 16)}<rect y="165" width="250" height="85" fill="#2a1d12"/>
  <path d="M60 250V186c26-26 60-26 86 0v10h-12c-18-16-44-16-62 0v54z" fill="#d8c493"/><path d="M186 180l26 8 4 62h-30z" fill="#d8c493"/><path d="M148 186l30-12 4 7-28 14zM150 214l22 3-4 9-20-3z" fill="#d8c493"/>
  <path d="M40 232c60-10 130-10 190 0M60 242c50-8 100-8 150 0" stroke="#8c7446" stroke-width="2" fill="none"/>
  <circle cx="196" cy="54" r="20" fill="#9c2a1a" opacity=".85"/>`,
  barrage: () => `<rect width="250" height="250" fill="#d8c493"/>${V.sapins(0, 250, 96, 46, '#8c7446', 6, 14)}<rect y="94" width="250" height="156" fill="#b9a26c"/>
    <g fill="none" stroke="#8c7446" stroke-width="2"><path d="M10 120q30 -8 60 0t60 0M120 230q30 -8 60 0t60 0M20 208q24 -6 48 0"/></g>
    <g fill="#2a1d12"><path d="M20 176l96-40 12 12-88 44zM80 196l150-30 6 14-146 34zM150 150l60-46 12 10-52 50zM36 214h190l14 16H26z"/><path d="M110 138l-16-44 8-3 18 44zM196 160l22-50 9 4-20 50z"/></g>
    <circle cx="52" cy="46" r="20" fill="#9c2a1a" opacity=".85"/>`,
  port: () => `<rect width="250" height="250" fill="#d8c493"/><rect y="170" width="250" height="80" fill="#b9a26c"/><g fill="#2a1d12"><path d="M0 150h120v22H0zM18 172h10v60H18zM60 172h10v60H60zM100 172h10v60h-10z"/><path d="M20 150V96h34v54zM62 150v-76l22-22 22 22v76z"/><path d="M150 176h86l-12 26h-62z"/><path d="M190 60h5v116h-5z"/><path d="M160 84c22 6 44 6 66 0 3 26 2 50-2 70-20 6-42 6-62 0-4-20-5-44-2-70z"/></g><g fill="none" stroke="#8c7446" stroke-width="2"><path d="M124 214q16-7 32 0t32 0 32 0M130 232q14-6 28 0t28 0"/></g><circle cx="204" cy="34" r="16" fill="#9c2a1a" opacity=".85"/>`,
  paie: () => `<rect width="250" height="250" fill="#d8c493"/><rect y="176" width="250" height="74" fill="#b9a26c"/><g fill="#2a1d12"><path d="M30 176h190v14H30zM48 190h12v52H48zM190 190h12v52h-12z"/><path d="M74 176v-30h42v30zM82 146c0-10 6-16 13-16s13 6 13 16z"/><circle cx="150" cy="166" r="10"/><circle cx="172" cy="168" r="8"/><circle cx="160" cy="152" r="8"/><path d="M196 176l6-64h8l6 64z"/></g><path d="M203 104c-8-10 4-14 0-26 10 8 12 18 6 26z" fill="#9c2a1a" opacity=".85"/>`,
  chaudiere: () => `<rect width="250" height="250" fill="#d8c493"/><rect y="190" width="250" height="60" fill="#b9a26c"/><g fill="#2a1d12"><path d="M50 190v-80c0-22 16-36 40-36h30c24 0 40 14 40 36v80z"/><path d="M150 96h46v14h-46zM186 96h12v94h-12z"/><path d="M92 74V42h26v32z"/></g><circle cx="105" cy="136" r="22" fill="#d8c493"/><path d="M105 136l12-12" stroke="#2a1d12" stroke-width="4"/><g fill="none" stroke="#8c7446" stroke-width="3" stroke-linecap="round"><path d="M160 120c20-10 30 6 50-6M162 140c22-8 34 8 58-4M160 160c18-6 30 8 46 0"/></g>`,
};
/* les silhouettes des possessions, dans la niche de leur dossier : la cogue, la mule bâtée, la charrette */
const SILHOUETTES = {
  navire: `<svg viewBox="-330 -450 680 520">${D.ombreVoile}${D.cogue(0, 0, 1, { coque: '#2a1d12', voile: '#7d2020' })}<path d="M-300 26q60 -12 120 0t120 0 120 0 120 0 120 0" fill="none" stroke="#5f7a80" stroke-width="4"/></svg>`,
  mule: '<svg viewBox="0 0 240 520"><ellipse cx="120" cy="420" rx="92" ry="9" fill="#2a1d12" opacity=".3"/><g fill="#2a1d12"><path d="M52 300c0-34 20-50 56-52h44c22 0 36 10 40 30l4 30-12 2-6-20c-6 10-14 16-26 18H86c-10 0-18-4-22-10z"/><path d="M64 300h14v116H64zM92 318h13v98H92zM150 318h13v98h-13zM176 296h14v120h-14z"/><path d="M60 262l-16-44c-8 2-18 0-26-6l-10-24c-2-6 2-10 8-8l18 8 6-34 10 26 10-28 4 36c8 10 12 24 12 44z"/><path d="M196 290c10 14 12 34 6 60l-8-2c4-22 2-38-6-50z"/></g><path d="M96 250h56l6 40H90z" fill="#7d2020" stroke="#2a1d12" stroke-width="3"/><path d="M84 262h80" stroke="#2a1d12" stroke-width="5"/></svg>',
  charrette: '<svg viewBox="0 0 240 520"><ellipse cx="120" cy="420" rx="100" ry="9" fill="#2a1d12" opacity=".3"/><g fill="#2a1d12"><path d="M30 300h150l14 20v46H30z"/><path d="M190 334h44v8h-44z"/><path d="M36 300l-8-40h10l10 40zM172 300l8-40h-10l-10 40z"/></g><g fill="none" stroke="#2a1d12"><circle cx="96" cy="372" r="44" stroke-width="10"/><path d="M96 328v88M52 372h88M65 341l62 62M127 341l-62 62" stroke-width="5"/></g><circle cx="96" cy="372" r="9" fill="#2a1d12"/></svg>',
};
// Partagé avec les scripts chargés après celui-ci.
Object.assign(globalThis, { temps, carteDuTrajet, VIGNETTES, SILHOUETTES });
