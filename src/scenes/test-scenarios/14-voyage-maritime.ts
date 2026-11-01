import { createHero } from '../../engine/character';
import { contexteDeNaissanceDObjet, itemFromTrappingById } from '../../engine/items';
import type { Combatant } from '../../engine/types';
import { buildScene } from '../../noyau/mapSpec';
import type { WorldMap } from '../../noyau/worldMap';
import { renforcerCompetence, type TestScenario } from './_shared';
import type { Scene } from '../../noyau/monde/scene';
import { especeDApparence } from '../../data';

/**
 * « Voyage maritime » — la traversée en mer JOUABLE (MDG 13/15), pendant naval du « Voyage & temps long »
 * TERRESTRE. Une route MARITIME (`MapRoute.sea`, distance en MILLES) relie deux ports ; le groupe appareille
 * sur le NAVIRE DE CAMPAGNE (`state.vessel` = une cogue), et chaque jour de mer enchaîne : météo/vent →
 * Test d'équipage de Progression → phare à l'atterrage → Test d'équipage d'Orientation → entretien de la
 * coque (elle démarre endommagée) → halte de nuit, jusqu'à l'ACCOSTAGE au port d'arrivée (écran Port :
 * réparer/caréner/commerce). L'équipage = les PJ (MDG 14 l.39), chacun tenant son RÔLE.
 */

/** Quatre marins couvrant les RÔLES d'équipage essentiels des Tests de voyage (MDG 14) : Capitaine
 *  (Progression), Timonier/Mousse (Manœuvre/Affaler/Entretien), Navigateur (Orientation), Vigie
 *  (Perception au phare). `shipRole` ÉPINGLE le rôle de chacun pour un défaut d'équipage lisible. */
function crew(): Combatant[] {
  const cap = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Capitaine Brenner', motivation: 'Test', seed: 4801, id: 'mar-cap' });
  cap.shipRole = 'capitaine';
  renforcerCompetence(cap, 'commandement', 50);
  renforcerCompetence(cap, 'voile', 40, 'cogue');
  cap.items = [...(cap.items ?? []), itemFromTrappingById('ration', undefined, contexteDeNaissanceDObjet(cap))!, itemFromTrappingById('ration', undefined, contexteDeNaissanceDObjet(cap))!];
  cap.appearance = { species: especeDApparence('humains-reiklander'), sex: 'M' };

  const timo = createHero({ speciesId: 'humains-reiklander', careerId: 'chasseur', label: 'Timonière Hilda', motivation: 'Test', seed: 4802, id: 'mar-timo' });
  timo.shipRole = 'timonier';
  renforcerCompetence(timo, 'voile', 55, 'cogue');
  renforcerCompetence(timo, 'ramer', 45);
  renforcerCompetence(timo, 'metier', 40, 'charpentier'); // entretien de la coque au soir
  timo.appearance = { species: especeDApparence('humains-reiklander'), sex: 'F' };

  const navi = createHero({ speciesId: 'humains-reiklander', careerId: 'erudit', label: 'Navigateur Ansmann', motivation: 'Test', seed: 4803, id: 'mar-navi' });
  navi.shipRole = 'navigateur';
  renforcerCompetence(navi, 'orientation', 55);
  renforcerCompetence(navi, 'savoir', 40, 'oceans'); // bonus d'Orientation au phare (MDG 13 l.335)
  // Astromancien de bord (Magie des mers, MDG 02 l.176) : lance Bienfait de Bel Shanaar (Domaine des
  // Cieux, MDG 02 l.238) en mer — +2 DR aux Tests d'Orientation qui l'impliquent (Test d'équipage compris).
  renforcerCompetence(navi, 'langue', 40, 'magick');
  renforcerCompetence(navi, 'focalisation', 40, 'cieux');
  navi.spells = ['bienfait-de-bel-shanaar'];
  navi.appearance = { species: especeDApparence('humains-reiklander'), sex: 'M' };

  const vigie = createHero({ speciesId: 'humains-reiklander', careerId: 'eclaireur', label: 'Vigie Perla', motivation: 'Test', seed: 4804, id: 'mar-vigie' });
  vigie.shipRole = 'vigie';
  renforcerCompetence(vigie, 'perception', 55);
  renforcerCompetence(vigie, 'voile', 35, 'cogue');
  vigie.appearance = { species: especeDApparence('humains-reiklander'), sex: 'F' };

  return [cap, timo, navi, vigie];
}

