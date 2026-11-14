import { describe, it, expect } from 'vitest';
import { creerVerbesDeJet, type CloturesDuJet } from './rollFlowSpecs';
import { FLOW_VERBS, NOM_DU_VERBE_DE_JET } from './flowVerbs';
import { COMBAT_INTENTS, MANUAL_COMBAT_INTENTS } from './intentionsDeSiege';
import type { Get, Set as SetFn } from './flowTypes';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { sitesDeDelegueManuscrit } from '../../scripts/guards/lib/delegueDeVerbeManuscrit.mjs';

/**
 * Garde de la SOURCE UNIQUE `FLOW_VERBS` : prouve que les miroirs d'un flux de jet — le TYPE (`VerbesDeJet`, vérifié
 * par `tsc` via `ActionsDuNoyau extends`), le RUNTIME (`creerVerbesDeJet`) et les INTENTS coop
 * (`noyau/intentionsDeSiege.ts`) — restent alignés sur la table, dans les DEUX sens : les verbes de jet, clôture
 * comprise, sont des intents (#1017 — surface dérivée de la possession, sans marqueur à poser), et aucun
 * nom DÉRIVABLE ne dort dans la part manuelle `MANUAL_COMBAT_INTENTS` (une entrée recopiée = une 2ᵉ source).
 */
const noopGet = (() => ({})) as unknown as Get;
const noopSet = (() => {}) as unknown as SetFn;
const ENTRIES = Object.entries(FLOW_VERBS) as [string, { kind: 'mono' | 'multi'; verbs: readonly string[] }][];
const NOMS_DE_JET = Object.values(NOM_DU_VERBE_DE_JET);

describe('câblage des flux de jet — source unique FLOW_VERBS', () => {
  it('runtime : creerVerbesDeJet expose EXACTEMENT les verbes de jet (`NOM_DU_VERBE_DE_JET`)', () => {
    expect(new Set(Object.keys(creerVerbesDeJet(noopGet, noopSet, {} as CloturesDuJet)))).toEqual(new Set(NOMS_DE_JET));
  });

  it('intents : chaque verbe de jet est exposé (surface DÉRIVÉE, #1017, #1050)', () => {
    expect(NOMS_DE_JET.filter((n) => !COMBAT_INTENTS.has(n)), 'hors COMBAT_INTENTS — la dérivation `coopFlowIntents` a été rompue').toEqual([]);
  });

  it('intents : la part MANUELLE ne recopie aucun nom dérivable de FLOW_VERBS (source unique)', () => {
    const derivable = new Set<string>(NOMS_DE_JET);
    const recopies = MANUAL_COMBAT_INTENTS.filter((n) => derivable.has(n));
    expect(recopies, 'intent dérivable recopié à la main — le retirer de MANUAL_COMBAT_INTENTS').toEqual([]);
  });

  it('intents : la part MANUELLE ne porte aucun doublon (une entrée = un choix, une fois)', () => {
    const vus = new Set<string>();
    const doublons = MANUAL_COMBAT_INTENTS.filter((n) => (vus.has(n) ? true : (vus.add(n), false)));
    expect(doublons).toEqual([]);
  });

  /**
   * INVARIANT RAW — LDB 17 l.68, « Je ne faillirai pas ! » : « au lieu de lancer les dés pour un Test,
   * vous choisissez le résultat ». Le choix du résultat EST la mécanique de la dépense de Résilience,
   * pas une option qui l'accompagne : un flux qui offre `forcerLaReussite` DOIT offrir `imposerLeResultat`.
   * Aucune liste d'exception : la Résilience est GLOBALE (LDB 17 l.65, « réussir là où vous auriez
   * certainement échoué »), donc tout flux qui porte un Test la porte.
   */
  it('Résilience : tout flux à forcerLaReussite offre le choix du dé (imposerLeResultat)', () => {
    const sans = ENTRIES
      .filter(([, w]) => w.verbs.includes('forcerLaReussite') && !w.verbs.includes('imposerLeResultat'))
      .map(([prefix]) => prefix);
    expect(sans, 'flux à Résilience SANS choix du dé — déclarer son accesseur `die` puis le verbe').toEqual([]);
  });

  /** #2903, #3311 — un geste de jet passe par son verbe `jet<Verbe>(flux, …)` (`creerVerbesDeJet`) : aucune action
   *  ne rappelle le handler d'un verbe à la main, hors surface dérivée et hors possession. */
  describe('délégué de verbe manuscrit (`scripts/guards/lib/delegueDeVerbeManuscrit.mjs`)', () => {
    const VERBES = new Set(ENTRIES.flatMap(([, w]) => w.verbs));
    const site = (text: string) => sitesDeDelegueManuscrit({ rel: 'src/noyau/x.ts', text }, VERBES);

    it('voit l’appel direct du handler d’un verbe, par nom de flux ou par index', () => {
      expect(site('const a = { annuler: () => FLOWS.activite.annuler(get, set) };')).toEqual([{ ligne: 1, texte: 'FLOWS.activite.annuler(get, set)' }]);
      expect(site('FLOWS[k].imposerLeResultat(get, set, 12);').map((x) => x.texte)).toEqual(['FLOWS[k].imposerLeResultat(get, set, 12)']);
    });

    it('laisse les membres d’un handler qui ne sont pas des verbes, et le handler reçu en paramètre', () => {
      expect(site('FLOWS.rechargement.apply(get, { p });')).toEqual([]);
      expect(site('const jouer = (h: RollFlowHandlers) => h.annuler(get, set); jouer(FLOWS[flux]);')).toEqual([]);
    });

    it('le code de production n’en porte aucun', () => {
      const sites = readCorpus(['src']).flatMap((f) => sitesDeDelegueManuscrit(f, VERBES).map((x) => `${f.rel}:${x.ligne} ${x.texte}`));
      expect(sites, 'handler de verbe appelé à la main : jouer le verbe de jet `jet<Verbe>(flux, …)`').toEqual([]);
    });
  });
});
