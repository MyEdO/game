/**
 * Le JET (`jetSchema`, LDB 12 l.7, l.137) est UNE forme de la grammaire : le Test de flux, la
 * récupération d'un État et la racine d'un jeu de taverne la COMPOSENT — mêmes nœuds, jamais une copie.
 * La DÉCISION d'un Test (`decisionDuTestSchema`, #1874) l'est aussi : le Test de flux et le Test étendu la composent ;
 * le Test FIXE (`testFixeSchema`) n'en porte aucun champ.
 */
import { describe, expect, it } from 'vitest';
import { decisionDuTestSchema, extendedTestSchema, flowTestSchema, jetSchema, testDeSceneSchema, testFixeSchema } from './mecanique';
import { coDescendre, enfantsDe } from './descente';
import { CHAMPS_DE_DECISION, type ChampDeDecision } from '../../../engine/flowCore';
import { DEFS_DE_DOCUMENT, noeudDeLEntree, noeudObjet, validateDataset } from '../validate';
import { etats } from '../../index';
import tavernGames from '../../tavernGames.json';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const champ = (noeud: unknown, cle: string): unknown => enfantsDe(noeudObjet(noeud)).find((e) => e.cle === cle)?.noeud;
const CLES = ['skill', 'characteristic', 'difficulty'] as const;

describe('jetSchema — une forme, trois porteurs', () => {
  it('le Test de flux compose le jet', () => {
    for (const cle of CLES) expect(champ(flowTestSchema, cle), cle).toBe(champ(jetSchema, cle));
  });

  it('la récupération d’un État compose le jet', () => {
    const etat = etats.find((e) => e.recover);
    if (!etat) throw new Error('aucun État ne porte de récupération (`recover`)');
    const recover = champ(noeudDeLEntree('etats', etat), 'recover');
    for (const cle of CLES) expect(champ(recover, cle), cle).toBe(champ(jetSchema, cle));
  });

  it('la racine d’un jeu de taverne compose le jet', () => {
    const racine = noeudDeLEntree('tavernGames', tavernGames[0]);
    for (const cle of CLES) expect(champ(racine, cle), cle).toBe(champ(jetSchema, cle));
  });
});

describe('decisionDuTestSchema — une décision, deux porteurs', () => {
  it('la décision porte exactement `CHAMPS_DE_DECISION`', () => {
    expect(Object.keys(decisionDuTestSchema.shape).sort()).toEqual([...CHAMPS_DE_DECISION].sort());
  });

  it('le Test de flux et le Test étendu composent la décision et le jet', () => {
    for (const cle of CHAMPS_DE_DECISION) {
      expect(champ(flowTestSchema, cle), cle).toBe(champ(decisionDuTestSchema, cle));
      expect(champ(extendedTestSchema, cle), cle).toBe(champ(decisionDuTestSchema, cle));
    }
    for (const cle of CLES) expect(champ(extendedTestSchema, cle), cle).toBe(champ(jetSchema, cle));
  });
});

/** Une valeur VALIDE de chaque champ de décision : le Test de flux l'accepte, le Test fixe refuse la clé. */
const DECISION_VALIDE: Record<ChampDeDecision, unknown> = {
  gate: { kind: 'always' },
  onlyGroups: ['nain'],
  exceptGroups: ['nain'],
  difficultyBy: [{ cond: { kind: 'always' }, difficulty: 'facile' }],
  easierIf: { hasSkill: { id: 'athletisme' } },
};
const TEST_MINIMAL = { skill: { id: 'athletisme' }, difficulty: 'intermediaire' };

/** Chaque document qui compose `testFixeSchema`, avec le chemin de donnée de son premier Test fixe. */
const PORTEURS_FIXES = DEFS_DE_DOCUMENT.flatMap((def) => {
  const donnee: unknown = JSON.parse(readFileSync(join(process.cwd(), def.root, def.file), 'utf8'));
  let chemin: readonly (string | number)[] | undefined;
  coDescendre(def.schema, donnee, (p) => {
    if (!p.noeuds.includes(testFixeSchema)) return;
    chemin = p.chemin;
    return 'arreter';
  });
  return chemin ? [{ fichier: def.file, donnee, chemin }] : [];
});

/** La valeur au `chemin` de `donnee`. */
const auChemin = (donnee: unknown, chemin: readonly (string | number)[]): unknown => chemin.reduce<unknown>((v, pas) => Reflect.get(Object(v), pas), donnee);

describe('testFixeSchema — aucun champ de décision', () => {
  it('un Test fixe minimal refuse chaque champ de `CHAMPS_DE_DECISION` que le Test de flux accepte', () => {
    expect(testFixeSchema.safeParse(TEST_MINIMAL).success).toBe(true);
    for (const cle of CHAMPS_DE_DECISION) {
      const avec = { ...TEST_MINIMAL, [cle]: DECISION_VALIDE[cle] };
      expect(flowTestSchema.safeParse(avec).success, `Test de flux + ${cle}`).toBe(true);
      expect(testFixeSchema.safeParse(avec).success, `Test fixe + ${cle}`).toBe(false);
    }
  });

  it('la donnée réelle compose le Test fixe', () => {
    expect(PORTEURS_FIXES.length).toBeGreaterThan(0);
  });

  it.each(PORTEURS_FIXES)('$fichier : le Test fixe d’un porteur réel refuse chaque champ de décision', ({ fichier, donnee, chemin }) => {
    expect(validateDataset(fichier, donnee), 'témoin').toBeNull();
    for (const cle of CHAMPS_DE_DECISION) {
      const copie: unknown = structuredClone(donnee);
      Reflect.set(Object(auChemin(copie, chemin)), cle, DECISION_VALIDE[cle]);
      expect(validateDataset(fichier, copie) ?? '', `${fichier} + ${cle}`).toContain(`"${cle}"`);
    }
  });
});

describe('argDifficulty — au seul Test de flux', () => {
  it('le Test de flux porte `argDifficulty` ; le Test de scène et le Test fixe, non', () => {
    expect(champ(flowTestSchema, 'argDifficulty')).toBeDefined();
    expect(champ(testDeSceneSchema, 'argDifficulty')).toBeUndefined();
    expect(champ(testFixeSchema, 'argDifficulty')).toBeUndefined();
  });
});
