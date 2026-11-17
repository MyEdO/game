/* La préparation d'une bataille de masse, pendant l'interlude : le noyau l'ajoute au menu d'Activités, sans écran à
   part (`src/noyau/interludeFlow.ts:457-467`). Se charge après `../lieux-et-nuit/interlude-en-ville.js`, qui dessine
   la ville, le lieu et les héros ; ce script y pose le camp de l'armée et ses Activités de préparation.
   ADE II 08 l.60-108 ; `src/noyau/interludeEnVue.ts:94-96`, `src/noyau/massBattleFlow.ts:460-476`,
   `src/noyau/interludeFlow.ts:1196-1200`, `src/data/activities.json` (contexte `bataille`), `mbf.requires*`. */
{
const $ = (s) => document.querySelector(s);
const CAMP = { x: 122, y: 196 };
/* la carte : le héros choisi quitte la taverne pour le camp, hors les murs */
const taverne = $('.lieu.choisi'), epingles = [...document.querySelectorAll('#carte svg > circle')];
taverne.classList.remove('choisi'); taverne.querySelector('.fantome').remove();
epingles.find((c) => c.getAttribute('fill') === '#c8452c').setAttribute('fill', '#2a1d12');
el($('#carte svg'), 'circle', { cx: CAMP.x, cy: CAMP.y, r: 6.5, fill: '#c8452c', stroke: '#e6d5ad', 'stroke-width': 1.6 });
$('#carte .fond').insertAdjacentHTML('beforeend', `<div class="lieu bois choisi" style="left:${CAMP.x}px;top:${CAMP.y}px">${medaillon('epee', { petit: true, taille: 17 })}<div><b>Le camp de l’armée</b><span class="rubrique">Préparer la bataille</span></div>${portrait('mira', { classe: 'fantome' })}</div>`);
/* une Activité de préparation : la prise dit ce que sa réussite vaut, la fermée dit sa raison au survol */
const activite = (icone, nom, test, { enjeu = '', refus = '', survol = false } = {}) => `<div class="activite${enjeu ? ' prise' : ''}${refus ? ' fermee' : ''}">${medaillon(icone, { petit: true, ferme: !!refus })}<div><b>${nom}</b>${refus ? '' : `<span class="c rubrique">${test}</span>`}${enjeu ? `<i>${enjeu}</i>` : ''}</div>${survol ? raison(refus) : ''}</div>`;
$('#lieu').outerHTML = `<div id="lieu" class="cadre bois preparation" data-piece="lieu"><div class="fond bois">
  <h3 data-texte="lieu">Le camp de l’armée</h3>
  <div class="forces rubrique">Armée des Personnages 50 · Horde ennemie 55</div>
  ${activite('carte', 'Planification', 'Savoir (Guerre) · une Activité · Soutien', { enjeu: 'Réussite : +10 à tous les Tests de Puissance de ton armée pendant la bataille, +20 à partir de +6 DR.' })}
  ${activite('bulle', 'Discours inspirant', 'Commandement · une Activité')}
  ${activite('oeil', 'Repérage', 'Chevaucher et Perception · une Activité')}
  ${activite('reseau', 'Rassembler des forces', 'Commandement, Charme ou Intimidation')}
  <div class="fermees">${activite('cle', 'Infiltration', '', { refus: 'Exige une Planification réussie au préalable.' })}${activite('feu', 'Sabotage', '', { refus: 'Exige un Repérage réussi au préalable.', survol: true })}</div>
  ${plaque('Envoyer Mira au camp', { armee: true, icone: 'route', classe: 'envoyer' })}
</div><div class="ruban rubrique">Hors les murs</div>${ferrures}</div>`;
$('.heros.choisi .attend').textContent = 'À envoyer au camp';
$('.retour span').textContent = 'Livrer bataille';
}
