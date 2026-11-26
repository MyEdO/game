import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dossierDesProjetsLivres, listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { findPropById } from '../../../src/data/index';
import { sceneMetresPerTile, type SceneEntity } from '../../../src/noyau/monde/scene';
import { empreinteDuProp } from '../../../src/data/schemas/props.types';
import { parseProject } from '../../../src/noyau/worldMap';
import type { AreneSceneFactory } from '../campagnes/arene/scenes.d.mts';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';

const CORPUS = dossierDesProjetsLivres();
const ARENE_JSON = join(__dirname, '../campagnes/arene/arene-projet.json');

/** Les projets livrés (`projetsLivres.mjs`), relatifs au dossier du corpus. */
const sceneJsonFiles = (): string[] => listerProjetsLivres();

/** `<fichier>/<scène>/<entité>` pour chaque entité portant un `foot` d'INSTANCE dans un document BRUT. */
function entitesAvecFoot(doc: unknown, fichier: string): string[] {
  const scenes: { id?: string; entities?: { id?: string; foot?: unknown }[] }[] = [];
  (function rec(o: unknown) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(rec); return; }
    const rec_ = o as Record<string, unknown>;
    if (Array.isArray(rec_.entities)) scenes.push(rec_ as never);
    for (const k of Object.keys(rec_)) rec(rec_[k]);
  })(doc);
  return scenes.flatMap((s) => (s.entities ?? []).filter((e) => e && 'foot' in e).map((e) => `${fichier}/${s.id ?? '?'}/${e.id}`));
}

const entitesAvecFootDansLesJson = (): string[] =>
  sceneJsonFiles().flatMap((f) => entitesAvecFoot(JSON.parse(readFileSync(join(CORPUS, f), 'utf8')), f));

const areneDoc = parseProject(lireProjetLivre('jeu-de-role/campagnes/arene/arene-projet.json'));
const entitiesOf = (scene: string): SceneEntity[] => areneDoc.scenes.find((s) => s.id === scene)!.entities;
/** L'ÉCHELLE de la scène PORTEUSE : l'empreinte d'un décor à recette en dépend (#1509). Lue à sa
 *  source unique (`sceneMetresPerTile`), jamais écrite en littéral. */
const mptDe = (scene: string): number => sceneMetresPerTile(areneDoc.scenes.find((s) => s.id === scene));

/** Les instances de l'Arène qui portaient une empreinte D'INSTANCE avant la migration. */
const LEGACY_AUTHORED_FOOT_SITES: [string, string][] = [
  ['arene-hub', 'p8'],
  ['arene-zone5', 'p9'],
  ['arene-zone6', 'p16'],
  ['arene-zone6', 'p17'],
  ['arene-zone11', 'p0'],
  ['arene-exp-foret', 'p13'],
  ['arene-exp-foret', 'p16'],
  ['arene-exp-marais', 'p12'],
  ['arene-exp-village', 'p1'],
  ['arene-exp-village', 'p2'],
  ['arene-route-embuscade', 'p0'],
];

/** Empreinte EFFECTIVE d'une instance authorée : sa ref et les cases que le catalogue lui donne AU CAP ET À L'ÉCHELLE
 *  de sa scène (`empreinteDuProp`, #1509) ; le contrat du type : `src/scenes/opera/empreinte-du-type.test.ts`. */
function authoredPropFoot(scene: string, id: string): [string, number, number] {
  const ent = entitiesOf(scene).find((e) => e.id === id)!;
  const { w, h } = empreinteDuProp(findPropById(ent.decor?.id), ent.facing, mptDe(scene));
  return [ent.decor!.id, w, h];
}

const authoredPropFootTable = (): [string, string, string, number, number][] =>
  LEGACY_AUTHORED_FOOT_SITES.map(([scene, id]) => [scene, id, ...authoredPropFoot(scene, id)] as [string, string, string, number, number]);

