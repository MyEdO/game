// Mécanique de scan du garde-fou anti-son-fantôme (#321 lentille 2) : toute réf littérale
// `playSfx('x')` doit résoudre dans le registre de sons généré (`src/data/sons/_registry.generated.ts`).
// Module ESM pur — consommé par `src/audio/no-phantom-sound.test.ts` (POLICY : répertoires scannés).

/** Réf littérale `playSfx('id')` — ≠ accès dynamique (`playSfx(x)`). @type {RegExp} */
const SOUND_REF_RE = /\bplaySfx\(\s*['"]([A-Za-z0-9_-]+)['"]/g;

/** Toutes les réfs `playSfx('...')` d'un texte, dédupliquées, avec la ligne de 1ʳᵉ occurrence.
 * @param {string} text @returns {{ id: string, line: number }[]} */
export function soundRefsIn(text) {
  const found = new Map();
  let m;
  SOUND_REF_RE.lastIndex = 0;
  while ((m = SOUND_REF_RE.exec(text))) {
    if (!found.has(m[1])) {
      const line = text.slice(0, m.index).split('\n').length;
      found.set(m[1], line);
    }
  }
  return [...found].map(([id, line]) => ({ id, line }));
}
