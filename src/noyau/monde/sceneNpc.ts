/**
 * LA FICHE d'une entité de scène — projection UNIQUE `SceneEntity` → `Combatant`, lue par le spawn de
 * rencontre (`combatSlice`), la Psychologie à la rencontre (`encounterPsychFlow`) et tous les flux qui
 * font JOUER un PNJ hors combat (table de taverne, marchandage, billet, infirmerie payante). Un PNJ a UNE
 * fiche, quelle que soit la porte par laquelle la partie le rencontre (#1882).
 */
import { nomDe } from '../../engine/nom';
import type { Combatant } from '../../engine/types';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { idDuCorps, type Scene, type SceneEntity } from './scene';
import { spawnEnemy } from './spawn';
import type { PorteurDeFiche } from '../../engine/statblock';
import { parcoursDe } from '../../engine/pnjDeCarriere';
import { nomDePreset, presetDuNarratif, resolvePresetCreature, type ResolveurDePreset } from './resolveursDuNarratif';
import type { NomDIndividu } from '../../engine/psych/ciblage';
import type { Jeu } from '../etat';
import { inBattleId } from './combatants';
import { typeNonNomme } from '../../data/schemas/defs-scenes/scene';
import { findCreatureById, findFicheDeVehicule, findSpeciesById, isNamed, profilsStandard, sexeDuPorteur } from '../../data';
import { raceKeySchema, type RaceKey, type Sexe } from '../../data/schemas/grammaire/valeurs';
import { generateName } from '../../engine/names';
import { tirerLesDetails } from '../../engine/creation';
import { hashSeed, makeRNG } from '../../engine/dice';

/** Le porteur de fiche d'une entité et l'apparence qui l'accompagne — preset de PNJ nommé (#671),
 *  statbloc, puis son corps : sa créature, portée à son parcours de carrière s'il en a un (`parcoursDe`, #773), sa
 *  coque ou son engin, dans cet ordre ; `undefined` si elle n'en porte aucun, ou si son preset ou son corps ne se
 *  résout pas (#1882). `presetDe` résout un preset (`nomDEntite`). */
function porteurDeFiche(ent: SceneEntity, presetDe: ResolveurDePreset): { porteur: PorteurDeFiche; appearance?: EntityAppearance } | undefined {
  if (ent.presetId) { // `''` n'est pas un porteur (`typeNonNomme`, `defs-scenes/scene.ts`)
    const preset = resolvePresetCreature(ent.presetId, presetDe);
    return preset && { porteur: { presetCreature: preset.creature, presetId: ent.presetId }, appearance: { ...preset.apparence, ...ent.appearance } };
  }
  if (ent.statblock) return { porteur: { statblock: ent.statblock }, appearance: ent.appearance };
  if (ent.creature) return findCreatureById(ent.creature.id) ? { porteur: { ref: ent.creature.id, parcours: parcoursDe(ent) }, appearance: ent.appearance } : undefined;
  if (ent.vehicule) return findFicheDeVehicule(ent.vehicule.id) ? { porteur: { vehicule: ent.vehicule.id }, appearance: ent.appearance } : undefined;
  if (ent.engin) return findFicheDeVehicule(ent.engin.id) ? { porteur: { engin: ent.engin.id }, appearance: ent.appearance } : undefined;
  return undefined;
}

/** L'individu ANONYME qu'est l'entité `ent` (#3712) : un personnage sans nom d'auteur, ni preset ni statbloc, d'une fiche
 *  du bestiaire qui n'est pas un individu nommé (`isNamed`) et dont l'espèce, celle de l'auteur sinon celle de la fiche,
 *  est d'une race (`RaceKey`) ; son sexe (`sexeDuPorteur`, sinon `M`, #3253). */
