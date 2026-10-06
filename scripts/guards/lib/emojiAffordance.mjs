// Mécanique de scan du garde-fou anti-emoji (LOT 4) : les AFFORDANCES de l'UI passent par le
// registre d'icônes (`src/ui/icons/`), plus jamais par un emoji dans le code ou la donnée. Module
// ESM pur, exécutable par `node` nu — consommé par src/ui/no-emoji-affordance.test.ts ET par le
// hook pre-commit (scripts/git-hooks/pre-commit.mjs). Les EXCEPTIONS (fichiers hors périmètre) restent DONNÉES DE POLICY dans
// le test — ici ne vit QUE la mécanique de détection des emoji.

/** Plages Unicode d'emoji (présentation emoji) — volontairement SANS les blocs typographiques
 *  (flèches 2190-21FF, formes géométriques 25xx, ⌊⌋⌈⌉ math du bloc technique).
 * @type {[number, number][]} */
export const EMOJI_RANGES = [
  [0x1f000, 0x1faff], // Mahjong → Symbols & Pictographs Extended (émoticônes, transport, suppléments…)
  [0x2600, 0x27bf], // Miscellaneous Symbols + Dingbats
  [0x2b00, 0x2bff], // Misc Symbols and Arrows (⬆ ⭐ …)
  [0x231a, 0x231b], // ⌚ ⌛
  [0x23e9, 0x23f3], // ⏩ … ⏳ (timers/lecteur)
  [0x23f8, 0x23fa], // ⏸ ⏹ ⏺
  [0x2139, 0x2139], // ℹ
  [0xfe0f, 0xfe0f], // sélecteur de variation emoji
];

/** Glyphes TEXTE tolérés partout (typographie monochrome, pas des affordances emoji) :
 *  coches/croix de résultat (✓ ✗ ✔ ✘), fermeture ✕, marqueur essentiel ★ (ShipSheet/équipages),
 *  ornement ⚜ (Ornaments), burger ☰ (GameMenu), sexes ♂ ♀ (compendium), étoiles FX ✦ ✸
 *  (particules dessinées en <text> SVG). */
export const ALLOWED_CHARS = new Set(['✓', '✗', '✔', '✘', '✕', '★', '⚜', '☰', '♂', '♀', '✦', '✸']);

/** @param {number} cp @returns {boolean} */
export const isEmoji = (cp) => EMOJI_RANGES.some(([a, b]) => cp >= a && cp <= b);

/** Tous les emoji distincts (non tolérés) présents dans un texte, dans l'ordre de première apparition.
 * @param {string} text @returns {string[]} */
export function emojisIn(text) {
  const found = new Set();
  let prev = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    // FE0F collé à un glyphe toléré (✔️ …) : fait partie de la séquence tolérée.
    if (cp === 0xfe0f && ALLOWED_CHARS.has(prev)) { prev = ch; continue; }
    if (isEmoji(cp) && !ALLOWED_CHARS.has(ch)) found.add(ch);
    prev = ch;
  }
  return [...found];
}

/**
 * Scan complet d'un fichier : chaque emoji d'affordance trouvé, avec la ligne de sa PREMIÈRE
 * occurrence (utile pour un hook pre-commit qui veut pointer un fichier:ligne).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanEmojiAffordance(relPath, contenu) {
  const hits = emojisIn(contenu);
  if (!hits.length) return [];
  const firstLineOf = new Map();
  const lines = contenu.split('\n');
  for (const emoji of hits) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(emoji)) { firstLineOf.set(emoji, i + 1); break; }
    }
  }
  return hits.map((emoji) => ({ line: firstLineOf.get(emoji) ?? 1, detail: emoji }));
}
