/**
 * LA FICHE D'UN PORTEUR EN DONNÉES (#3328, #3678) — ce que la fiche d'un combattant montre en statbloc, lu de l'état :
 * son espèce et sa carrière, ses Blessures, ses Points de Destin, de Chance, de Résilience et de Détermination, ses
 * États, son Mouvement et ses Caractéristiques effectifs, ses armes à la valeur de leur Test, ses Points d'Armure
 * effectifs, ses Traits, ses Mutations, ses Compétences à la valeur de leur Test, ses Talents effectifs, ses sorts et
 * ses prières, leur description sous les règles actives, ses possessions, et la source du profil dont il est
 * l'instance ; l'entrée du Codex que nomme chacun de ces termes qui en désigne une (`Renvoyable`). Lecteur PUR, pour
 * tout hôte qui montre la partie.
 */
import type { Jeu } from './etat';
import { porteurParId } from './monde/combatants';
import { nomDIndividu } from './monde/sceneNpc';
import type { NomDIndividu } from '../engine/psych/ciblage';
import { CHAR_KEYS, CHAR_LABELS, LOCALISATIONS_DE_COUP, locationLabel, type CharKey, type Combatant } from '../engine/types';
import { effectiveArmourAt, effectiveChar, forceDuPorteur } from '../engine/characteristics';
import { effectiveMovement } from '../engine/encumbrance';
import { isVehicle } from '../engine/coque';
import { isEngin } from '../engine/structures';
import { isPrayerFamily } from '../engine/combatFeatures/types';
import { effectiveSkillCharKey, testValue } from '../engine/skills';
import { effectiveTalents } from '../engine/talentEffects';
import { effectiveEntry } from '../engine/variants';
import { isWeaponActive, itemLabel } from '../engine/items';
import { attackTestOf } from '../engine/combat';
import { weaponStatParts } from '../engine/weaponStats';
import { resolveQualities } from '../engine/qualities/dispatch';
import { traitLisible } from '../engine/traits/dispatch';
import { formatMoney } from '../engine/money';
import { bourseOf } from '../engine/bourse';
import {
  careerLabelFor,
  charAbr,
  findCreatureById,
  findSpeciesById,
  findSpellById,
  findTalentById,
  findTraitById,
  mentionsParNature,
  qualityRefLabel,
  skillInstanceLabel,
  sourceRefLabel,
  talentConcrete,
} from '../data';
import type { NatureDeMention, SourceRef } from '../data/schemas/grammaire/valeurs';
import { cibleDuCodex, type CibleDuCompendium } from './codex/registry';

/** Une Caractéristique : son abréviation, son nom, sa valeur effective (`effectiveChar`). */
export interface CaracteristiqueDeLaFiche { cle: CharKey; abrege: string; libelle: string; valeur: number }

/** Ce que la fiche nomme d'une entrée du Codex : son nom tel que le joueur le lit, et l'entrée qu'il désigne, instance
 *  comprise (`cibleDuCodex`), `null` sans entrée au Codex. */
export interface Renvoyable { libelle: string; renvoi: CibleDuCompendium | null }

/** Une Compétence : son nom (Spécialisation comprise), la valeur de son Test (`testValue`), la Caractéristique qui
 *  la porte (`effectiveSkillCharKey`) et ses Augmentations. */
export interface CompetenceDeLaFiche extends Renvoyable { valeur: number; caracteristique: CharKey; avances: number }

/** Un Talent effectif (`effectiveTalents`) : son nom, son niveau, sa description sous les règles actives
 *  (`effectiveEntry`), `null` sans description. */
export interface TalentDeLaFiche extends Renvoyable { fois: number; desc: string | null }

/** Une arme tenue ou portée (`Combatant.weapons`) : son nom, la valeur du Test qui l'emploie (`attackTestOf`, à la
 *  même valeur que ses Compétences, `testValue`), ses Dégâts résolus, son Allonge ou sa Portée (`weaponStatParts`) et
 *  ses Atouts et Défauts (`resolveQualities`) ; l'arme désignée par son identité de catalogue (`trappingId`, sinon
 *  `builtinId`). */
export interface ArmeDeLaFiche extends Renvoyable { valeur: number; stats: string[]; qualites: Renvoyable[] }

/** Les Points d'Armure effectifs d'une localisation qui en porte (`effectiveArmourAt`) : son nom (`locationLabel`, à la
 *  forme du corps) et ses PA. */
export interface ArmureDeLaFiche { localisation: string; pa: number }

/** Une entrée nommée du profil (un Trait posé, une Mutation, un sort ou une prière connus) : son nom tel que le joueur
 *  le lit, sa description sous les règles actives, `null` sans description. */
export interface EntreeDeLaFiche extends Renvoyable { desc: string | null }

