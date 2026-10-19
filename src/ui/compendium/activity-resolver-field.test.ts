/**
 * CONTRAT du sélecteur de résolveur d'Activité du Codex (`resolverChoicesFor`, `CodexEdit.tsx`) :
 * un contexte d'Activité SANS famille de résolveur n'affiche PAS le champ — jamais une liste
 * déroulante à zéro option (affordance morte). La table `OWNERS_BY_CONTEXT` est TOTALE : tout
 * contexte du vocabulaire est classé (famille ou `null`), et aucune famille rendue n'est vide.
 */
import { describe, it, expect } from 'vitest';
import { resolverChoicesFor } from '../editor/codex/CodexEdit';
import { ACTIVITIES, ACTIVITY_RESOLVERS, resolversOwnedBy, type ActivityContext, type ResolverOwner } from '../../engine/activities';

const CONTEXTS: ActivityContext[] = ['interlude', 'voyage', 'mer', 'bataille', 'bataille-round', 'auberge'];
/** Les 3 contextes qui SONT aussi des familles de résolveur (homonymie assumée du vocabulaire). */
const CONTEXTS_A_FAMILLE: ResolverOwner[] = ['interlude', 'voyage', 'mer'];

describe('sélecteur de résolveur du Codex — un contexte sans famille n’affiche pas le champ', () => {
  it('bataille-round (Rassemblement, ADE II 8 l.122) : AUCUN champ rendu', () => {
    expect(resolverChoicesFor(['bataille-round'])).toBeNull();
    expect(resolverChoicesFor(['bataille'])).toBeNull();
    expect(resolverChoicesFor(['bataille', 'bataille-round'])).toBeNull();
  });

  it('interlude / voyage / mer : le champ est rendu, filtré sur la famille, et JAMAIS vide', () => {
    for (const c of CONTEXTS_A_FAMILLE) {
      const choix = resolverChoicesFor([c]);
      expect(choix, `${c} : champ absent`).not.toBeNull();
      expect(choix!.familles).toEqual([c]);
      expect(choix!.options).toEqual(resolversOwnedBy(c));
      expect(choix!.options.length, `${c} : famille vide rendue`).toBeGreaterThan(0);
    }
  });

  it('contextes MIXTES : seules les familles présentes filtrent (voyage + auberge → voyage)', () => {
    const choix = resolverChoicesFor(['voyage', 'auberge'])!;
    expect(choix.familles).toEqual(['voyage']);
    expect(choix.options).toEqual(resolversOwnedBy('voyage'));
  });

  it('aucun contexte déclaré : rien ne filtre ⇒ vocabulaire COMPLET', () => {
    expect(resolverChoicesFor([])!.options).toEqual([...ACTIVITY_RESOLVERS]);
  });

  it('une valeur AUTHORÉE reste éditable même dans un contexte sans famille', () => {
    expect(resolverChoicesFor(['bataille-round'], 'forage')!.options).toEqual(['forage']);
    expect(resolverChoicesFor(['mer'], 'forage')!.options[0]).toBe('forage');
  });

  it('toute Activité RÉELLE dont le champ est rendu reçoit au moins une option', () => {
    for (const c of CONTEXTS) {
      const choix = resolverChoicesFor([c]);
      if (choix) expect(choix.options.length, `${c} : sélecteur à zéro option`).toBeGreaterThan(0);
    }
    for (const a of ACTIVITIES) {
      const choix = resolverChoicesFor(a.contexts, a.resolver);
      if (choix) expect(choix.options.length, `${a.id} : sélecteur à zéro option`).toBeGreaterThan(0);
      else expect(a.resolver, `${a.id} : résolveur authoré mais champ masqué`).toBeUndefined();
    }
  });
});
