// QUARANTAINE d'import du CANAL météo « Tests physiques » (EDOC ch.5 l.82, #341). Le trou de la défense
// (audit adversarial) venait de ce qu'AUCUNE garde ne protégeait le canal des modificateurs : chaque
// surface (attackEnv, options de défense, activités) recalculait `weatherPhysicalTestMod` À LA MAIN → une
// surface OUBLIÉE = un mod manquant en silence. Cette garde rend le câblage par-surface INEXPRIMABLE :
//  - `weatherPhysicalTestMod` (le CALCUL brut) n'est importable QUE par le lecteur canonique
//    `src/engine/weatherTestMod.ts` ;
//  - `weatherTestMods` (le LECTEUR du canal, qui produit la ligne « Météo : … ») n'est importable QUE par
//    les étages de Test canoniques whitelistés (le moteur de combat + le constructeur des rangées d'Activité).
// Une 4ᵉ surface qui voudrait pousser la météo doit ÉDITER la whitelist (revue), jamais recâbler en douce.
// Module ESM pur (node nu), patron `batchNavalQuarantine.mjs`.

/** Détecte un symbole `symbol` figurant dans une CLAUSE d'import nommé (`import { … symbol … } from '…'`,
 *  valeur OU type) — renvoie les lignes fautives. @param {string} contenu @param {string} symbol */
export function scanNamedImport(contenu, symbol) {
  const findings = [];
  const rx = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = rx.exec(contenu)) !== null) {
    const names = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim());
    if (names.includes(symbol)) {
      const line = contenu.slice(0, m.index).split('\n').length;
      findings.push({ line, symbol, source: m[2] });
    }
  }
  return findings;
}

/** Le CALCUL brut : seul le lecteur canonique peut l'importer. POSIX relatifs à la racine du repo. */
export const RAW_SYMBOL = 'weatherPhysicalTestMod';
export const RAW_ALLOWED = ['src/engine/weatherTestMod.ts'];

/** Le LECTEUR du canal : seuls les étages de Test canoniques peuvent l'importer. */
export const CHANNEL_SYMBOL = 'weatherTestMods';
export const CHANNEL_ALLOWED = ['src/engine/combat.ts', 'src/state/travelPostes.ts'];

/** Le LECTEUR des Précipitations sur le pont (MDG 13 l.185, #1936) : le monteur canonique d'une ligne de
 *  jet (déclaration `pont`) et les étages du moteur de combat (`Combatant.envPrecipitation`). */
export const PRECIP_SYMBOL = 'precipitationTestMods';
export const PRECIP_ALLOWED = ['src/engine/combat.ts', 'src/engine/crewMorale.ts', 'src/state/rollSeam.ts'];
