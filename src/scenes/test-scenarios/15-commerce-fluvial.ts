import { createHero, skillCharacteristicById } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { itemFromTrappingById } from '../../engine/items';
import type { Combatant, SkillInstance } from '../../engine/types';
import { buildScene } from '../../state/mapSpec';
import type { Scene } from '../../state/scene';
import type { MapPlace, MapRoute, WorldMap } from '../../state/worldMap';
import type { TestScenario } from './_shared';
import { REIK_INDEX, hasTradeGoods, reikMarket, type ReikEntry } from './_reik-index';
import { rigSpeciesId } from '../../data';

/**
 * « Commerce fluvial sur le Reik » — le commerce de cargaison de Mort sur le Reik Compagnon (ch.11
 * « Règles du commerce ») rendu JOUABLE. Une portion du Reikland avec ses VRAIES localités marchandes
 * (Index géographique, MSRC 13 l.185-270 — cf. `_reik-index.ts`), chacune un Lieu de la carte du monde
 * porteur de son `market` (Taille / Richesse / Produits VERBATIM du livre), reliées par des routes de
 * BARGE (voie navigable). La boucle du marchand (l.11-13) : acheter bas en un lieu, descendre le fleuve,
 * revendre plus cher là où la Richesse est plus haute (Mise à prix par Richesse, l.150-156).
 *
 * NB — Fidélité : les INDICES (Taille/Richesse/Produits) sont recopiés tels quels de l'Index. En revanche
 * l'ORDRE amont→aval et les DISTANCES (km) ne sont PAS fournis par le ch.11 (c'est un index d100, pas un
 * gazetteer positionné) : la disposition ci-dessous est SCHÉMATIQUE (regroupée par région : Ubersreik/
 * Auerswald en amont, Kemperbad sur la Stir, Reik central autour de Grünburg, Bögen, puis Altdorf en
 * aval), et les distances sont des valeurs d'auteur. Seuls les Hameaux (Taille 1) sont laissés hors carte
 * (l.139 : « les hameaux n'ont généralement aucune demande de biens ») — ils restent dans les données.
 */

/** Ajoute/renforce une Compétence sur un héros, à la Caractéristique CANONIQUE de la Compétence (donnée). */
function skill(c: Combatant, skillId: string, advances: number, spec?: string): void {
  const characteristic = skillCharacteristicById(skillId);
  const ex = c.skills.find((s) => s.id === skillId && s.spec === spec);
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ id: skillId, spec, characteristic, advances } as SkillInstance);
}

/** Quatre marchands ambulants. Berta tient le commerce : Marchandage (négocier l'achat/la vente),
 *  Ragot (dénicher une rumeur commerciale au marché, l.180) et Évaluation + Résistance à l'alcool
 *  (jauger la qualité secrète d'une cargaison de vin, l.95). Les trois autres sont l'équipage de barge. */
function traders(): Combatant[] {
  const berta = createHero({ speciesId: 'humains-reiklander', careerId: 'marchand', label: 'Berta Kaufmann', motivation: 'Test', rng: makeRNG(1501), id: 'com-berta' });
  skill(berta, 'marchandage', 65);
  skill(berta, 'ragot', 55);
  skill(berta, 'evaluation', 50);
  skill(berta, 'resistance-a-l-alcool', 45);
  // Chariot de convoi (porteur RÉEL de la cargaison, #327) : la contenance devient un plafond réel — le
  // vrac vit sur `ItemInstance.cargo`, embarqué sur la barge à la descente (Décision 5, EDOC 7).
  const convoi = { uid: 'com-convoi', name: 'Chariot de convoi', trappingId: 'diligence', kind: 'misc', qualities: [], enc: 0, equipped: false } as never;
  berta.items = [...(berta.items ?? []), itemFromTrappingById('ration')!, itemFromTrappingById('ration')!, convoi];
  berta.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'F', build: 0.5 };

  const gunnar = createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', label: 'Gunnar le Batelier', motivation: 'Test', rng: makeRNG(1502), id: 'com-gunnar' });
  skill(gunnar, 'ramer', 50);
  skill(gunnar, 'voile', 40);
  gunnar.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'M', build: 0.58 };

  const otto = createHero({ speciesId: 'humains-reiklander', careerId: 'garde', label: 'Otto le Garde', motivation: 'Test', rng: makeRNG(1503), id: 'com-otto' });
  skill(otto, 'intimidation', 40);
  otto.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'M', build: 0.62 };

  const lise = createHero({ speciesId: 'humains-reiklander', careerId: 'erudit', label: 'Lise la Scribe', motivation: 'Test', rng: makeRNG(1504), id: 'com-lise' });
  skill(lise, 'metier', 40, 'Cartographe');
  lise.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'F', build: 0.42 };

  return [berta, gunnar, otto, lise];
}

