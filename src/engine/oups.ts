/**
 * Maladresses — Livre de base, « Maladresses » (14-_GoBack.md l.53-57). Une Maladresse = Test de
 * combat ÉCHOUÉ dont le d100 est un double (miroir du Critique = double réussi). Déclenche le
 * Tableau des Oups !, ou un Incident de Tir (arme à Poudre noire + jet pair → explosion, l.56-57).
 */
import { d100, RNG, defaultRNG, type DiceSpec } from './dice';
import { findTableEntry } from './tables';
import { isDoubleRoll } from './tests';
import { Combatant, Weapon } from './types';
import { oupsTable, oupsMisfire, OupsKind } from '../data/oups';
import { isFirearmQuality, hasQuality, isUnbreakable } from './qualities/dispatch';
import { solideSaveThreshold, sauvegardeImperdable } from './weaponDamage';
import { TABLE_SALVE_MISFIRE, D10_SALVE_MISFIRE } from './artilleryMisfire';
import type { DemandeDe } from './ops';
import { formatWardSave, type SourceDeSauvegarde } from './traits/dispatch';
import { t } from '../i18n';

export interface OupsResolved {
  roll: number;
  kind: OupsKind | 'misfire';
  label: string;
}

/** Une Maladresse = jet d100 raté ET (double (11,22,…,99,00), OU — Doigts amputés, LDB 18 l.251 — chiffre
 *  des unités du jet ∈ [1..fingersLost] si le Test implique une main où `fingersLost` doigts ont été
 *  perdus). `fingersLost` omis/0 = comportement d'origine (LDB 14 l.19). */
export function isFumble(roll: number, success: boolean, fingersLost = 0): boolean {
  if (success) return false;
  if (isDoubleRoll(roll)) return true;
  if (fingersLost <= 0) return false;
  const unit = roll % 10;
  return unit >= 1 && unit <= fingersLost;
}

/** Arme à Poudre noire / explosive (Incident de Tir, l.56-57). On détecte la famille « Poudre noire ». */
function isFirearm(w: Weapon | undefined): boolean {
  if (!w) return false;
  return /poudre|explos/i.test(w.subType ?? '') || isFirearmQuality(w);
}

/** Tire sur le Tableau des Oups ! ; Incident de Tir prioritaire (arme à poudre + jet PAIR). */
export function rollOups(weapon: Weapon | undefined, rng: RNG = defaultRNG): OupsResolved {
  const roll = d100(rng);
  if (isFirearm(weapon) && roll % 2 === 0) {
    return { roll, kind: 'misfire', label: oupsMisfire().label };
  }
  const entry = findTableEntry(oupsTable(), roll);
  return { roll, kind: entry.kind, label: entry.label };
}

/** LA LECTURE que la porte fera du dé demandé par la grappe (#1508 T3b-4) : un SEUIL « 1d10 ≥ Indice »
 *  (la Sauvegarde Solide, `LDB 60 l.30`) ou une TABLE (les Incidents de Tir par Salve, `AA 10 l.270`).
 *  Le moteur DIT la lecture ; la porte sait seule ouvrir l'étape qui la porte. */
export type LectureDeCasse =
  | { kind: 'seuil'; indice: number; source: SourceDeSauvegarde }
  | { kind: 'table'; tableId: string };

/** UN dé de la grappe d'une casse d'arme — `DemandeDe` (forme du canal op → porte) + sa LECTURE. */
export type DemandeDeCasse = DemandeDe & { lecture: LectureDeCasse };

/** La qualité qui OFFRE la sauvegarde contre la cassure instantanée (`LDB 60 l.30`) — id STABLE. */
export const SOURCE_SOLIDE: SourceDeSauvegarde = { kind: 'qualite', id: 'solide' };

const D10_SOLIDE: DiceSpec = { n: 1, sides: 10 };

/** Le SEUIL de la Sauvegarde Solide de l'arme TENUE, ou `null` quand il n'y a pas de sauvegarde à
 *  jouer : arme non Solide, ou Incassable (`LDB 62 l.262` — ni dégât ni destruction, donc aucun dé).
 *  L'`ItemInstance` SOURCE fait foi pour Incassable, comme à l'usure (`combatFlow.wearActiveWeapon`). */
function seuilSolide(c: Combatant, weapon: Weapon): number | null {
  const it = weapon.uid ? (c.items ?? []).find((i) => i.uid === weapon.uid) : undefined;
  if (isUnbreakable(it ?? weapon)) return null;
  const thr = solideSaveThreshold(weapon);
  // Un seuil imperdable ne DEMANDE pas de dé : un dé qui ne décide rien ne s'ouvre pas (`LDB 60 l.30`).
  return thr != null && sauvegardeImperdable(thr) ? null : thr;
}

