/**
 * GARDE (#1882 T2d) — aucun littéral d'id de créature hors dataset dans les suites Vitest de `src/**`.
 *
 * QUESTION : une fixture qui pose une créature par un id que le bestiaire ne connaît pas (`'bandit-de-grand-chemin'`,
 * un libellé pris pour un id `'Villageois'`) teste-t-elle ce qu'elle croit ? Non : elle testait le mannequin de
 * repli mort avec #1882. Sites lus : `spawnEnemy({ ref: 'x' }`, `creatureId: 'x'`, le corps `creature: { id: 'x' }`
 * d'un littéral `kind: 'personnage'`, la `ref` d'un outil de pose de personnage. Résolution : le bestiaire pour
 * la réf d'une créature ; le bestiaire, les fiches de coque et d'engin (`findFicheDeVehicule`, `data/index.ts`)
 * et les STRUCTURES pour le `creatureId` d'un combattant (`engine/inanimate.ts:53` `creatureId: s.refId`, posé par
 * `engine/structures.ts:164` `refId: struct.id` et par le spawn des coques et engins) ; le bestiaire SEUL pour la
 * référence d'un vivant (`livingRefSchema`, `defs-scenes/effets.ts`) :
 * `ref: { id, type: 'creature' }` (`givePossession`), le `ref: { id }` d'une possession, qui n'ouvre
 * jamais son objet (un `{ ref: … }` est un tirage ou une offre de Compétence), et l'adversaire de poursuite,
 * `{ id }` posé dans `foes:`. Dans une Condition `has`, `what` désigne le catalogue de `ref`.
 * Exemptés au SITE (`fichier|ligne du site`) : les tests dont la réf MORTE est le SUJET (refus prouvé).
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { avecAnalyse, typescript, type FichierSource } from '../scripts/guards/lib/dialecte.mjs';
import { estSuiteVitest } from '../scripts/guards/lib/fichierVitest.mjs';
import { findCreatureById, findFicheDeVehicule, structures } from './data';

/** Les réfs MORTES que leur test PROUVE (refus, repli signalé) — `fichier|ligne du site` (texte, espaces réduits). */
const MORTES_PROUVEES = new Set<string>([
  "src/noyau/give-possession-effect.hors-store.test.ts|expect(refs({ type: 'givePossession', nature: 'bete', ref: { id: '', type: 'creature' } } as never, ctx)).toEqual([{ level: 'error', message: 'Possession → créature inexistante « (aucune) »' }]);",
  "src/noyau/give-possession-effect.hors-store.test.ts|expect(refs({ type: 'givePossession', nature: 'bete', ref: { id: 'licorne-mauve', type: 'creature' } } as never, ctx)).toEqual([{ level: 'error', message: 'Possession → créature inexistante « licorne-mauve »' }]);",
  "src/noyau/validateScene-contenu.test.ts|expect(() => spawnEnemy({ ref: 'ref-qui-nexiste-nulle-part' }, 'e-1', { x: 2, y: 2 })).toThrow(RefIrresoluble);",
  "src/noyau/sceneEdit-editeur.test.ts|expect(() => placeEntity(emptyScene('scene-test', 10, 10), { mode: 'entite', kind: 'personnage', ref: 'Humain' }, { x: 1, y: 1 }))",
]);

/** Une créature du bestiaire. */
const creature = (id: string) => !!findCreatureById(id);
/** Le `creatureId` d'un combattant : une créature, une coque ou un engin, ou l'id d'une STRUCTURE (objet inanimé). */
const refDeCombattant = (id: string) => creature(id) || !!findFicheDeVehicule(id) || structures.some((st) => st.id === id);

const REF_SANS_TYPE = /(?<!\{\s*)\bref:\s*\{\s*id:\s*'([^']*)'\s*\}/g;

