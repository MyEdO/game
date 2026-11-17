/* Le jet opposé, images d'intention (#3935) : les pièces du bandeau du bas que partagent le combat (`socle.js`) et
   les écrans bâtis sur `../lieux-et-nuit/commun.js` (le Marchandage). Ne dépend d'aucun des deux socles : le portrait
   d'un camp lui arrive déjà dessiné. Maquette hors du jeu. */
const d10 = (texte) => `<svg width="36" height="40" viewBox="-19 -21 38 42"><path d="M0,-19L17,-5L10,17L-10,17L-17,-5Z" fill="#b8a67e" stroke="#2a1d12" stroke-width="1.300" stroke-linejoin="round"/><path d="M0,-19L10,4L0,13L-10,4Z" fill="#f1e6cc" stroke="#2a1d12" stroke-width="1" stroke-linejoin="round"/><path d="M-17,-5L-10,4M17,-5L10,4M0,13L-10,17M0,13L10,17" stroke="#2a1d12" stroke-width="1" fill="none"/><text x="0" y="3.500" text-anchor="middle" font-family="Grenze Gotisch" font-weight="600" font-size="${texte.length > 1 ? 12.5 : 15}" fill="#2a1d12">${texte}</text></svg>`;
const camp = ({ cote = '', portrait, nom, carac, seuil, des = ['', ''], total = null, dr = null, modif = null, reussite = false, verdict = reussite ? 'réussite' : 'échec', sous = '' }) => `
  <div class="camp ${cote}">${portrait}
    <div><div class="n gothique">${nom}${modif ? ` <span class="modif rubrique" style="vertical-align:3px;margin-left:6px">${modif}</span>` : ''}</div><div class="c rubrique">${carac}</div>
    <div class="des"><span class="seuil">≤ ${seuil}</span>${des.map(d10).join('')}<div class="resultat${total == null ? ' vide' : reussite ? ' reussite' : ''}">${total ?? ''}</div>${total == null ? '' : `<div class="issue${reussite ? ' reussite' : ''}"><b>${verdict}</b><span>DR ${dr}</span></div>`}</div>${sous}</div>
  </div>`;
const verdict = (sous, dr, phrase, classe = '') => `<div id="verdict" class="${classe}"><div class="sous rubrique" data-texte="sous-titre">${sous}</div><div class="dr gothique">${dr}</div><p data-texte="phrase d'issue">${phrase}</p></div>`;
/* les clous du meuble du bas, barre de l'actif ou bandeau du jet */
const clouer = (b) => { const h = b.offsetHeight; [[70, 3], [330, 3], [850, 3], [1110, 3], [70, h - 9], [330, h - 9], [590, h - 9], [850, h - 9], [1110, h - 9]].forEach(([x, y]) => { const c = document.createElement('i'); c.className = 'clou'; c.style.left = x + 'px'; c.style.top = y + 'px'; b.appendChild(c); }); };
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { camp, verdict, clouer });