// ── Deux ports : Salzenmund (départ) et Marienburg (arrivée, phare + grand port de commerce) ──
const construireDepart = (): Scene => buildScene({
  id: 'test-mer-depart',
  label: 'Salzenmund — les quais',
  desc: 'Arène de test.',
  size: [14, 9],
  terrain: 'planches',
  heroStart: [3, 4],
  weather: 'brouillard',
  startMessage:
    { texte: 'Le capitaine Brenner arpente le pont de la cogue. « Cap sur Marienburg, plusieurs jours de mer nous attendent. ' +
    'Chacun tient son poste : au vent et à la Progression, à l’Orientation, à l’entretien de la coque — elle a pris ' +
    'l’eau à Salzenmund, alors on la choie chaque soir. Vigie, ouvre l’œil dès qu’on approche : le phare de Marienburg ' +
    'annoncera la côte. Une fois à quai, on répare et on commerce au Grand Port. » Le Navigateur, qui sert aussi ' +
    'd’astromancien de bord, sait invoquer le Bienfait de Bel Shanaar pour affiner sa route en mer. (Ouvrez la carte ' +
    'du monde pour appareiller vers Marienburg.)' },
});

const construireArrivee = (): Scene => buildScene({
  id: 'test-mer-arrivee',
  label: 'Marienburg — le Grand Port',
  desc: 'Arène de test.',
  size: [14, 9],
  terrain: 'planches',
  heroStart: [3, 4],
  startMessage:
    { texte: 'Marienburg, au bout de la traversée. Un maître de port vous hèle depuis le quai : « Charpentiers et calfats sont ' +
    'là pour la coque (1 CO la Blessure), le carénage débarrasse la coque de ses Salissures, et le grand marché ' +
    'cosmopolite achète comme il vend. » (Ouvrez l’écran Port depuis la scène ; reprenez la carte du monde pour repartir.)' },
});

// ── Carte du monde : une seule route, MARITIME (milles), avec phare à l'arrivée ──
const construireCarte = (): WorldMap => ({
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
});

export const scenario: TestScenario = {
  id: 'voyage-maritime',
  order: 12,
  category: 'naval',
  icon: 'scenario/port',
  title: 'Voyage maritime',
  tests:
    // MDG 13 ; MDG 15
    'Traversée en mer JOUABLE : route MARITIME (milles) entre 2 ports, appareillage sur le navire ' +
    'de campagne (cogue), journée = météo/vent + Tests d’équipage de Progression & d’Orientation (modales), phare ' +
    'à l’atterrage (Perception), entretien de coque le soir (part endommagée), haltes de nuit, puis ACCOSTAGE au ' +
    'Grand Port (écran Port : réparer/caréner/commerce). Équipage = les PJ, chacun à son rôle (Capitaine/Timonier/' +
    'Navigateur/Vigie).',
  partyNote: 'Équipage : Capitaine Brenner (Commandement) · Timonière Hilda (Voile/Charpentier) · Navigateur Ansmann (Orientation + Astromancien : Bienfait de Bel Shanaar) · Vigie Perla (Perception)',
  money: { gold: 40, silver: 0, brass: 0 }, // de quoi réparer la coque au port
  construire: () => ({
    party: crew(),
    scene: construireDepart(),
    extraScenes: [construireArrivee()],
    worldMap: construireCarte(),
    // Cogue de campagne : coque ENDOMMAGÉE (déclenche l'entretien du soir), tonneaux d'eau suivis, Moral neuf.
    vessel: {
      vehicleId: 'cogue',
      morale: { score: 75, lastMoraleWeek: 0, factors: [] },
      wounds: { current: 15, max: 50 }, // coque mal en point : entretien chaque nuit, encore à réparer à l'arrivée
      waterLitres: 2900, // 20 tonneaux de 145 L (MDG 14 l.242) — 19 hommes à 3 L/jour, soit ~50 jours d'eau
    },
  }),
};