function individuAnonyme(ent: SceneEntity): { race: RaceKey; sexe: Sexe } | undefined {
  if (ent.kind !== 'personnage' || ent.label || ent.presetId || ent.statblock || ent.creature === undefined) return undefined;
  const creature = findCreatureById(ent.creature.id);
  if (!creature || isNamed(creature)) return undefined;
  const espece = ent.appearance?.species ?? creature.appearance?.species;
  const race = findSpeciesById(espece)?.refChar ?? raceKeySchema.safeParse(espece).data;
  return race && { race, sexe: sexeDuPorteur({ appearanceOverride: ent.appearance, creatureId: creature.id }) ?? 'M' };
}

/**
 * Le NOM d'une entité de scène (#1463 S3, #1882) : celui que l'auteur écrit (`label`), sinon celui que l'individu
 * anonyme tire sur la graine de son id (`generateName`, #3712), sinon celui de sa fiche, dans l'ordre de
 * `porteurDeFiche` (preset, statbloc, réf). `presetDe` résout un preset : le narratif de la partie en jeu, celui du
 * projet édité dans l'éditeur (`presetDuNarratif`).
 */
export function nomDEntite(ent: SceneEntity, presetDe: ResolveurDePreset): string | undefined {
  if (ent.label) return ent.label;
  if (ent.kind !== 'personnage') return undefined;
  const anonyme = individuAnonyme(ent);
  const tire = anonyme && generateName(anonyme.race, anonyme.sexe, makeRNG(hashSeed(`nom:${ent.id}`)));
  if (tire) return tire;
  if (ent.presetId) {
    const preset = presetDe(ent.presetId);
    return preset && nomDePreset(preset);
  }
  if (ent.statblock) return ent.statblock.label;
  return ent.creature && findCreatureById(ent.creature.id)?.label;
}

/** Ce que lit `nomDIndividu` de l'état de la partie : le groupe, la bataille, la scène et son narratif. */
export type EtatDesIndividus = Pick<Jeu, 'party' | 'battle' | 'scene' | 'campaignNarratif'>;

/** Le nom d'un individu par son id (Cible d'individu, `libelleDeCible`), lu sur l'état COURANT : le groupe,
 *  puis les combattants de la bataille, puis les entités de la scène (`nomDEntite`). #3045 */
export function nomDIndividu(etat: EtatDesIndividus): NomDIndividu {
  return (id) => {
    const combattant = etat.party.find((c) => c.id === id) ?? inBattleId(etat.battle, id);
    if (combattant) return nomDe(combattant);
    const ent = etat.scene?.entities.find((e) => e.id === id);
    return ent && nomDEntite(ent, presetDuNarratif(etat.campaignNarratif));
  };
}

/** La fiche sous le NOM de l'entité (`nomDEntite`) : la fiche donne les valeurs, l'entité le nom —
 *  en combat comme hors combat. L'individu anonyme y reçoit son âge, sa taille, ses yeux et ses cheveux, tirés sur la
 *  graine de son id (`tirerLesDetails`, #3712). */
function fiche(ent: SceneEntity, p: NonNullable<ReturnType<typeof porteurDeFiche>>, presetDe: ResolveurDePreset): Combatant {
  const c = spawnEnemy(p.porteur, ent.id, ent.z ? { ...ent.pos, z: ent.z } : { ...ent.pos }, {
    appearance: p.appearance, inventaire: ent.inventaire,
    optionals: ent.combat?.optionals, spells: ent.combat?.spells, randomChars: ent.combat?.randomChars, // LDB 76/78
    skills: ent.combat?.skills, // AA 10 l.142-146
    crewIds: ent.crewIds, // MDG 14
    postes: ent.postes, // MDG 12-13
    upgrades: ent.upgrades, // MDG 12
  });
  const nom = nomDEntite(ent, presetDe);
  if (nom) c.label = nom;
  const anonyme = individuAnonyme(ent);
  if (anonyme) c.details = tirerLesDetails(anonyme.race, makeRNG(hashSeed(`details:${ent.id}`)));
  return c;
}

