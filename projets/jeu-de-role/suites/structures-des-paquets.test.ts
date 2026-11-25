/**
 * Les volets de `src/data/structures-contrat.test.ts` joués sur les paquets livrés : la référence ancrée à l'index,
 * la pose du Test étendu (#1657), les concepts reconnus à leur pose (#3012), les proses nommées (#2001) et la
 * croissance vue à l'inventaire (#1465 F21).
 */
import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classerValeur, listerDocuments, posesDesObjets, scanDuCorpus, scannerDonnees } from '../../../scripts/docs/lib/structures-scan.mjs';
import { inventaireDe } from '../../../scripts/guards/lib/inventaireDeDette.mts';
import { CONCEPT_DE_LA_POSE, signature, type IdConceptPose } from '../../../scripts/docs/lib/structures-lexique.mjs';
import { cheminsDesProjetsLivres, PROJETS_LIVRES } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { extendedTestSchema } from '../../../src/data/schemas/grammaire/mecanique';
import { coDescendre } from '../../../src/data/schemas/grammaire/descente';
import { estObjet } from '../../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PAQUETS = cheminsDesProjetsLivres(ROOT);
const { defs: DEFS, declares: DECLARES, choix: CHOIX, choixOps: CHOIX_OPS, scan } = scanDuCorpus(ROOT, PAQUETS);
const INVENTAIRE = inventaireDe({ scan, defs: DEFS, declares: DECLARES });

describe('la référence est ANCRÉE sur l’index des ids — paquets livrés', () => {
  it('arene-projet.json › members {entityId} est une occurrence de référence dont la cible résout vers arene-projet.json', () => {
    const f = scan.formes.find((x) => x.concept === 'reference' && x.dataset === 'arene-projet.json' && x.champ === 'members' && x.signature === 'entityId');
    expect(f, 'aucune occurrence de référence mesurée sous `arene-projet.json › members {entityId}`').toBeTruthy();
    expect(f!.occurrences).toBeGreaterThan(0);
    expect(f!.cibles).toContain('arene-projet.json');
  });
});

describe('le lexique reconnaît un concept à sa POSE de grammaire — paquets livrés (#3012)', () => {
  const brutParNom = new Map<string, unknown>(
    listerDocuments(ROOT, PAQUETS).map((d) => [d.nom, JSON.parse(readFileSync(join(ROOT, d.chemin), 'utf8'))] as const),
  );
  const poses = posesDesObjets(DEFS, brutParNom);
  const objets: { site: string; dataset: string; champ: string; o: Record<string, unknown> }[] = [];
  const marche = (v: unknown, dataset: string, champ: string, chemin: string): void => {
    if (Array.isArray(v)) { v.forEach((e, i) => marche(e, dataset, champ, `${chemin}[${i}]`)); return; }
    if (!estObjet(v)) return;
    objets.push({ site: `${dataset} › ${chemin || '(racine)'}`, dataset, champ, o: v });
    for (const [k, e] of Object.entries(v)) marche(e, dataset, k, `${chemin}.${k}`);
  };
  for (const [nom, brut] of brutParNom) marche(brut, nom, '', '');
  const conceptsDesPoses = (ids: ReadonlySet<IdConceptPose> | undefined) => new Set([...(ids ?? [])].map((p) => CONCEPT_DE_LA_POSE[p]));

  it('loup-et-saumure-projet.json : le Test étendu réel doit sa cible à la pose de son schéma de scène (#1657)', () => {
    const dataset = 'loup-et-saumure-projet.json';
    const { o, champ } = objets.find((x) => x.dataset === dataset && x.o.type === 'extendedTest')!;
    const def = DEFS.find((d) => d.file === dataset)!;
    const projet = structuredClone(brutParNom.get(dataset));
    let effetAvecCleEtrangere: Record<string, unknown> | undefined;
    coDescendre(def.schema, projet, ({ valeur }) => {
      if (estObjet(valeur) && valeur.type === 'extendedTest') {
        valeur.argDifficulty = true;
        effetAvecCleEtrangere = valeur;
        return 'arreter';
      }
    });
    if (!effetAvecCleEtrangere) throw new Error('Test étendu du projet introuvable');
    const classement = (effet: Record<string, unknown>, p?: ReadonlySet<IdConceptPose>) =>
      classerValeur(signature(Object.keys(effet)), Object.keys(effet), { dataset, champ, poses: p });
    expect(extendedTestSchema.safeParse(o).success).toBe(true);
    expect(classement(o, poses.get(o))).toMatchObject({ concept: 'test', statut: 'cible' });
    expect(classement(o)).toMatchObject({ concept: 'test', statut: 'divergente' });
    const contrePoses = posesDesObjets([def], new Map([[dataset, projet]]));
    expect(contrePoses.get(effetAvecCleEtrangere)?.has('test-etendu')).toBe(false);
    expect(classement(effetAvecCleEtrangere, contrePoses.get(effetAvecCleEtrangere))).toMatchObject({ concept: 'test', statut: 'divergente' });
  });

  it('un concept que nommaient un champ ou un dataset classe encore des objets livrés, à sa pose', () => {
    const anciennementNommes = [
      'palette-d-objet', 'profil-de-propulsion', 'marchandage-de-billet', 'identite-de-heros', 'ligne-d-identite',
      'valeur-d-identite', 'billet-de-route', 'provenance-de-valeur', 'provenances-de-route', 'special-de-jeu',
    ];
    const classes = objets.map((x) => ({ ...x, concept: classerValeur(signature(Object.keys(x.o)), Object.keys(x.o), { dataset: x.dataset, champ: x.champ, poses: poses.get(x.o) })?.concept }));
    expect(
      anciennementNommes.filter((c) => !classes.some((x) => x.concept === c)),
      'un concept nommé ne classe plus aucun objet : sa pose ne le reconnaît pas.',
    ).toEqual([]);
    expect(
      classes.filter((x) => x.concept && anciennementNommes.includes(x.concept) && !conceptsDesPoses(poses.get(x.o)).has(x.concept)).map((x) => `${x.concept} | ${x.site}`),
      'un noyau revendique hors de sa pose ce que le dataset bornait : c’est un débordement.',
    ).toEqual([]);
  });
});

