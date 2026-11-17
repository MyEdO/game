/* Le dossier du navire, sur le modèle de la fiche lue en combat (`combat/fiche-au-clic`). Profil de la Cogue :
   `src/data/vehicles.json` (MDG 12) ; traits : `src/data/naval-traits.json` ; état : `src/noyau/etat.ts:282` ; Moral : MDG 14 l.133-143 ; nom de l'instance :
   `src/noyau/possessionsFlow.ts:49`. */
poser(interieur(D.mer({ navire: false })));
el(S, 'rect', { width: W, height: H, fill: '#06040a', opacity: .5 });
voiles();
const trait = (dessin, nom, texte) => `<div class="arme trait">
    <div class="vignette laiton"><div><svg viewBox="0 0 24 24" fill="none" stroke="#e2c06a" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${dessin}</svg></div></div>
    <div class="texte"><div class="n gothique">${nom}</div><p data-texte="trait ${nom}">${texte}</p></div></div>`;
const etat = (lab, val) => `<div class="etat-n"><span class="rubrique">${lab}</span><b class="lineale">${val}</b></div>`;
const ui = [];
ui.push(`<div id="dossier">
<div id="f-identite" class="cadre bois" data-piece="dossier-identite"><div class="fond parchemin">
  <div class="tete">${portrait('navire', 'heros')}<div><div class="n gothique">La Sterne</div><div class="c rubrique">Cogue</div><div class="c rubrique">Navire à voile</div><div class="c rubrique">25 mètres · 300 CO</div><div class="renommer">${rond('plume', 13)}<span class="rubrique">Renommer</span></div></div></div>
  <div class="mesure"><div class="tete rubrique"><span>Coque</span><b class="lineale">50 / 50</b></div><div class="vie"><i style="width:100%"></i></div></div>
  <div class="mesure" style="margin-top:14px"><div class="tete rubrique"><span>Moral</span><b class="lineale">75</b></div><div class="vie or"><i style="width:75%"></i></div></div>
  <div class="orne"><i></i><b></b><i></i></div>
  <div class="reserves">${medaillon(15, 'Équipage')}${medaillon(8, 'Aux voiles')}${medaillon(4, 'Héros à un poste')}</div>
</div>${ferrures}</div>
<div id="f-profil" class="cadre bois" data-piece="dossier-profil"><div class="fond parchemin" style="grid-template-columns:repeat(6,1fr)">
  ${[['M', 5], ['E', 45], ['B', 50], ['Man', '−1'], ['Équipage', 15], ['Capacité', 300]].map(([a, v]) => `<div class="carac"><span class="rubrique">${a}</span><b class="lineale">${v}</b></div>`).join('')}
</div><div class="ruban titre">Profil du navire</div>${ferrures}</div>
<div id="f-figure" class="cadre bois" data-piece="dossier-figure"><div class="fond bois"><div class="niche laiton"><div><svg viewBox="-330 -450 680 520">${D.ombreVoile}${D.cogue(0, 0, 1, { coque: '#2a1d12', voile: '#7d2020' })}<path d="M-300 26q60 -12 120 0t120 0 120 0 120 0 120 0" fill="none" stroke="#5f7a80" stroke-width="4"/></svg></div></div></div>${ferrures}</div>
<div id="f-sections" class="cadre bois" data-piece="dossier-sections"><div class="fond parchemin">
  ${trait(PICTOS.barre, 'Peu maniable', 'Chaque niveau impose une pénalité de –1 DR sur tous les Tests de Ramer et de Voile.')}
  ${trait(PICTOS.coque, 'Robuste', 'Un navire Robuste reçoit +2 DR sur ses Tests d’équipage d’Affaler les voiles.')}
  <div class="etats">${etat('Eau douce', '2 900 L')}${etat('Vivres de l’équipage', '735 rations')}${etat('Salissures', 'aucune')}${etat('Avaries', 'aucune')}</div>
</div><div class="onglets"><div class="ruban titre">État</div>${['Équipage', 'Cargaison', 'Améliorations'].map((t) => plaque(t)).join('')}</div>${ferrures}</div>
</div>`);
ui.push(croix());
ui.push(SYSTEME);
monter(ui);
