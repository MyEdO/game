import { createHero, skillCharacteristicById } from '../../engine/character';
import { itemFromTrappingById } from '../../engine/items';
import type { Combatant, SkillInstance } from '../../engine/types';
import { buildScene } from '../../state/mapSpec';
import type { WorldMap } from '../../state/worldMap';
import type { TestScenario } from './_shared';
import { rigSpeciesId } from '../../data';

/**
 * « Voyage maritime » — la traversée en mer JOUABLE (MDG 13/15), pendant naval du « Voyage & temps long »
 * TERRESTRE. Une route MARITIME (`MapRoute.sea`, distance en MILLES) relie deux ports ; le groupe appareille
 * sur le NAVIRE DE CAMPAGNE (`state.vessel` = une cogue), et chaque jour de mer enchaîne : météo/vent →
 * Test d'équipage de Progression → phare à l'atterrage → Test d'équipage d'Orientation → entretien de la
 * coque (elle démarre endommagée) → halte de nuit, jusqu'à l'ACCOSTAGE au port d'arrivée (écran Port :
 * réparer/caréner/commerce). L'équipage = les PJ (MDG 14 l.39), chacun tenant son RÔLE.
 */

/** Ajoute/renforce une Compétence sur un héros, à la Caractéristique CANONIQUE de la Compétence (donnée). */
function skill(c: Combatant, skillId: string, advances: number, spec?: string): void {
  const characteristic = skillCharacteristicById(skillId);
  const ex = c.skills.find((s) => s.id === skillId && s.spec === spec);
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ id: skillId, spec, characteristic, advances } as SkillInstance);
}

/** Quatre marins couvrant les RÔLES d'équipage essentiels des Tests de voyage (MDG 14) : Capitaine
 *  (Progression), Timonier/Mousse (Manœuvre/Affaler/Entretien), Navigateur (Orientation), Vigie
 *  (Perception au phare). `shipRole` ÉPINGLE le rôle de chacun pour un défaut d'équipage lisible. */
function crew(): Combatant[] {
  const cap = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Capitaine Brenner', motivation: 'Test', seed: 4801, id: 'mar-cap' });
  cap.shipRole = 'capitaine';
  skill(cap, 'commandement', 50);
  skill(cap, 'voile', 40);
  cap.items = [...(cap.items ?? []), itemFromTrappingById('ration')!, itemFromTrappingById('ration')!];
  cap.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'M', build: 0.55 };

  const timo = createHero({ speciesId: 'humains-reiklander', careerId: 'chasseur', label: 'Timonière Hilda', motivation: 'Test', seed: 4802, id: 'mar-timo' });
  timo.shipRole = 'timonier';
  skill(timo, 'voile', 55);
  skill(timo, 'ramer', 45);
  skill(timo, 'metier', 40, 'Charpentier'); // entretien de la coque au soir
  timo.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'F', build: 0.42 };

  const navi = createHero({ speciesId: 'humains-reiklander', careerId: 'erudit', label: 'Navigateur Ansmann', motivation: 'Test', seed: 4803, id: 'mar-navi' });
  navi.shipRole = 'navigateur';
  skill(navi, 'orientation', 55);
  skill(navi, 'savoir', 40, 'oceans'); // bonus d'Orientation au phare (MDG 13 l.335)
  // Astromancien de bord (Magie des mers, MDG 02 l.176) : lance Bienfait de Bel Shanaar (Domaine des
  // Cieux, MDG 02 l.238) en mer — +2 DR aux Tests d'Orientation qui l'impliquent (Test d'équipage compris).
  skill(navi, 'langue', 40, 'magick');
  skill(navi, 'focalisation', 40);
  navi.spells = ['bienfait-de-bel-shanaar'];
  navi.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'M', build: 0.48 };

  const vigie = createHero({ speciesId: 'humains-reiklander', careerId: 'eclaireur', label: 'Vigie Perla', motivation: 'Test', seed: 4804, id: 'mar-vigie' });
  vigie.shipRole = 'vigie';
  skill(vigie, 'perception', 55);
  skill(vigie, 'voile', 35);
  vigie.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'F', build: 0.4 };

  return [cap, timo, navi, vigie];
}

// ── Deux ports : Salzenmund (départ) et Marienburg (arrivée, phare + grand port de commerce) ──
const departPort = buildScene({
  id: 'test-mer-depart',
  label: 'Salzenmund — les quais',
  desc: 'Arène de test.',
  size: [14, 9],
  terrain: 'planches',
  heroStart: [3, 4],
  weather: 'brouillard',
  startMessage:
    'Le capitaine Brenner arpente le pont de la cogue. « Cap sur Marienburg, plusieurs jours de mer nous attendent. ' +
    'Chacun tient son poste : au vent et à la Progression, à l’Orientation, à l’entretien de la coque — elle a pris ' +
    'l’eau à Salzenmund, alors on la choie chaque soir. Vigie, ouvre l’œil dès qu’on approche : le phare de Marienburg ' +
    'annoncera la côte. Une fois à quai, on répare et on commerce au Grand Port. » Le Navigateur, qui sert aussi ' +
    'd’astromancien de bord, sait invoquer le Bienfait de Bel Shanaar pour affiner sa route en mer. (Ouvrez la carte ' +
    'du monde pour appareiller vers Marienburg.)',
});

