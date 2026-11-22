/* Proposition du groupe « listes et noms » (#4585, docs/plans/2026-11-22-lot-listes-et-noms.md) : pour chaque nature, les
   variantes rendues aujourd'hui à gauche (valeurs relevées sur les 170 états en 16:9), la forme cible à droite, sur bois et
   sur parchemin. La forme cible est SIMULÉE par la feuille locale ci-dessous ; rien n'est posé au kit. Maquette hors du jeu. */
document.head.insertAdjacentHTML('beforeend', `<style>
.pl-col{display:flex;gap:12px}.pl-col>div{flex:1;min-width:0}
.pl-h{font:10px/12px monospace;opacity:.85;margin:0 0 3px;text-transform:uppercase}
.pl-pane{padding:4px 8px 1px;border-radius:2px;margin-bottom:5px}
[id^=pl-] figure code{font-size:9px!important;line-height:11px!important;margin-top:2px!important}
[id^=pl-] .fond>div{padding:18px 16px 0!important}
[id^=pl-] div[style*="margin-bottom:12px"]{margin-bottom:4px!important;gap:4px 12px!important}
.pl-e{display:inline-flex;align-items:center;box-sizing:border-box;white-space:nowrap;border:1px solid var(--filet-or-vif);color:var(--ivoire);background:var(--ombre)}
.parchemin .pl-e{border-color:var(--trait-encre);color:var(--encre);background:var(--voile)}
.pl-e.or,.parchemin .pl-e.or{border-color:var(--laiton-ombre);background:linear-gradient(180deg,var(--or-eclat),var(--or-moyen));color:var(--encre)}
.pl-e.cire,.parchemin .pl-e.cire{border-color:var(--cire-sombre);background:linear-gradient(180deg,var(--cire-clair),var(--sang));color:var(--ivoire)}
.pl-e.fer,.parchemin .pl-e.fer{border-color:var(--noir);background:linear-gradient(180deg,var(--fer-clair),var(--fer-sombre));color:var(--eteint)}
.pl-rect{font-family:"Fell SC";font-size:12.5px;line-height:15px;height:19px;padding:0 9px;border-radius:2px}
.pl-pastille{font-family:"Fell SC";font-size:10.5px;letter-spacing:.8px;height:21px;padding:0 10px;border-radius:11px}
.pl-compte{font-family:"Chiffres";font-weight:600;font-size:11.5px;letter-spacing:.2px;height:21px;padding:0 9px;border-radius:11px}
.pl-l{display:flex;align-items:center;gap:8px;box-sizing:border-box;height:28px;padding:0 8px;border:2px solid transparent;border-bottom:1px solid var(--filet-creme);font-family:"Fell";font-size:15px;color:var(--ivoire);white-space:nowrap;width:240px}
.parchemin .pl-l{color:var(--encre);border-bottom-color:var(--filet-encre)}
.pl-l.choisie,.parchemin .pl-l.choisie{border:2px solid var(--laiton);background:var(--voile)}
.pl-l .fin{margin-left:auto;font-family:"Chiffres";font-weight:600;font-size:11.5px}
.pl-l>.losange{width:7px;height:7px;margin:0 2px}
.pl-l .nm{font-family:"Grenze Gotisch";font-weight:600;font-size:16px;line-height:22px;letter-spacing:.3px}
.pl-n{font-family:"Grenze Gotisch";font-weight:600;letter-spacing:.3px;white-space:nowrap;color:var(--ivoire);text-shadow:0 1px 2px var(--noir)}
.parchemin .pl-n{color:var(--sepia);text-shadow:none}
.pl-n.grand{font-size:22px;line-height:30px}.pl-n.moyen{font-size:18px;line-height:24px}.pl-n.petit{font-size:16px;line-height:22px}
.pl-boite{outline:1px dashed rgba(127,127,127,.6)}
</style>`);
const pl = (cls, txt, style = '') => `<span class="pl-e ${cls}" style="${style}">${txt}</span>`;
const vol = (matiere, html) => `<div class="pl-pane ${matiere}">${html}</div>`;
const n = (taille, ligneH, txt) => `<span class="pl-n pl-boite" style="font-size:${taille}px;line-height:${ligneH}px">${txt}</span>`;
const trait = (fond) => `<div style="height:1px;background:${fond}"></div>`;

