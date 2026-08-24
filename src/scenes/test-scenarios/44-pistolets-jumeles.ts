import { pregen, PREGEN } from '../../data/pregens';
import { itemFromTrappingById, recomputeLoadout } from '../../engine/items';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

/**
 * PISTOLETS JUMELÉS — le porteur tient DEUX armes à Recharge (LDB 62, qualité `recharge` 1), chacune
 * avec SON cycle de charge (`weaponLoad.ts`, registre par `uid`) et sa munition. C'est le seul cas où
 * la console doit BORNER un paramètre au lieu de dispatcher : « Recharger » ne sait pas LAQUELLE, et
 * ouvre son panneau (spec HUD zone 10) — à l'alvéole comme à l'écran des capacités, depuis la MÊME
 * liste de candidats (`state/poolsDeCapacites`, `panneauDeCase`).
 *
 * Le set porte DEUX chips de munition dans l'en-tête de travée (une par arme), et la besace porte
 * DEUX munitions compatibles (même famille `poudre-ingenierie`, `engine/items.ammoFamily`) : le chip
 * devient donc lui aussi un déclencheur de panneau. Les deux pistolets partent DÉCHARGÉS : le premier
 * geste du combat est un rechargement, la case s'allume, et le Test étendu se lit sur l'alvéole.
 *
 * Sert aussi de banc au lot A3 (placement à la barre) : deux cases de MÊME action (`reload`) mais de
 * clés distinctes, exactement ce qu'une adresse de barre doit savoir distinguer.
 */
function pistolier() {
  const h = pregen(PREGEN.chasseur);
  const p1 = Object.assign(itemFromTrappingById('pistolet')!, { uid: 'pist-droit', loaded: false, reloadProgress: 0 });
  const p2 = Object.assign(itemFromTrappingById('pistolet')!, { uid: 'pist-gauche', loaded: false, reloadProgress: 0 });
  const balles = Object.assign(itemFromTrappingById('balle-et-poudre')!, { uid: 'mun-balles' });
  const petites = Object.assign(itemFromTrappingById('petites-munitions-et-poudre')!, { uid: 'mun-petites' });
  // Le SET dit ce qui est TENU (arbitrage #1348) : les deux pistolets, un par main.
  h.items = [...(h.items ?? []), p1, p2, balles, petites];
  h.loadouts = [{ id: 'lo-pistolets', main: p1.uid, off: p2.uid }];
  h.activeLoadoutId = 'lo-pistolets';
  recomputeLoadout(h);
  return h;
}

const HERO_START = { x: 3, y: 5 };
const scene = arena({ id: 'test-pistolets-jumeles', nom: 'Pistolets jumelés — deux cycles de charge', heroStart: HERO_START });
scene.startMessage =
  'Deux pistolets au poing, tous deux DÉCHARGÉS, et deux munitions en besace. « Recharger » ne sait ' +
  'pas laquelle des deux armes vous voulez : la case ouvre son panneau et vous la choisissez — depuis ' +
  'la console comme depuis l’écran des capacités (K). Chaque chip de munition de l’en-tête ouvre le ' +
  'sien, pour SON arme.';
setEncounters(scene, [
  {
    id: 'enc-pistolets',
    enemies: [
      { ref: 'mutant', pos: { x: 12, y: 4 }, facing: 'O' },
      { ref: 'mutant', pos: { x: 12, y: 7 }, facing: 'O' },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'pistolets-jumeles',
  order: 44,
  category: 'combat',
  icon: 'scenario/ambush',
  title: 'Pistolets jumelés — paramètre borné du rechargement',
  tests:
    'Spec HUD zone 10 (panneau-paramètre) et zone 6 (écran des capacités) sur le seul cas qui les ' +
    'exige : DEUX armes à Recharge tenues au même set. La case `reload` n’engage RIEN au clic — elle ' +
    'ouvre la liste BORNÉE des deux armes (état de charge et main directrice dits par candidat, ' +
    'source unique `panneauDeCase`), l’élection joue le geste, Échap annule sans coût. Même liste et ' +
    'même verdict à l’alvéole de la console et à l’entrée de l’écran des capacités. Couvre aussi les ' +
    'DEUX chips de munition de l’en-tête (une par arme, deux munitions compatibles en besace) et la ' +
    'progression du Test étendu de rechargement sur la case.',
  partyNote: 'Chasseur seul, deux pistolets au poing (déchargés) + Balle et Poudre et Petites munitions en besace.',
  makeParty: () => [pistolier()],
  scene,
  autoCombat: 'enc-pistolets',
};