/** Le parent syntaxique direct distingue une référence de Condition d’une référence de possession. */
function refsSansType(fichier: FichierSource): RegExpMatchArray[] {
  const refs = [...fichier.text.matchAll(REF_SANS_TYPE)];
  if (!refs.length || !/['"]has['"]/.test(fichier.text)) return refs;
  return avecAnalyse(fichier, undefined, undefined, (source) => {
    const ts = typescript();
    return refs.filter(({ index }) => {
      if (index === undefined) return true;
      const ref = ts.getTokenAtPosition(source, index);
      if (!ts.isIdentifier(ref) || ref.text !== 'ref' || ref.getStart(source) !== index) return true;
      const propriete = ref.parent;
      if (!propriete || !ts.isPropertyAssignment(propriete) || propriete.name !== ref) return true;
      const porteur = propriete.parent;
      if (!porteur || !ts.isObjectLiteralExpression(porteur) || porteur.properties.length !== 4) return true;
      const champs = new Map(porteur.properties
        .filter(ts.isPropertyAssignment)
        .filter((p) => ts.isIdentifier(p.name))
        .map((p) => [p.name.getText(source), p.initializer]));
      const kind = champs.get('kind');
      return !(kind && ts.isStringLiteral(kind) && kind.text === 'has' && champs.has('who') && champs.has('what'));
    });
  });
}

/** Chaque site et la famille qu'il admet : une créature, ou un combattant. */
const MOTIFS: { re: RegExp; resout: (id: string) => boolean }[] = [
  { re: /spawnEnemy\(\s*\{\s*ref:\s*'([^']*)'/g, resout: creature },
  { re: /\bref:\s*\{\s*id:\s*'([^']*)',\s*type:\s*'creature'/g, resout: creature },
  { re: REF_SANS_TYPE, resout: creature },
  { re: /(?<=foes:\s*\[[^\]]*)\{\s*id:\s*'([^']*)'\s*\}/g, resout: creature },
  { re: /creatureId:\s*'([^']*)'/g, resout: refDeCombattant },
  { re: /\{[^{}]*kind:\s*'personnage'[^{}]*?\bcreature:\s*\{\s*id:\s*'([^']*)'/g, resout: creature },
  { re: /mode:\s*'entite',\s*kind:\s*'personnage',\s*ref:\s*'([^']*)'/g, resout: creature },
];

function sites(): { rel: string; ligne: number; id: string; resolu: boolean; motif: number; texte: string }[] {
  const out: { rel: string; ligne: number; id: string; resolu: boolean; motif: number; texte: string }[] = [];
  for (const fichier of readCorpus(['src'], { tests: true })) {
    const { rel, text: src } = fichier;
    if (!estSuiteVitest(rel) || rel === 'src/creature-id-litteral-guard.test.ts') continue;
    const lignes = src.split('\n');
    MOTIFS.forEach(({ re, resout }, motif) => {
      const correspondances = re === REF_SANS_TYPE ? refsSansType(fichier) : src.matchAll(re);
      for (const m of correspondances) {
        const ligne = src.slice(0, m.index).split('\n').length;
        out.push({ rel, ligne, id: m[1], resolu: resout(m[1]), motif, texte: lignes[ligne - 1].trim().replace(/\s+/g, ' ') });
      }
    });
  }
  return out;
}

describe('creature-id-litteral-guard (#1882)', () => {
  const vus = sites();

  it('aucune fixture ne pose une créature par un id hors du faisceau du spawn', () => {
    const fautes = vus
      .filter((s) => !s.resolu && !MORTES_PROUVEES.has(`${s.rel}|${s.texte}`))
      .map((s) => `${s.rel}|${s.texte}`);
    expect(fautes, 'poser un id du bestiaire (`creatures.json`), ou exempter le SITE dont la réf morte est le sujet').toEqual([]);
  });

  it('MORSURE : une Condition à côté de la possession ne masque pas une créature morte', () => {
    const text = `const fixture = {
      condition: { who: 'target', what: 'immunity', ref: { id: 'poison' }, kind: 'has' },
      possession: { ...bete(), ref: { id: 'creature-introuvable' } },
      animal: { nature: 'bete', ref: { id: 'mule' } },
    };`;
    expect(refsSansType({ rel: 'fixture.test.ts', text }).map((m) => [m[1], creature(m[1])])).toEqual([
      ['creature-introuvable', false],
      ['mule', true],
    ]);
  });

  it('PEUPLEMENT : chaque exemption est VUE par le scan (sinon exemption périmée)', () => {
    const vues = new Set(vus.filter((s) => !s.resolu).map((s) => `${s.rel}|${s.texte}`));
    expect([...MORTES_PROUVEES].filter((e) => !vues.has(e))).toEqual([]);
  });

  it('PEUPLEMENT : chaque motif lit au moins un site (sinon motif mort)', () => {
    expect(MOTIFS.map((_, i) => vus.filter((s) => s.motif === i).length).filter((n) => n === 0)).toEqual([]);
  });
});
