import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it, expect } from 'vitest';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs';

/**
 * Garde TRANSVERSE (#1522) : la SOURCE d'authoring possède 100 % de la donnée de l'artefact généré.
 * Chaque `scripts/<dossier>/generate.mjs` expose une construction PURE `build()` et le chemin `OUT` de son
 * artefact ; la garde compare `JSON.stringify(build(), null, 1) + '\n'` à l'OCTET du fichier committé.
 * Relancer un générateur ne peut donc plus perdre en silence ce que seul l'artefact portait (le lot
 * d'origine : 26 `desc` de scène et 11 `stake.authored` vivaient UNIQUEMENT dans les JSON).
 *
 * Découverte par GLOB (`scripts/<dossier>/generate.mjs`), jamais une liste de noms en dur (patron
 * `src/scenes/bundled-projects.test.ts:12`) : un générateur N+1 coûte zéro ligne ici. Le volet
 * COUVERTURE ferme l'autre bout : tout `src/scenes/<dossier>/<nom>-projet.json` est soit produit par un
 * générateur découvert, soit déclaré NOMINATIVEMENT manuscrit ci-dessous.
 *
 * Réserve de convention : le générateur écrit `ambientLight: "auto"` EXPLICITE là où l'éditeur
 * SUPPRIME la clé sur « auto » (`src/ui/editor/Inspector.tsx`) — les deux formes sont équivalentes
 * à la lecture (`src/state/vision.ts`) ; cette garde juge la forme GÉNÉRATEUR.
 * Angle mort : elle ne voit pas un projet MANUSCRIT ajouté à la liste des manuscrits alors qu'un
 * générateur existe pour lui — la couverture prouve l'inclusion, pas la sincérité du motif.
 */
const SCRIPTS_DIR = join(__dirname, '../../scripts');
const SCENES_DIR = join(__dirname);

/** Projets AUTHORÉS à la main : aucun générateur ne les produit, ils ne sont pas rejouables. */
const MANUSCRITS: Record<string, string> = {
  'diligence-projet.json': 'authoré sans générateur (édité au studio, aucun script ne le réécrit)',
};

type Generateur = { build: () => unknown; OUT: string };

function generateurs(): string[] {
  const out: string[] = [];
  for (const nom of listerDossier(SCRIPTS_DIR)) {
    const f = join(SCRIPTS_DIR, nom, 'generate.mjs');
    try {
      readFileSync(f);
      out.push(f);
    } catch {
      /* ce dossier de scripts n'est pas un générateur de projet */
    }
  }
  return out;
}

const projets = (): string[] => listerProjetsLivres().map((rel) => join(SCENES_DIR, rel));

const GENERATEURS = generateurs();

describe('générateurs de campagne — l’artefact committé est l’octet exact de leur `build()` (#1522)', () => {
  it('au moins un générateur découvert (la garde couvre réellement quelque chose)', () => {
    expect(GENERATEURS.length).toBeGreaterThan(0);
  });

  it.each(GENERATEURS.map((f) => [f] as const))('%s : build() reproduit son artefact À L’OCTET', async (fichier) => {
    const mod = (await import(pathToFileURL(fichier).href)) as Generateur;
    expect(typeof mod.build, `${fichier} : pas d’export build() — le CLI doit être un simple shell d’écriture`).toBe('function');
    expect(typeof mod.OUT, `${fichier} : pas d’export OUT (chemin de l’artefact)`).toBe('string');
    const attendu = readFileSync(mod.OUT, 'utf8');
    const produit = JSON.stringify(mod.build(), null, 1) + '\n';
    expect(produit, `${fichier} : régénérer perdrait/changerait de la donnée — relancer le CLI et juger le diff`).toBe(attendu);
    // Rejouabilité dans un MÊME process : aucune séquence d'ids ne fuit d'un appel à l'autre.
    expect(JSON.stringify(mod.build(), null, 1) + '\n').toBe(attendu);
  });

  it('ordre BROUILLÉ : les générateurs entrelacés restent byte-identiques (aucune séquence d’ids ne fuit)', async () => {
    // Les modules ne sont importés qu'une fois (cache ESM) : c'est l'ENTRELACEMENT des `build()` qui est
    // jugé ici, pas l'ordre d'import — un compteur partagé par la lib (props, postes) le ferait rougir.
    const par = new Map(await Promise.all(GENERATEURS.map(async (f) => [f, (await import(pathToFileURL(f).href)) as Generateur] as const)));
    const ordre = [...GENERATEURS, ...[...GENERATEURS].reverse()];
    for (const f of ordre) {
      const mod = par.get(f)!;
      expect(JSON.stringify(mod.build(), null, 1) + '\n', `${f} : sortie dépendante de l’ORDRE d’exécution`).toBe(readFileSync(mod.OUT, 'utf8'));
    }
    expect(ordre.length).toBeGreaterThanOrEqual(6);
  });

  it('tout projet bundlé est produit par un générateur OU déclaré manuscrit', async () => {
    const produits = new Set<string>();
    for (const f of GENERATEURS) {
      const mod = (await import(pathToFileURL(f).href)) as Generateur;
      produits.add(join(mod.OUT));
    }
    const orphelins = projets().filter((p) => !produits.has(join(p)) && !(p.split(/[\\/]/).pop()! in MANUSCRITS));
    expect(orphelins, 'projet ni généré ni déclaré manuscrit — ajouter son générateur ou le nommer dans MANUSCRITS').toEqual([]);
    // Non-vacuité : la liste des manuscrits nomme des fichiers qui EXISTENT.
    const noms = new Set(projets().map((p) => p.split(/[\\/]/).pop()!));
    for (const m of Object.keys(MANUSCRITS)) expect(noms.has(m), `${m} : déclaré manuscrit mais absent de ${dirname(SCENES_DIR)}`).toBe(true);
  });
});
