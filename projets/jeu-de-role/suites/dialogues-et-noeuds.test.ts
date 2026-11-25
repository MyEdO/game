/**
 * #2968 L15 sur les paquets du jeu : leurs scènes parsent, et leurs références de nœud et de dialogue sont des slots
 * `local:nodes` / `local:dialogues` au parse de mesure. Contrat de `ref(portee)` : `src/data/schemas/defs-scenes/dialogues-et-noeuds.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { sceneSchema } from '../../../src/data/schemas/defs-scenes/scene';
import { mesureDuParse } from '../../../src/data/schemas/grammaire/ref';
import areneProjet from '../campagnes/arene/arene-projet.json';
import loupEtSaumureProjet from '../campagnes/loup-et-saumure/loup-et-saumure-projet.json';

describe('#2968 L15 — dialogues et nœuds des paquets du jeu', () => {
  it('les scènes réelles parsent, et leurs références sont des slots `local:nodes` / `local:dialogues` au parse de mesure', () => {
    const compte = (projet: { scenes: readonly unknown[] }, cible: string) =>
      projet.scenes.flatMap((s) => {
        expect(sceneSchema.safeParse(s).success).toBe(true);
        return mesureDuParse(sceneSchema, s).reperes.filter((r) => r.type === cible);
      }).length;
    /** Les références de nœud écrites dans la donnée : le `start` de chaque dialogue et chaque `choices[].next`. */
    const nodesEcrits = (projet: { scenes: readonly unknown[] }) =>
      (projet.scenes as { dialogues?: { nodes: { choices?: { next?: unknown }[] }[] }[] }[])
        .flatMap((s) => s.dialogues ?? [])
        .reduce((n, d) => n + 1 + d.nodes.flatMap((x) => x.choices ?? []).filter((c) => c.next !== undefined).length, 0);
    for (const projet of [areneProjet, loupEtSaumureProjet]) {
      expect(compte(projet, 'local:nodes')).toBe(nodesEcrits(projet));
      expect(compte(projet, 'local:dialogues')).toBeGreaterThan(0);
    }
  });

});