const arrivePort = buildScene({
  id: 'test-mer-arrivee',
  label: 'Marienburg — le Grand Port',
  desc: 'Arène de test.',
  size: [14, 9],
  terrain: 'planches',
  heroStart: [3, 4],
  startMessage:
    'Marienburg, au bout de la traversée. Un maître de port vous hèle depuis le quai : « Charpentiers et calfats sont ' +
    'là pour la coque (1 CO la Blessure), le carénage débarrasse la coque de ses Salissures, et le grand marché ' +
    'cosmopolite achète comme il vend. » (Ouvrez l’écran Port depuis la scène ; reprenez la carte du monde pour repartir.)',
});

// ── Carte du monde : une seule route, MARITIME (milles), avec phare à l'arrivée ──
const carte: WorldMap = {
  id: 'test-mer-carte',
  label: 'Mer des Griffes (test)',
  places: [
    {
      id: 'p-salzenmund', label: 'Salzenmund', pos: { x: 20, y: 30 }, scene: 'test-mer-depart', icon: 'scenario/port',
      // port de production côtière (sel/poisson) — permet aussi réparer/caréner au départ
      port: { taille: 3, richesse: 3, production: ['sel', 'poisson-sale'], surplus: { sel: 1 } },
    },
    {
      id: 'p-marienburg', label: 'Marienburg', pos: { x: 75, y: 55 }, scene: 'test-mer-arrivee', icon: 'scenario/port',
      // grand port cosmopolite (MDG 15 l.343) + phare à l'atterrage (MDG 13 l.337)
      port: { taille: 4, richesse: 5, production: ['commerce', 'produits-de-luxe'], surplus: { 'produits-de-luxe': 1 }, cosmopolite: true, lighthouse: true },
    },
  ],
  routes: [
    {
      id: 'route-marienburg',
      a: 'p-salzenmund', b: 'p-marienburg',
      km: 480, // MILLES (route sea) : plusieurs jours de mer à M5 (18×5 = 90 milles/jour, ± vent)
      modes: ['mer'],
      sea: true,
      // Cap EST : vent de dos sur les vents dominants d'OUEST (MDG 13 l.253) — même convention que
      // tous les autres fixtures/scénarios maritimes (`seaHeading: 'est'`, cf. sea-voyage-flow.test.ts
      // et al.). `seaHeading: 'ouest'` mettait ce cap DIRECTEMENT contre les vents dominants (`windAspect`
      // renvoie 'face' quand cap==vent), un vent de face quasi permanent (#408) : la traversée pouvait
      // s'étirer sur plusieurs DIZAINES de jours (Affaler quasi systématique dès Vent violent), très loin
      // des « plusieurs jours de mer » attendus par la narration/le commentaire ci-dessous.
      seaHeading: 'est',
    },
  ],
};

export const scenario: TestScenario = {
  id: 'voyage-maritime',
  order: 12,
  category: 'naval',
  icon: 'scenario/port',
  title: 'Voyage maritime',
  tests:
    'Traversée en mer JOUABLE (MDG 13/15) : route MARITIME (milles) entre 2 ports, appareillage sur le navire ' +
    'de campagne (cogue), journée = météo/vent + Tests d’équipage de Progression & d’Orientation (modales), phare ' +
    'à l’atterrage (Perception), entretien de coque le soir (part endommagée), haltes de nuit, puis ACCOSTAGE au ' +
    'Grand Port (écran Port : réparer/caréner/commerce). Équipage = les PJ, chacun à son rôle (Capitaine/Timonier/' +
    'Navigateur/Vigie).',
  partyNote: 'Équipage : Capitaine Brenner (Commandement) · Timonière Hilda (Voile/Charpentier) · Navigateur Ansmann (Orientation + Astromancien : Bienfait de Bel Shanaar) · Vigie Perla (Perception)',
  makeParty: crew,
  scene: departPort,
  extraScenes: [arrivePort],
  worldMap: carte,
  money: { gold: 40, silver: 0, brass: 0 }, // de quoi réparer la coque au port
  // Cogue de campagne : coque ENDOMMAGÉE (déclenche l'entretien du soir), tonneaux d'eau suivis, Moral neuf.
  vessel: {
    vehicleId: 'cogue',
    morale: { score: 75, lastMoraleWeek: 0, factors: [] },
    wounds: { current: 15, max: 50 }, // coque mal en point : entretien chaque nuit, encore à réparer à l'arrivée
    waterLitres: 2900, // 20 tonneaux de 145 L (MDG 14 l.242) — 19 hommes à 3 L/jour, soit ~50 jours d'eau
  },
};
