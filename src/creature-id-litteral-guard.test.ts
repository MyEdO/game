/**
 * GARDE (#1882 T2d) — aucun littéral d'id de créature hors dataset dans les suites Vitest de `src/**`.
 *
 * QUESTION : une fixture qui pose une créature par un id que le bestiaire ne connaît pas (`'bandit-de-grand-chemin'`,
 * un libellé pris pour un id `'Villageois'`) teste-t-elle ce qu'elle croit ? Non : elle testait le mannequin de
 * repli mort avec #1882. Sites lus : `spawnEnemy({ ref: 'x' }`, `creatureId: 'x'`, `ref: 'x'` d'un littéral
 * `kind: 'personnage'`. Résolution : le faisceau du spawn (`refEntiteResolue`, `data/index.ts`) pour une réf
 * de fiche ; ce faisceau plus les STRUCTURES pour le `creatureId` d'un combattant (`engine/inanimate.ts:53`
 * `creatureId: s.refId`, posé par `engine/structures.ts:164` `refId: struct.id` et par le spawn des coques et
 * engins) ; le bestiaire SEUL pour un `ref: { creatureId }` (`livingRefSchema`, `defs-scenes/effets.ts`).
 * Exemptés au SITE (`fichier|ligne du site`) : les tests dont la réf MORTE est le SUJET (refus prouvé).
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { estSuiteVitest } from '../scripts/guards/lib/fichierVitest.mjs';
import { findCreatureById, refEntiteResolue, structures } from './data';

/** Les réfs MORTES que leur test PROUVE (refus, repli signalé) — `fichier|ligne du site` (texte, espaces réduits). */
const MORTES_PROUVEES = new Set<string>([
  "src/gameIso/tokenBodyKind.test.ts|const r = tokenBodyKind({ kind: 'sceneEntity', ent: ent({ id: 'e', kind: 'personnage', ref: 'ref-totalement-inconnue' }) });",
  "src/state/give-possession-effect.test.ts|expect(refs({ type: 'givePossession', nature: 'bete', ref: { creatureId: '' } } as never, ctx)).toEqual([{ level: 'error', message: 'Possession → créature inexistante « (aucune) »' }]);",
  "src/state/give-possession-effect.test.ts|expect(refs({ type: 'givePossession', nature: 'bete', ref: { creatureId: 'licorne-mauve' } } as never, ctx)).toEqual([{ level: 'error', message: 'Possession → créature inexistante « licorne-mauve »' }]);",
  "src/state/projet-migration-12-vers-13.test.ts|{ id: 'a', kind: 'personnage', ref: '', pos: { x: 0, y: 0 }, appearance: { species: ESPECE } },",
  "src/state/projet-migration-12-vers-13.test.ts|{ id: 'b', kind: 'personnage', ref: '', presetId: '', pos: { x: 0, y: 0 } },",
  "src/state/projet-migration-13-vers-14.test.ts|{ kind: 'do', effect: { type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' }, foes: [{ ref: { creatureId: '' } }], encounter: '' } },",
  "src/state/projet-migration-13-vers-14.test.ts|{ kind: 'do', effect: { type: 'givePossession', nature: 'bete', ref: { creatureId: '' } } },",
  "src/state/projet-migration-13-vers-14.test.ts|const PERIL_POSSESSION = { type: 'givePossession', nature: 'bete', ref: { creatureId: '' } };",
  "src/state/projet-migration-13-vers-14.test.ts|const PERIL_POURSUITE = { type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' }, foes: [{ ref: { creatureId: '' } }], encounter: '' };",
  "src/state/validateScene-contenu.test.ts|expect(() => spawnEnemy({ ref: 'ref-qui-nexiste-nulle-part' }, 'e-1', { x: 2, y: 2 })).toThrow(RefIrresoluble);",
  "src/ui/editor/editorState.test.ts|expect(() => placeEntity(emptyScene(10, 10), { mode: 'entity', kind: 'personnage', ref: 'Humain' }, { x: 1, y: 1 }))",
]);

/** Le `creatureId` d'un combattant : une réf de fiche, ou l'id d'une STRUCTURE (objet inanimé). */
const refDeCombattant = (id: string) => refEntiteResolue(id) || structures.some((st) => st.id === id);

/** Chaque site et la famille qu'il admet : une réf de fiche, un combattant, ou une CRÉATURE seule. */
const MOTIFS: { re: RegExp; resout: (id: string) => boolean }[] = [
  { re: /spawnEnemy\(\s*\{\s*ref:\s*'([^']*)'/g, resout: refEntiteResolue },
  { re: /ref:\s*\{\s*creatureId:\s*'([^']*)'/g, resout: (id) => !!findCreatureById(id) },
  { re: /(?<!ref:\s*\{\s*)creatureId:\s*'([^']*)'/g, resout: refDeCombattant },
  { re: /\{[^{}]*kind:\s*'personnage'[^{}]*?\bref:\s*'([^']*)'/g, resout: refEntiteResolue },
];

function sites(): { rel: string; ligne: number; id: string; resolu: boolean; motif: number; texte: string }[] {
  const out: { rel: string; ligne: number; id: string; resolu: boolean; motif: number; texte: string }[] = [];
  for (const { rel, text: src } of readCorpus(['src'], { tests: true })) {
    if (!estSuiteVitest(rel) || rel === 'src/creature-id-litteral-guard.test.ts') continue;
    const lignes = src.split('\n');
    MOTIFS.forEach(({ re, resout }, motif) => {
      for (const m of src.matchAll(re)) {
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

  it('PEUPLEMENT : chaque exemption est VUE par le scan (sinon exemption périmée)', () => {
    const vues = new Set(vus.filter((s) => !s.resolu).map((s) => `${s.rel}|${s.texte}`));
    expect([...MORTES_PROUVEES].filter((e) => !vues.has(e))).toEqual([]);
  });

  it('PEUPLEMENT : chaque motif lit au moins un site (sinon motif mort)', () => {
    expect(MOTIFS.map((_, i) => vus.filter((s) => s.motif === i).length).filter((n) => n === 0)).toEqual([]);
  });
});