/** Ordre amont→aval SCHÉMATIQUE des localités marchandes portées à la carte (regroupées par région,
 *  cf. l'avertissement d'en-tête) : la source ne donne pas de séquence fluviale. Le groupe démarre à
 *  Grünburg (Ville de construction de bateaux — port naturel d'un équipage de barge). */
const RIVER_ORDER = [
  // Amont : Teufel (Ubersreik) et Freistadt d'Auerswald.
  'ubersreik', 'hahnbrandt', 'koch', 'auerswald', 'messingen', 'hugeldal',
  // Stir : Kemperbad et sa région viticole.
  'kemperbad', 'brandenburg', 'jungbach', 'stockhausen',
  // Reik central autour de Grünburg (départ).
  'eilhart', 'grunburg', 'hornlach', 'silberwurt', 'worlitz', 'dunkelburg', 'diesdorf', 'rottefach', 'buchedorf',
  // Bögen (Freistadt de Bögenhafen).
  'bogenhafen', 'finsterbad', 'ardlich', 'herzhald',
  // Bas Reik → capitale.
  'walfen', 'autler', 'weissbruck', 'altdorf',
];

const START_ID = 'grunburg';
const SELL_ID = 'altdorf'; // Florissant (R 5) → Mise à prix +10 % (l.156) : le débouché le plus cher

const byId = (id: string): ReikEntry => {
  const e = REIK_INDEX.find((x) => x.id === id);
  if (!e || !hasTradeGoods(e)) throw new Error(`Lieu marchand introuvable : ${id}`);
  return e;
};

/** Scène-quai générée pour un Lieu (petit débarcadère de planches). Le port de DÉPART porte le message
 *  d'accueil qui explique la boucle ; les autres, un rappel bref. */
function quay(e: ReikEntry, start: boolean): Scene {
  const size: [number, number] = [12, 7];
  return buildScene({
    id: `quai-${e.id}`,
    label: `${e.label} — les quais`,
    desc: 'Arène de test.',
    size,
    terrain: 'planches',
    heroStart: [3, 4],
    startMessage: start
      ? `Berta Kaufmann inspecte les étals de ${e.label} d’un œil connaisseur. « On achète bon marché ici, on redescend ` +
        `le Reik en barge, et on revend plus cher où la ville est florissante — à Altdorf, on paiera dix bons pour cent ` +
        `de plus. Le chariot de convoi porte la cargaison tout le voyage. » (Ouvrez le marché pour acheter, puis la carte ` +
        `du monde pour prendre la barge.) Berta marchande, jauge le vin et tend l’oreille aux rumeurs de marché.`
      : `${e.label}, sur le Reik. (Le marché pour acheter ou vendre ; la carte du monde pour reprendre la barge.)`,
  });
}

