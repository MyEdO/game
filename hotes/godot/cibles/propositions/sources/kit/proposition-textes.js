/* Proposition du groupe « textes » (#4585) : ligne libellé-valeur, rubrique, sous-titre, note. Pour chaque nature, les
   variantes d'aujourd'hui à gauche (valeurs relevées sur les 170 états, reproduites par du style local), la forme cible
   sur bois et sur parchemin à droite. La cible est simulée par la feuille locale ci-dessous, rien n'est posé au kit.
   Chargée après `../gestes.js` et `planche.js`. Maquette hors du jeu. */
document.head.insertAdjacentHTML('beforeend', `<style>
.cible-sous{font-family:"Fell SC",serif;font-size:12.5px;line-height:14px;letter-spacing:1.1px;color:var(--encre-2);white-space:nowrap}
.fond.bois .cible-sous{color:var(--creme-2)}
.cible-note{font-family:"Spectral",serif;font-style:italic;font-size:12.5px;line-height:16px;color:var(--encre-2)}
.fond.bois .cible-note{color:var(--creme-2)}
.cible-consigne{font-family:"Spectral",serif;font-style:italic;font-size:17px;line-height:23px;color:var(--encre);border-left:2px solid var(--filet-encre);padding-left:10px}
.cible-ligne{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.cible-ligne .rub{flex:none}
.cible-val{font-family:"Fell",serif;font-size:15px;color:var(--encre)}
.fond.bois .cible-val{color:var(--ivoire)}
.cible-chiffres{font-family:"Chiffres",sans-serif;font-weight:600;font-size:14px;color:var(--encre)}
.fond.bois .cible-chiffres{color:var(--ivoire)}
.ech{padding:1px 6px 2px;border-radius:2px}
.ech.scene{background:linear-gradient(180deg,#3a3326,#1d1912)}
</style>`);
const ech = (fond, html, legende, largeur = null) => piece(legende, `<div class="ech ${fond}"${largeur ? ` style="width:${largeur}px"` : ''}>${html}</div>`);
const css = (s, t) => `<span style="white-space:nowrap;${s}">${t}</span>`;
const FELLSC = "font-family:'Fell SC';letter-spacing:1.1px;";
const ITAL = 'font-family:Spectral;font-style:italic;';
const bande = (y, h, nomNature, gauche, bois, parchemin) => [
  cadre(`auj-${nomNature}`, 18, y, 760, h, 'parchemin', `<div style="padding:8px 12px 0;color:var(--encre-2)">${gauche}</div>`, { ruban: `${nomNature} · aujourd’hui` }),
  cadre(`bois-${nomNature}`, 792, y, 230, h, 'bois', `<div style="padding:18px 12px 0;color:var(--creme-2)">${bois}</div>`, { ruban: 'cible · bois' }),
  cadre(`parch-${nomNature}`, 1034, y, 230, h, 'parchemin', `<div style="padding:18px 12px 0;color:var(--encre-2)">${parchemin}</div>`, { ruban: 'cible · parchemin' }),
];
const cibleLigne = () => `
  <div class="cible-ligne">${rubrique({ texte: 'Poursuivant' })}<span class="cible-val">Cogue pirate</span></div>
  <div class="cible-ligne" style="margin-top:4px">${rubrique({ texte: 'Blessures' })}<span class="cible-chiffres">10 / 14</span></div>
  ${nom('ligne courante · texte, chiffres')}
  <div style="margin-top:8px">${rubrique({ texte: 'Race' })}<div class="cible-val">Humains (Reikland)</div></div>${nom('ligne empilée')}`;
const cibleRub = () => `${rubrique({ texte: 'Compétences de carrière' })}${nom('rubrique · 13/16')}
  <div style="margin-top:8px" class="cible-ligne">${rubrique({ texte: 'Armée' })}${rubrique({ texte: 'Bâbord' })}</div>${nom('libellé de ligne = rubrique')}`;
const cibleSous = () => `<div class="n gothique" style="font-size:22px;line-height:24px">Aldric Haas</div><div class="cible-sous">Chasseur · Argent 1</div>${nom('nom + sousTitre · 12,5/14')}`;
const cibleNote = (fond) => `${rubrique({ texte: 'Blessures' })}<div class="cible-note">Changer coûte 100 PX.</div>${nom('note courante · 12,5/16')}
  ${fond === 'parchemin' ? `<div class="cible-consigne" style="margin-top:6px">Choisissez une cible.</div>${nom('note consigne · 17/23')}` : ''}`;
