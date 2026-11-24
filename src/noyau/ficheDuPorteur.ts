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
import { porteurParId, rencontreEngagee } from './monde/combatants';
import { objetDuNarratif, presetDuNarratif } from './monde/resolveursDuNarratif';
import { ficheDuPersonnage, nomDIndividu } from './monde/sceneNpc';
import { nomDe } from '../engine/nom';
import {
  entiteConnue,
  nomEnVue,
  nomObserve,
} from './visionDuGroupe';
import type { NomDIndividu } from '../engine/psych/ciblage';
import { CHAR_KEYS, CHAR_LABELS, LOCALISATIONS_DE_COUP, locationLabel, type CharKey, type Combatant, type HitLocation } from '../engine/types';
import { effectiveArmourAt, effectiveChar, forceDuPorteur } from '../engine/characteristics';
import { effectiveMovement } from '../engine/encumbrance';
import { isVehicle } from '../engine/coque';
import { isEngin } from '../engine/structures';
import { isPrayerFamily } from '../engine/combatFeatures/types';
import { effectiveSkillCharKey, testValue } from '../engine/skills';
import { effectiveTalents } from '../engine/talentEffects';
import { effectiveEntry } from '../engine/variants';
import { isWearable, itemLabel } from '../engine/items';
import { isHeld, isWeaponActive } from '../engine/weaponLoad';
import { attackTestOf } from '../engine/combat';
import { profilDArme, type ProfilDArme } from '../engine/weaponStats';
import { resolveQualities } from '../engine/qualities/dispatch';
import { traitLisible } from '../engine/traits/dispatch';
import type { Money } from '../engine/money';
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
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { jsonCanonique } from '../lib/jsonCanonique.mjs';
import { cibleDuCodex, type CibleDuCompendium } from './codex/registry';
import type { PlayerText } from '../i18n/playerText';

/** Une Caractéristique : son abréviation, son nom, sa valeur effective (`effectiveChar`). */
export interface CaracteristiqueDeLaFiche { cle: CharKey; abrege: string; libelle: string; valeur: number }

/** Ce que la fiche nomme d'une entrée du Codex : son nom tel que le joueur le lit, et l'entrée qu'il désigne, instance
 *  comprise (`cibleDuCodex`), `null` sans entrée au Codex. */
export interface Renvoyable { libelle: string; renvoi: CibleDuCompendium | null }

/** Une Compétence : son id et sa Spécialisation (`RefDesignee`), son nom (Spécialisation comprise), la valeur de son
 *  Test (`testValue`), la Caractéristique qui la porte (`effectiveSkillCharKey`) et ses Augmentations. */
export interface CompetenceDeLaFiche extends Renvoyable, RefDesignee { valeur: number; caracteristique: CharKey; avances: number }

/** Un Talent effectif (`effectiveTalents`) : son nom, son niveau, sa description sous les règles actives
 *  (`effectiveEntry`), `null` sans description. */
export interface TalentDeLaFiche extends Renvoyable { fois: number; desc: string | null }

/** Une arme tenue ou portée (`Combatant.weapons`) : son nom, la valeur du Test qui l'emploie (`attackTestOf`, à la
 *  même valeur que ses Compétences, `testValue`), son profil pour son porteur (`profilDArme`) et ses Atouts et Défauts
 *  (`resolveQualities`) ; l'arme désignée par son identité de catalogue (`trappingId`, sinon `builtinId`). */
export interface ArmeDeLaFiche extends Renvoyable { valeur: number; profil: ProfilDArme; qualites: Renvoyable[] }

/** Les Points d'Armure effectifs d'une localisation qui en porte (`effectiveArmourAt`) : la localisation, son id et son
 *  nom à la forme du corps (`locationLabel`), et ses PA. */
export interface ArmureDeLaFiche { localisation: { id: HitLocation; nom: PlayerText }; pa: number }

/** Une entrée nommée du profil (un Trait posé, une Mutation, un sort ou une prière connus) : son nom tel que le joueur
 *  le lit, sa description sous les règles actives, `null` sans description. */
export interface EntreeDeLaFiche extends Renvoyable { desc: string | null }

