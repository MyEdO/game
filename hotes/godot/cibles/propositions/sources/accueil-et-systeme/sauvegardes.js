/* Charger et sauvegarder (#3935) : quatre feuillets du carnet de route posés sur la table, l'automatique d'abord. */
const vignette = (genre) => {
  const tete = `<svg viewBox="0 0 336 150" preserveAspectRatio="xMidYMid slice"><defs>
    <linearGradient id="v-soir" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241f4a"/><stop offset=".55" stop-color="#8a4a62"/><stop offset=".85" stop-color="#f0a45c"/><stop offset="1" stop-color="#f6c877"/></linearGradient>
    <linearGradient id="v-nuit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0d22"/><stop offset=".7" stop-color="#2a2a5a"/><stop offset="1" stop-color="#5a4a78"/></linearGradient>
    <linearGradient id="v-jour" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a7a9a"/><stop offset=".7" stop-color="#c9c0a0"/><stop offset="1" stop-color="#e8d8a8"/></linearGradient>
    <radialGradient id="v-lune"><stop offset="0" stop-color="#fff6dc" stop-opacity=".9"/><stop offset=".3" stop-color="#ffe2a8" stop-opacity=".35"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/></radialGradient></defs>`;
  const sap = (x, y, h, c) => `<path d="M${x},${y - h}l${h * .28},${h * .9}h${-h * .56}z" fill="${c}"/>`;
  if (genre === 'bourg') return tete + `<rect width="336" height="150" fill="url(#v-soir)"/>
    <path d="M0,110l40,-30l44,24l50,-36l60,40l50,-28l92,36v40H0z" fill="#4d3d6c"/>
    <g fill="#1a1328"><path d="M0,150V104l22,-18l22,18v-8l26,-20l26,20v54zM96,150V92l30,-24l30,24v58zM150,150V60l-4,0l18,-34l18,34h-4v90zM186,150V96l26,-20l26,20v-6l30,-22l30,22v60zM298,150V100l19,-14l19,14v50z"/><path d="M163,26v-12l10,4l-10,4" fill="#9c2a1a"/></g>
    <g fill="#ffd98a"><rect x="16" y="112" width="5" height="7"/><rect x="60" y="100" width="5" height="7"/><rect x="74" y="118" width="5" height="7"/><rect x="112" y="98" width="6" height="8"/><rect x="134" y="118" width="6" height="8"/><rect x="161" y="72" width="5" height="9"/><rect x="161" y="100" width="5" height="9"/><rect x="204" y="106" width="5" height="7"/><rect x="246" y="98" width="6" height="8"/><rect x="270" y="118" width="6" height="8"/><rect x="312" y="112" width="5" height="7"/></g></svg>`;
  if (genre === 'route') return tete + `<rect width="336" height="150" fill="url(#v-jour)"/>
    <path d="M0,96l50,-26l60,22l56,-30l70,34l100,-20v74H0z" fill="#7d8a78"/>
    ${[12, 30, 52, 70, 252, 276, 300, 322].map((x, i) => sap(x, 118 + (i % 3) * 4, 46 + (i % 4) * 9, '#263026')).join('')}
    <path d="M0,150V122c80,-10 220,-10 336,2v26z" fill="#1c1a14"/>
    <path d="M120,150c30,-22 70,-28 110,-30c-20,6 -44,16 -56,30z" fill="#6b5a40"/>
    <g fill="#14100c"><path d="M150,118v-22c0,-4 2,-6 6,-6h44c4,0 6,2 6,6v22zM146,90h64v-4h-64z"/><circle cx="162" cy="121" r="9"/><circle cx="196" cy="121" r="9"/><path d="M206,108h26l14,-10l8,2l-4,8l-6,2v12h-3v-10h-16v10h-3v-12h-16z"/></g></svg>`;
  return tete + `<rect width="336" height="150" fill="url(#v-nuit)"/>
    <circle cx="268" cy="34" r="38" fill="url(#v-lune)"/><circle cx="268" cy="34" r="11" fill="#fff3d0"/>
    <g fill="#fff" opacity=".7"><circle cx="30" cy="20" r="1"/><circle cx="84" cy="38" r=".8"/><circle cx="140" cy="16" r="1"/><circle cx="196" cy="30" r=".8"/><circle cx="318" cy="70" r="1"/><circle cx="56" cy="60" r=".8"/></g>
    ${[8, 26, 300, 322].map((x, i) => sap(x, 126, 60 + i * 6, '#0c0e18')).join('')}
    <g fill="#100c14"><path d="M70,150V84l56,-40l56,40v-10l40,-26l40,26v76z"/><path d="M92,84v-34h12v26z"/><path d="M262,86h30v3h-30zM284,89v6h-12v16h18v-16h-3v-6"/></g>
    <g fill="#ffd98a"><rect x="88" y="96" width="12" height="14"/><rect x="118" y="96" width="12" height="14"/><rect x="150" y="96" width="12" height="14"/><rect x="204" y="92" width="10" height="12"/><rect x="232" y="92" width="10" height="12"/><path d="M118,150v-22a8 8 0 0 1 16 0v22z"/><rect x="275" y="98" width="12" height="10" opacity=".8"/></g>
    <path d="M0,150v-10c100,-8 240,-8 336,0v10z" fill="#08060c"/></svg>`;
};
const GROUPE = ['bjorn', 'mira', 'aldric', 'greta'];
const feuillet = ({ nom, lieu, date, reel, genre, sauver = true, charge = false, vide = false }) => `
  <div class="feuillet cadre bois ${charge ? 'vise' : ''} ${vide ? 'vide' : ''}"><div class="fond parchemin"><span class="ruban rubrique">${nom}</span>
    ${vide ? `<div class="blanc"><div class="filet-l"><i></i></div><em>— vide —</em><div class="filet-l"><i></i></div></div>` : `
    <div class="vue">${vignette(genre)}</div>
    <div class="lieu gothique" data-texte="lieu ${lieu}">${lieu}</div>
    <div class="date rubrique">${date}</div>
    <div class="filet-l"><i></i></div>
    <div class="groupe">${GROUPE.map((g) => portrait(g)).join('')}</div>
    <div class="reel lin">Sauvegardée le ${reel}</div>`}
    <div class="gestes">${vide ? '' : plaque('Charger', { armee: charge })}${sauver ? plaque('Sauvegarder') : ''}</div>
  </div>${ferrures}</div>`;
