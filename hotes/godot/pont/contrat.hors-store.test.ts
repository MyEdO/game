/**
 * LE CONTRAT DU PONT (#2928, `CONTRAT.md`) : la réponse est toujours une chaîne JSON ; une méthode inconnue, une entrée
 * illisible ou hors contrat, un appel avant `demarrer`, un second `demarrer` (un par page, plan M-g) et un jeton inconnu
 * se refusent en `validation` ; un geste refusé porte la catégorie que le module commun lui donne (`validation`,
 * `permission`, `regle`), une levée qu'aucun contrôle n'attendait la catégorie `interne` ; les erreurs de la page
 * s'y relèvent. Une partie par contexte JS : les tests de ce fichier jouent, dans l'ordre, sur un même pont.
 */
import { describe, it, expect, vi } from 'vitest';
import { drainer, erreurDe, suiteDe, table } from './pont.testkit';
import type { VueDuPont } from './pont';

/** La panne d'un lecteur de la vue, armée par le test de la catégorie `interne`. */
const panne = vi.hoisted(() => ({ projeter: false }));
vi.mock('../../../src/hote/projection', async (importOriginal) => {
  const origine = await importOriginal<typeof import('../../../src/hote/projection')>();
  return {
    ...origine,
    projeter: (...a: Parameters<typeof origine.projeter>) => {
      if (panne.projeter) throw new Error('lecteur en panne');
      return origine.projeter(...a);
    },
  };
});

/** La page témoin : son `addEventListener`, posé avant le pont, reçoit les erreurs que le test y émet. */
const page = new EventTarget();
Object.assign(globalThis, { addEventListener: page.addEventListener.bind(page) });

const { pont, appel } = table();

/** La vue que rend `vue`. */
const vue = (): VueDuPont => (appel('vue') as { vue: VueDuPont }).vue;

describe('le pont avant sa partie', () => {
  it('une méthode inconnue se refuse en `validation` et nomme les méthodes du contrat', () => {
    const e = erreurDe(appel('simulerAttaque', {}));
    expect(e.categorie).toBe('validation');
    expect(e.message).toBe('méthode inconnue : simulerAttaque (méthodes : demarrer, vue, jouer, reprendre, erreursGlobales)');
  });

  it('`vue`, `jouer` et `reprendre` se refusent sans partie', () => {
    for (const [methode, entree] of [['vue', undefined], ['jouer', { type: 'confirmRoundStart', args: [] }], ['reprendre', { jeton: 0 }]] as const) {
      expect(erreurDe(appel(methode, entree)), methode).toEqual({ categorie: 'validation', message: 'aucune partie : demarrer d’abord' });
    }
  });

  it('une entrée illisible, qui n’est pas un objet, ou qui porte une clé hors contrat se refuse en `validation`', () => {
    expect(JSON.parse(pont.appeler('demarrer', '{scenario'))).toEqual({ ok: false, erreur: { categorie: 'validation', message: 'demarrer : entrée JSON illisible' } });
    expect(erreurDe(appel('demarrer', ['dome'])).message).toBe('demarrer : l’entrée est un objet JSON');
    expect(erreurDe(appel('demarrer', { scenario: 'dome', grain: 3 })).message).toBe('demarrer : grain hors de l’entrée (clés : scenario, graine)');
  });

  it('un scénario inconnu ou une graine non entière se refuse, et ne démarre rien', () => {
    expect(erreurDe(appel('demarrer', { scenario: 'zz-inconnu', graine: 7 }))).toEqual({ categorie: 'validation', message: 'scénario inconnu : zz-inconnu' });
    expect(erreurDe(appel('demarrer', { scenario: 'dome', graine: 1.5 }))).toEqual({ categorie: 'validation', message: 'graine non entière : 1.5' });
    expect(erreurDe(appel('vue')).message).toBe('aucune partie : demarrer d’abord');
  });
});

