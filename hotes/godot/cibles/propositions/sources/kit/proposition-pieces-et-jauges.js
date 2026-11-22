/* La proposition du groupe « pièces et jauges » (#4585) : bulles, plaques et boutons, jauges. À gauche les variantes
   rendues aujourd'hui (relevé des 170 états en 16:9), à droite la forme cible, simulée par la feuille locale de cette
   planche. Chaque pièce porte sa taille et ses écrans. Maquette hors du jeu ; chargée après `../gestes.js` et `planche.js`. */
{
  const regles = [];
  /* une variante d'aujourd'hui : la pièce dans une enveloppe qui rejoue la surcharge relevée */
  const sous = (css, html) => { const c = `pj${regles.length}`; regles.push(css.replaceAll('&', `.${c}`)); return `<div class="${c}">${html}</div>`; };
  const etroit = (l, html) => `<div style="width:${l}px;display:flex">${html}</div>`;

  /* ── bulles ── */
  const hote = (bulle, porteur, haut = 52) => `<div style="position:relative;display:flex;justify-content:center;margin-top:${haut}px">${porteur}${bulle}</div>`;
  const large300 = (texte) => sous('& .bulle-refus{white-space:normal;width:max-content;max-width:300px}', raison(texte)).replace(/^<div/, '<div style="display:contents"');
  const bullesAujourdhui = [
    ligne(
      piece('raison · au texte · 16 sites', hote(raison('Maxi atteint'), plaque('Ajouter', { taille: 'petite', fermee: true }))),
      piece('largeur fixée : 340, 310, 174', hote(sous('& .bulle-refus{white-space:normal;width:200px;text-align:center}', raison('D’autres données désignent cette entrée.')).replace(/^<div/, '<div style="display:contents"'), plaque('Retirer', { taille: 'petite', fermee: true })))),
    ligne(
      piece('en ligne · Fell SC 10,5', '<i class="rubrique" style="font-size:10.5px;color:var(--creme-2)">au maximum</i>'),
      piece('Spectral 11,5', '<i style="font-size:11.5px;color:var(--eteint)">Pas de place</i>'),
      piece('Spectral 13,5', '<i style="font-size:13.5px;color:var(--creme)">Réservé</i>'),
      piece('title= · 113 sites', '<span style="font-size:12px;color:var(--eteint)">rien à l’écran</span>')),
  ];
  const bullesCible = [
    ligne(
      piece('raison : une ligne jusqu’à 300, puis à la ligne', hote(large300('Cette possession doit être avec le groupe pour être vendue.'), plaque('Vendre', { taille: 'petite', fermee: true }))),
      piece('title= → raison au survol', hote(raison('3 Bourses'), disque(3), 40))),
    ligne(piece('raison en ligne · Spectral italique 13/16', '<i style="font-size:13px;line-height:16px;color:var(--eteint)">Pas de place à bord</i>')),
  ];

  /* ── plaques et boutons ── */
  const lib = (css, libelle, o = {}) => sous(`& .plaque>div{${css}}`, plaque(libelle, o));
  const plaquesAujourdhui = [
    ligne(
      piece('moy. 13/,3 · 192', etroit(88, lib('font-size:13px;letter-spacing:.3px;padding:0 4px', 'Attaquer'))),
      piece('14,5 · 66 (rail)', etroit(88, lib('font-size:14.5px', 'Partir'))),
      piece('15 · 75', etroit(88, plaque('Fouiller'))),
      piece('16,5 · 16', etroit(88, lib('font-size:16.5px', 'Conclure'))),
      piece('13,5/,5 · 12', etroit(88, lib('font-size:13.5px;letter-spacing:.5px;padding:0 4px', 'Charger')))),
    ligne(
      piece('pet. 13 · 99', etroit(76, plaque('Retirer', { taille: 'petite' }))),
      piece('12,5 · 55', etroit(76, lib('font-size:12.5px', 'Retirer', { taille: 'petite' }))),
      piece('12 · 26', etroit(76, lib('font-size:12px', 'Retirer', { taille: 'petite' }))),
      piece('10 · 8 (nuit)', etroit(76, lib('font-size:10px;letter-spacing:.2px;padding:0 4px', 'Retirer', { taille: 'petite' }))),
      piece('Chiffres 12 · 48', etroit(76, lib('font-family:Chiffres;font-weight:600;font-size:12px;letter-spacing:.2px;padding:0 4px', '10 PX', { taille: 'petite' })))),
    ligne(
      piece('outil 11,5 · 13 (accueil)', `<div style="display:flex;gap:4px">${outil('carte', 'Carte')}${sous('& .outil span{font-size:13px;color:var(--ivoire)}', outil('carte', 'Carte'))}</div>`),
      piece('visé : 18 ,9 · 16 ,75', `<div style="display:flex;gap:16px">${sous('& .medaillon{box-shadow:0 0 0 1px #150d04,0 0 18px rgba(255,214,140,.9)}', medaillon('chope', { taille: 'moyen' }))}${sous('& .medaillon{box-shadow:0 0 0 1px var(--contour),0 0 16px var(--halo-vif)}', medaillon('chope', { taille: 'moyen' }))}</div>`),
      piece('compteur · 4 sites', compteur(2, 'Détermination'))),
  ];
  const plaquesCible = (fond) => [
    ligne(
      piece("petite 28 · 13", etroit(80, plaque('Retirer', { taille: 'petite' }))),
      piece("moyenne 40 · 15", etroit(100, plaque('Fouiller')))),
    ligne(
      piece('prix · Chiffres 12,5', etroit(118, plaque('Acheter', { taille: 'petite', prix: '10 PX' }))),
      piece('geste · 13/12', etroit(96, sous('& .plaque>div{padding:0 4px;white-space:normal;text-align:center;font-size:13px;line-height:12px;letter-spacing:.3px}', plaque('Viser la tête')).replace(/^<div/, '<div style="display:contents"')))),
    ligne(piece("appel 52 · 18", etroit(130, plaque('Partir', { taille: 'appel', armee: true }))),
      fond === 'bois'
        ? piece('visé', sous('& .medaillon{box-shadow:0 3px 6px var(--ombre-forte),0 0 18px var(--halo-vif)}', medaillon('chope', { taille: 'moyen' })))
        : piece('compteur', `<div style="display:flex;align-items:center;gap:4px">${picto('etoile', 18)}${disque(2, { taille: 'grand' })}</div>`)),
  ];

  /* ── jauges ── */
  const jaugesAujourdhui = [
    ligne(
      piece("jauge fine 6 · cire · 413", large(90, jauge(.6))),
      piece("forte 8 · or · 32", large(90, jauge(.5, { teinte: 'or', taille: 'forte' }))),
      piece('pas 15 · écart 5 (combat, bois)', `<div class="bois" style="padding:4px 6px">${sous('& .pas{gap:5px;margin:0}', rangDePas({ pleins: 3, total: 5 }))}</div>`),
      piece('pas petit 11 · écart 8', sous('& .pas{gap:8px;margin:0}& .pas i{width:11px;height:11px}', rangDePas({ pleins: 2, total: 4 }))),
      piece('écart 13 · cire (corruption)', sous('& .pas{gap:13px;margin:0}& .pas i{width:11px;height:11px}& .pas i:not(.vide){background:linear-gradient(135deg,#d2553a,#7c1f14)}', rangDePas({ pleins: 2, total: 4 }))),
      piece('clous 9 · écart 3 · 23', sous('& .c{display:flex;gap:3px}& .c i{width:9px;height:9px;border-radius:50%;border:1px solid var(--trait-encre);background:rgba(60,40,20,.08)}& .c i.p{border-color:var(--laiton-ombre);background:radial-gradient(circle at 36% 30%,var(--or-eclat),var(--or-moyen) 70%)}& .c i:nth-child(5){margin-right:4px}', `<div class="c">${'<i class="p"></i>'.repeat(4)}${'<i></i>'.repeat(4)}</div>`))),
  ];
  const pas = (pleins, total, petit, teinte = '') => sous(`& .pas{gap:8px;margin:0}${petit ? '& .pas i{width:11px;height:11px}' : ''}${teinte ? '& .pas i:not(.vide){background:linear-gradient(135deg,#d2553a,#7c1f14)}' : ''}`, rangDePas({ pleins, total }));
  const jaugesCible = (fond) => [
    ligne(
      piece('fine · forte', `<div style="width:80px">${jauge(.6)}<div style="height:8px"></div>${jauge(.5, { teinte: 'or', taille: 'forte' })}</div>`),
      piece('pas 15 · écart 8', pas(3, 5, false)),
      piece(fond === 'bois' ? 'petit 11 · écart 8' : 'petit · cire', pas(2, 4, true, fond === 'bois' ? '' : 'cire'))),
  ];

  regles.unshift('.planche-pj .pas{margin:0}', '.planche-pj .parchemin .bois .pas i{background:linear-gradient(135deg,var(--ivoire),var(--creme-2));box-shadow:0 0 0 1px var(--contour),0 1px 2px var(--ombre-forte)}', '.planche-pj .parchemin .bois .pas i.vide{background:var(--lit);box-shadow:0 0 0 1px var(--filet-creme),inset 0 1px 2px var(--noir)}', '.planche-pj .parchemin .pas i{background:linear-gradient(135deg,#6a3d1c,#2a160a);box-shadow:0 0 0 1px #1a1005,0 1px 2px rgba(0,0,0,.5)}', '.planche-pj .parchemin .pas i.vide{background:rgba(255,245,215,.3);box-shadow:0 0 0 1px rgba(60,40,20,.6)}');
  const pages = [
    page('bulles-aujourdhui', 24, 14, 612, 200, 'bois', 'Bulles · aujourd’hui', ...bullesAujourdhui),
    page('bulles-cible', 656, 14, 600, 200, 'bois', 'Bulles · cible', ...bullesCible),
    page('plaques-aujourdhui', 24, 226, 612, 330, 'bois', 'Plaques et boutons · aujourd’hui : 68 rendus', ...plaquesAujourdhui),
    page('plaques-bois', 656, 226, 294, 330, 'bois', 'cible · bois', ...plaquesCible('bois')),
    page('plaques-parchemin', 962, 226, 294, 330, 'parchemin', 'cible · parchemin', ...plaquesCible('parchemin')),
    page('jauges-aujourdhui', 24, 568, 612, 140, 'parchemin', 'Jauges · aujourd’hui', ...jaugesAujourdhui),
    page('jauges-bois', 656, 568, 294, 140, 'bois', 'cible · bois', ...jaugesCible('bois')),
    page('jauges-parchemin', 962, 568, 294, 140, 'parchemin', 'cible · parchemin', ...jaugesCible('parchemin')),
  ];
  monter([`<style>${regles.join('\n')}</style>`, '<div class="planche-pj">', ...pages, '</div>']);
}