/* étiquette : 41 rendus aujourd'hui (relevé), 3 variantes et 4 teintes en cible */
const etiquettes = () => `<div class="pl-col"><div><p class="pl-h">aujourd'hui (parchemin)</p>${vol('parchemin', [
  ligne(piece('.modif 12,5/h19', pl('', 'Orc a peur', 'font:12.5px Fell SC;height:19px;padding:0 9px;border-radius:2px')),
    piece('.chip 12/h18', pl('', 'Indice', 'font:12px Fell SC;height:18px;padding:0 6px;border-radius:2px')),
    piece('.tag 11 w32', pl('', 'CC', 'font:11px Fell SC;height:18px;width:32px;justify-content:center;border-radius:2px;color:var(--rouille)')),
    piece('.puce h31', pl('', 'Test', 'font:12.5px Fell SC;height:31px;padding:0 8px;border-radius:2px'))),
  ligne(piece('.attend 12/h18', pl('or', 'Mène le groupe', 'font:12px Fell SC;height:18px;padding:0 7px;border-radius:2px')),
    piece('.pill 10/h19', pl('', 'Albionais', 'font:10px Fell SC;height:19px;padding:0 9px;border-radius:11px')),
    piece('.pill 12/h23', pl('', 'Alerte', 'font:12px Fell SC;height:23px;padding:0 10px;border-radius:11px'))),
  ligne(piece('.palier 11/h20', pl('cire', '+5', 'font:600 11px Chiffres;height:20px;padding:0 7px;border-radius:10px')),
    piece('.jeton 10/h16', pl('', '+20 PX', 'font:600 10px Chiffres;height:16px;padding:0 7px;border-radius:11px')),
    piece('10,5/h19', pl('or', '100 PX', 'font:600 10.5px Chiffres;height:19px;padding:0 8px;border-radius:11px')),
    piece('11,5/h21', pl('or', 'Niveau achevé', 'font:600 11.5px Chiffres;height:21px;padding:0 9px;border-radius:11px'))),
].join(''))}</div><div><p class="pl-h">cible : etiquette({ texte, teinte, variante })</p>${['bois', 'parchemin'].map((m) => vol(m, [
  ligne(piece('rectangle 12,5/h19', pl('pl-rect', 'Orc a peur')), piece('or', pl('pl-rect or', 'Mène le groupe')), piece('cire', pl('pl-rect cire', 'Nouveau')), piece('fer', pl('pl-rect fer', 'Hôte'))),
  ligne(piece('pastille 10,5/h21', pl('pl-pastille', 'Initiative')), piece('or', pl('pl-pastille or', 'Peinture')), piece('compte 11,5/h21', pl('pl-compte', '+25 PX')), piece('or', pl('pl-compte or', '100 PX')), piece('fer', pl('pl-compte fer', '50 PX'))),
].join(''))).join('')}</div></div>`;

/* ligne de liste, puce, séparateur */
const listes = () => `<div class="pl-col"><div><p class="pl-h">aujourd'hui (parchemin)</p>${vol('parchemin', [
  ligne(piece('fiche 28 · Fell 15 · losange 7 du kit', `<div class="pl-l"><i class="losange"></i>Apothicaire<span class="fin">100 PX</span></div>`)),
  ligne(piece('rangée 23 · compendium', `<div class="pl-l" style="height:23px;font:14.5px Spectral">Mains agiles<span class="fin">LDB</span></div>`)),
  ligne(piece('ligne-b 34 · butin', `<div class="pl-l" style="height:34px;font-size:14.5px">Hache<span class="fin">Attribuer</span></div>`)),
  ligne(piece('.pt 8 · coop', '<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--or)"></i>'), piece('.sep 1×30', '<i style="display:inline-block;width:1px;height:30px;background:var(--filet-encre)"></i>'), piece("« · » en texte, 342 → separateur('median')", '<span style="font:14px Spectral">50 · 100</span>')),
].join(''))}</div><div><p class="pl-h">cible : ligneDeListe({ puce, nom, fin, choisie })</p>${['bois', 'parchemin'].map((m) => vol(m, [
  ligne(piece("28 · puce 'losange' 7 · nom petit", `<div class="pl-l"><i class="losange"></i><span class="nm">Apothicaire</span><span class="fin">100 PX</span></div>`)),
  ligne(piece('44 · precision dessous', `<div class="pl-l" style="height:44px;flex-wrap:wrap;align-content:center;row-gap:0"><i class="losange"></i><span class="nm">Garder les jets</span><span class="fin">+50 PX</span><span style="flex-basis:100%;padding-left:19px;font:13px/16px Spectral">une seule fois par séance</span></div>`)),
  ligne(piece('{ choisie } · coche', `<div class="pl-l choisie">${picto('coche', 14)}<span class="nm">Lettrés</span><span class="fin">100 PX</span></div>`)),
].join(''))).join('')}</div></div>`;

