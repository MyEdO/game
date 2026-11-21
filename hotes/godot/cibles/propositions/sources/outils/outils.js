/* Les outils (#3935, #4411) : la ligne de liste à compte (Compendium, éditeur), la table ronde du salon en ligne et ses
   tabourets (`../rendu.js`, écrans `compendium`, `coop`, `editeur-de-scene`, `editeur-carte-du-monde`). Maquette hors du
   jeu. */
/* une ligne de liste : nom, compte à droite */
const ligneDeListe = (nom, compte = '', { la = false, icone = null } = {}) => `<div class="ligne ${la ? 'la' : ''}" data-primitive="ligneDeListe">${icone ? picto(icone, 16, la ? '#2a1a08' : '#e2c06a') : ''}<span>${nom}</span>${compte !== '' ? `<em class="chiffres">${compte}</em>` : ''}</div>`;
/* la table ronde du salon, vue de dessus : ses quatre tabourets, la carte, la chandelle, les dés */
const TABOURETS = [[178, 112], [462, 112], [178, 358], [462, 358]];
const tableDuSalon = () => `<svg viewBox="0 0 640 520" data-primitive="tableDuSalon"><defs>
    <radialGradient id="t-bois" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#7a5230"/><stop offset=".6" stop-color="#553519"/><stop offset="1" stop-color="#2e1b0c"/></radialGradient>
    <radialGradient id="t-lueur"><stop offset="0" stop-color="#ffd98a" stop-opacity=".75"/><stop offset=".35" stop-color="#ffb45a" stop-opacity=".28"/><stop offset="1" stop-color="#ffb45a" stop-opacity="0"/></radialGradient>
    <clipPath id="t-rond"><circle cx="320" cy="235" r="132"/></clipPath></defs>
  <ellipse cx="326" cy="252" rx="170" ry="160" fill="#000" opacity=".5"/>
  ${TABOURETS.map(([x, y]) => `<circle cx="${x + 4}" cy="${y + 6}" r="35" fill="#000" opacity=".5"/><circle cx="${x}" cy="${y}" r="33" fill="#3a2414" stroke="#150c07" stroke-width="2"/><circle cx="${x}" cy="${y}" r="24" fill="none" stroke="#5d3d22" stroke-width="1.500"/>`).join('')}
  <circle cx="320" cy="235" r="136" fill="#1c1008"/><circle cx="320" cy="235" r="132" fill="url(#t-bois)"/>
  <g clip-path="url(#t-rond)" stroke="#2a180b" stroke-width="1.500" opacity=".8">${[-88, -44, 0, 44, 88].map((d) => `<path d="M${320 + d},90V380"/>`).join('')}</g>
  <circle cx="320" cy="235" r="132" fill="none" stroke="#8a6a26" stroke-width="2" opacity=".55"/>
  <path d="M250,190l92,-26l30,84l-96,30z" fill="#d8c49a" stroke="#6d5a3c"/><path d="M268,200c20,10 40,-12 62,-4M276,226c22,-8 38,10 70,2M290,252c16,-4 30,4 50,-2" fill="none" stroke="#7c5a34" stroke-width="1.500"/>
  <circle cx="316" cy="222" r="4" fill="#9c2a1a"/>
  <circle cx="392" cy="292" r="74" fill="url(#t-lueur)"/><circle cx="392" cy="292" r="11" fill="#e9dcc0" stroke="#6d5a3c"/><circle cx="392" cy="292" r="4" fill="#fff3c8"/>
  <g fill="#e9dcc0" stroke="#3a2a18"><rect x="232" y="286" width="17" height="17" rx="3" transform="rotate(-14 240 294)"/><rect x="258" y="300" width="17" height="17" rx="3" transform="rotate(22 266 308)"/></g>
  <g fill="#3a2414" stroke="#150c07" stroke-width="1.500"><circle cx="246" cy="160" r="13"/><circle cx="404" cy="176" r="13"/></g><g fill="#7a4a1c"><circle cx="246" cy="160" r="8"/><circle cx="404" cy="176" r="8"/></g>
</svg>`;
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { ligneDeListe, tableDuSalon });
