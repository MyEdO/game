import { createHero } from '../../engine/character';
import { acquerirTalent } from '../../engine/careerSlots';
import { makeRNG } from '../../engine/dice';
import { itemFromTrappingById, loadoutCreate, loadoutSetSlot, recomputeLoadout } from '../../engine/items';
import type { Combatant, ItemInstance } from '../../engine/types';
import { CustomStatblock } from '../../state/scene';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import { pregen, PREGEN } from '../../data/pregens';
import type { TestScenario } from './_shared';
import { rigSpeciesId } from '../../data';

/**
 * SANDBOX combat « un terrain bien agencé, des mannequins bien placés » : un seul lieu qui exerce une
 * famille entière de systèmes liés, plutôt qu'un micro-test par mécanique. Cour d'entraînement de NUIT
 * (brouillard de guerre : ~5 cases de vue) — on entre en exploration (brouillard, forme d'arme via la
 * fiche), puis on franchit la lice (à l'EST) pour déclencher l'exercice au contact (`startCombat`).
 *
 * Systèmes couverts par le seul placement : tir & rechargement, ciblage & ligne de vue (muret de
 * couvert), brouillard/vision (lanterne portée + vision nocturne du Nain + sort Lumière), Engagé/charge/
 * désengagement et maniement de deux armes (sparring-partners), forme d'arme (fiche du Bretteur), combat
 * monté (monture libre à enfourcher), Explosion en zone (Sorcière). L'explosion-MINUTERIE (delayedEffect)
 * vit, elle, dans le scénario Opéra.
 */

/** Cible inerte : M 0 (ne bouge pas), beaucoup de Blessures (encaisse) → on observe le tir/ciblage.
 *  Son `appearance.species` (posé sur chaque exemplaire de la rencontre) est une donnée D'ATTENTE : le
 *  rendu d'un combattant n'offre aujourd'hui que rig/plan, aucun gabarit d'objet inanimé — arbitrage
 *  du vrai gabarit de mannequin : #1075. */
const MANNEQUIN: CustomStatblock = { type: 'statblock',
  label: "Mannequin d'entraînement",
  char: { M: 0, 'capacite-de-combat': 5, 'capacite-de-tir': 0, force: 20, endurance: 35, initiative: 5, agilite: 5, dexterite: 5, intelligence: 5, 'force-mentale': 5, sociabilite: 5, B: 40 },
  traits: [],
};

/** Tireur humain : arbalète (Recharge 1 → modale de rechargement) + carreaux + LANTERNE portée (halo). */
function tireur(): Combatant {
  const h = createHero({
    speciesId: 'humains-reiklander',
    careerId: 'soldat',
    label: 'Tireur (entraînement)',
    motivation: 'Exercice',
    rng: makeRNG(3101),
    id: 'tr-tireur',
  });
  const arb = itemFromTrappingById('arbalete')!; // Recharge 1 + Empaleuse
  arb.equipped = true;
  const carreaux = itemFromTrappingById('carreau')!;
  const lant = itemFromTrappingById('lanterne')!;
  lant.equipped = true; // PORTÉE → halo de lumière qui le suit (gate : un objet rangé n'éclaire pas)
  h.items = [arb, carreaux, lant];
  h.loadouts = undefined;
  h.activeLoadoutId = undefined;
  recomputeLoadout(h);
  // Tir rapide (LDB 10) : interruption à distance pendant la pause de début de Round (badge de la frise d'Initiative).
  if (!h.talents.some((t) => t.talentId === 'tir-rapide')) acquerirTalent(h, { id: 'tir-rapide' });
  h.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'M', build: 0.5 };
  return h;
}

/** Bretteur : deux armes de mêlée 1 main (Arme simple à FORME changeable + Dague) + talent dédié. */
function bretteur(): Combatant {
  const h = pregen(PREGEN.soldat); // Sigmund
  if (!h.talents.some((t) => t.talentId === 'maniement-de-deux-armes')) {
    acquerirTalent(h, { id: 'maniement-de-deux-armes' });
  }
  const main = itemFromTrappingById('arme-simple'); // shape:'epee' + formChoices (épée→hache/masse/…)
  const off = itemFromTrappingById('dague');
  h.items = [...(h.items ?? []), main, off].filter(Boolean) as ItemInstance[];
  if (main && off) {
    const id = loadoutCreate(h);
    loadoutSetSlot(h, id, 'main', main.uid);
    loadoutSetSlot(h, id, 'off', off.uid);
  }
  recomputeLoadout(h);
  return h;
}

const W = 24, H = 14;

