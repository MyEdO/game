// Mécanique de scan « le générique n'importe pas le domanial » (#329, pérennise la lentille
// adversariale du recensement #329). Réutilise la closure d'imports de `build-systemes.mjs`
// (`importGraph.mjs`, extraite pour #329 — jamais un 2ᵉ parseur) : un module de `src/` appartient à
// UN SEUL système si sa closure racine (`systemes.manifest.json`) ne l'atteint que via CE système
// (partagé par ≥2 systèmes = infra transverse légitime, PAS domanial). Une PRIMITIVE générique
// (`primitives.manifest.json`) qui IMPORTE (directement, imports relatifs) un module appartenant à
// un système unique importe du domaine dans le générique — exactement la faute-souche relevée par
// #329 (ex. `cascade.ts` → `shipManeuver.ts`, `CascadeModal.tsx` → `crewMorale.ts`/`data` naval).
// L'appartenance se juge SANS la primitive : un système qui n'atteint la cible qu'en traversant la
// primitive elle-même (seul poseur de celle-ci) lui transmet un propriétaire HÉRITÉ, qui ne dit rien
// du domaine de la cible — la cible n'est domaniale que si le système l'atteint par un autre chemin.
// Module ESM pur (node nu), même patron que `combatEventPort.mjs`/`inBattleFind.mjs`.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { closureOf, clotureDImports, directImportsOf } from './importGraph.mjs';

/**
 * Calcule, pour chaque module atteint par au moins une closure système, le NOMBRE de systèmes qui
 * l'atteignent. Un module compté par exactement 1 système est « domanial » (single-system) ; un
 * module compté par ≥2 est de l'infra partagée légitime.
 * @param {{ id: string, modules: string[] }[]} systemes
 * @param {Map<string, string[]|null>} [cache] enfants résolus, partageable (`clotureDImports`)
 * @returns {Map<string, string[]>} module (chemin POSIX) -> liste des ids système qui l'atteignent
 */
export function computeOwnerSystems(systemes, cache = new Map()) {
  const owners = new Map();
  for (const s of systemes) {
    for (const rel of closureOf(s.modules, cache)) {
      const list = owners.get(rel) ?? [];
      list.push(s.id);
      owners.set(rel, list);
    }
  }
  return owners;
}

/**
 * Scanne les imports DIRECTS d'un fichier primitive et signale ceux qui résolvent vers un module
 * domanial (owner unique).
 * @param {string} primitiveFile chemin POSIX relatif à la racine du repo
 * @param {string} contenu
 * @param {Map<string, string[]>} ownerSystems (`computeOwnerSystems`)
 * @returns {{ target: string, systemId: string }[]}
 */
export function scanGenericDomainImport(primitiveFile, contenu, ownerSystems) {
  const findings = [];
  for (const target of directImportsOf(primitiveFile, contenu)) {
    if (target === primitiveFile) continue;
    const owners = ownerSystems.get(target);
    if (owners && owners.length === 1) findings.push({ target, systemId: owners[0] });
  }
  return findings;
}

/**
 * Scan complet : pour chaque primitive GÉNÉRIQUE du manifeste, ses imports domaniaux. Une entrée de
 * `nature: 'organisme'` en est exclue : c'est un ORGANISME de domaine (panneau d'inspection, panneau
 * d'équipement, plateau du monde), entré au manifeste pour le module CSS qu'il POSSÈDE (#1806) et non
 * pour une généricité — lui interdire d'importer son domaine n'a aucun sens, et le tolérer par une
 * baseline chiffrée rendrait le cliquet inerte sans le dire.
 * @param {{ id: string, fichier: string, nature?: string }[]} primitives
 * @param {{ id: string, modules: string[] }[]} systemes
 * @param {(path: string) => string} [readFile] injectable (tests)
 * @returns {{ primitiveId: string, fichier: string, target: string, systemId: string }[]}
 */
export function scanAllPrimitives(primitives, systemes, readFile = (p) => readFileSync(p, 'utf8')) {
  const cache = new Map();
  const ownerSystems = computeOwnerSystems(systemes, cache);
  const findings = [];
  for (const p of primitives) {
    if (p.nature === 'organisme') continue;
    const contenu = readFile(p.fichier);
    for (const f of scanGenericDomainImport(p.fichier, contenu, ownerSystems)) {
      const systeme = systemes.find((s) => s.id === f.systemId);
      if (!atteintSansLaPrimitive(systeme.modules, p.fichier, f.target, cache)) continue;
      findings.push({ primitiveId: p.id, fichier: p.fichier, target: f.target, systemId: f.systemId });
    }
  }
  return findings;
}

/**
 * Le système atteint-il `target` par un chemin qui ne traverse PAS la primitive ? Sinon, son unique
 * propriétaire est HÉRITÉ de la primitive elle-même (le seul système qui la pose) et ne dit rien du
 * domaine de `target`.
 * @param {string[]} roots racines du système @param {string} primitiveFile @param {string} target
 * @param {Map<string, string[]|null>} cache
 * @returns {boolean}
 */
function atteintSansLaPrimitive(roots, primitiveFile, target, cache) {
  const primitiveAbs = resolve(primitiveFile).split('\\').join('/');
  const retenir = (abs) => abs.includes('/src/') && abs !== primitiveAbs;
  return clotureDImports(roots, { retenir, cache }).has(target);
}