/* filet : les quatre du kit, et les traits d'aujourd'hui */
const filets = () => `<div class="pl-col"><div><p class="pl-h">aujourd'hui : traits hors du kit</p>${vol('bois', [
  ligne(piece('.trait .28 · inspecteur, nouvelle partie', large(120, trait('rgba(226,192,106,.28)'))), piece('.trait fondu .55 · ouverture', large(120, trait('linear-gradient(90deg,rgba(226,192,106,.55),rgba(226,192,106,0))')))),
  ligne(piece('.borne > i · combat, 55 états', large(120, trait('linear-gradient(90deg,rgba(201,185,149,0),rgba(201,185,149,.6),rgba(201,185,149,0))')))),
].join(''))}${vol('parchemin', ligne(piece('.parchemin .trait .35 · éditeurs', large(120, trait('rgba(60,40,20,.35)')))) + '<p class="pl-h" style="text-transform:none">filet() : marges propres 0, 4 0, 9 26, 10 30, 12 8, 18 0 12, 4 120 6…</p>')}</div><div><p class="pl-h">cible : filet({ fondu, losange, or }), marge = placement</p>${['bois', 'parchemin'].map((m) => vol(m, ligne(piece('filet()', large(90, filet())), piece('{ fondu }', large(90, filet({ fondu: true }))), piece('{ losange }', large(90, filet({ losange: true }))), piece(m === 'bois' ? '{ or, losange }' : '{ fondu, losange }', large(90, filet(m === 'bois' ? { or: true, losange: true } : { fondu: true, losange: true })))))).join('')}</div></div>`;

/* nom : les tailles rendues, puis l'échelle à trois crans (boîte pointillée = interligne) */
const noms = () => `<div class="pl-col"><div><p class="pl-h">aujourd'hui (taille/interligne · sites)</p>${vol('bois', ligne(piece('17,5/28 · 247 · rang', n(17.5, 28, 'Greta Hartmann')), piece('22/30 · 34 · cartouche', n(22, 30, 'Le Bord')), piece('24/32 · 12', n(24, 32, 'Race')), piece('16/17 · 41 · .et', n(16, 17, 'Dés'))))}${vol('parchemin', ligne(piece('21 · 82 · place', n(21, 26, 'Orc')), piece('26/36 · 13 · fiche', n(26, 36, 'Lena')), piece('16/22 · 17 · sorte', n(16, 22, 'Calme')), piece('18/20 · 17 · .l', n(18, 20, 'Brader'))))}</div><div><p class="pl-h">cible : nom({ texte, taille })</p>${['bois', 'parchemin'].map((m) => vol(m, ligne(piece("'grand' 22/30 · 93", '<span class="pl-n grand pl-boite">Greta Hartmann</span>'), piece("'moyen' 18/24 · 446", '<span class="pl-n moyen pl-boite">Greta Hartmann</span>'), piece("'petit' 16/22 · 175", '<span class="pl-n petit pl-boite">Greta Hartmann</span>')))).join('')}</div></div>`;

monter([
  page('pl-etiquettes', 16, 12, 620, 384, 'bois', 'Étiquette', etiquettes()),
  page('pl-listes', 648, 12, 616, 384, 'bois', 'Ligne de liste, puce, séparateur', listes()),
  page('pl-filets', 16, 414, 620, 294, 'bois', 'Filet', filets()),
  page('pl-noms', 648, 414, 616, 294, 'bois', 'Nom', noms()),
]);
