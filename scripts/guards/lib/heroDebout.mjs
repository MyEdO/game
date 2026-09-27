// Mécanique de scan du garde-fou « héros DEBOUT » (#1362, lot L1a). La définition CANONIQUE est
// `estDebout` (`src/state/combatants.ts`) = `!isOutOfAction(h) && h.wounds.current > 0`, dont dérive
// l'élection du meneur (`meneurDuMonde`). Recopiée ailleurs, elle refait une seconde définition : le
// jeton dessiné, le regard qui pivote, la lampe portée et le grimpeur cessent de désigner le même
// héros — et une recopie qui oublie l'Inconscient le fait mener.
//
// La détection est une CO-OCCURRENCE, pas une graphie : dans une même INSTRUCTION, le GROUPE
// (`party`) + la moitié « hors d'action » (`dead` ou `isOutOfAction`) + une comparaison de
// `wounds.current` à 0 ou 1. Un scan par graphie ne voyait que 2 formes sur 9 (`>= 1`,
// `dead === false`, `!(dead || … <= 0)`, destructuration, multi-ligne, `!( … <= 0)`, `!== 0` lui
// échappaient). Le GROUPE est ce qui borne la garde à sa classe : le moteur de combat accouple lui
// aussi `dead` et `wounds.current <= 0`, mais pour une AUTRE notion — « vient de tomber à 0 »
// (`applyZeroWounds`, `combatFlow.ts`) ou « réduit la cible à 0 Blessure » (LDB 47 l.340, chaîne de
// rebond) — qui ne se migre PAS vers `estDebout` sans changer la règle. Ce que la garde ne voit pas :
// une recopie sur un alias local déjà détaché du roster (`const heroes = s.party; heroes.find(…)`).
// Module ESM pur, exécutable par `node` nu — même patron que `inBattleFind.mjs` (mécanique ici,
// POLITIQUE dans le test).

import { codeSeul } from './codeSeul.mjs';

/** Le GROUPE : sujet de la classe gardée (roster du store, sous toutes ses formes d'accès). @type {RegExp} */
export const PARTY_RX = /\bparty\b/;

/** La moitié « hors d'action » du prédicat — jeton `dead` (jamais `isDead`, `undead`) ou le canonique
 *  du moteur. Point d'ancrage du scan. @type {RegExp} */
export const HORS_ACTION_RX = /\bdead\b|\bisOutOfAction\b/g;

/** Comparaison des Blessures courantes au seuil de chute (0) ou au premier point (1). @type {RegExp} */
export const WOUNDS_CMP_RX = /\bwounds\s*\??\s*\.\s*current\s*(?:===|!==|==|!=|>=|<=|>|<)\s*[01]\b/;

/** Demi-fenêtre de co-occurrence, en caractères de texte APLATI. Large assez pour un prédicat
 *  multi-ligne, courte assez pour que deux instructions voisines ne s'accouplent pas. */
export const FENETRE = 80;

/**
 * Texte APLATI pour l'analyse : vue CODE SEUL (`codeSeul.mjs`, #1790 — prose et données blanchies
 * sur place), puis retours de ligne et indentations réduits à une espace : un prédicat coupé en deux
 * lignes redevient une expression.
 * Rend aussi, par index de caractère aplati, le numéro de LIGNE d'origine.
 * @param {string} contenu
 * @returns {{ plat: string, ligneDe: (i: number) => number }}
 */
export function aplatir(contenu) {
  const lignes = codeSeul(contenu).split('\n');
  let brut = '';
  /** @type {number[]} */
  const ligneParIndex = [];
  lignes.forEach((l, i) => {
    const morceau = (i ? ' ' : '') + l;
    for (let k = 0; k < morceau.length; k++) ligneParIndex.push(i + 1);
    brut += morceau;
  });
  // Espaces compactés : on garde, index par index, la ligne d'origine du caractère retenu.
  let plat = '';
  /** @type {number[]} */
  const carte = [];
  for (let i = 0; i < brut.length; i++) {
    const c = brut[i];
    if (c === ' ' || c === '\t') {
      if (plat.endsWith(' ')) continue;
      plat += ' ';
    } else plat += c;
    carte.push(ligneParIndex[i]);
  }
  return { plat, ligneDe: (i) => carte[i] ?? carte[carte.length - 1] ?? 1 };
}

/**
 * Fenêtre d'INSTRUCTION autour d'un index : `FENETRE` caractères de part et d'autre, tronquée au `;`
 * le plus proche de chaque côté — deux instructions distinctes ne s'accouplent jamais, même voisines.
 * @param {string} plat @param {number} i @returns {string}
 */
export function fenetreDInstruction(plat, i) {
  const avant = plat.slice(Math.max(0, i - FENETRE), i);
  const apres = plat.slice(i, Math.min(plat.length, i + FENETRE));
  const coupeD = apres.indexOf(';');
  return avant.slice(avant.lastIndexOf(';') + 1) + (coupeD >= 0 ? apres.slice(0, coupeD) : apres);
}

/**
 * Scan complet d'un fichier source : chaque instruction où le groupe, la moitié « hors d'action » et
 * une comparaison de `wounds.current` à 0/1 CO-OCCURRENT. Une instruction n'est rapportée qu'une fois.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanHeroDebout(relPath, contenu) {
  const { plat, ligneDe } = aplatir(contenu);
  /** @type {{ line: number, detail: string }[]} */
  const findings = [];
  const vues = new Set();
  for (const m of plat.matchAll(HORS_ACTION_RX)) {
    const fenetre = fenetreDInstruction(plat, m.index);
    if (!WOUNDS_CMP_RX.test(fenetre) || !PARTY_RX.test(fenetre)) continue;
    const detail = fenetre.trim();
    if (vues.has(detail)) continue;
    vues.add(detail);
    findings.push({ line: ligneDe(m.index), detail });
  }
  return findings;
}
