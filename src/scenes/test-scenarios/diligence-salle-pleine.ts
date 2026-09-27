import { makeShowcaseParty } from '../../data/pregens';
import { diligenceCampaign } from '../campaign';
import type { Scene, SceneEntity } from '../../state/scene';
import { assignSeat, seatSlotsOf } from '../../state/seating';
import type { TestScenario } from './_shared';
import type { Sexe } from '../../data/schemas/grammaire/valeurs';

/** Où le groupe entre : au milieu de la salle, entre les tables (zone `zone-S-z0`) — case LIBRE, hors
 *  du passage d'entrée traversant (colonne 12), hors de l'allée de service du tenancier (à l'ouest du
 *  comptoir) et hors de tout abord de place. */
const DEPART = { x: 13, y: 14 };

/** Un convive AUTHORÉ : son id stable, son nom, et l'apparence choisie (espèce/sexe/tenue civile).
 *  La PLACE qu'il tient est donnée par `TABLES` ci-dessous, dans le même ordre. */
interface Convive {
  id: string;
  label: string;
  species: string;
  sex: Sexe;
  tenue: string;
}

const CONVIVES: Convive[] = [
  { id: 'diligence-convive-1', label: 'Karl Brandt, roulier', species: 'humains-reiklander', sex: 'M', tenue: 'cocher' },
  { id: 'diligence-convive-2', label: 'Elsbeth Ruhl, colporteuse', species: 'humains-reiklander', sex: 'F', tenue: 'colporteur' },
  { id: 'diligence-convive-3', label: 'Grimni Barbefer', species: 'nains', sex: 'M', tenue: 'artisan' },
  { id: 'diligence-convive-4', label: 'Marta Holzknecht', species: 'humains-middenland', sex: 'F', tenue: 'villageois' },
  { id: 'diligence-convive-5', label: 'Rudi Pfeffer, marchand', species: 'humains-reiklander', sex: 'M', tenue: 'marchand' },
  { id: 'diligence-convive-6', label: 'Berta Sonnenschein', species: 'halflings', sex: 'F', tenue: 'villageois' },
  { id: 'diligence-convive-7', label: 'Otto Gruber, batelier', species: 'humains-nordland', sex: 'M', tenue: 'batelier' },
  { id: 'diligence-convive-8', label: 'Ilse Wagner, herboriste', species: 'humains-reiklander', sex: 'F', tenue: 'herboriste' },
  { id: 'diligence-convive-9', label: 'Dorin Pierrefonte', species: 'nains', sex: 'M', tenue: 'mineur' },
  { id: 'diligence-convive-10', label: 'Anneliese Kuhn', species: 'humains-reiklander', sex: 'F', tenue: 'bourgeois' },
  { id: 'diligence-convive-11', label: 'Hans Meissner, boucher', species: 'humains-middenheim', sex: 'M', tenue: 'artisan' },
  { id: 'diligence-convive-12', label: 'Rosalind Beck', species: 'halflings-cendreplaine', sex: 'F', tenue: 'serviteur' },
  { id: 'diligence-convive-13', label: 'Emil Voss, clerc', species: 'humains-reiklander', sex: 'M', tenue: 'erudit' },
  { id: 'diligence-convive-14', label: 'Gudrun Steinfaust', species: 'nains', sex: 'F', tenue: 'marchand' },
  { id: 'diligence-convive-15', label: 'Lukas Ehrlich, messager', species: 'humains-reiklander', sex: 'M', tenue: 'messager' },
  { id: 'diligence-convive-16', label: 'Sieglinde Haupt', species: 'humains-middenland', sex: 'F', tenue: 'villageois' },
];

/** Les places de la salle, meuble par meuble, dans l'ordre du catalogue : 3 tables rondes (4 places)
 *  + 2 tables murales (2 places) = 16, une par convive. */
const TABLES: string[] = [
  'diligence-salle-table-ronde-1',
  'diligence-salle-table-ronde-2',
  'diligence-salle-table-ronde-3',
  'diligence-salle-table-murale-1',
  'diligence-salle-table-murale-2',
];

/** Le groupe entre au milieu de la salle plutôt que sur la route. */
function poserDepart(base: Scene): Scene {
  return {
    ...base,
    entities: base.entities.map((e) =>
      e.kind === 'heroStart' ? { ...e, pos: { ...DEPART } } : e,
    ),
  };
}

/**
 * Assoit les 16 convives, une place chacun. La `pos` de chaque PNJ est l'abord EFFECTIF de sa place,
 * LU sur `seatSlotsOf` (arbitré à l'échelle de la scène) — jamais une coordonnée devinée : c'est
 * l'invariant que `seatAssignmentDefects`/`validateScene` vérifient. `assignSeat` écrit l'occupation
 * et refuse toute place qui ne se tiendrait pas.
 */
function meublerDeGens(depart: Scene): Scene {
  let scene = depart;
  let i = 0;
  for (const propId of TABLES) {
    for (const slot of seatSlotsOf(scene, propId)) {
      const convive = CONVIVES[i++];
      if (!convive) throw new Error(`La Diligence — salle pleine : ${TABLES.length} tables offrent plus de places que de convives authorés`);
      const pnj: SceneEntity = {
        id: convive.id,
        kind: 'personnage',
        ref: 'villageois',
        label: convive.label,
        pos: { x: slot.approach.x, y: slot.approach.y },
        facing: slot.facing,
        appearance: { species: convive.species, sex: convive.sex, tenue: convive.tenue },
      };
      scene = { ...scene, entities: [...scene.entities, pnj] };
      const res = assignSeat(scene, propId, slot.slotId, { kind: 'entity', entityId: convive.id }, 0);
      if (!res.ok) throw new Error(`La Diligence — salle pleine : ${convive.id} refusé à ${propId}/${slot.slotId} (${res.reason})`);
      scene = res.scene;
    }
  }
  if (i !== CONVIVES.length) throw new Error(`La Diligence — salle pleine : ${CONVIVES.length} convives authorés pour ${i} places`);
  return scene;
}

const scene = meublerDeGens(poserDepart(diligenceCampaign.scenes[0]));

export const scenario: TestScenario = {
  id: 'diligence-salle-pleine',
  order: 61,
  category: 'rendu',
  icon: 'scenario/village',
  title: 'La Diligence — salle pleine',
  tests: 'La salle meublée VUE HABITÉE : 16 convives authorés assis, un par place des 3 tables rondes et des 2 tables murales, chacun posé sur l’abord effectif de sa place.',
  partyNote: 'Groupe vitrine (Soldat / Tueur / Sorcier / Chasseur) — départ au milieu de la salle, aucun combat.',
  makeParty: makeShowcaseParty,
  scene,
};
