import type { GameState } from '../state/store';
import { rolledLocally } from '../noyau/netOwnership';
import type { RollRowData } from './RollShell';

/**
 * CALENDRIER de révélation d'un Test OPPOSÉ à jet FIGÉ (#990) — feuille de PRÉSENTATION : aucune
 * règle, aucune valeur touchée (le jet figé garde ses chiffres exacts, seul son AFFICHAGE est masqué).
 *
 * Masqué jusqu'au jet de réponse (#990) : le jet figé du premier participant s'affiche masqué tant
 * que le répondant n'a pas lancé ; les deux se révèlent à son jet. Confort de jeu.
 *
 * SOURCE UNIQUE du CALENDRIER de découverte, pour tous les sites à jet figé (défense réactive,
 * incantation opposée, étape de cascade `meta.opposed`, Au Contact, Distraire, Empoignade,
 * Désengagement, Marchandage) : un site qui recompose la règle à la main dérive du calendrier. Le
 * MONTAGE de la rangée, lui, vit à la porte `rollRowBuild.ts` (`frozenOpposedRow`) : ici on masque
 * une rangée reçue, on n'en fabrique aucune. Aucun décompte ici — il se périme.
 */

/** Participant d'un flux opposé, réduit à ce que le calendrier lit (id, rangée jouée ou témoin, jet posé). */
export interface OpposedParticipantLike {
  id?: string;
  interactive?: boolean;
  result?: unknown;
}

/**
 * Le RÉPONDANT a-t-il joué ? Formule UNIQUE, mono comme multi (le mono = N=1, même expression) :
 *  - au moins une rangée de CE siège (jouée ET produite ici) → il faut qu'elles aient TOUTES leur jet
 *    (multi acteur : chacun joue à l'aveugle et ne voit qu'après SON propre jet) ;
 *  - aucune rangée de ce siège (SPECTATEUR tiers — coop, siège qui ne tient aucun des jets) → repli
 *    sur la PREMIÈRE réponse posée : il n'y a rien à attendre de lui, il regarde la table ;
 *  - aucun répondant du tout (jet non opposé) → rien à attendre : la ligne se lit normalement.
 */
export function opposedResponded(s: GameState, participants: readonly OpposedParticipantLike[]): boolean {
  if (!participants.length) return true;
  const mine = participants.filter((p) => p.interactive && rolledLocally(s, p.id));
  return mine.length ? mine.every((p) => !!p.result) : participants.some((p) => !!p.result);
}

/** Le jet figé de `ownerId` est-il DÉCOUVERT pour ce siège ? Un siège ne se masque jamais son propre
 *  dé (`rolledLocally`) ; sinon la découverte suit le jet de réponse. */
export function opposedRevealed(s: GameState, ownerId: string | undefined, responded: boolean): boolean {
  return rolledLocally(s, ownerId) || responded;
}

/**
 * Pose le calendrier sur une rangée DÉJÀ MONTÉE — la forme à employer quand la rangée porte aussi
 * son cycle d'influence (rangée du LANCEUR d'une incantation opposée). Elle PRÉSERVE la rangée
 * reçue : le résultat est la rangée d'origine (marque de montage comprise) plus les seules
 * surcharges du masque — rien n'est remonté ici, le montage vit à la porte (`rollRowBuild.ts`).
 *
 * Une rangée MASQUÉE neutralise TOUT ce qui DÉRIVE du résultat. Le CYCLE D'INFLUENCE (Chance,
 * Sombre Pacte, Résilience) n'y est plus éteint drapeau par drapeau : il se DÉRIVE du jet posé, et
 * `RollRow` refuse de dériver quoi que ce soit d'une ligne masquée (`mask: 'roll'`) — le masque
 * POSÉ ICI est ce qui le ferme, par construction. Restent les champs que le site pose lui-même et
 * qui portent le verdict : `reverse` (son `preview` PORTE `{roll, sl, success}`), `resist` (offert
 * sur issue défavorable), `extendedDr` (DR cumulés), `winner` (l'accent gagnant/perdant EST le
 * verdict) et la SOUS-LIGNE `row.note` (issue en clair — canal unique de la rangée). Ce qui ne
 * dérive PAS du résultat traverse intact (`rolled`, `onRoll`, `interactive`, `actor`, ressources…).
 */
export function maskOpposedRow<T extends RollRowData>(
  s: GameState,
  o: { ownerId?: string; responded: boolean },
  row: T,
): T {
  if (opposedRevealed(s, o.ownerId, o.responded)) return row;
  const { d, pending } = row.row;
  const masque = {
    reverse: undefined,
    resist: undefined,
    extendedDr: undefined,
    winner: undefined,
  } satisfies Partial<RollRowData>;
  const ligne = {
    ...row.row,
    note: undefined,
    ...(d ? { d: { ...d, mask: 'roll' as const } } : {}),
    ...(pending ? { pending: { ...pending, mask: 'roll' as const } } : {}),
  };
  return { ...row, row: ligne, ...masque };
}