/** Une possession : l'objet qui la désigne (`uid`, le premier de celles comptées ensemble), son nom (`itemLabel`), si
 *  elle est équipée (une arme : tenue dans le set actif, `isWeaponActive` ; ce qui se porte : portée ou tenue, `isHeld`),
 *  combien en sont portées, l'argent qu'elle tient (`null` sans argent), le contenant où elle est rangée, son `uid` et
 *  son nom (`null` : en vrac), et l'objet du catalogue qu'elle instancie (`trappingId`). Des instances égales hors `uid`
 *  et `qty`, équipées de même, qui ne tiennent ni argent ni objet (`container`), se comptent ensemble. */
export interface PossessionDeLaFiche extends Renvoyable {
  uid: string;
  equipee: boolean;
  nombre: number;
  argent: Money | null;
  contenant: { uid: string; nom: string } | null;
}

/** Les mentions d'une nature (`mentionsParNature`) : sa nature, son libellé de rubrique, et chacune, son libellé et son
 *  nombre. */
export interface MentionsDeLaFiche { nature: NatureDeMention; titre: string; mentions: { libelle: string; nombre: number }[] }

/** La fiche d'un porteur. */
export interface FicheDuPorteur {
  id: string;
  nom: PlayerText;
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
  bourse: Money;
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
    return sp && isPrayerFamily(sp.family) === priere ? [{ libelle: sp.label, renvoi: cibleDuCodex('spells', id), desc: sp.desc ?? null }] : [];
  });

/** L'entrée `id` de la catégorie `categorie`, nommée `libelle`. */
const renvoyable = (categorie: string, id: string | undefined, libelle: string): Renvoyable => ({ libelle, renvoi: cibleDuCodex(categorie, id) });
/** Le terme `libelle` d'une instance de l'entrée `id` de `categorie` (Spécialisation, Indice, niveau, page), qui la
 *  renvoie sous son nom. */
const instance = (categorie: string, id: string | undefined, libelle: string): Renvoyable => ({ libelle, renvoi: cibleDuCodex(categorie, id, libelle) });

/** L'en-tête de la fiche : son porteur, sa carrière, ses Blessures et ses États, ce que la carte d'un héros montre. */
export type EnTeteDeFiche = Pick<FicheDuPorteur, 'id' | 'nom' | 'carriere' | 'blessures' | 'etats'>;

/** Le combattant `c` s'il a une fiche : une coque (navire, engin) n'a pas de profil de personnage. */
const aUneFiche = (c: Combatant | undefined): c is Combatant => !!c && !isVehicle(c) && !isEngin(c);

/** L'en-tête de la fiche du combattant `c`, lu sur lui, sous le nom `nom`. */
const enTeteDuCombattant = (c: Combatant, nom: PlayerText): EnTeteDeFiche => ({
  id: c.id,
  nom,
  carriere: c.career ? instance('careers', c.career, careerLabelFor(c)) : null,
  blessures: [c.wounds.current, c.wounds.max],
  etats: c.conditions.map((e) => ({ id: e.id, valeur: e.value })),
});

/** Le porteur de la fiche : le combattant de la partie ou le personnage de la scène en vue hors rencontre. */
function porteurDeLaFiche(s: Jeu, id: string): Combatant | undefined {
  const porteur = porteurParId(s, id);
  if (porteur || rencontreEngagee(s)) return porteur;
  const entite = s.scene?.entities.find((e) => e.id === id && e.kind === 'personnage');
  return entite && entiteConnue(s, entite) ? ficheDuPersonnage(entite, presetDuNarratif(s.campaignNarratif), objetDuNarratif(s.campaignNarratif)) : undefined;
}

/** La fiche du porteur `id`, `null` sans porteur ou pour une coque (`ficheDuCombattant`). PUR. */
export function ficheDuPorteur(s: Jeu, id: string): FicheDuPorteur | null {
  const c = porteurDeLaFiche(s, id);
  return c ? ficheDuCombattant(c, nomDIndividu(s)) : null;
}

/** L'en-tête de la fiche du porteur `id`, au domaine de `ficheDuPorteur` : `null` sans lui ou pour une coque. PUR. */
export function enTeteDuPorteur(s: Jeu, id: string): EnTeteDeFiche | null {
  const c = porteurDeLaFiche(s, id);
  return aUneFiche(c) ? enTeteDuCombattant(c, nomEnVue(s, id) ?? nomObserve(c)) : null;
}