/**
 * Cour d'entraînement de NUIT, migrée sur `buildScene(MapSpec)`. Terrain 'sol' plein ; muret de couvert
 * (colonne x=11, rangées 3-6) posé en tuiles 'mur' (`#`) via la grille `z0` — casse la ligne de vue vers
 * le mannequin tapi derrière. Braséros = props (halos de lumière). La lice (bande x=7) lance l'exercice.
 */
const scene = buildScene({
  id: 'terrain-entrainement',
  label: "Terrain d'entraînement",
  desc: 'Arène de test.',
  size: [W, H],
  terrain: 'sol',
  ambientLight: 'nuit', // brouillard de guerre : ~5 cases de vue de base ; lumière / vision nocturne révèlent
  heroStart: [3, 8],
  // Muret de couvert (x=11, rangées y=3..6) : casse la ligne de vue vers le mannequin tapi derrière (`#` = mur).
  levels: {
    z0: [
      '........................',
      '........................',
      '........................',
      '...........#............',
      '...........#............',
      '...........#............',
      '...........#............',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ].join('\n'),
  },
  // Braseros : îlots de lumière (la lice et le couloir sont éclairés ; le fond reste dans le noir).
  entities: [
    { id: 'brasero-lice', kind: 'prop', ref: 'brasero', pos: { x: 14, y: 8 } },
    { id: 'brasero-couloir', kind: 'prop', ref: 'brasero', pos: { x: 8, y: 11 } },
  ],
  // La lice : franchir la bande (x=7) lance l'exercice au contact (on garde l'exploration AVANT pour le
  // brouillard et la forme d'arme dans la fiche).
  triggers: [
    {
      id: 'entrer-en-lice',
      rect: { x: 7, y: 1, w: 1, h: 12 },
      once: true,
      flow: flowFromEffects([
        { type: 'journal', desc: "Vous entrez dans la lice ; l'instructeur lance l'exercice. En garde !" },
        { type: 'startCombat', encounter: 'enc-entrainement' },
      ]),
    },
  ],
  encounters: [
    {
      id: 'enc-entrainement',
      enemies: [
        { statblock: MANNEQUIN, appearance: { species: 'humains-reiklander' }, pos: { x: 13, y: 10 } }, // cible proche, éclairée → tir + rechargement
        { statblock: MANNEQUIN, appearance: { species: 'humains-reiklander' }, pos: { x: 13, y: 5 } }, //  derrière le muret → hors LdV (clic refusé)
        { statblock: MANNEQUIN, appearance: { species: 'humains-reiklander' }, pos: { x: 21, y: 2 } }, //  au loin dans le brouillard → invisible tant qu'on n'éclaire/approche pas
        { ref: 'gobelin', pos: { x: 15, y: 7 } }, //         sparring : charge / Engagé / désengagement / deux armes
        { ref: 'gobelin', pos: { x: 16, y: 9 } }, //         + cible plus petite que le Cheval → charge montée +20
        { ref: 'cheval', pos: { x: 5, y: 10 }, mount: true, side: 'ally' }, // monture libre à enfourcher
      ],
    },
  ],
  startMessage:
    "Cour d'entraînement, de nuit (brouillard de guerre : ~5 cases de vue). Le Tireur porte une lanterne, le " +
    "Tueur nain voit dans le noir, la Sorcière connaît Lumière. Ouvrez la fiche du Bretteur (onglet Sac) pour " +
    "changer la FORME de son Arme simple (épée → hache…), puis avancez vers l'EST : franchir la lice lance " +
    "l'exercice. Cibles à tirer/recharger (une derrière un muret = hors LdV, une au loin dans le brouillard), " +
    "deux sparring-partners (charge / Engagé / désengagement / deux armes), une monture libre à enfourcher, " +
    "l'Explosion de la Sorcière en zone.",
});

export const scenario: TestScenario = {
  id: 'entrainement',
  order: 1,
  category: 'combat',
  icon: 'scenario/training',
  title: "Terrain d'entraînement",
  tests:
    'Sandbox : tir + rechargement & ciblage/LdV (cible derrière un muret, cible au loin dans le brouillard), ' +
    'brouillard de guerre (nuit + lanterne portée + vision nocturne du Nain + sort Lumière), Engagé/charge/' +
    'désengagement & deux armes sur sparring-partners, forme d’arme (fiche du Bretteur), combat monté (monture ' +
    'libre, +20 vs plus petit), Explosion en zone (Sorcière).',
  partyNote: 'Tireur (arbalète + lanterne) · Bretteur (deux armes, forme changeable) · Tueur nain (vision nocturne) · Sorcière (Lumière/Explosion)',
  makeParty: () => {
    const sorciere = pregen(PREGEN.sorcier);
    sorciere.spells = ['lumiere', 'explosion', 'bouclier-magique', ...(sorciere.spells ?? [])];
    return [tireur(), bretteur(), pregen(PREGEN.tueur), sorciere];
  },
  scene,
};
