import type { RollRowData } from './RollShell';

/**
 * MASQUE d'affichage d'un Test OPPOSÉ à jet FIGÉ (#990) — feuille de PRÉSENTATION : aucune règle,
 * aucune valeur touchée (le jet figé garde ses chiffres exacts, seul son AFFICHAGE est masqué). Le
 * CALENDRIER (révélé ou non, pour ce siège) se décide au noyau, `netOwnership.jetFigeRevele` ; ici on
 * masque une rangée reçue, on n'en fabrique aucune (le MONTAGE vit à `rollRowBuild.ts`,
 * `frozenOpposedRow`).
 */

/**
 * Pose le verdict du calendrier (`revele`, de `jetFigeRevele`) sur une rangée DÉJÀ MONTÉE — la forme
 * à employer quand la rangée porte aussi son cycle d'influence (rangée du LANCEUR d'une incantation opposée). Elle PRÉSERVE la rangée
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
export function maskOpposedRow<T extends RollRowData>(revele: boolean, row: T): T {
  if (revele) return row;
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
