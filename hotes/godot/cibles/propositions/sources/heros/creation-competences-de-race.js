/* Création 5/10 : les Compétences de race (LDB 05 l.484 ; src/data/species.json, humains-reiklander). */
const COMPETENCES = [
  ['FM', 'Calme', '', 3], ['Soc', 'Charme', '', 5], ['Soc', 'Commandement', '', 0], ['CC', 'Corps à corps', 'Base', 0],
  ['Int', 'Évaluation', '', 5], ['Int', 'Langue', 'Bretonnien', 0], ['Int', 'Langue', 'Wastelander', 0], ['Soc', 'Marchandage', '', 3],
  ['CT', 'Projectiles', 'Arc', 0], ['Soc', 'Ragot', '', 5], ['Int', 'Savoir', 'Reikland', 0], ['Int', 'Soin aux animaux', '', 0],
];
const ligneDeRace = ([c, n, spec, palier]) => `<div class="ligne">${car(c)}<span class="n" data-texte="${n} ${spec}">${nomDe(n, spec)}</span>
  <div class="paliers">${[0, 3, 5].map((p) => `<span class="palier ${p === palier ? (p ? 'pris' : 'zero') : p === 5 ? 'ferme' : ''}">${p ? `+${p}` : '0'}</span>`).join('')}</div></div>`;
const carte = (c, n, base, plus) => `<div class="carte">${car(c)}<div class="anneau petit">${base + plus}</div><div class="n">${n}</div><div class="pied"><span class="calc">${c} ${base} &nbsp;+${plus}</span></div></div>`;

poser([
  frise(5),
  gauche(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">${rub('Compétences de race')}${plaque('Répartition par défaut', { style: 'flex:none;width:214px;height:32px' })}</div>
    <div class="lignes">${COMPETENCES.map(ligneDeRace).join('')}</div>
    <div style="display:flex;align-items:center;gap:9px;margin-top:13px"><span class="jeton fer">À +5 &nbsp;·&nbsp; 3 / 3</span><span class="jeton or">À +3 &nbsp;·&nbsp; 2 / 3</span></div>`),
  centre('Humains (Reiklander)', `
    <div class="nom" style="margin-top:12px" data-texte="titre de page">Compétences de race</div>
    <div class="sous">Trois à +5 · trois à +3</div>
    ${sep()}
    <div style="align-self:stretch;margin:2px 0 7px">${rub('Cinq Augmentations')}</div>
    <div class="rangee">${carte('Soc', 'Charme', 35, 5)}${carte('Int', 'Évaluation', 37, 5)}${carte('Soc', 'Ragot', 35, 5)}</div>
    <div style="align-self:stretch;margin:16px 0 7px">${rub('Trois Augmentations')}</div>
    <div class="rangee">${carte('FM', 'Calme', 29, 3)}${carte('Soc', 'Marchandage', 35, 3)}<div class="carte vide"><span>À choisir</span></div></div>
    <svg class="filigrane" width="92" height="92" viewBox="0 0 100 100" fill="none" stroke="rgba(90,58,28,.45)" stroke-width="1"><circle cx="50" cy="30" r="22"/><circle cx="50" cy="70" r="22"/><circle cx="30" cy="50" r="22"/><circle cx="70" cy="50" r="22"/><path d="M50 38l12 12-12 12-12-12z"/></svg>`),
  herosNeuf({ acquis: [...ACQUIS, ['Compétences de race', 'Cinq sur six']], pose: .5, refus: 'Encore une Compétence de race à +3.' }),
  groupeEnCreation(),
  coins(),
]);
