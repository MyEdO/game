/**
 * `actions.json` — le GESTE SECONDAIRE (`surface: 'geste-secondaire'`, #1411 P2-B) n'a pas d'alvéole
 * propre : il naît de l'alvéole d'une AUTRE entrée, qu'il nomme (`hote`), et n'est offert que sur les
 * candidats de la population qu'il DÉCLARE (`candidates`). Sans ces deux champs — ou avec un `hote`
 * qui ne mène à aucune alvéole — l'entrée serait déclarée au registre et RENDUE NULLE PART : le
 * schéma doit la refuser AU CHARGEMENT, pas la console au rendu.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './actions';
import actionsJson from '../../actions.json';

/** Alvéole HÔTE minimale (une entrée de grille ordinaire) et son geste secondaire. */
const HOTE = {
  id: 'incantation', type: 'actions', label: 'Incanter', icon: 'magie/puissance', surface: 'grille',
  gate: 'action-libre-hors-frenesie', run: 'incanterLeSort', candidates: 'sorts-du-heros', coutAction: 'action',
} as const;
const GESTE = {
  id: 'focalisation', type: 'actions', label: 'Focaliser', icon: 'drapeau/focalisation', surface: 'geste-secondaire',
  hote: { id: 'incantation' }, gate: 'sort-focalisable', run: 'focaliserLeSort', candidates: 'sorts-du-heros', coutAction: 'action',
} as const;

const sans = <T extends object, K extends keyof T>(o: T, k: K): Omit<T, K> => {
  const { [k]: _, ...reste } = o;
  return reste;
};

describe('actions.json — un geste secondaire mène TOUJOURS à une alvéole', () => {
  it('m0 TÉMOIN : le registre RÉEL parse, et le couple hôte/geste minimal aussi', () => {
    expect(schema.safeParse(actionsJson).success).toBe(true);
    expect(schema.safeParse([HOTE, GESTE]).success).toBe(true);
  });

  const refuses: [string, unknown[]][] = [
    ['m1 — geste secondaire SANS `hote` : aucune alvéole ne le porterait', [HOTE, sans(GESTE, 'hote')]],
    ['m2 — `hote` FANTÔME : l’id ne résout aucune entrée du registre', [HOTE, { ...GESTE, hote: { id: 'alveole-inexistante' } }]],
    ['m3 — `hote` lui-même geste secondaire : aucune alvéole au bout de la chaîne', [
      HOTE, GESTE, { ...GESTE, id: 'sur-focus', hote: { id: 'focalisation' } },
    ]],
    ['m4 — `hote` porté par une entrée qui n’est PAS un geste secondaire', [{ ...HOTE, hote: { id: 'incantation' } }, GESTE]],
    ['m5 — geste secondaire SANS `candidates` : sa population n’est pas déclarée', [HOTE, sans(GESTE, 'candidates')]],
  ];
  for (const [cas, data] of refuses)
    it(`REFUSÉ : ${cas}`, () => {
      expect(schema.safeParse(data).success).toBe(false);
    });

  it('le message DIT quoi corriger (un auteur ne devine pas)', () => {
    const m1 = schema.safeParse([HOTE, sans(GESTE, 'hote')]);
    expect(m1.success).toBe(false);
    if (!m1.success) expect(m1.error.issues.map((i) => i.message).join('\n')).toContain('sans entrée hôte');
    const m2 = schema.safeParse([HOTE, { ...GESTE, hote: { id: 'alveole-inexistante' } }]);
    expect(m2.success).toBe(false);
    if (!m2.success) expect(m2.error.issues.map((i) => i.message).join('\n')).toContain('absent du registre');
  });
});
