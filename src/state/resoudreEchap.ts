/**
 * COUTURE UNIQUE DU CONGÉDIEMENT (#1476) — tout appui d'annulation (Échap au clavier, B à la
 * manette) passe par ici, quel que soit l'écran.
 *
 * Deux étages, dans cet ordre :
 *  1. LA PILE DES COUCHES (`dismissStack`) — surfaces ouvertes par-dessus le jeu (modales,
 *     popovers, panneaux-paramètre, dialogue). Dès qu'une couche existe, elle prend l'appui : LIFO
 *     pur, et un refus/blocage s'arrête là (jamais de cascade vers la couche suivante).
 *  2. L'ÉCHELLE MÉTIER du registre (`intent-cancel` → `cursor-cancel` → … → `toggle-menu`),
 *     inchangée : le 1ᵉʳ raccourci d'Échap que la porte commune du registre laisse passer
 *     (`bindingApplies` : couche du dialogue, puis `when`).
 *
 * UN APPUI, UNE PRISE : tant que la touche n'est pas relâchée, elle appartient à ce qui l'a prise —
 * la répétition automatique du clavier ne la passe jamais à un AUTRE (#1411 P0-A). La mémoire est
 * ici, et non chez l'appelant, parce que la pile peut se vider EN COURS d'appui (la couche fermée
 * rend la main au registre) : sans mémoire partagée, la répétition suivante ouvrirait le menu.
 */
import type { GameState } from './store';
import { KEYBINDINGS, bindingApplies, effectiveCodes, effectiveMods, modsMatch, CODE_ECHAP, type KeyMod } from './keybindings';
import { dismissStackSize, dismissTop } from './dismissStack';

/** Jeton de prise quand c'est la PILE qui a répondu (aucun id de raccourci ne peut le valoir). */
export const PRISE_COUCHE = 'couche';

let prise: string | null = null;

/** Relâchement de la touche : elle est rendue à qui la réclamera au prochain appui. */
export function echapRelachee(): void {
  prise = null;
}

export interface OptionsEchap {
  /** Un contrôle (bouton/lien) a le focus : les raccourcis `notWhenControlFocused` se taisent. */
  controlFocused?: boolean;
  /** Répétition automatique du clavier (`KeyboardEvent.repeat`) — jamais vrai pour la manette. */
  repeat?: boolean;
  /** Modificateurs tenus pendant l'appui — défaut AUCUN (le B de la manette n'en porte pas). */
  mods?: readonly KeyMod[];
}

/**
 * Résout un appui d'annulation. Rend le JETON de ce qui a pris la touche (`PRISE_COUCHE` ou l'id du
 * raccourci), ou `null` si rien ne la réclame — l'appelant en déduit s'il doit la consommer.
 */
export function resoudreEchap(get: () => GameState, { controlFocused = false, repeat = false, mods = [] }: OptionsEchap = {}): string | null {
  if (dismissStackSize() > 0) {
    if (repeat && prise !== null && prise !== PRISE_COUCHE) return prise;
    if (!repeat) dismissTop(); // une pression = au plus UNE fermeture
    prise = PRISE_COUCHE;
    return PRISE_COUCHE;
  }
  const s = get();
  const b = KEYBINDINGS.find(
    (k) =>
      effectiveCodes(k, s.keyOverrides).includes(CODE_ECHAP) &&
      modsMatch(effectiveMods(k, s.keyOverrides), mods, CODE_ECHAP) &&
      (!k.notWhenControlFocused || !controlFocused) &&
      bindingApplies(k, s),
  );
  if (!b) return null;
  if (repeat && prise !== null && prise !== b.id) return prise;
  if (!repeat) prise = b.id;
  if (repeat && (b.runUp || b.unePression)) return b.id;
  b.run(get);
  return b.id;
}
