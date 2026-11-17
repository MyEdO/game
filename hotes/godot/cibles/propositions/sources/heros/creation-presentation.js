/* Création 10/10 : la présentation, le héros achevé (src/noyau/creation/vueDeLaCreation.ts, pageDeLaPresentation). */
const PROFIL = [4, 28, 30, 27, 33, 41, 32, 39, 37, 29, 35, 10];
const COMPETENCES = [
  ['Dex', 'Art', 'Peinture', 49], ['FM', 'Calme', '', 37], ['Soc', 'Charme', '', 40], ['Ag', 'Discrétion', 'Urbaine', 37], ['Int', 'Évaluation', '', 47], ['Int', 'Langue', 'Bretonnien', 40],
  ['Soc', 'Marchandage', '', 38], ['I', 'Perception', '', 46], ['Soc', 'Ragot', '', 45], ['E', 'Résistance', '', 36], ['E', "Résistance à l'alcool", '', 35],
];
const comp = ([c, n, spec, v]) => `<div class="ligne" style="height:26px;padding:0 2px;font-size:14.500px;gap:7px">${car(c)}<span class="n" data-texte="${n}">${n}${spec ? ` <small>(${spec})</small>` : ''}</span><span class="val" style="font-size:13.500px">${v}</span></div>`;

poser([
  frise(10),
  cadre('choix', 26, 96, 610, 512, 'parchemin', `
    <div class="tete">${portrait('astrid')}
      <div style="flex:1;min-width:0">
        <div class="nom" data-texte="nom">Astrid Altdorfer</div>
        <div class="l" style="margin-top:6px">Humains (Reiklander)</div>
        <div class="l">Artiste Apprentie · Courtisans</div>
        <div class="faits" style="grid-template-columns:repeat(4,auto);justify-content:space-between;margin-top:14px;gap:0 10px">
          <div class="fait">${rub('Âge')}<b>23 ans</b></div><div class="fait">${rub('Taille')}<b>172 cm</b></div><div class="fait">${rub('Yeux')}<b>Marron</b></div><div class="fait">${rub('Cheveux')}<b>Brun foncé</b></div>
        </div>
      </div>
    </div>
    <div class="bl">${rub('Blessures')}<span>10 / 10</span></div>
    <div class="vie"><i style="width:100%"></i></div>
    ${sep()}
    <div class="reserves" style="grid-template-columns:repeat(4,auto);justify-content:space-between">${reserve(3, 'Destin')}${reserve(4, 'Chance')}${reserve(3, 'Résilience')}${reserve(3, 'Détermination')}</div>
    ${sep()}
    <div class="faits" style="grid-template-columns:1.25fr 1fr 1fr">
      <div class="fait">${rub('Signe astral')}<b>Le Trait du Peintre</b></div>
      <div class="fait">${rub('Statut')}<b>Argent 1</b></div>
      <div class="fait">${rub('Bourse')}<b class="lin" style="font-size:15px;font-weight:600">7/–</b></div>
    </div>
    <div style="margin-top:9px">${rub('Motivation')}<div class="fell" style="font-style:italic;font-size:17px;line-height:23px;color:#2b1a3a">Peindre ce que nul n’ose regarder</div></div>`, { classe: 'pan ident' }),
  centre('Artiste Apprentie', `
    <div class="bande mini" style="align-self:stretch;margin-top:13px;border:1px solid rgba(60,40,20,.4);border-radius:3px;background:rgba(255,246,218,.25)"><div class="fond" style="display:grid">${ABR.map((a, i) => `<div class="c"><span class="ab">${a}</span><span class="v">${PROFIL[i]}</span></div>`).join('')}</div></div>
    <div style="align-self:stretch;margin:14px 0 3px">${rub('Compétences')}</div>
    <div class="deux" style="align-self:stretch;column-gap:18px"><div class="lignes">${COMPETENCES.slice(0, 6).map(comp).join('')}</div><div class="lignes">${COMPETENCES.slice(6).map(comp).join('')}</div></div>
    <div style="align-self:stretch;margin:14px 0 7px">${rub('Talents')}</div>
    <div class="pills" style="align-self:stretch">${['Artiste (Peinture)', 'Chanceux', 'Destinée', 'Infatigable', 'Perspicace', 'Vivacité'].map((t) => `<span class="pill">${t}</span>`).join('')}</div>`),
  herosNeuf({ nom: 'Astrid Altdorfer', pose: 1, palette: true, suivant: 'Engager',
    acquis: [['Race tirée au d100', 'Humains (Reiklander)', '+20 PX'], ['Carrière tirée au d100', 'Artiste', '+50 PX'], ['Caractéristiques', 'Jets gardés', '+50 PX'], ['Signe tiré au d100', 'Le Trait du Peintre', '+25 PX'], ['PX de création', '<span class="lin" style="font-size:19px;font-weight:600;color:#f3dc93">145 PX</span>']] }),
  groupeEnCreation({ nom: 'Astrid Altdorfer', esquisse: false, pv: 10, max: 10 }),
  coins(),
]);