describe('migration de l’empreinte : du legacy d’instance au catalogue de type', () => {
  it('conserve l’empreinte effective de chaque instance authorée', () => {
    expect(authoredPropFootTable()).toEqual([
      ['arene-hub', 'p8', 'tente', 2, 2],
      ['arene-zone5', 'p9', 'abreuvoir', 2, 1],
      ['arene-zone6', 'p16', 'cheval-mort', 2, 1],
      ['arene-zone6', 'p17', 'barque', 2, 1],
      ['arene-zone11', 'p0', 'idole-chaos', 2, 2],
      ['arene-exp-foret', 'p13', 'tente', 2, 2],
      ['arene-exp-foret', 'p16', 'charrette', 2, 1],
      ['arene-exp-marais', 'p12', 'barque', 2, 1],
      ['arene-exp-village', 'p1', 'abreuvoir', 2, 1],
      ['arene-exp-village', 'p2', 'charrette', 2, 1],
      ['arene-route-embuscade', 'p0', 'epave-carrosse', 2, 2],
    ]);
  });

  /** Le JSON BRUT, jamais `parseProject` : le verrou juge le fichier tel qu'il est commité. */
  it('plus AUCUNE instance authorée ne porte d’empreinte propre — mesuré sur le JSON BRUT', () => {
    expect(entitesAvecFootDansLesJson()).toEqual([]);
  });

  it('le verrou MORD : un JSON sali est rapporté (il ne passe pas sous la normalisation)', () => {
    const sali = JSON.parse(readFileSync(ARENE_JSON, 'utf8'));
    const hub = sali.scenes.find((s: { id: string }) => s.id === 'arene-hub');
    hub.entities.find((e: { id: string }) => e.id === 'p8').foot = { w: 9, h: 9 };
    expect(entitesAvecFoot(sali, 'arene-projet.json')).toEqual(['arene-projet.json/arene-hub/p8']);
  });
});

/**
 * `arene-projet.json` est GÉNÉRÉ (`projets/jeu-de-role/campagnes/arene/generate.mjs`) : purger le JSON sans purger ses
 * call-sites laisserait la prochaine régénération ré-émettre les empreintes d'instance. Ce verrou
 * juge la SOURCE, en appelant les fabriques de scène du générateur.
 */
describe('générateur de l’Arène — aucune fabrique ne pose d’empreinte d’instance', () => {
  it('les scènes produites par les fabriques ne portent AUCUN `foot` d’entité', async () => {
    const [hub, zones1a7, zones8a13, expeditions] = await Promise.all([
      import('../campagnes/arene/hub.mjs'),
      import('../campagnes/arene/zones1-7.mjs'),
      import('../campagnes/arene/zones8-13.mjs'),
      import('../campagnes/arene/expeditions.mjs'),
    ]);
    const fabriques: [string, AreneSceneFactory][] = [hub, zones1a7, zones8a13, expeditions]
      .flatMap((m) => Object.entries(m).filter(([nom]) => nom.startsWith('make')) as [string, AreneSceneFactory][]);
    // Le verrou ne juge que ce qu'il monte : CHAQUE module de fabriques du générateur doit en avoir
    // fourni au moins une, sans quoi une famille entière de scènes sortirait du champ en silence.
    const familles = [
      ['hub', hub],
      ['zones1-7', zones1a7],
      ['zones8-13', zones8a13],
      ['expéditions', expeditions],
    ] as const;
    for (const [famille, module] of familles) {
      const noms = Object.keys(module).filter((n) => n.startsWith('make'));
      expect(noms.length, `${famille} : aucune fabrique montée`).toBeGreaterThan(0);
      expect(fabriques.map(([n]) => n)).toEqual(expect.arrayContaining(noms));
    }
    const porteuses: string[] = [];
    for (const [nom, fabrique] of fabriques) {
      for (const e of fabrique().entities ?? []) if ('foot' in e) porteuses.push(`${nom}/${e.id}`);
    }
    expect(porteuses).toEqual([]);
  });
});
