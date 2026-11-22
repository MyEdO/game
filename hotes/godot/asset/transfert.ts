/**
 * LE COMMIT DE TRANSFERT (#4338, #4746) : le versement à la Release (`.github/workflows/transfert.yml`) part d'une
 * branche `transfert/<nom>` dont le commit, fils de HEAD, ajoute de force des fichiers épinglés que git ignore (le GLB
 * d'un modèle, une texture ou un son d'un dossier épinglé, `epingles.ts`) avec la provenance qui les épingle.
 * `fabriquerTransfert` le fabrique sous un index temporaire, sans toucher l'index ni l'arbre de travail ;
 * `commandeDEnvoi` dit la commande qui le pousse, jamais lancée. La commande est `hotes/godot/transfert.mjs`.
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './empreinte.ts';
import { DOSSIERS_EPINGLES } from './epingles.ts';
import { DOSSIER_DES_MODELES } from './dossierDeProduction.ts';

/** La racine du dépôt qui porte ce module. */
const RACINE = fileURLToPath(new URL('../../..', import.meta.url));

/** Un chemin absolu de ce dépôt, relatif à sa racine, en séparateurs `/`. */
const duDepot = (chemin: string): string => relative(RACINE, chemin).split('\\').join('/');

/** La porte d'un message de commit : rend le processus achevé. */
type Porte = (fichier: string, contexte: { readonly racine: string; readonly env: NodeJS.ProcessEnv }) => Pick<SpawnSyncReturns<string>, 'status' | 'stdout' | 'stderr'>;

/** La porte du commit (`scripts/git-hooks/commit-msg.mjs`) sur le fichier de message `fichier`, l'index temporaire
 *  dans `env`. */
const porteDuCommit: Porte = (fichier, { racine, env }) =>
  spawnSync(process.execPath, [join(RACINE, 'scripts/git-hooks/commit-msg.mjs'), fichier], { cwd: racine, env, encoding: 'utf8' });

/** Le refus du nom de branche `transfert/<nom>`, ou `null`. */
export function refusDuNom(nom: string): string | null {
  return spawnSync('git', ['check-ref-format', `refs/heads/transfert/${nom}`]).status === 0 ? null : `« ${nom} » ne nomme pas une branche transfert/<nom>`;
}

/** La commande, imprimée et jamais lancée, qui pousse le commit `sha` en branche `transfert/<nom>`. PURE. */
export const commandeDEnvoi = (sha: string, nom: string): string => `git push origin ${sha}:refs/heads/transfert/${nom}`;

/** Ce qu'un fichier épinglé `chemin` (relatif au dépôt) emmène dans le transfert : les fichiers suivis qui l'épinglent,
 *  et la lecture de l'empreinte que sa provenance, lue par `lire`, lui donne. Un GLB des modèles emmène son manifeste et sa provenance
 *  (`model_sha256`), un fichier d'un dossier épinglé la provenance du dossier (`<fichier>.sha256`) ; lève sur tout
 *  autre chemin. */
function epinglage(chemin: string, lire: (suivi: string) => string): { readonly suivis: readonly string[]; readonly epinglee: () => unknown } {
  const dossier = dirname(chemin);
  if (dossier === duDepot(DOSSIER_DES_MODELES) && extname(chemin) === '.glb') {
    const id = basename(chemin, '.glb');
    const provenance = `${dossier}/${id}.provenance.json`;
    return { suivis: [`${dossier}/${id}.manifeste.json`, provenance], epinglee: () => (JSON.parse(lire(provenance)) as { model_sha256?: unknown }).model_sha256 };
  }
  if (DOSSIERS_EPINGLES.map(duDepot).includes(dossier)) {
    const provenance = `${dossier}/provenance.json`;
    return { suivis: [provenance], epinglee: () => (JSON.parse(lire(provenance)) as Record<string, { sha256?: unknown } | undefined>)[basename(chemin)]?.sha256 };
  }
  throw new Error(`${chemin} : ni le GLB d'un modèle (${duDepot(DOSSIER_DES_MODELES)}), ni un fichier d'un dossier épinglé (${DOSSIERS_EPINGLES.map(duDepot).join(', ')})`);
}

/**
 * Le commit fils de HEAD du dépôt `racine` dont l'arbre est celui de HEAD plus chaque fichier épinglé `fichiers`
 * (chemins relatifs au dépôt), ignoré par git, ajouté de force, et les fichiers suivis qui l'épinglent (`epinglage`),
 * pris à l'arbre de travail ; fabriqué sous un index temporaire (`GIT_INDEX_FILE`), son message jugé par `porte` : rend
 * son sha. Refuse un fichier dont l'empreinte n'est pas celle que sa provenance épingle, que le versement ne verserait
 * pas.
 */
export function fabriquerTransfert({ racine = RACINE, fichiers, nom, env = process.env, porte = porteDuCommit }: {
  racine?: string; fichiers: readonly string[]; nom: string; env?: NodeJS.ProcessEnv; porte?: Porte;
}): string {
  const refus = refusDuNom(nom);
  if (refus) throw new Error(refus);
  const temporaire = mkdtempSync(join(tmpdir(), 'transfert-'));
  try {
    const envDeLIndex = { ...env, GIT_INDEX_FILE: join(temporaire, 'index') };
    const git = (...args: string[]): string => {
      const vu = spawnSync('git', args, { cwd: racine, env: envDeLIndex, encoding: 'utf8' });
      if (vu.status !== 0) throw new Error(`git ${args.join(' ')} : ${vu.stderr.trim() || `code ${String(vu.status)}`}`);
      return vu.stdout.trim();
    };
    const epinglages = fichiers.map((chemin) => ({ chemin, ...epinglage(chemin, (suivi) => git('show', `:${suivi}`)) }));
    git('read-tree', 'HEAD');
    git('add', '--', ...new Set(epinglages.flatMap((e) => e.suivis)));
    git('add', '-f', '--', ...fichiers);
    const sommes = epinglages.map(({ chemin, epinglee }) => {
      const somme = sha256(readFileSync(join(racine, chemin)));
      const attendue = epinglee();
      if (attendue !== somme) throw new Error(`${chemin} : sa provenance épingle ${String(attendue)}, le fichier est ${somme}`);
      return `${chemin} ${somme}`;
    });
    const arbre = git('write-tree');
    const message = join(temporaire, 'message');
    writeFileSync(message, `transfert/${nom} : ${fichiers.length} fichier(s) épinglé(s) à verser à la Release\n\n${sommes.join('\n')}\n`);
    const jugee = porte(message, { racine, env: envDeLIndex });
    if (jugee.status !== 0) throw new Error(`porte du commit : ${`${jugee.stdout ?? ''}${jugee.stderr ?? ''}`.trim()}`);
    return git('commit-tree', arbre, '-p', 'HEAD', '-F', message);
  } finally {
    rmSync(temporaire, { recursive: true, force: true });
  }
}