/** Une possession : l'objet qui la désigne (`uid`, le premier de celles comptées ensemble), son nom (`itemLabel`), si
 *  elle est équipée (une arme : tenue dans le set actif, `isWeaponActive`), combien en sont portées, l'argent qu'elle
 *  tient (`formatMoney`, `null` sans argent), le contenant où elle est rangée (`null` : en vrac) et l'objet du catalogue
 *  qu'elle instancie (`trappingId`). Les possessions de même nom, équipées de même, rangées au même endroit et sans
 *  argent, se comptent ensemble. */
export interface PossessionDeLaFiche extends Renvoyable { uid: string; equipee: boolean; nombre: number; argent: string | null; contenant: string | null }

/** Les mentions d'une nature (`mentionsParNature`) : sa nature, son libellé de rubrique, et chacune, son libellé et son
 *  nombre. */
export interface MentionsDeLaFiche { nature: NatureDeMention; titre: string; mentions: { libelle: string; nombre: number }[] }

/** La fiche d'un porteur. */
export interface FicheDuPorteur {
  id: string;
  nom: string;
  espece: Renvoyable | null;
  carriere: Renvoyable | null;
  blessures: [courant: number, max: number];
  /** Ses Points de Destin, de Chance, de Résilience et de Détermination, `null` pour un porteur qui n'en a pas (une
   *  créature). */
  destin: number | null;
  chance: number | null;
  resilience: number | null;
  determination: number | null;
  etats: { id: string; valeur: number }[];
  /** Sa bourse (`bourseOf`). */
  bourse: string;
  mouvement: number;
  caracteristiques: CaracteristiqueDeLaFiche[];
  armes: ArmeDeLaFiche[];
  armure: ArmureDeLaFiche[];
  traits: EntreeDeLaFiche[];
  mutations: EntreeDeLaFiche[];
  competences: CompetenceDeLaFiche[];
  talents: TalentDeLaFiche[];
  sorts: EntreeDeLaFiche[];
  prieres: EntreeDeLaFiche[];
  possessions: PossessionDeLaFiche[];
  /** Ses mentions (`Combatant.mentions`), par nature. */
  mentions: MentionsDeLaFiche[];
  /** La source du profil dont le porteur est l'instance (`sourceRefLabel`), renvoyée à son livre, `null` sans profil
   *  sourcé (un héros, un statbloc d'auteur). */
  source: Renvoyable | null;
  /** La créature du bestiaire que désigne le porteur (`porteurDeFiche.ref`), `null` sans elle (un héros, un preset,
   *  un statbloc d'auteur). */
  profil: Renvoyable | null;
}

/** La source du profil dont `c` est l'instance (`porteurDeFiche`) : la créature du bestiaire, ou celle d'un preset. */
function sourceDuProfil(c: Combatant): SourceRef | undefined {
  const p = c.porteurDeFiche;
  if (p?.presetCreature) return p.presetCreature.source;
  return p?.ref === undefined ? undefined : findCreatureById(p.ref)?.source;
}

/** Les sorts connus de `c` qui sont des prières (`priere`) ou n'en sont pas (`isPrayerFamily`). */
const sortsConnus = (c: Combatant, priere: boolean): EntreeDeLaFiche[] =>
  (c.spells ?? []).flatMap((id) => {
    const sp = effectiveEntry(findSpellById(id));
    return sp && isPrayerFamily(sp.family) === priere ? [{ libelle: sp.label, renvoi: cibleDuCodex('spells', id, sp.label), desc: sp.desc ?? null }] : [];
  });

/** L'entrée `id` de la catégorie `categorie`, nommée `libelle`. */
const renvoyable = (categorie: string, id: string | undefined, libelle: string): Renvoyable => ({ libelle, renvoi: cibleDuCodex(categorie, id, libelle) });

/** L'en-tête de la fiche : son porteur, sa carrière, ses Blessures et ses États, ce que la carte d'un héros montre. */
export type EnTeteDeFiche = Pick<FicheDuPorteur, 'id' | 'nom' | 'carriere' | 'blessures' | 'etats'>;

/** Le combattant `c` s'il a une fiche : une coque (navire, engin) n'a pas de profil de personnage. */
const aUneFiche = (c: Combatant | undefined): c is Combatant => !!c && !isVehicle(c) && !isEngin(c);

/** L'en-tête de la fiche du combattant `c`, lu sur lui. */
const enTeteDuCombattant = (c: Combatant): EnTeteDeFiche => ({
  id: c.id,
  nom: c.label,
  carriere: c.career ? renvoyable('careers', c.career, careerLabelFor(c)) : null,
  blessures: [c.wounds.current, c.wounds.max],
  etats: c.conditions.map((e) => ({ id: e.id, valeur: e.value })),
});

