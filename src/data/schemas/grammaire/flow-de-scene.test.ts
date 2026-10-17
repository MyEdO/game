/**
 * Le `flowSchema` de la GRAMMAIRE n'est PAS le Flow de SCÈNE (#1466, sonde du juge promue en garde).
 *
 * `flowSchema` est `Flow<EffectOp>` : sa feuille `do` porte un `EffectOp` (`{ type: 'ops', ops }`),
 * le vocabulaire du MOTEUR. Le Flow de scène est `Flow<Effect>` : sa feuille porte l'union `Effect`
 * de `state/scene.ts` (`startCombat`, `transition`, `journal`…). Réutiliser le premier pour valider
 * le second rejetterait TOUTES les feuilles authorées — ce test le mesure sur la donnée réelle, pour
 * que le lot T3-b compose un `sceneFlowSchema` propre au lieu de recycler celui de la grammaire.
 * La `Condition`, elle, est bien PARTAGÉE (même algèbre des deux côtés).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerProjetsLivres } from '../../../../scripts/guards/lib/projetsLivres.mjs';
import { flowSchema, effectOpSchema, conditionSchema } from './mecanique';
import { effectSchema, sceneFlowSchema } from '../defs-scenes/effets';

const RACINE = fileURLToPath(new URL('../../../scenes/', import.meta.url));
const PROJETS = listerProjetsLivres();

/** Toutes les feuilles `{ kind:'do', effect }` des Flows authorés des projets livrés. */
function feuillesDo(projets: unknown[]): unknown[] {
  const out: unknown[] = [];
  const marche = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(marche);
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (o.kind === 'do' && o.effect) out.push(o.effect);
    Object.values(o).forEach(marche);
  };
  projets.forEach(marche);
  return out;
}

const projets = PROJETS.map((p) => JSON.parse(readFileSync(RACINE + p, 'utf8')));
const croissance = structuredClone(projets);
const paquet = croissance.find((p) => p.id === 'la-diligence');
const scene = paquet.scenes.find((s: { id: string }) => s.id === 'la-diligence');
paquet.worldMap.places.push({ id: 'lieu-croissance-2337', label: 'Lieu de contrôle', pos: { x: 20, y: 20 }, scene: scene.id, icon: 'scenario/hamlet' });
scene.triggers.push({ id: 'declencheur-croissance-2337', rect: { x: 0, y: 0, w: 1, h: 1 }, once: true, flow: { kind: 'do', effect: { type: 'setFlag', flag: 'croissance-2337' } } });

describe.each([
  { nom: 'corpus livré', corpus: projets, ajoute: false },
  { nom: 'corpus avec un lieu et un déclencheur supplémentaires', corpus: croissance, ajoute: true },
])('grammaire — $nom : `flowSchema` (Flow<EffectOp>) ≠ Flow de scène (Flow<Effect>)', ({ corpus, ajoute }) => {
  const feuilles = feuillesDo(corpus);

  it('le corpus réel reste branché : le départ de La Diligence est observé', () => {
    expect(feuilles).toContainEqual({ type: 'setFlag', flag: 'edo-ch1-depart' });
    if (ajoute) {
      expect(feuilles).toContainEqual({ type: 'setFlag', flag: 'croissance-2337' });
      expect(feuilles.length).toBe(feuillesDo(projets).length + 1);
    }
  });

  it('POSITIF — les feuilles `do` réelles passent TOUTES `effectSchema` (le vocabulaire de scène)', () => {
    const refusees = feuilles
      .map((e, i) => ({ i, e, r: effectSchema.safeParse(e) }))
      .filter((x) => !x.r.success)
      .map((x) => `#${x.i} ${JSON.stringify(x.e).slice(0, 120)}`);
    expect(refusees, 'une feuille authorée refusée par `effectSchema` : la donnée ou le schéma ment.').toEqual([]);
  });

  it('POSITIF — un Flow de scène entier passe `sceneFlowSchema`, celui-là même que `flowSchema` refuse', () => {
    const flow = { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'startCombat', encounter: 'enc-1' } }] };
    expect(sceneFlowSchema.safeParse(flow).success).toBe(true);
    expect(flowSchema.safeParse(flow).success).toBe(false);
  });

  it('AUCUNE feuille `do` de scène ne passe `effectOpSchema` — le vocabulaire est disjoint', () => {
    const acceptees = feuilles.filter((e) => effectOpSchema.safeParse(e).success);
    expect(acceptees, 'une feuille de scène acceptée par la feuille MOTEUR : vérifier le vocabulaire').toEqual([]);
  });

  it('un Flow de scène entier est donc REFUSÉ par `flowSchema`, sur le `type` de sa feuille', () => {
    const res = flowSchema.safeParse({ kind: 'seq', steps: [{ kind: 'do', effect: { type: 'startCombat', encounter: 'enc-1' } }] });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].path.join('.')).toBe('steps.0.effect.type');
  });

  it('la `Condition`, elle, est PARTAGÉE : celle d\'une scène passe `conditionSchema`', () => {
    expect(conditionSchema.safeParse({ kind: 'flag', expr: 'porte-ouverte' }).success).toBe(true);
  });
});

/**
 * Le nœud `test` est déclaré UNE fois (`noeudTest`, `grammaire/mecanique.ts`) et paramétré par sa
 * branche : les deux instances du Flow en reçoivent la MÊME forme (#1657). Ce contrat est POSITIF et
 * SYMÉTRIQUE — il nomme les clés attendues des deux côtés et refuse la clé inconnue des deux côtés :
 * une clé renommée dans la fabrique fait rougir les deux, jamais un seul.
 */
describe('grammaire — le nœud `test` des DEUX instances du Flow vient de la même fabrique', () => {
  const jet = { skill: { id: 'escalade' }, difficulty: 'intermediaire' };
  const noeudMecanique = {
    kind: 'test',
    test: jet,
    success: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'heal', amount: 1 }] } },
    fail: { kind: 'seq', steps: [] },
  };
  const noeudScene = {
    kind: 'test',
    test: jet,
    success: { kind: 'do', effect: { type: 'startCombat', encounter: 'enc-1' } },
    fail: { kind: 'seq', steps: [] },
  };

  it('POSITIF — le nœud `test` passe `flowSchema` (branche mécanique) ET `sceneFlowSchema` (branche de scène)', () => {
    const m = flowSchema.safeParse(noeudMecanique);
    expect(m.success, m.success ? '' : JSON.stringify(m.error.issues)).toBe(true);
    const sc = sceneFlowSchema.safeParse(noeudScene);
    expect(sc.success, sc.success ? '' : JSON.stringify(sc.error.issues)).toBe(true);
  });

  it('les DEUX branches sont exigées, sous les MÊMES noms — `success` et `fail`', () => {
    const cas = [
      ['flowSchema', flowSchema, noeudMecanique],
      ['sceneFlowSchema', sceneFlowSchema, noeudScene],
    ] as const;
    for (const [nom, schema, noeud] of cas)
      for (const branche of ['success', 'fail'] as const) {
        const ampute: Record<string, unknown> = { ...noeud };
        delete ampute[branche];
        expect(schema.safeParse(ampute).success, `${nom} : la branche \`${branche}\` n'est plus exigée.`).toBe(false);
      }
  });

  it('une clé INCONNUE est refusée des deux côtés (le nœud reste STRICT)', () => {
    expect(flowSchema.safeParse({ ...noeudMecanique, succes: noeudMecanique.success }).success).toBe(false);
    expect(sceneFlowSchema.safeParse({ ...noeudScene, succes: noeudScene.success }).success).toBe(false);
  });
});
