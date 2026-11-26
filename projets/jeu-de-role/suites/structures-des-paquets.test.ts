/**
 * Les volets de `src/data/structures-contrat.test.ts` joués sur les paquets livrés : les concepts reconnus à leur
 * pose (#3012) et les proses nommées (#2001).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classerValeur, listerDocuments, posesDesObjets, scanDuCorpus } from '../../../scripts/docs/lib/structures-scan.mjs';
import { CONCEPT_DE_LA_POSE, signature, type IdConceptPose } from '../../../scripts/docs/lib/structures-lexique.mjs';
import { cheminsDesProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { estObjet } from '../../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PAQUETS = cheminsDesProjetsLivres(ROOT);
const { defs: DEFS } = scanDuCorpus(ROOT, PAQUETS);

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
