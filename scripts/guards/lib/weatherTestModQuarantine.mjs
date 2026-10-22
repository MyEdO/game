// QUARANTAINE d'import des CANAUX météo (EDOC ch.5 l.82, #341 ; MDG 13 l.185, #1936). Les étages
// propriétaires des LECTEURS de canal vivent dans deux couches (`src/engine`, `src/noyau`) qu'aucun dossier
// `interne/` ne regroupe (#2724) : seuls ces étages les importent.
// Module ESM pur (node nu).

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

/** Le LECTEUR du canal : seuls les étages de Test canoniques peuvent l'importer. POSIX relatifs à la racine du repo. */
export const CHANNEL_SYMBOL = 'weatherTestMods';
export const CHANNEL_ALLOWED = ['src/engine/combat.ts', 'src/noyau/travelPostes.ts'];

/** Le LECTEUR des Précipitations sur le pont (MDG 13 l.185, #1936) : le monteur canonique d'une ligne de
 *  jet (déclaration `pont`) et les étages du moteur de combat (`Combatant.envPrecipitation`). */
export const PRECIP_SYMBOL = 'precipitationTestMods';
export const PRECIP_ALLOWED = ['src/engine/combat.ts', 'src/engine/crewMorale.ts', 'src/noyau/rollSeam.ts'];