/** La fiche du combattant `c`, les individus que nomment ses Traits par `nom` ; `null` pour une coque (`aUneFiche`). PUR. */
export function ficheDuCombattant(c: Combatant, nom: NomDIndividu): FicheDuPorteur | null {
  if (!aUneFiche(c)) return null;
  const items = c.items ?? [];
  const possessions: PossessionDeLaFiche[] = [];
  const empilables = new Map<string, PossessionDeLaFiche>();
  for (const it of items) {
    const equipee = (it.kind === 'melee' || it.kind === 'distance') && !isWearable(it) ? isWeaponActive(c, it.uid) : isHeld(c, it);
    const cle = it.money || it.container ? null : `${equipee}|${jsonCanonique({ ...it, uid: undefined, qty: undefined })}`;
    const meme = cle === null ? undefined : empilables.get(cle);
    if (meme) {
      meme.nombre += it.qty ?? 1;
      continue;
    }
    const sac = it.inside ? items.find((i) => i.uid === it.inside) : undefined;
    const possession = {
      uid: it.uid, ...renvoyable('trappings', it.trappingId, itemLabel(it)), equipee, nombre: it.qty ?? 1,
      argent: it.money ?? null, contenant: sac ? { uid: sac.uid, nom: itemLabel(sac) } : null,
    };
    possessions.push(possession);
    if (cle !== null) empilables.set(cle, possession);
  }
  const force = forceDuPorteur(c);
  const source = sourceDuProfil(c);
  const creature = c.porteurDeFiche?.ref === undefined ? undefined : findCreatureById(c.porteurDeFiche.ref);
  const espece = findSpeciesById(c.species);
  return {
    ...enTeteDuCombattant(c, nomDe(c)),
    espece: espece ? renvoyable('races', espece.id, espece.label) : null,
    destin: c.fate ?? null,
    chance: c.fortune ?? null,
    resilience: c.resilience ?? null,
    determination: c.resolve ?? null,
    bourse: bourseOf(c),
    mouvement: effectiveMovement(c),
    caracteristiques: CHAR_KEYS.map((cle) => ({ cle, abrege: charAbr(cle), libelle: CHAR_LABELS[cle], valeur: effectiveChar(c, cle) })),
    armes: c.weapons.map((w) => ({
      ...renvoyable('trappings', w.trappingId ?? w.builtinId, w.label), valeur: testValue(c, attackTestOf(c, w, w.type)), profil: profilDArme(w, force),
      qualites: resolveQualities(w).map((q) => instance('qualities', q.id, qualityRefLabel(q.instance))),
    })),
    armure: LOCALISATIONS_DE_COUP.flatMap((l) => {
      const pa = effectiveArmourAt(c, l);
      return pa > 0 ? [{ localisation: { id: l, nom: locationLabel(l, c.bodyShape) }, pa }] : [];
    }),
    traits: (c.traits ?? []).map((tp) => ({ ...instance('traits', tp.id, traitLisible(tp, nom)), desc: effectiveEntry(findTraitById(tp.id))?.desc ?? null })),
    mutations: (c.mutations ?? []).map((m) => ({ ...renvoyable('mutations', m.id, m.label), desc: m.desc ?? null })),
    competences: c.skills.map((sk) => ({
      ...instance('skills', sk.id, skillInstanceLabel(sk)), id: sk.id, ...(sk.spec === undefined ? {} : { spec: sk.spec }), valeur: testValue(c, { skill: sk }),
      caracteristique: effectiveSkillCharKey(c, { skill: sk }), avances: sk.advances,
    })),
    talents: effectiveTalents(c).map((tt) => ({ ...instance('talents', tt.talentId, talentConcrete(tt)), fois: tt.times, desc: effectiveEntry(findTalentById(tt.talentId))?.desc ?? null })),
    sorts: sortsConnus(c, false),
    prieres: sortsConnus(c, true),
    possessions,
    mentions: mentionsParNature(c.mentions ?? []).map(({ nature, titre, mentions }) => ({ nature, titre, mentions: mentions.map((m) => ({ libelle: m.label, nombre: m.nombre })) })),
    source: source ? instance('books', source.book, sourceRefLabel(source)) : null,
    profil: creature ? renvoyable('creatures', creature.id, creature.label) : null,
  };
}
