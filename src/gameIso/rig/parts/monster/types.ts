import type { PartArt } from '../types';

/** Emplacement d'une part monstrueuse. Têtes = repère os `tete` ; bras = os `epaule` (asymétrie
 *  native, on remplace UN bras) ; jambe = os `cuisse` (symétrique). */
export type MonsterPartSlot = 'tete' | 'bras' | 'jambe';

/**
 * Une part monstrueuse = un fichier `defs/<clé>.ts`. Remplace la triple-saisie d'avant
 * (type union + Record + tableau _OPTIONS) : déposer un fichier suffit.
 *   - `key`   : clé libre référencée par MonsterParts (tete/brasG/brasD/jambes) et l'éditeur.
 *   - `label` : libellé FR pour le sélecteur de l'éditeur.
 *   - `order` : ordre d'affichage dans le sélecteur (croissant ; défaut = fin de liste).
 *   - `art`   : SVG. Têtes = PartArt orienté {front,back,profile} ; bras/jambe = string (1 vue).
 *   - `cornes`/`queue` (têtes) : calque de cornes/queue DÉCLARÉ par la tête (bovine, démon, rat…) —
 *     lu par `monsterInjection` quand `MonsterParts.cornes`/`.queue` est vrai (plus de name-matcher).
 */
export type MonsterPartDef = {
  slot: MonsterPartSlot;
  key: string;
  label: string;
  order?: number;
  art: PartArt;
  /** Cornes/queue = id du registre UNIQUE `APPENDAGES` (art orienté) — résolu PAR VUE via `viewOrFront`
   *  dans monsterInjection. Même source que les cornes de `features` de créature (aucun art inline). */
  cornes?: string;
  queue?: string;
};