describe('les concepts d’ENVELOPPE — paquets livrés', () => {
  // #2001
  it('les porteurs bruts de texte des paquets livrés sont des proses sans concept concurrent', () => {
    const porteurs: { site: string; objet: Record<string, unknown> }[] = [];
    const marche = (v: unknown, site: string): void => {
      if (Array.isArray(v)) { v.forEach((e, i) => marche(e, `${site}[${i}]`)); return; }
      if (!v || typeof v !== 'object') return;
      const o = v as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(o, 'texte')) porteurs.push({ site, objet: o });
      for (const [k, e] of Object.entries(o)) marche(e, `${site}.${k}`);
    };
    for (const d of listerDocuments(ROOT, PAQUETS).filter((x) => PAQUETS.includes(x.chemin))) marche(JSON.parse(readFileSync(join(ROOT, d.chemin), 'utf8')), d.chemin);
    expect(porteurs.length, 'aucun porteur brut de texte : la sonde ne mesurerait rien.').toBeGreaterThan(0);
    for (const { site, objet } of porteurs) {
      expect(typeof objet.texte, site).toBe('string');
      expect(Object.keys(objet).filter((k) => !['texte', 'source', 'adapteDe'].includes(k)), site).toEqual([]);
      expect(classerValeur(signature(Object.keys(objet)), Object.keys(objet)), site).toMatchObject({
        concept: 'prose-nommee', strate: 'Document', statut: 'cible',
      });
    }
  });
});

describe('contrôle POSITIF côté DONNÉE : le détecteur MORD — paquets livrés (#1465 F21)', () => {
  it('une façade et un déclencheur supplémentaires font monter le site de l’inventaire, nommé avec sa cible', { timeout: 60_000 }, () => {
    const copie = mkdtempSync(join(tmpdir(), 'structures-croissance-'));
    try {
      for (const racine of ['src/data', 'src/scenes', PROJETS_LIVRES.dossier]) cpSync(join(ROOT, racine), join(copie, racine), { recursive: true });
      const chemin = cheminsDesProjetsLivres(copie).map((rel) => join(copie, rel)).find((f) => JSON.parse(readFileSync(f, 'utf8')).id === 'la-diligence')!;
      const paquet = JSON.parse(readFileSync(chemin, 'utf8'));
      const scene = paquet.scenes.find((s: { id: string }) => s.id === 'la-diligence');
      const cheminArene = cheminsDesProjetsLivres(copie).map((rel) => join(copie, rel)).find((f) => f.endsWith('/arene-projet.json'))!;
      const arene = JSON.parse(readFileSync(cheminArene, 'utf8'));
      type Facade = { appearance?: unknown };
      const chapelle = (f: Facade) => f.appearance === 'chapelle';
      const batiment = arene.scenes.flatMap((s: { architecture?: { facades?: Facade[] }[] }) => s.architecture ?? []).find((a: { facades?: Facade[] }) => a.facades?.some(chapelle));
      batiment.facades.push({ ...batiment.facades.find(chapelle), id: 'facade-croissance-2337' });
      writeFileSync(cheminArene, JSON.stringify(arene), 'utf8');
      scene.triggers.push({
        id: 'declencheur-croissance-2337', rect: { x: 0, y: 0, w: 1, h: 1 }, once: true,
        flow: { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'setFlag', flag: 'croissance-2337' } }] },
      });
      writeFileSync(chemin, JSON.stringify(paquet), 'utf8');
      const apres = scannerDonnees(copie, DEFS, CHOIX, CHOIX_OPS, PAQUETS);
      const site = (f: { dataset: string; champ: string; signature: string }) =>
        f.dataset === 'arene-projet.json' && f.champ === 'appearance' && f.signature === 'id-nu';
      expect(apres.formes.find(site)!.occurrences).toBe(scan.formes.find(site)!.occurrences + 1);
      const ligne = (inv: typeof INVENTAIRE) => inv.find((l) => l.collection === 'CASES_DE_REFERENCE' && l.site === 'arene-projet.json | appearance')!;
      const avant = ligne(INVENTAIRE);
      const hausse = ligne(inventaireDe({ scan: apres, defs: DEFS, declares: DECLARES }));
      expect(hausse.occurrences, 'la hausse d’un site connu se lit à l’inventaire, sur la même ligne.').toBe(avant.occurrences! + 1);
      expect(hausse.cible, 'le seul remède d’une hausse est la migration vers la CIBLE du site.').toContain('Migrer ce site vers une forme CIBLE du lexique (`id`');
      const cleDOp = (o: { op: string; signature: string; dataset: string; occurrences: number }) => `${o.op} | ${o.signature} | ${o.dataset} | ${o.occurrences}`;
      expect(apres.ops.map(cleDOp)).toEqual(scan.ops.map(cleDOp));
    } finally {
      rmSync(copie, { recursive: true, force: true });
    }
  });
});
