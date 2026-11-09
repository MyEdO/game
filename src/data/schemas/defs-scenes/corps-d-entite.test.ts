/**
 * #2968 L16b — le corps d'une entité de scène se désigne par `ref(type)` sous une clé qui NOMME son type : `decor`
 * (`ref('prop')`), et d'un personnage, au plus un de `creature` (`ref('creature')`), `vehicule` (`ref('vehicle')`) et
 * `engin` (`ref('trapping')`, un engin de siège). Fixtures : les projets réels, référence connue, inconnue, écrite en
 * id nu, sous l'ancienne clé `ref`, deux corps, un objet qui n'est pas un engin. Aucun porteur n'est une liste.
 */
import { describe, expect, it } from 'vitest';
import { sceneEntitySchema } from './scene';
import { projetSchema } from './projet';
import { mesureDuParse } from '../grammaire/ref';
import { versDisque } from '../grammaire/prose';
import areneProjet from '../../../scenes/arene/arene-projet.json';
import bargeProjet from '../../../scenes/barge-du-sel/barge-du-sel-projet.json';
import diligenceProjet from '../../../scenes/diligence/diligence-projet.json';
import loupProjet from '../../../scenes/loup-et-saumure/loup-et-saumure-projet.json';

const PROJETS = { arene: areneProjet, 'barge-du-sel': bargeProjet, diligence: diligenceProjet, 'loup-et-saumure': loupProjet };

/** Le type de catalogue de chaque clé de corps. */
const TYPE_DU_CORPS: Record<string, string> = { decor: 'prop', creature: 'creature', vehicule: 'vehicle', engin: 'trapping' };

const PORTEURS = [
  { cle: 'decor', kind: 'prop', connue: 'tonneau', catalogue: 'décors (props.json)' },
  { cle: 'creature', kind: 'personnage', connue: 'humain', catalogue: 'créatures (creatures.json)' },
  { cle: 'vehicule', kind: 'personnage', connue: 'cogue', catalogue: 'véhicules (vehicles.json)' },
  { cle: 'engin', kind: 'personnage', connue: 'baliste', catalogue: 'objets (trappings.json)' },
];

const entite = (kind: string, corps: Record<string, unknown>) => ({ id: 'e', kind, pos: { x: 0, y: 0 }, ...corps });
const messages = (v: unknown): string[] => sceneEntitySchema.safeParse(v).error?.issues.map((i) => `${i.path.join('.')} ${i.message}`) ?? [];

describe('#2968 L16b — le corps d’une entité de scène désigné par `ref(type)`', () => {
  it.each(Object.entries(PROJETS))('%s : le projet parse, et chaque corps est un slot de son type au parse de mesure', (_, projet) => {
    const doc = versDisque(projet);
    expect(projetSchema.safeParse(doc).error).toBeUndefined();
    const corps = mesureDuParse(projetSchema, doc).reperes.filter((r) => r.path[0] === 'scenes' && r.path[2] === 'entities' && String(r.path[4]) in TYPE_DU_CORPS && r.path[5] === 'id');
    const attendus = projet.scenes.flatMap((s) => (s.entities ?? []).flatMap((e) => Object.keys(e).filter((k) => k in TYPE_DU_CORPS)));
    expect(corps.map((r) => r.type)).toEqual(attendus.map((k) => TYPE_DU_CORPS[k]));
    expect(corps.length).toBeGreaterThan(0);
  });

  it.each(PORTEURS)('$cle : une référence connue parse', ({ cle, kind, connue }) => {
    expect(messages(entite(kind, { [cle]: { id: connue } }))).toEqual([]);
  });

  it.each(PORTEURS)('$cle : une référence inconnue est refusée, son catalogue nommé', ({ cle, kind, catalogue }) => {
    expect(messages(entite(kind, { [cle]: { id: 'corps-inexistant' } }))).toContain(`${cle}.id « corps-inexistant » est absent du catalogue des ${catalogue}.`);
  });

  it.each(PORTEURS)('$cle : une référence écrite en id nu est refusée', ({ cle, kind, connue }) => {
    expect(sceneEntitySchema.safeParse(entite(kind, { [cle]: connue })).success).toBe(false);
  });

  it.each(PORTEURS)('$cle : l’ancienne clé `ref` est refusée', ({ kind, connue }) => {
    expect(sceneEntitySchema.safeParse(entite(kind, { ref: connue })).success).toBe(false);
  });

  it('un personnage porte un corps au plus', () => {
    expect(messages(entite('personnage', { creature: { id: 'humain' }, vehicule: { id: 'cogue' } }))).toEqual([
      'vehicule corps EXCLUSIFS — « creature », « vehicule » : un personnage en porte un au plus',
    ]);
  });

  it('un engin est un engin de siège', () => {
    expect(messages(entite('personnage', { engin: { id: 'baton-de-combat' } }))).toEqual(['engin.id « baton-de-combat » n\'est pas un engin de siège']);
  });

  it('un décor ne porte pas le corps d’un personnage, ni un personnage celui d’un décor', () => {
    expect(sceneEntitySchema.safeParse(entite('prop', { creature: { id: 'humain' } })).success).toBe(false);
    expect(sceneEntitySchema.safeParse(entite('personnage', { decor: { id: 'tonneau' } })).success).toBe(false);
  });
});
