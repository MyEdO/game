/**
 * LA FICHE d'une entité de scène — projection UNIQUE `SceneEntity` → `Combatant`, lue par le spawn de
 * rencontre (`combatSlice`), la Psychologie à la rencontre (`encounterPsychFlow`) et tous les flux qui
 * font JOUER un PNJ hors combat (table de taverne, marchandage, infirmerie payante). Un PNJ a UNE
 * fiche, quelle que soit la porte par laquelle la partie le rencontre (#1882).
 */
import type { Combatant } from '../engine/types';
import type { EntityAppearance } from '../engine/authoringAppearance';
import type { Scene, SceneEntity } from './scene';
import { spawnEnemy } from './spawn';
import type { PorteurDeFiche } from '../engine/statblock';
import { resolvePresetCreature } from './campaignData';
import { typeNonNomme } from '../data/schemas/defs-scenes/scene';
import { profilsStandard, refEntiteResolue } from '../data';

/** Le porteur de fiche d'une entité et l'apparence qui l'accompagne — preset de PNJ nommé (#671),
 *  statbloc, puis réf, dans cet ordre ; `undefined` si elle n'en porte aucun, ou si son preset ou sa réf
 *  ne se résout pas (#1882). */
function porteurDeFiche(ent: SceneEntity): { porteur: PorteurDeFiche; appearance?: EntityAppearance } | undefined {
  if (ent.presetId) { // `''` n'est pas un porteur (`typeNonNomme`, `defs-scenes/scene.ts`)
    const preset = resolvePresetCreature(ent.presetId);
    return preset && { porteur: { presetCreature: preset.creature }, appearance: preset.apparence ?? ent.appearance };
  }
  if (ent.statblock) return { porteur: { statblock: ent.statblock }, appearance: ent.appearance };
  if (ent.ref) return refEntiteResolue(ent.ref) ? { porteur: { ref: ent.ref }, appearance: ent.appearance } : undefined;
  return undefined;
}

/** La fiche sous le NOM de l'entité (#1463 S3, #1882) : la fiche donne les valeurs, l'entité le nom —
 *  en combat comme hors combat. */
function fiche(ent: SceneEntity, p: NonNullable<ReturnType<typeof porteurDeFiche>>): Combatant {
  const c = spawnEnemy(p.porteur, ent.id, ent.z ? { ...ent.pos, z: ent.z } : { ...ent.pos }, {
    appearance: p.appearance, weapon: ent.weapon,
    optionals: ent.combat?.optionals, spells: ent.combat?.spells, randomChars: ent.combat?.randomChars, // LDB 76/78
    skills: ent.combat?.skills, // AA 10 l.142-146
    crewIds: ent.crewIds, // MDG 14
    postes: ent.postes, // MDG 12-13
    upgrades: ent.upgrades, // MDG 12
  });
  if (ent.label) c.label = ent.label;
  return c;
}

/** Une entité sans porteur de fiche résoluble a franchi la porte (`sceneEntitySchema`, #1882) : bogue du jeu. */
export class FicheAbsente extends Error {
  constructor(readonly entite: string, presetId: string | undefined, ref: string | undefined) {
    super(presetId
      ? `[fiche] personnage « ${entite} » : preset de PNJ « ${presetId} » irrésoluble (#1882)`
      : ref && !refEntiteResolue(ref)
        ? `[fiche] personnage « ${entite} » : réf. « ${ref} » irrésoluble (#1882)`
        : `[fiche] ${typeNonNomme({ id: entite, kind: 'personnage' })} (#1882)`);
    this.name = 'FicheAbsente';
  }
}

/** LA fiche d'une entité `personnage` ; lève `FicheAbsente` si elle n'en porte aucune de résoluble. */
export function ficheDEntite(ent: SceneEntity): Combatant {
  const p = porteurDeFiche(ent);
  if (!p) throw new FicheAbsente(ent.id, ent.presetId, ent.ref);
  return fiche(ent, p);
}

/** UN PNJ SANS ENTITÉ DE SCÈNE — l'habitué d'une table : sa fiche est un profil standard (`LDB 77 l.7`,
 *  `profilsStandard`), sous le libellé de cette fiche. `undefined` hors des profils standard. */
export function pnjAuProfil(profil: string, id: string): Combatant | undefined {
  return profilsStandard().includes(profil) ? spawnEnemy({ ref: profil }, id, { x: 0, y: 0 }) : undefined;
}

/**
 * LE PNJ DE SCÈNE derrière un id, hors combat — sa fiche, la MÊME que `ficheDEntite`. `undefined` quand l'id ne désigne aucun `personnage`, ou un personnage sans fiche : chaque
 * lecteur le DIT (refus nommé de l'infirmerie, faute de `validateScene`).
 *
 * DETTE DITE (#1279 S4-c, décision d'architecture commissionnée à part) : cette dérivation est
 * ÉPHÉMÈRE. Il n'existe aucun registre de Combatants persistants hors combat (`actorIn` =
 * `battle.combatants ?? party`, `state/combatants.ts`), donc ce que la partie ÉCRIRAIT sur cette
 * fiche — un État d'attrition (`SequenceRoundOps.attrition`, appliqué par `sequenceRoundOps` sur des
 * porteurs résolus par `actorIn`), un mouvement de bourse (`creditBourse`/`debitBourse` écrivent
 * dans `party`) — ne s'y déposerait pas. Le lot S4-b est donc en LECTURE SEULE : le PNJ joue de sa
 * fiche, il n'en subit rien. Aucune simulation ne comble ce trou.
 */
export function sceneNpc(scene: Scene | null | undefined, id: string): Combatant | undefined {
  const ent = scene?.entities.find((e) => e.id === id && e.kind === 'personnage');
  const p = ent ? porteurDeFiche(ent) : undefined;
  return ent && p ? fiche(ent, p) : undefined;
}
