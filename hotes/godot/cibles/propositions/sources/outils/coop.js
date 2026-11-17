/* La coop (#3935) : la tablée de l'auberge, un siège par joueur (l'hôte et jusqu'à trois invités). « coop-ouvrir » :
   aucune partie ouverte, on rejoint par le code ; « coop-salon » : l'hôte en session partage le code et attribue les
   héros et le rôle de Maître du Jeu aux sièges. */
const SALON = document.getElementById('ecran').dataset.etat === 'coop-salon';
const TABOURETS = [[178, 112], [462, 112], [178, 358], [462, 358]];
const table = () => `<svg viewBox="0 0 640 520"><defs>
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
const siege = (x, y, { nom, sous, heros = [], vous = false, absent = false, vide = false }) => vide
  ? `<div class="siege vide" style="left:${x}px;top:${y}px"><div class="q">${medaillon('plus', { petit: true, ferme: true })}<div><b>Un siège à pourvoir</b></div></div></div>`
  : `<div class="siege bois ${vous ? 'vous' : ''} ${absent ? 'absent' : ''}" style="left:${x}px;top:${y}px">
      <div class="q">${absent ? sceau('reseau', 15) : medaillon('personnage', { petit: true })}<div><b class="gothique" data-texte="siège ${nom}">${nom}</b><span class="rubrique">${sous}</span></div></div>
      <div class="tient">${heros.length ? heros.map((h) => portrait(h)).join('') : '<i>Aucun héros</i>'}</div></div>`;
const tablee = (x, sieges, legende) => `<div id="tablee" data-piece="tablée" style="left:${x}px;top:${SALON ? 150 : 140}px">${table()}${sieges.join('')}<div class="legende rubrique ombre">${legende}</div></div>`;
const POSES = [[0, 6], [426, 6], [0, 352], [426, 352]];

const pieces = [fondDeTable()];
if (SALON) {
  const JOUEURS = ['Karl', 'Lena', 'Otto'];
  const TIENT = { bjorn: 'Karl', mira: 'Lena', aldric: 'Karl', greta: 'Otto' };
  pieces.push(
    titre({ icone: 'reseau', nom: 'Salon — hôte', sous: 'Partie K7M2QX', largeur: 400 }),
    `<div id="invitation" class="cadre bois" data-piece="invitation"><div class="fond bois"><span class="ruban rubrique">Inviter — partagez le code</span>
       <div class="code parchemin gothique" data-texte="code">K7M2QX</div>
       <div class="r rubrique">Joueurs connectés</div>
       <div>
         <div class="joueur"><i class="pt"></i>Karl (vous)</div>
         <div class="joueur"><i class="pt"></i>Lena</div>
         <div class="joueur absent">${sceau('reseau', 11)}Otto — reconnexion…</div>
       </div>
       <div class="trait"></div>
       ${plaque('Quitter le salon', { icone: 'sortie' })}
     </div>${ferrures}</div>`,
    tablee(472, [
      siege(...POSES[0], { nom: 'Karl', sous: 'Hôte · vous', heros: ['bjorn', 'aldric'], vous: true }),
      siege(...POSES[1], { nom: 'Lena', sous: 'Invitée', heros: ['mira'] }),
      siege(...POSES[2], { nom: 'Otto', sous: 'Reconnexion…', heros: ['greta'], absent: true }),
      siege(...POSES[3], { vide: true }),
    ], 'Le monde est tenu par l’hôte tant qu’aucun siège n’est Maître du Jeu'),
    `<div id="attribution" class="cadre bois" data-piece="attribution"><div class="fond parchemin">
       ${HEROS.map((h) => `<div class="rang">${portrait(h.id)}<div><b class="gothique" data-texte="héros ${h.nom}">${h.nom}</b><span class="c rubrique">${h.car}</span></div><span class="segments">${JOUEURS.map((j) => `<b class="${TIENT[h.id] === j ? 'la' : ''}">${j}</b>`).join('')}</span></div>`).join('')}
       <div class="mj"><div class="r"><b class="gothique">Maître du Jeu</b><i>Un seul siège, ou personne</i></div>
         <span class="segments"><b class="la">IA (aucun MJ)</b>${JOUEURS.map((j) => `<b>${j}</b>`).join('')}</span></div>
     </div><div class="ruban gothique">Attribution des héros</div>${ferrures}</div>`,
  );
} else {
  pieces.push(
    titre({ icone: 'reseau', nom: 'Jouer en ligne', sous: 'Aucune partie ouverte', largeur: 400 }),
    `<div class="feuillet-coop cadre bois" data-piece="rejoindre" style="left:44px;top:150px"><div class="fond parchemin"><span class="ruban rubrique">Rejoindre une partie</span>
       <label class="champ"><span class="rubrique">Code de la partie</span><div class="cases gothique">${[...'K7M2QX'].map((c) => `<b>${c}</b>`).join('')}</div></label>
       <div class="indice">Le code de room fait 6 caractères.</div>
       ${champ('Votre nom', 'Lena')}
       ${plaque('Rejoindre', { armee: true, icone: 'reseau' })}
     </div>${ferrures}</div>`,
    tablee(534, POSES.map((p) => siege(...p, { vide: true })), 'Une tablée : l’hôte et jusqu’à trois invités'),
    `<div class="feuillet-coop cadre bois" data-piece="héberger" style="left:1223px;top:150px"><div class="fond parchemin"><span class="ruban rubrique">Héberger une partie</span>
       <p data-texte="aide">Le groupe se compose ensemble : vous attribuerez les emplacements aux joueurs connectés.</p>
       ${champ('Votre nom', '', { attente: 'Nom de joueur' })}
       ${plaque('Héberger', { fermee: true })}
       <div class="refus">${sceau('disque', 12)}<span>Ouvrez une partie pour l’héberger.</span></div>
     </div>${ferrures}</div>`,
  );
}
pieces.push(croix());
monter(pieces);
