/**
 * Garde du CORPUS de grounding (#903) — `scripts/guards/lib/groundingCorpus.mjs` porte les cas,
 * ce fichier les relit. Le succès de #903 ne se mesure ni en nombre de documents générés ni en CI
 * verte : un agent SANS CONTEXTE doit trouver la bonne réponse. Rien d'autre dans le dépôt ne mesure
 * ça — fraîcheur/exhaustivité/couverture sont des proxys, une doc peut les satisfaire et rester
 * inutilisable. Ce corpus grandit à CHAQUE incident réel (un agent a cherché et n'a pas trouvé, ou a
 * trouvé un motif faux) : c'est le seul instrument dont la couverture suit les défauts au lieu de les
 * précéder.
 *
 * Portée volontairement ÉTROITE (cf. en-tête de `groundingCorpus.mjs`) : un motif trouvable par
 * mots-clefs dans une fenêtre de lignes, pas un agent qui comprend.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUNDING_CASES, type ResolvedGroundingCase, type PendingGroundingCase } from '../../scripts/guards/lib/groundingCorpus.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const resolved = GROUNDING_CASES.filter((c): c is ResolvedGroundingCase => c.status === 'resolu');
const pending = GROUNDING_CASES.filter((c): c is PendingGroundingCase => c.status === 'attente');

describe('corpus de grounding — cas RÉSOLUS (#903)', () => {
  for (const c of resolved) {
    it(`« ${c.question} » (mots-clefs : ${c.keywords.join(', ')}) reste trouvable dans ${c.surface}`, () => {
      const text = readFileSync(join(ROOT, c.surface), 'utf8');
      expect(
        c.resolves(text),
        `cas "${c.id}" — motif introuvable dans ${c.surface}\nincident fondateur : ${c.incident}`,
      ).toBe(true);
    });
  }
});

/**
 * Preuve MÉCANIQUE qu'aucun cas n'est décoratif (#903, incident du 2026-07-27 — le cas
 * `carriere-borne-partagee` était vert MÊME sans la ligne de concept générée, sauvé par le
 * préambule narratif de `docs/index-moteur.md` qui raconte l'incident et cite `rollCareer`).
 * Un cas dont on n'a pas prouvé qu'il vire au rouge quand sa propriété disparaît est décoratif.
 * `sabotage(text)` retire EXACTEMENT ce que le cas prétend vérifier ; ce bloc tourne à CHAQUE
 * exécution de la suite — pas une démonstration ponctuelle, ni une consigne de revue en plus.
 */
describe('corpus de grounding — chaque cas RÉSOLU vire au ROUGE quand sa propriété disparaît', () => {
  for (const c of resolved) {
    it(`« ${c.question} » — sabotage(text) fait basculer resolves() à false`, () => {
      const text = readFileSync(join(ROOT, c.surface), 'utf8');
      const sabotaged = c.sabotage(text);
      expect(sabotaged, `cas "${c.id}" — sabotage(text) n'a rien changé : la preuve ne prouve rien`).not.toBe(text);
      expect(
        c.resolves(sabotaged),
        `cas "${c.id}" reste VERT après sabotage de sa propre propriété — cas décoratif (test qui ment)`,
      ).toBe(false);
    });
  }
});

/**
 * Les cas EN ATTENTE, gelés NOMINATIVEMENT par leur id. La liste est VIDE : aucun cas du corpus
 * n'attend sa surface aujourd'hui, et l'égalité ci-dessous le dit dans les deux sens — poser un cas
 * en attente rougit en le NOMMANT (son id s'inscrit ici, geste visible dans ce fichier), construire
 * la surface d'un cas inscrit rougit aussi (son id se retire ici, dans le commit qui le résout).
 */
const EN_ATTENTE: readonly string[] = [];

describe('corpus de grounding — cas EN ATTENTE (surface manquante, jamais silencieux)', () => {
  for (const c of pending) {
    it(`EN ATTENTE — « ${c.question} » : surface manquante nommée`, () => {
      expect(c.surfaceManquante, `cas "${c.id}" en attente sans surface manquante documentée`).toBeTruthy();
    });
  }

  it('les cas en attente sont ceux qui sont INSCRITS ici, par leur id — ni plus, ni moins', () => {
    expect(
      pending.map((c) => c.id).sort(),
      'un cas en attente s’inscrit ICI par son id (et s’en retire quand sa surface est construite) — jamais un compte qui monte en silence.',
    ).toEqual([...EN_ATTENTE].sort());
  });
});