el(S, 'rect', { width: W, height: H, fill: '#150c07' });
monter([
  `<div class="calque bois" id="table"></div><div class="calque" id="lueur-table"></div>`,
  titre({ icone: 'disque', nom: 'Sauvegardes', sous: 'Steinbruck · 14 Pflugzeit 2512 CI · 18:20', largeur: 430 }),
  fermerRond(),
  `<div id="feuillets" data-piece="emplacements">
    ${feuillet({ nom: 'Emplacement automatique', lieu: 'Steinbruck', date: '14 Pflugzeit 2512 CI · 18:05', reel: '16/11/2026 21:48', genre: 'bourg', sauver: false, charge: true })}
    ${feuillet({ nom: 'Emplacement 1', lieu: 'La route de Weissbruck', date: '12 Pflugzeit 2512 CI · 15:40', reel: '15/11/2026 23:12', genre: 'route' })}
    ${feuillet({ nom: 'Emplacement 2', lieu: 'Auberge La Diligence', date: '33 Jahrdrung 2512 CI · 21:30', reel: '13/11/2026 20:05', genre: 'auberge' })}
    ${feuillet({ nom: 'Emplacement 3', vide: true })}
  </div>`,
  `<div id="avis" data-piece="avis">${sceau('disque', 14)}<span class="ombre">Emplacement 3 : sauvegarde d’un autre format, retirée.</span></div>`,
]);
