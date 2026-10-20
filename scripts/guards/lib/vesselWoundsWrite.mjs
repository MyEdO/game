// Mécanique de scan du garde-fou « écriture de la coque hors seam » (#302, verrous 2ᵉ vague).
// SOURCE UNIQUE de `state.vessel.wounds` (#296) : `shipDamage.ts` (mutation du Combattant-coque)
// + `seaVoyageFlow.ts` (persistance `set({ vessel: { ...vessel, wounds } })` via `setVesselHull`/
// `persistHullWounds`/`damageVesselHull`/`healVesselHull`). Le motif détecté est la forme SPREAD
// « on repart de l'ancien `vessel` et on y réécrit `wounds` » — la seule qui persiste RÉELLEMENT
// une valeur de coque (`setVessel` en `src/noyau/combatEffects.ts` construit un vessel ENTIER neuf
// à l'authoring, motif structurellement différent, hors périmètre). Module ESM pur, exécutable par
// `node` nu — même patron que `journalWrite.mjs`.

/** Retire commentaires ET imports nommés — mêmes règles que `hardcode.mjs`.
 * @param {string} src @returns {string} */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+['"][^'"]*['"];?/g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** @type {RegExp} */
export const VESSEL_WOUNDS_WRITE_RX = /\.\.\.vessel[^,]*,\s*wounds\s*:/;

/**
 * Scan complet d'un fichier source : chaque ligne portant le motif (hors commentaires/imports).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanVesselWoundsWrite(relPath, contenu) {
  const findings = [];
  stripComments(contenu)
    .split('\n')
    .forEach((line, i) => {
      if (VESSEL_WOUNDS_WRITE_RX.test(line)) findings.push({ line: i + 1, detail: line.trim() });
    });
  return findings;
}

/** Compte de sites par fichier (raccourci de `scanVesselWoundsWrite(...).length`).
 * @param {string} relPath @param {string} contenu @returns {number} */
export function countVesselWoundsWrite(relPath, contenu) {
  return scanVesselWoundsWrite(relPath, contenu).length;
}