/** La fiche du porteur `id` (`porteurParId` : le combattant en combat, le héros du groupe hors combat), `null` sans
 *  lui ou pour une coque (`ficheDuCombattant`). PUR. */
export function ficheDuPorteur(s: Jeu, id: string): FicheDuPorteur | null {
  const c = porteurParId(s, id);
  return c ? ficheDuCombattant(c, nomDIndividu(s)) : null;
}

/** L'en-tête de la fiche du porteur `id`, au domaine de `ficheDuPorteur` : `null` sans lui ou pour une coque. PUR. */
export function enTeteDuPorteur(s: Jeu, id: string): EnTeteDeFiche | null {
  const c = porteurParId(s, id);
  return aUneFiche(c) ? enTeteDuCombattant(c) : null;
}

/** La fiche du combattant `c`, les individus que nomment ses Traits par `nom` ; `null` pour une coque (`aUneFiche`). PUR. */
export function ficheDuCombattant(c: Combatant, nom: NomDIndividu): FicheDuPorteur | null {
  if (!aUneFiche(c)) return null;
  const items = c.items ?? [];
  const possessions: PossessionDeLaFiche[] = [];
  for (const it of items) {
    const libelle = itemLabel(it);
    const argent = it.money ? formatMoney(it.money) : null;
    const equipee = it.kind === 'melee' || it.kind === 'distance' ? isWeaponActive(c, it.uid) : it.equipped;
    const sac = it.inside ? items.find((i) => i.uid === it.inside) : undefined;
    const contenant = sac ? itemLabel(sac) : null;
    const meme = argent === null ? possessions.find((p) => p.libelle === libelle && p.equipee === equipee && items.find((i) => i.uid === p.uid)?.inside === it.inside && p.argent === null) : undefined;
    if (meme) meme.nombre += it.qty ?? 1;
    else possessions.push({ uid: it.uid, ...renvoyable('trappings', it.trappingId, libelle), equipee, nombre: it.qty ?? 1, argent, contenant });
  }
  const force = forceDuPorteur(c);
  const source = sourceDuProfil(c);
  const creature = c.porteurDeFiche?.ref === undefined ? undefined : findCreatureById(c.porteurDeFiche.ref);
  const espece = findSpeciesById(c.species);
  return {
    ...enTeteDuCombattant(c),
    espece: espece ? renvoyable('races', espece.id, espece.label) : null,
    destin: c.fate ?? null,
    chance: c.fortune ?? null,
    resilience: c.resilience ?? null,
    determination: c.resolve ?? null,
    bourse: formatMoney(bourseOf(c)),
    mouvement: effectiveMovement(c),
    caracteristiques: CHAR_KEYS.map((cle) => ({ cle, abrege: charAbr(cle), libelle: CHAR_LABELS[cle], valeur: effectiveChar(c, cle) })),
    armes: c.weapons.map((w) => ({
      ...renvoyable('trappings', w.trappingId ?? w.builtinId, w.label), valeur: testValue(c, attackTestOf(c, w, w.type)), stats: weaponStatParts(w, force),
      qualites: resolveQualities(w).map((q) => renvoyable('qualities', q.id, qualityRefLabel({ id: q.id, value: q.indice }))),
    })),
    armure: LOCALISATIONS_DE_COUP.flatMap((l) => {
      const pa = effectiveArmourAt(c, l);
      return pa > 0 ? [{ localisation: locationLabel(l, c.bodyShape), pa }] : [];
    }),
    traits: (c.traits ?? []).map((tp) => ({ ...renvoyable('traits', tp.id, traitLisible(tp, nom)), desc: effectiveEntry(findTraitById(tp.id))?.desc ?? null })),
    mutations: (c.mutations ?? []).map((m) => ({ ...renvoyable('mutations', m.id, m.label), desc: m.desc ?? null })),
    competences: c.skills.map((sk) => ({
      ...renvoyable('skills', sk.id, skillInstanceLabel(sk)), valeur: testValue(c, { skill: sk }),
      caracteristique: effectiveSkillCharKey(c, { skill: sk }), avances: sk.advances,
    })),
    talents: effectiveTalents(c).map((tt) => ({ ...renvoyable('talents', tt.talentId, talentConcrete(tt)), fois: tt.times, desc: effectiveEntry(findTalentById(tt.talentId))?.desc ?? null })),
    sorts: sortsConnus(c, false),
    prieres: sortsConnus(c, true),
    possessions,
    mentions: mentionsParNature(c.mentions ?? []).map(({ nature, titre, mentions }) => ({ nature, titre, mentions: mentions.map((m) => ({ libelle: m.label, nombre: m.nombre })) })),
    source: source ? renvoyable('books', source.book, sourceRefLabel(source)) : null,
    profil: creature ? renvoyable('creatures', creature.id, creature.label) : null,
  };
}