describe('le pont et sa partie', () => {
  it('`demarrer` ouvre la partie une fois par page ; un second appel se refuse', { timeout: 120_000 }, () => {
    const { suite } = drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
    expect(suite.vue.projection.fenetre?.verbes.length, 'la vue nomme les verbes de la fenêtre ouverte').toBeGreaterThan(0);
    const e = erreurDe(appel('demarrer', { scenario: 'dome', graine: 7 }));
    expect(e.categorie).toBe('validation');
    expect(e.message).toMatch(/une partie par page, déjà démarrée/);
    expect(vue(), '`vue` rend la vue de la dernière suite').toEqual(suite.vue);
  });

  it('un jeton inconnu se refuse en `validation`', () => {
    expect(erreurDe(appel('reprendre', { jeton: 999 }))).toEqual({ categorie: 'validation', message: 'jeton inconnu : 999' });
    expect(erreurDe(appel('reprendre', { jeton: 'a' })).message).toBe('reprendre : jeton, le numéro d’un jeton programmé');
  });

  it('une levée qu’aucun contrôle n’attendait se rend en `interne`, dans une chaîne JSON', () => {
    panne.projeter = true;
    try {
      expect(JSON.parse(pont.appeler('vue'))).toEqual({ ok: false, erreur: { categorie: 'interne', message: 'lecteur en panne' } });
    } finally {
      panne.projeter = false;
    }
    expect(appel('vue').ok, 'le lecteur rétabli, la vue se rend').toBe(true);
  });

  it('un verbe inconnu nomme les verbes de la fenêtre qui tient la main ; un argument en trop se refuse', () => {
    const fenetre = vue().projection.fenetre!;
    const e = erreurDe(appel('jouer', { type: 'confirmRound', args: [] }));
    expect(e.categorie).toBe('validation');
    expect(e.message).toContain(`verbe inconnu : confirmRound ; verbes de la fenêtre ${fenetre.cle} : ${fenetre.verbes.join(', ')}`);
    expect(erreurDe(appel('jouer', { type: fenetre.verbes[0], args: [1] })).categorie).toBe('validation');
    expect(erreurDe(appel('jouer', { offre: 'end-turn', type: 'x' })).message).toBe('jouer : type hors de l’entrée (clés : offre, ctx)');
  });

  it('chaque catégorie d’un geste refusé : `validation`, `permission`, `regle`', { timeout: 120_000 }, () => {
    drainer(appel, appel('jouer', { type: 'confirmRoundStart', args: [] }));
    expect(erreurDe(appel('jouer', { type: 'jouerLOffre', args: ['end-turn'], siege: 0 })).categorie).toBe('validation');
    expect(erreurDe(appel('jouer', { type: 'battleEndTurn', args: [], siege: 1 })).categorie).toBe('permission');
    expect(erreurDe(appel('jouer', { offre: 'disengage' })).categorie).toBe('regle');
  });

  it('un jeton déjà repris se refuse en `validation`', { timeout: 120_000 }, () => {
    // Les tours des héros finis jusqu'au premier qui programme une suite (le tour adverse) ; ses jetons repris.
    let fin = appel('jouer', { offre: 'end-turn' });
    for (let tours = 0; !suiteDe(fin).programmes.length && tours < 8; tours++) fin = appel('jouer', { offre: 'end-turn' });
    const [jeton] = suiteDe(fin).programmes;
    expect(jeton, 'une fin de tour programme la suite du round').toBeDefined();
    drainer(appel, fin);
    expect(erreurDe(appel('reprendre', { jeton: jeton.id }))).toEqual({ categorie: 'validation', message: `jeton inconnu : ${jeton.id}` });
  });

  it('`erreursGlobales` rend les erreurs de la page relevées, puis les vide', () => {
    expect(appel('erreursGlobales'), 'aucune erreur émise').toEqual({ ok: true, erreurs: [] });
    page.dispatchEvent(Object.assign(new Event('error'), { message: 'boum', filename: 'wfrp-pont.js', lineno: 12 }));
    page.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('promesse rejetée') }));
    expect(appel('erreursGlobales')).toEqual({
      ok: true,
      erreurs: [{ message: 'boum', source: 'wfrp-pont.js:12' }, { message: 'promesse rejetée', source: 'unhandledrejection' }],
    });
    expect(appel('erreursGlobales'), 'relevées, elles sont vidées').toEqual({ ok: true, erreurs: [] });
  });
});
