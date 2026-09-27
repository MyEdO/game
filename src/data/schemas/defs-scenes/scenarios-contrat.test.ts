/**
 * Contrat des SCÈNES CONSTRUITES par les scénarios de test (#1466 L1a T3-c).
 *
 * Le corpus de `effets.test.ts` scanne les documents JSON ; celui-ci prend l'autre moitié du réel :
 * les scènes fabriquées EN TYPESCRIPT (`arena`/`buildScene`/littéraux) par les scénarios du menu
 * Tests. Même patron de contrat : registre GÉNÉRÉ parcouru en entier, PLANCHER de corpus asserté (un
 * vert vide reste impossible ; le compte RÉEL s'imprime en diagnostic — un cardinal vivant qu'un lot
 * ÉTRANGER fait croître ne rougit pas ce fichier), zéro KO, chaque refus NOMMANT le scénario et le
 * chemin zod.
 *
 * Chemin RÉEL : `SCENARIOS` (registre `scripts/gen-registry.mjs`) est ce que `test-scenarios/index.ts`
 * trie pour le menu ; chaque entrée porte ses scènes DÉJÀ construites (`scene`, `extraScenes`) —
 * aucune reconstruction ici, on parse exactement les objets que le lancement charge.
 *
 * ANGLE MORT CHIFFRÉ : ces verts ne valent qu'À CONCURRENCE des trous de `TROUS_DE_VALIDATION`
 * (`trous-de-validation.ts`) que le corpus TRAVERSE — mesuré le 2026-08-25 sur les 85 scènes :
 * `statblock` (19 occurrences, 8 scènes), `optionals` (14 entrées, 13 scènes), `postes`
 * (18 entrées, 6 scènes) ; le 4ᵉ trou (`narratif.ts:objets`) n'est pas atteint par ce corpus.
 * Sous ces champs, `z.custom` accepte tout : le parse y est un passe-droit, pas une validation.
 */
import { describe, it, expect } from 'vitest';
import { SCENARIOS } from '../../../scenes/test-scenarios/_registry.generated';
import { sceneSchema } from './scene';

/** Toutes les scènes qu'un scénario apporte au projet : la scène d'entrée + ses destinations. */
function scenesDe(s: (typeof SCENARIOS)[number]): { chemin: string; scene: unknown }[] {
  const c = s.construire();
  const out = [{ chemin: `${s.id}.scene`, scene: c.scene as unknown }];
  (c.extraScenes ?? []).forEach((sc, i) => out.push({ chemin: `${s.id}.extraScenes[${i}] (${sc.id})`, scene: sc }));
  return out;
}

describe('sceneSchema — les scènes CONSTRUITES par les scénarios de test', () => {
  const scenes = SCENARIOS.flatMap(scenesDe);

  it('le contrat VOIT le corpus qu’il prétend mesurer', () => {
    expect(SCENARIOS.length, `scénarios au registre : ${SCENARIOS.length}`).toBeGreaterThanOrEqual(40);
    expect(scenes.length, `scènes construites (scene + extraScenes) : ${scenes.length}`).toBeGreaterThanOrEqual(89);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  it('CHAQUE scène construite parse — le refus NOMME le scénario et le chemin', () => {
    const ko = scenes
      .map(({ chemin, scene }) => ({ chemin, r: sceneSchema.safeParse(scene) }))
      .filter((x) => !x.r.success)
      .map((x) => `${x.chemin} — ${x.r.success ? '' : x.r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ; ')}`);
    expect(ko, `Scène(s) de scénario que le schéma refuse :\n${ko.join('\n')}`).toEqual([]);
  });
});
