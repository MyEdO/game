/* Création 6/10 : les Compétences de carrière (LDB 05 l.535 ; src/data/careerLevels.json, artiste-1).
   Ligne : [Caractéristique, nom, spécialisation, Augmentations de carrière, Augmentations de race, Test, pressée]. */
const COMPETENCES = [
  ['Dex', 'Art', 'Peinture', 10, 0, 49, true], ['FM', 'Calme', '', 4, 3, 36], ['Ag', 'Discrétion', 'Urbaine', 2, 0, 34], ['Int', 'Évaluation', '', 5, 5, 47],
  ['I', 'Perception', '', 5, 0, 46], ['Soc', 'Ragot', '', 4, 5, 44], ['E', 'Résistance', '', 2, 0, 35], ['E', "Résistance à l'alcool", '', 2, 0, 35],
];
const deRace = (n) => `<span class="palier race ${n ? '' : 'sans'}">+${n}</span>`;
const ligneDeCarriere = ([c, n, spec, aug, race, test, choisie]) => `<div class="ligne ${choisie ? 'choisie' : ''}" style="height:42px">${car(c)}<span class="n" data-texte="${n}">${nomDe(n, spec)}</span>
  ${deRace(race)}<div class="clous">${Array.from({ length: 10 }, (_, i) => `<i class="${i < aug ? 'p' : ''}"></i>`).join('')}</div>${pm(aug === 10)}<span class="val">${test}</span></div>`;
const SPECS = ['Calligraphie', 'Cartographie', 'Écriture', 'Gravure', 'Icones', 'Mosaïque', 'Peinture', 'Sculpture', 'Tatouage', 'Tissage', 'Boucherie', 'Rédaction', 'Dessin'];

poser([
  frise(6),
  gauche(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">${rub('Compétences de carrière')}${plaque('Répartition simple', { style: 'flex:none;width:190px', taille: 'petite' })}</div>
    <div class="lignes">${COMPETENCES.map(ligneDeCarriere).join('')}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:15px"><span class="jeton or">À répartir &nbsp;·&nbsp; 6 / 40</span><span class="rub"><span class="note">Dix Augmentations au plus par Compétence.</span></span></div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:9px">${deRace(5)}<span class="rub"><span class="note">Augmentations de race : acquises, hors des quarante et des dix.</span></span></div>`),
  centre('Artiste Apprentie', `
    <div class="nom" style="margin-top:12px" data-texte="titre de page">Art</div>
    <div class="sous">Peinture · Dextérité</div>
    ${filet({ fondu: true, losange: true })}
    <div style="display:flex;align-items:center;gap:14px;align-self:stretch;margin-top:2px">${disque(49, { taille: 'grand' })}<div>${rub('Test')}<div class="fell" style="font-size:15.500px;color:#2a1d12">Dextérité 39, dix Augmentations</div></div></div>
    <div style="align-self:stretch;margin:16px 0 7px">${rub("Spécialisation d'Art")}</div>
    <div class="pills" style="align-self:stretch">${SPECS.map((s) => `<span class="pill ${s === 'Peinture' ? 'prise' : ''}">${s}</span>`).join('')}</div>
    <p class="prose" style="margin-top:17px" data-texte="texte de la compétence">Créez des œuvres d'art avec le moyen d'expression de votre choix.</p>
    <p class="prose">Ne pas avoir accès aux Outils de la profession appropriés entraînera une pénalité à vos Tests. Le DR obtenu détermine la qualité de l'œuvre finale.</p>`),
  herosNeuf({ acquis: [...ACQUIS, ['Compétences de race', 'Six augmentées'], ['Compétences de carrière', '34 sur 40']], pose: .6, refus: 'Six Augmentations restent à répartir.' }),
  groupeEnCreation(),
  coins(),
]);
