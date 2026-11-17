/* Création 7/10 : les Talents (LDB 05 l.484, l.514-531, l.535 ; species.json, careerLevels.json, talents.json). */
const tire = (jet, nom, extra = '') => `<div style="display:flex;align-items:center;gap:11px;height:47px"><div class="de petit">${jet}</div><div class="ligne" style="flex:1;border-bottom:1px solid rgba(60,40,20,.28)"><span class="n" data-texte="${nom}">${nom}</span>${extra}</div></div>`;
const option = (nom, { choisie = false, raison = '' } = {}) => `<div class="ligne ${choisie ? 'choisie' : ''} ${raison ? 'refusee' : ''}">${choisie ? picto('coche', 15, '#2a1d12', 2) : '<i class="losange"></i>'}<span class="n" data-texte="${nom}">${nom}</span>${raison ? `<span class="raison">${raison}</span>` : ''}</div>`;

poser([
  frise(7),
  gauche(`
    ${rub('Talents de race')}
    <div class="deux" style="margin-top:3px;align-items:end">
      <div class="ligne">${coche(20)}<span class="n">Destinée</span><span class="raison" style="color:#5a3a1c">Acquis</span></div>
      <div></div>
    </div>
    <div style="margin-top:13px">${rub('Au choix')}</div>
    <div class="deux" style="margin-top:3px">${option('Affable')}${option('Perspicace', { choisie: true })}</div>
    <div style="margin-top:15px">${rub('Trois Talents au d100')}</div>
    ${tire(15, 'Artiste <small>(Peinture)</small>', `<span class="pill" style="height:20px">Utilisation ${picto('chevron_d', 12, '#3a2a18', 2)}</span>`)}
    ${tire(24, 'Chanceux')}
    ${tire(99, 'Vivacité')}
    ${sep()}
    ${rub('Talent de carrière', 'un seul')}
    <div class="deux" style="margin-top:3px">
      <div class="lignes">${option('Artiste <small>(Au choix)</small>')}${option('Infatigable', { choisie: true })}</div>
      <div class="lignes">${option('Persévérant')}${option('Vivacité', { raison: 'Maxi atteint' })}</div>
    </div>`),
  centre('Talent de carrière', `
    <div class="medaillon laiton" style="width:64px;height:64px;margin-top:16px"><div>${picto('poing', 32, '#e2c06a', 1.4)}</div></div>
    <div class="nom" style="margin-top:8px" data-texte="titre de page">Infatigable</div>
    <div class="sous">Artiste Apprentie</div>
    ${sep()}
    <div class="faits" style="margin-top:2px">
      <div class="fait">${rub('Maxi')}<b>Bonus de Force</b></div>
      <div class="fait">${rub('Tests')}<b>Ramer et Natation</b></div>
    </div>
    <p class="prose" style="margin-top:15px" data-texte="texte du talent">Vous avez l'échine solide, rompue au dur labeur. Vous pouvez ajouter vos Niveaux d'Infatigable à votre DR dans tous les Tests opposés de Force et vous pouvez porter un nombre de Points supplémentaires d'Encombrement (voir p293) équivalent à votre Niveau d'Infatigable.</p>
    <svg class="filigrane" width="92" height="92" viewBox="0 0 100 100" fill="none" stroke="rgba(90,58,28,.45)" stroke-width="1"><circle cx="50" cy="30" r="22"/><circle cx="50" cy="70" r="22"/><circle cx="30" cy="50" r="22"/><circle cx="70" cy="50" r="22"/><path d="M50 38l12 12-12 12-12-12z"/></svg>`),
  herosNeuf({ acquis: [...ACQUIS, ['Compétences', 'Six de race, huit de carrière'], ['Talents', 'Six acquis']], pose: .7 }),
  groupeEnCreation(),
  coins(),
]);