// ── Génère lieux + scènes + routes depuis l'Index (RIVER_ORDER) ──────────────────────────────────────
function construireReik(): { scenes: Scene[]; carte: WorldMap } {
  const entries = RIVER_ORDER.map(byId);
  const scenes: Scene[] = entries.map((e) => quay(e, e.id === START_ID));

  const places: MapPlace[] = entries.map((e, i) => ({
    id: `p-${e.id}`,
    label: e.label,
    // Ruban fluvial schématique : x croît amont→aval, y ondule (sans chevauchement des médaillons).
    pos: { x: Math.round(6 + (i / (RIVER_ORDER.length - 1)) * 88), y: Math.round(34 + 20 * Math.sin(i * 0.8)) },
    scene: `quai-${e.id}`,
    icon: 'scenario/port',
    market: reikMarket(e),
  }));

  const placeIdOf = (id: string) => `p-${id}`;

  /** Route de barge entre deux Lieux (voie navigable) — modes barge + pied, sans péripétie (démo commerce ;
   *  les périls de voyage sont couverts par le scénario « Voyage & temps long »). */
  function bargeRoute(aId: string, bId: string, km: number, id?: string): MapRoute {
    return {
      id: id ?? `r-${aId}-${bId}`,
      a: placeIdOf(aId), b: placeIdOf(bId),
      km,
      modes: ['barge', 'pied'],
      perilDie: 0,
      inns: true, // relais d'auberges le long du fleuve : la halte de nuit propose l'auberge (et le Ragot, l.180)
    };
  }

  // Chaîne fluviale : chaque Lieu relié au suivant (barge). Distances d'auteur (amont hâché ~30 km, bas Reik plus long).
  const routes: MapRoute[] = [];
  for (let i = 0; i < RIVER_ORDER.length - 1; i++) {
    routes.push(bargeRoute(RIVER_ORDER[i], RIVER_ORDER[i + 1], 30));
  }
  // Route DIRECTE Grünburg → Altdorf (le grand axe du Reik) : ~45 km, une journée de barge (M8 × 6 h = 48 km) —
  // permet la boucle d'arbitrage en un seul saut (achat à Grünburg → vente à Altdorf, l.150-156). Cette descente
  // est JOUÉE (MSRC 7 « Navigation fluviale ») : Test de Navigation par étape, table des vents, et un péril
  // atteignable (débris flottants, l.123-125). Le chariot de convoi (porteur réel) persiste pendant la descente.
  const grunburgAltdorf = bargeRoute(START_ID, SELL_ID, 45, 'r-grunburg-altdorf');
  grunburgAltdorf.river = true;
  grunburgAltdorf.riverPerils = [{ perilId: 'debris', chancePct: 55 }];
  // Exposition hydrique de la descente (MSRC 16, l.5) : l'équipage boit l'eau du Reik non bouillie en
  // approchant d'Altdorf (grande ville en aval → tableau 1 « Source d'eau », −20, l.23-33). Chaque étape à
  // flot, un tirage déclenche l'Effet EXISTANT `waterExposure` (Test de Résistance → maladie) — data-driven.
  grunburgAltdorf.riverExposure = { source: 'aval-grande-ville-8km', mode: 'ingestion', chancePct: 60 };
  routes.push(grunburgAltdorf);

  const carte: WorldMap = {
    id: 'reik-commerce-carte',
    label: 'Le Reik marchand (Index géographique, MSRC 13)',
    params: { perilDie: 0 },
    places,
    routes,
  };
  return { scenes, carte };
}

export const scenario: TestScenario = {
  id: 'commerce-fluvial',
  order: 2,
  category: 'marche',
  icon: 'scenario/market',
  title: 'Commerce fluvial (le Reik)',
  tests:
    'Commerce de cargaison MSRC 13 JOUABLE : le Reik peuplé de ses VRAIES localités marchandes (Index ' +
    'géographique l.185-270, indices Taille/Richesse/Produits verbatim), reliées par des routes de BARGE. ' +
    'Boucle du marchand : acheter une cargaison à Grünburg (R 2), descendre le fleuve en barge (le convoi ' +
    'persiste sur le chariot de convoi), revendre à Altdorf (Florissant R 5, Mise à prix +10 %, l.156) — profit. ' +
    'Marché à chaque ville, Marchandage/Évaluation du vin/rumeurs (Berta). La descente EXERCE aussi ' +
    'l’exposition hydrique (MSRC 16) : en approchant d’Altdorf, l’équipage risque une maladie de l’eau.',
  partyNote: 'Berta (Marchande — Marchandage/Ragot/Évaluation) · Gunnar (batelier) · Otto (garde) · Lise (scribe)',
  construire: () => {
    const { scenes, carte } = construireReik();
    return {
      party: traders(),
      scene: scenes.find((s) => s.id === `quai-${START_ID}`)!,
      extraScenes: scenes.filter((s) => s.id !== `quai-${START_ID}`),
      worldMap: carte,
    };
  },
  money: { gold: 5000, silver: 0, brass: 0 }, // de quoi acheter une cargaison entière (lot plein = pas de surcoût, l.131)
};