FEUILLES.textes = () => [
  ...bande(12, 244, 'ligne',
    ligne(
      ech('parchemin', `${css(FELLSC + 'font-size:12px;color:#4a3420', 'Virage')} ${css('font-family:Spectral;font-size:16px', 'Bâbord 45°')}`, 'regle · 12 + 16 · jet'),
      ech('bois', `${css(FELLSC + 'font-size:12.5px;color:var(--creme-2)', 'Poursuivant')} ${css('font-family:Spectral;font-size:14px;color:var(--ivoire)', 'Cogue pirate')}`, 'ligneDu · 12,5 + 14 · poursuite'),
      ech('bois', `${css(FELLSC + 'font-size:11px;color:var(--creme-2)', 'Race')}<br>${css('font-family:Fell;font-size:15px;color:var(--ivoire)', 'Humains (Reikland)')}`, 'acquis · 11 + Fell 15 · création'),
    
      ech('parchemin', `${css(FELLSC + 'font-size:13px;color:var(--rouille)', 'Blessures')}<br>${css('font-family:Fell;font-size:15px', 'BF + (2 × BE) + BFM')}`, 'fait · 13 + Fell 15 · fiche'),
      ech('bois', `${css(FELLSC + 'font-size:12.5px;color:var(--creme-2)', 'Blessures')} ${css(ITAL + 'font-size:16px;color:var(--ivoire)', '17 / 17')}`, 'mesure · 12,5 + 16 it. · combat'),
      ech('parchemin', `${css(FELLSC + 'font-size:13px;color:var(--rouille)', 'Blessures')} ${css('font-family:Chiffres;font-weight:600;font-size:14px', '10 / 10')}`, 'bl · 13 + Chiffres 14 · fiche'),
      ech('parchemin', `${css('font-family:Spectral;font-size:14.5px', 'Scène')} ${css('font-family:Spectral;font-size:14.5px', 'La Diligence')}`, 'prop · 14,5 · éditeurs'),
      ech('parchemin', `${css('font-family:Spectral;font-size:13.5px', 'Prix de base')} ${css('font-family:Chiffres;font-weight:600;font-size:13.5px', '2 CO')}`, 'tr · 13,5 · commerce')),
    cibleLigne(), cibleLigne()),
  ...bande(268, 140, 'rubrique',
    ligne(
      ech('parchemin', rubrique({ texte: 'Compétences' }), 'rub · 13/16 · fiche (142)'),
      ech('bois', css(FELLSC + 'font-size:13.5px;color:var(--creme-2)', 'Tour 2 sur 6'), '.t · 13,5 · combat (55)'),
      ech('scene', css(FELLSC + 'font-size:13.5px;color:#f0e2c2;text-shadow:0 1px 2px #000', 'Journal'), 'tête · 13,5 · scène (61)'),
      ech('scene', css(FELLSC + 'font-size:12.5px;color:var(--or);text-shadow:0 1px 2px #000', 'Le terrain'), 'récit · 12,5 or (16)'),
    
      ech('parchemin', css(FELLSC + 'font-size:13px;color:#6b1c10', 'Plan du lieu'), '.r · 13 · éditeurs (11)'),
      ech('bois', css(FELLSC + 'font-size:12px;color:var(--or)', 'Création de personnage'), 'intertitre · 12 or · Compendium'),
      ech('parchemin', css(FELLSC + 'font-size:11.5px;letter-spacing:.5px;color:#4a3420', 'Rangées'), '.t · 11,5 · naval'),
      ech('parchemin', css(FELLSC + 'font-size:12.5px;color:#4a3420', 'Ce que le Round jouera'), '.t · 12,5 · round')),
    cibleRub(), cibleRub()),
  ...bande(420, 140, 'sousTitre',
    ligne(
      ech('bois', css(FELLSC + 'font-size:12px;color:var(--creme-2)', 'Chasseur'), '.car · 12 · rangs (247)'),
      ech('bois', css(FELLSC + 'font-size:12.5px;color:var(--creme-2)', 'Auberge-relais'), '.s · 12,5 · cartouche (76)'),
      ech('parchemin', css(FELLSC + 'font-size:12.5px;color:#4a3420', 'Timonier · Voile'), '.c · 12,5 · places (76)'),
      ech('parchemin', css(FELLSC + 'font-size:12px;color:var(--rouille)', '1 indice'), '.sous · 12 rouille · pages'),
    
      ech('bois', css(FELLSC + 'font-size:11.5px;color:var(--creme-2)', 'Port d’Altdorf'), '.s · 11,5 · commerce (31)'),
      ech('bois', css(FELLSC + 'font-size:10.5px;color:var(--creme-2)', 'Inspecteur'), '.s · 10,5 · éditeurs'),
      ech('parchemin', css(FELLSC + 'font-size:14px;color:#6b1c10', 'Talent'), '.sous · 14 · Compendium'),
      ech('parchemin', css(FELLSC + 'font-size:12.5px;color:#7c1f14', 'Coup critique'), '.c · 12,5 sang · critique')),
    cibleSous(), cibleSous()),
  ...bande(572, 140, 'note',
    ligne(
      ech('parchemin', css(ITAL + 'font-size:12.5px;color:var(--encre-2)', 'Changer coûte 100 PX.'), 'noteDeRub · 12,5 (46)'),
      ech('parchemin', css(ITAL + 'font-size:12.5px;color:var(--encre)', 'L’effet dure trois minutes'), 'phrase-du-jet · 12,5 (23)'),
      ech('bois', css(FELLSC + 'font-size:11.5px;color:var(--creme-2)', 'Un indice caché ne s’y lit pas'), 'pied · Fell SC 11,5 (14)'),
    
      ech('parchemin', `<div style="${ITAL}font-size:17px;line-height:23px;color:var(--encre);border-left:2px solid var(--filet-encre);padding-left:10px">Choisissez une cible.</div>`, 'consigne · 17 (3)', 190),
      ech('parchemin', css(ITAL + 'font-size:13.5px;color:#3a2a18', 'Règle maison.'), 'aide · 13,5 · options'),
      ech('parchemin', css(FELLSC + 'font-size:13px;color:#7c1f14', 'Coût doublé'), 'span.rub · 13 · progression'),
      ech('parchemin', css(ITAL + 'font-size:12.5px;color:#4a3420', 'Se joue à la conclusion.'), '.note > i · 12,5 · commerce')),
    cibleNote('bois'), cibleNote('parchemin')),
];
document.getElementById('ecran').dataset.etat = 'textes';
monter(FEUILLES.textes());