/** Une entité sans porteur de fiche résoluble a franchi la porte (`sceneEntitySchema`, #1882) : bogue du jeu. */
export class FicheAbsente extends Error {
  constructor(readonly entite: string, presetId: string | undefined, corps: string | undefined) {
    super(presetId
      ? `[fiche] personnage « ${entite} » : preset de PNJ « ${presetId} » irrésoluble (#1882)`
      : corps
        ? `[fiche] personnage « ${entite} » : réf. « ${corps} » irrésoluble (#1882)`
        : `[fiche] ${typeNonNomme({ id: entite, kind: 'personnage' })} (#1882)`);
    this.name = 'FicheAbsente';
  }
}

/** LA fiche d'une entité `personnage` ; lève `FicheAbsente` si elle n'en porte aucune de résoluble. */
export function ficheDEntite(ent: SceneEntity, presetDe: ResolveurDePreset): Combatant {
  const p = porteurDeFiche(ent, presetDe);
  if (!p) throw new FicheAbsente(ent.id, ent.presetId, idDuCorps(ent));
  return fiche(ent, p, presetDe);
}

/** UN PNJ SANS ENTITÉ DE SCÈNE — l'habitué d'une table : sa fiche est un profil standard (`LDB 77 l.7`,
 *  `profilsStandard`), sous le libellé de cette fiche. `undefined` hors des profils standard. */
export function pnjAuProfil(profil: string, id: string): Combatant | undefined {
  return profilsStandard().includes(profil) ? spawnEnemy({ ref: profil }, id, { x: 0, y: 0 }) : undefined;
}

/** UN PNJ SANS ENTITÉ DE SCÈNE, nommé par un preset du narratif (#671) — le vendeur d'un billet
 *  marchandé (`billetFlow`) : sa fiche est celle du preset, sous son libellé. `undefined` si le preset
 *  ne se résout pas. */
export function pnjAuPreset(presetId: string, id: string, presetDe: ResolveurDePreset): Combatant | undefined {
  const preset = resolvePresetCreature(presetId, presetDe);
  return preset && spawnEnemy({ presetCreature: preset.creature, presetId }, id, { x: 0, y: 0 }, { appearance: preset.apparence });
}

/**
 * LE PNJ DE SCÈNE derrière un id, hors combat — sa fiche, la MÊME que `ficheDEntite`. `undefined` quand l'id ne désigne aucun `personnage`, ou un personnage sans fiche : chaque
 * lecteur le DIT (refus nommé de l'infirmerie, faute de `validateScene`).
 *
 * DETTE DITE (#1279 S4-c, décision d'architecture commissionnée à part) : cette dérivation est
 * ÉPHÉMÈRE. Il n'existe aucun registre de Combatants persistants hors combat (`actorIn` =
 * `battle.combatants ?? party`, `noyau/monde/combatants.ts`), donc ce que la partie ÉCRIRAIT sur cette
 * fiche — un État d'attrition (`SequenceRoundOps.attrition`, appliqué par `sequenceRoundOps` sur des
 * porteurs résolus par `actorIn`), un mouvement de bourse (`creditBourse`/`debitBourse` écrivent
 * dans `party`) — ne s'y déposerait pas. Le lot S4-b est donc en LECTURE SEULE : le PNJ joue de sa
 * fiche, il n'en subit rien. Aucune simulation ne comble ce trou.
 */
export function sceneNpc(scene: Scene | null | undefined, id: string, presetDe: ResolveurDePreset): Combatant | undefined {
  const ent = scene?.entities.find((e) => e.id === id);
  return ent && ficheDuPersonnage(ent, presetDe);
}

/** La fiche du `personnage` `ent`, la MÊME que `ficheDEntite` ; `undefined` hors d'un personnage, ou d'un personnage sans
 *  fiche. */
export function ficheDuPersonnage(ent: SceneEntity, presetDe: ResolveurDePreset): Combatant | undefined {
  const p = ent.kind === 'personnage' ? porteurDeFiche(ent, presetDe) : undefined;
  return p && fiche(ent, p, presetDe);
}
