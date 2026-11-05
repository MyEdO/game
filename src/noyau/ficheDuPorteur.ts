/**
 * LA FICHE D'UN PORTEUR EN DONNÉES (#3328) — ce que la fiche d'un héros montre, lu de l'état : ses Blessures, ses
 * Points de Destin, de Chance, de Résilience et de Détermination, ses États, ses Caractéristiques effectives, ses
 * Compétences à la valeur de leur Test, ses Talents effectifs et leur description sous les règles actives, ses
 * possessions. Lecteur PUR, pour tout hôte qui montre la partie.
 */
import type { Jeu } from './etat';
import { porteurParId } from './monde/combatants';
import { CHAR_KEYS, CHAR_LABELS, type CharKey } from '../engine/types';
import { effectiveChar } from '../engine/characteristics';
import { effectiveSkillCharKey, valeurDuTest } from '../engine/skills';
import { effectiveTalents } from '../engine/talentEffects';
import { effectiveEntry } from '../engine/variants';
import { itemLabel } from '../engine/items';
import { formatMoney } from '../engine/money';
import { charAbr, findTalentById, skillInstanceLabel, talentConcrete } from '../data';

/** Une Caractéristique : son abréviation, son nom, sa valeur effective (`effectiveChar`). */
export interface CaracteristiqueDeLaFiche { cle: CharKey; abrege: string; libelle: string; valeur: number }

/** Une Compétence : son nom (Spécialisation comprise), la valeur de son Test (`valeurDuTest`), la Caractéristique qui
 *  la porte (`effectiveSkillCharKey`) et ses Augmentations. */
export interface CompetenceDeLaFiche { libelle: string; valeur: number; caracteristique: CharKey; avances: number }

/** Un Talent effectif (`effectiveTalents`) : son nom, son niveau, sa description sous les règles actives
 *  (`effectiveEntry`), `null` sans description. */
export interface TalentDeLaFiche { libelle: string; fois: number; description: string | null }

/** Une possession : son nom (`itemLabel`), si elle est équipée, combien en sont portées, et l'argent qu'elle tient
 *  (`formatMoney`, `null` sans argent). Les possessions de même nom, équipées de même et sans argent, se comptent
 *  ensemble. */
export interface PossessionDeLaFiche { libelle: string; equipee: boolean; nombre: number; argent: string | null }

/** La fiche d'un porteur. */
export interface FicheDuPorteur {
  id: string;
  nom: string;
  blessures: [courant: number, max: number];
  destin: number;
  chance: number;
  resilience: number;
  determination: number;
  etats: { id: string; valeur: number }[];
  caracteristiques: CaracteristiqueDeLaFiche[];
  competences: CompetenceDeLaFiche[];
  talents: TalentDeLaFiche[];
  possessions: PossessionDeLaFiche[];
}

/** La fiche du porteur `id` (`porteurParId` : le combattant en combat, le héros du groupe hors combat), `null` sans
 *  lui. PUR. */
export function ficheDuPorteur(s: Jeu, id: string): FicheDuPorteur | null {
  const c = porteurParId(s, id);
  if (!c) return null;
  const possessions: PossessionDeLaFiche[] = [];
  for (const it of c.items ?? []) {
    const libelle = itemLabel(it);
    const argent = it.money ? formatMoney(it.money) : null;
    const meme = argent === null ? possessions.find((p) => p.libelle === libelle && p.equipee === it.equipped && p.argent === null) : undefined;
    if (meme) meme.nombre += it.qty ?? 1;
    else possessions.push({ libelle, equipee: it.equipped, nombre: it.qty ?? 1, argent });
  }
  return {
    id: c.id,
    nom: c.label,
    blessures: [c.wounds.current, c.wounds.max],
    destin: c.fate ?? 0,
    chance: c.fortune ?? 0,
    resilience: c.resilience ?? 0,
    determination: c.resolve ?? 0,
    etats: c.conditions.map((e) => ({ id: e.id, valeur: e.value })),
    caracteristiques: CHAR_KEYS.map((cle) => ({ cle, abrege: charAbr(cle), libelle: CHAR_LABELS[cle], valeur: effectiveChar(c, cle) })),
    competences: c.skills.map((sk) => ({
      libelle: skillInstanceLabel(sk), valeur: valeurDuTest(c, { skill: { id: sk.id, spec: sk.spec } }),
      caracteristique: effectiveSkillCharKey(c, sk.id, { spec: sk.spec }), avances: sk.advances,
    })),
    talents: effectiveTalents(c).map((tt) => ({ libelle: talentConcrete(tt), fois: tt.times, description: effectiveEntry(findTalentById(tt.talentId))?.desc ?? null })),
    possessions,
  };
}
