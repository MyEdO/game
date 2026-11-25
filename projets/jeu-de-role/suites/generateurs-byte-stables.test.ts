import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { dossierDesProjetsLivres, estManuscrit, listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';

/**
 * Garde TRANSVERSE (#1522) : la SOURCE d'authoring possède 100 % de la donnée de l'artefact généré.
 * Chaque `campagnes/<dossier>/generate.mjs` expose une construction PURE `build()` et le chemin `OUT` de son
 * artefact ; la garde compare `JSON.stringify(build(), null, 1) + '\n'` à l'OCTET du fichier committé.
 * Relancer un générateur ne peut donc plus perdre en silence ce que seul l'artefact portait (le lot
 * d'origine : 26 `desc` de scène et 11 `stake.authored` vivaient UNIQUEMENT dans les JSON).
 *
 * Découverte par GLOB (`campagnes/<dossier>/generate.mjs`), jamais une liste de noms en dur (patron
 * `bundled-projects.test.ts`) : un générateur N+1 coûte zéro ligne ici. Le volet COUVERTURE ferme l'autre bout : tout
 * paquet du jeu voisin d'un `generate.mjs` est l'artefact de ce générateur ; un paquet sans générateur voisin est
 * manuscrit (`estManuscrit`, `projetsLivres.mjs`).
 *
 * Réserve de convention : le générateur écrit `ambientLight: "auto"` EXPLICITE là où l'éditeur
 * SUPPRIME la clé sur « auto » — les deux formes sont équivalentes
 * à la lecture (`src/noyau/monde/vision.ts`) ; cette garde juge la forme GÉNÉRATEUR.
 */

type Generateur = { build: () => unknown; OUT: string };

/** Chaque générateur, par son chemin absolu : son chargeur (`import.meta.glob`, paresseux). */
const CHARGEURS = new Map(Object.entries(import.meta.glob<Generateur>('../campagnes/*/generate.mjs')).map(([cle, charger]) => [join(__dirname, cle), charger]));

const charger = (fichier: string): Promise<Generateur> => CHARGEURS.get(fichier)!();

/** Les paquets du jeu, relatifs au dossier du corpus (`jeu-de-role/campagnes/<dossier>/<nom>-projet.json`). */
const paquets = (): string[] => listerProjetsLivres().filter((rel) => rel.startsWith('jeu-de-role/'));

const GENERATEURS = [...CHARGEURS.keys()];

describe('générateurs de campagne — l’artefact committé est l’octet exact de leur `build()` (#1522)', () => {
  it('au moins un générateur découvert (la garde couvre réellement quelque chose)', () => {
    expect(GENERATEURS.length).toBeGreaterThan(0);
  });

  it.each(GENERATEURS.map((f) => [f] as const))('%s : build() reproduit son artefact À L’OCTET', async (fichier) => {
    const mod = await charger(fichier);
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
    const par = new Map(await Promise.all(GENERATEURS.map(async (f) => [f, await charger(f)] as const)));
    const ordre = [...GENERATEURS, ...[...GENERATEURS].reverse()];
    for (const f of ordre) {
      const mod = par.get(f)!;
      expect(JSON.stringify(mod.build(), null, 1) + '\n', `${f} : sortie dépendante de l’ORDRE d’exécution`).toBe(readFileSync(mod.OUT, 'utf8'));
    }
    expect(ordre.length).toBeGreaterThanOrEqual(6);
  });

  it('tout paquet voisin d’un générateur est son artefact ; un paquet sans générateur voisin est manuscrit', async () => {
    const produits = new Set<string>();
    for (const f of GENERATEURS) produits.add(join((await charger(f)).OUT));
    const generes = paquets().filter((rel) => !estManuscrit(rel));
    expect(generes.map((rel) => produits.has(join(dossierDesProjetsLivres(), rel))), generes.join(', ')).toEqual(generes.map(() => true));
    expect(generes.length, 'les générateurs découverts produisent les paquets voisins').toBe(GENERATEURS.length);
  });
});