/** Le porteur MISE UN OBJET : l'étape le NOMME, sans quoi un héros à deux armes ne sait pas laquelle
 *  son dé décide (le journal ne le dit qu'après coup). Le libellé est de l'AFFICHAGE ; la clé (`cle`)
 *  reste l'identité de la demande. */
const deSolide = (cle: string, indice: number, arme: string): DemandeDeCasse =>
  ({ cle, spec: D10_SOLIDE, libelle: t('step.sauvegardeSolide', { weapon: arme }), lecture: { kind: 'seuil', indice, source: SOURCE_SOLIDE } });

/** LA LIGNE de journal d'une Sauvegarde Solide (`LDB 60 l.30`) — ÉCRITURE UNIQUE de ses issues : le dé
 *  lu en seuil (`de`), ou le seuil imperdable, qui n'ouvre aucun dé (`de` absent). */
export function ligneDeSolide(arme: string, seuil: { indice: number; source: SourceDeSauvegarde }, de?: number): string {
  const trait = formatWardSave(seuil.source, seuil.indice);
  if (de == null) return t('cf.solideImperdable', { weapon: arme, trait });
  return t(de >= seuil.indice ? 'cf.solideResists' : 'cf.solideBreaks', { weapon: arme, roll: de, trait });
}

/**
 * LES DÉS QUE CETTE MALADRESSE DEMANDE À LA PORTE (#1508 T3b-4) — PURE et ORDONNÉE, elle ne rend que
 * les demandes CONNAISSABLES avec les dés déjà tombés (`des`), patron de `ops.demandesDeDes` : le dé
 * suivant peut dépendre de ce que le précédent a posé.
 *
 *  - `bacle-solide`   : Bâclé casse l'arme sur toute Maladresse (`LDB 60 l.50`) → sauvegarde Solide ;
 *  - `misfire-solide` : l'Incident de tir détruit l'arme (`LDB 14 l.34`) → sauvegarde Solide ;
 *  - `salve-table`    : une arme à Atout *Salve* tire EN PLUS sur sa table (`AA 10 l.264`).
 *
 * UNE sauvegarde Solide par Incident : la destruction du tableau de Salve (`AA 10 l.274-276`) est
 * couverte par celle de l'Incident — arbitrage utilisateur sur #1508 (commentaire du 2026-09-26),
 * « Une sauvegarde par Incident (Recommended) ». Une sauvegarde RATÉE condamne l'arme : aucune
 * sauvegarde ne se redemande derrière elle (`LDB 60 l.30`).
 *
 * L'applier prend la PREMIÈRE non servie (`.filter((d) => !des.has(d.cle))[0]`) ; `des` complet → `[]`,
 * et la Maladresse s'applique.
 */
export function desDOups(c: Combatant, weapon: Weapon, r: OupsResolved, des: Map<string, number>): DemandeDeCasse[] {
  const out: DemandeDeCasse[] = [];
  let indice = seuilSolide(c, weapon);
  const sauvegarde = (cle: string): void => {
    if (indice == null) return;
    const demande = deSolide(cle, indice, weapon.label);
    out.push(demande);
    const tombe = des.get(cle);
    if (demande.lecture.kind === 'seuil' && tombe != null && tombe < demande.lecture.indice) indice = null; // condamnée
  };
  if (hasQuality(weapon, 'bacle')) sauvegarde('bacle-solide');
  if (r.kind !== 'misfire') return out;
  sauvegarde('misfire-solide');
  if (hasQuality(weapon, 'salve')) out.push({ cle: 'salve-table', spec: D10_SALVE_MISFIRE, libelle: t('step.salveMisfire', { weapon: weapon.label }), lecture: { kind: 'table', tableId: TABLE_SALVE_MISFIRE } });
  return out;
}

/**
 * LE DÉ de la Sauvegarde Solide d'une lame que le Piège-lame BRISE (`LDB 62 l.280` : « à moins qu'elle
 * ne possède l'Atout Incassable » ; `LDB 60 l.30` nomme justement la Lame piégée comme la source de
 * cassure instantanée contre laquelle Solide sauve). MÊME lecture, MÊME forme que la grappe d'une
 * Maladresse : une seule écriture de la sauvegarde d'un objet. `[]` = aucun dé à jouer.
 */
export function desDeBrisDeLame(porteur: Combatant, weapon: Weapon): DemandeDeCasse[] {
  const indice = seuilSolide(porteur, weapon);
  return indice == null ? [] : [deSolide('bladetrap-solide', indice, weapon.label)];
}
