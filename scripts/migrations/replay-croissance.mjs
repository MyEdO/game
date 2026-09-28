/**
 * REJEU EN CROISSANCE (#1812) — `npm run migrations:replay:croissance [<sha>]`.
 *
 * `migrations:replay:head` prouve qu'un rejeu n'écrit RIEN sur l'arbre TEL QU'IL EST. Cette porte-ci
 * prouve l'autre moitié, celle que le ticket demande : qu'une DONNÉE DE PLUS ne coûte rien. Chaque
 * dataset app-owned à racine tableau reçoit UNE entrée clonée de sa dernière, chaque document de
 * projet UNE Scène de plus, puis toutes les migrations datées sont rejouées. Une migration qui gèle
 * un COMPTE d'entrées proteste alors — et c'est tout l'intérêt : le péage se mesure au lieu de se
 * chercher à la regex (#1392 `regles.json` 85 → 86 et #1800 `primitives.manifest.json` 62 → 66 ont
 * chacun payé un recalage dans des scripts déjà joués).
 *
 * Un cardinal IMPOSÉ PAR LE LIVRE (les 20 rangées d'un Tableau des Critiques, les 19 caractéristiques)
 * n'est pas un péage : il se DÉCLARE dans le refus que le code prononce, par une RÉFÉRENCE NUE
 * (`LDB 18 l.53`, `docs/raw/4e/caracteristiques`). L'exemption vit AU SITE, jamais dans une liste de
 * fichiers tenue ici.
 *
 * L'export, l'effacement et le périmètre sont ceux de `replay-head.mjs` / `replay.mjs` — une seule
 * mécanique d'export pour les deux portes.
 *
 * DEUX ARBRES, UNE MÊME PORTE :
 *  - `<sha>` (défaut `HEAD`) — l'arbre GIT du sha, par l'export de `replay-head.mjs`. C'est le mode de
 *    la CI : ce qui est jugé est ce qui est commité ;
 *  - `--arbre` — l'ARBRE DE TRAVAIL, fichiers non suivis VERSIONNABLES compris
 *    (`git ls-files --cached --others --exclude-standard`). C'est le seul mode qui prouve un lot AVANT
 *    son commit : le sha ignore un lot que l'arbre de travail porte.
 * Dans les deux cas la copie est JETABLE et hors dépôt ; le working tree n'est jamais écrit.
 *
 * ENTRÉES : l'arbre git du sha demandé, ou les fichiers versionnables de l'arbre de travail.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { croitreDocuments, rejouerEnCroissance } from './lib/croissance.mjs';
import { CHEMINS_EXPORTES, RACINE_DES_EXPORTS, effacerExport, exporter } from './replay-head.mjs';

/**
 * Copie dans `dossier` les fichiers VERSIONNABLES de l'arbre de travail (suivis + non suivis non
 * ignorés), restreints à `CHEMINS_EXPORTES` — le même périmètre que l'export de sha, la même
 * découverte que `scripts/guards/lib/memoryLinks.mjs` (`--cached --others --exclude-standard`).
 * @param {{ depot: string, dossier: string }} params
 * @returns {{ fichiers: number }}
 */
export function copierArbreDeTravail({ depot, dossier }) {
  const vu = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...Object.keys(CHEMINS_EXPORTES)],
    { cwd: depot, encoding: 'utf8', maxBuffer: 1 << 28 },
  );
  if (vu.status !== 0) throw new Error(`git ls-files a rendu ${vu.status} : ${(vu.stderr || '').trim()}`);
  const rels = [...new Set(vu.stdout.split('\0').filter(Boolean))];
  let fichiers = 0;
  for (const rel of rels) {
    const source = join(depot, rel);
    // Un chemin SUPPRIMÉ dans l'arbre de travail reste listé par `--cached` : il n'a rien à copier.
    if (!existsSync(source)) continue;
    const cible = join(dossier, rel);
    mkdirSync(dirname(cible), { recursive: true });
    copyFileSync(source, cible);
    fichiers++;
  }
  return { fichiers };
}

/**
 * Exporte l'arbre demandé, fait croître ses documents, rejoue toutes les migrations datées.
 * @param {{ cwd?: string, sha?: string, arbre?: boolean, ecrire?: (ligne: string) => void }} params
 * @returns {{ rouges: string[], exemptes: string[], lignes: string[], sha: string }}
 */
export function rejeuEnCroissance({ cwd = process.cwd(), sha = 'HEAD', arbre = false, ecrire = console.log } = {}) {
  const vu = spawnSync('git', ['rev-parse', sha], { cwd, encoding: 'utf8' });
  if (vu.status !== 0) throw new Error(`git rev-parse ${sha} a rendu ${vu.status} : ${(vu.stderr || '').trim()}`);
  const resolu = vu.stdout.trim();
  const quoi = arbre ? 'arbre-de-travail' : resolu.slice(0, 8);
  const dossier = join(RACINE_DES_EXPORTS, `croissance-${arbre ? 'travail' : resolu.slice(0, 8)}-${process.pid}`);
  const lignes = [];

  try {
    mkdirSync(dossier, { recursive: true });
    const { fichiers } = arbre ? copierArbreDeTravail({ depot: cwd, dossier }) : exporter({ depot: cwd, sha: resolu, dossier });
    if (!fichiers) throw new Error(`export de ${quoi} VIDE — rien à faire croître`);
    lignes.push(`export de ${quoi} : ${fichiers} fichier(s)`);

    const { faits, sautes } = croitreDocuments(dossier);
    lignes.push(`croissance : +1 entrée sur ${faits.length} document(s) ; ${sautes.length} sauté(s)`);
    for (const s of sautes) ecrire(`  (sauté) ${s}`);
    if (!faits.length) throw new Error('aucun document n’a grandi — la porte mesurerait le vide');

    const verdict = rejouerEnCroissance({ racine: dossier, ecrire });
    lignes.push(...verdict.lignes);
    return { ...verdict, lignes, sha: quoi };
  } finally {
    effacerExport(dossier);
  }
}

function main() {
  const args = process.argv.slice(2);
  const arbre = args.includes('--arbre');
  const { rouges, exemptes, lignes, sha } = rejeuEnCroissance({
    cwd: process.cwd(),
    sha: args.find((a) => !a.startsWith('--')) ?? 'HEAD',
    arbre,
  });
  for (const ligne of lignes) console.log(ligne);
  if (exemptes.length) {
    console.log(`\ncardinaux IMPOSÉS par le livre, refus à RÉFÉRENCE (${exemptes.length}) :`);
    for (const e of exemptes) console.log(`  - ${e}`);
  }
  if (rouges.length) {
    console.error(
      `\nmigrations:replay:croissance ROUGE sur ${sha} (${rouges.length}) — ` +
        `un compte d'entrées gelé fait payer un recalage à chaque ajout de donnée (#1812) :\n  - ${rouges.join('\n  - ')}`,
    );
    process.exit(1);
  }
  console.log(`migrations:replay:croissance — OK sur ${sha} : +1 entrée ne coûte rien`);
}

if (import.meta.main) main();
