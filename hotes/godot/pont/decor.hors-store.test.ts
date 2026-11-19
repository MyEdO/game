/**
 * LE DÉCOR SERVI PAR SON MODÈLE (#4335 ; `CONTRAT.md`, sections « Monde », « Corps d'un combattant » et « Atelier 3D ») :
 * chaque surface d'un décor du volume porte l'id de son type ; la vue sert, pour chaque type dont un élément `decor` est
 * servi, ce modèle et les poses de ce décor, celles dont le volume pose les faces ; l'atelier les sert de même pour
 * l'échantillon d'un décor. Un décor qui change selon la saison est servi, en jeu, à la saison de l'horloge, dans
 * l'atelier à celle demandée, à l'éditeur à aucune : ses nœuds cachés et sa palette.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  avecLeSaisonnier,
  avecLesSeulsDecors,
  enSaison,
  erreurDe,
  modelesCommites,
  mondeDe,
  morceauxDe,
  servirLesModeles,
  suiteDe,
  table,
  vueDe,
} from './pont.testkit';
import { currentSeason, posesDesDecors, sceneDEchantillon } from '../../../src/noyau/index';
import { SAISONS, type Saison } from '../asset/element';
import { cleDEmplacement } from '../../../src/hote/sauvegardes';
import type { DecorServi, MorceauxDuPont, SaisonOfferte } from './pont';
import { facadeFeatureViz } from '../../../src/noyau/monde/facades';
import { scenario as scenarioDiligence } from '../../../src/scenes/test-scenarios/diligence';
import { idsDeTest } from '../../../src/engine/idsDeTest.testkit';

const COMMITES = await modelesCommites();
const { appel } = table();

describe('les décors de la scène en cours', () => {
  /** Par type de décor des surfaces du volume, les cases `x,y,z` de leurs triangles. */
  let casesParDecor: Map<string, Set<string>>;
  beforeAll(() => {
    suiteDe(appel('demarrer', { scenario: 'a-bord-de-la-caraque', graine: 7 }));
    casesParDecor = new Map();
    for (const m of morceauxDe(appel, 'partie', mondeDe(appel).monde!))
      for (const s of m.surfaces) {
        if (s.decor === undefined) continue;
        const cases = casesParDecor.get(s.decor) ?? casesParDecor.set(s.decor, new Set()).get(s.decor)!;
        for (let t = s.debut / 3; t < s.fin / 3; t++) cases.add(m.cases.slice(t * 3, t * 3 + 3).join(','));
      }
  });
  afterAll(() => appel('quitter'));

  it('sans élément `decor` servi, aucun décor ; servi, le seul type qu’il nomme, à chaque case où le volume pose ses faces', () => {
    const [prop] = [...casesParDecor.keys()];
    expect(prop, 'la scène pose au moins un décor').toBeDefined();
    servirLesModeles(appel, COMMITES, avecLesSeulsDecors(COMMITES));
    expect(vueDe(appel('vue')).corps.decors).toEqual({});
    servirLesModeles(appel, COMMITES, avecLesSeulsDecors(COMMITES, prop));
    const { decors } = vueDe(appel('vue')).corps;
    expect(Object.keys(decors)).toEqual([prop]);
    expect(decors[prop].element).toBe(`decor--${prop}`);
    expect(new Set(decors[prop].poses.map((p) => p.prop))).toEqual(new Set([prop]));
    expect(new Set(decors[prop].poses.map(({ case: c }) => `${c.x},${c.y},${c.z}`))).toEqual(casesParDecor.get(prop));
  });
});

describe('les ornements du bâti de la scène en cours (#4471)', () => {
  it('sert chaque cheminée et chaque enseigne des façades de la Diligence, l’une portée avec sa nappe', () => {
    const { appel: jeu } = table();
    suiteDe(jeu('demarrer', { scenario: 'diligence', graine: 7 }));
    try {
      const { architecture } = scenarioDiligence.construire(idsDeTest).scene;
      const deLaDonnee = (prop: string) => (architecture ?? []).flatMap((corps) => corps.facades.flatMap((section) =>
        (section.features ?? [])
          .filter((f) => {
            const viz = facadeFeatureViz(section.appearance, f.kind);
            return viz !== undefined && (f.appearance ?? viz.prop) === prop;
          })
          .map((f) => `architecture/${corps.id}:${section.id}:${f.id}`))).sort();
      servirLesModeles(jeu, COMMITES, avecLesSeulsDecors(COMMITES, 'cheminee', 'enseigne'));
      const { decors } = vueDe(jeu('vue')).corps;
      const servies = (prop: string) => (decors[prop]?.poses ?? []).filter((p) => p.cle.startsWith('architecture/'));
      for (const prop of ['cheminee', 'enseigne']) {
        expect(deLaDonnee(prop).length, `${prop} : la donnée de la Diligence en porte`).toBeGreaterThan(0);
        expect(servies(prop).map((p) => p.cle).sort(), prop).toEqual(deLaDonnee(prop));
      }
      const portees = [...servies('cheminee'), ...servies('enseigne')].filter((p) => p.nappe);
      expect(portees.length, 'une cheminée assise sur un toit').toBeGreaterThan(0);
      const r = jeu('morceaux', { source: 'partie', volume: [], toits: portees.map((p) => p.nappe), couronnes: [] });
      expect(r.ok, JSON.stringify(r)).toBe(true);
      const { toits } = r as unknown as MorceauxDuPont;
      const nappes = new Map(toits.map((n) => [n.cle, n.surfaces.map((s) => s.decor)]));
      for (const p of portees) expect(nappes.get(p.nappe!), p.cle).toContain(p.prop);
    } finally {
      jeu('quitter');
    }
  });
});

describe('l’échantillon d’un décor dans l’atelier', () => {
  it('sert le modèle du décor et sa pose, celle du noyau ; un décor sans modèle, aucun', () => {
    const { appel: atelier } = table();
    servirLesModeles(atelier, COMMITES, avecLesSeulsDecors(COMMITES, 'tonneau'));
    const { decors } = atelier('echantillon', { famille: 'decor', id: 'tonneau' }) as unknown as { decors: Record<string, DecorServi> };
    expect(decors).toEqual({ tonneau: { element: 'decor--tonneau', poses: posesDesDecors(sceneDEchantillon('decor', 'tonneau')), palette: {}, caches: [] } });
    expect(decors.tonneau.poses).toHaveLength(1);
    expect((atelier('echantillon', { famille: 'decor', id: 'table' }) as unknown as { decors: unknown }).decors).toEqual({});
  });
});

describe('un décor qui change selon la saison (`selon`)', () => {
  it('l’atelier le sert à la saison demandée, sans elle tel que bâti, et offre chaque saison à son libellé', () => {
    const { appel: atelier } = table();
    servirLesModeles(atelier, COMMITES, avecLeSaisonnier(COMMITES, 'buisson'));
    const echantillon = (saison?: Saison) => atelier('echantillon', { famille: 'decor', id: 'buisson', ...(saison ? { saison } : {}) }) as unknown as { decors: Record<string, DecorServi>; saisons: SaisonOfferte[] };
    for (const saison of [null, ...SAISONS]) expect(echantillon(saison ?? undefined).decors.buisson, saison ?? 'tel que bâti').toMatchObject(enSaison(saison));
    const { saisons } = echantillon();
    expect(saisons.map((s) => s.id)).toEqual(SAISONS);
    for (const { id, libelle } of saisons) expect(libelle, id).not.toBe(id);
    expect(erreurDe(atelier('echantillon', { famille: 'decor', id: 'buisson', saison: 'mousson' })).message).toContain('saison');
  });

  it('l’atelier n’offre aucune saison pour un décor qui n’en nomme aucune', () => {
    const { appel: atelier } = table();
    servirLesModeles(atelier, COMMITES, avecLesSeulsDecors(COMMITES, 'tonneau'));
    const { decors, saisons } = atelier('echantillon', { famille: 'decor', id: 'tonneau', saison: 'hiver' }) as unknown as { decors: Record<string, DecorServi>; saisons: SaisonOfferte[] };
    expect(decors.tonneau).toMatchObject({ palette: {}, caches: [] });
    expect(saisons).toEqual([]);
  });

  it('le jeu le sert à la saison de son horloge', () => {
    const { appel, stockage } = table();
    suiteDe(appel('demarrer', { scenario: 'a-bord-de-la-caraque', graine: 7 }));
    const [prop] = morceauxDe(appel, 'partie', mondeDe(appel).monde!).flatMap((m) => m.surfaces.flatMap((s) => (s.decor === undefined ? [] : [s.decor])));
    expect(prop, 'la scène pose au moins un décor').toBeDefined();
    servirLesModeles(appel, COMMITES, avecLeSaisonnier(COMMITES, prop));
    appel('sauvegarder', { sauvegarder: 1 });
    const cle = cleDEmplacement(1);
    const sauvee = JSON.parse(stockage.getItem(cle)!);
    for (const saison of SAISONS) {
      let gameTime = sauvee.gameTime as number;
      while (currentSeason(gameTime) !== saison) gameTime += 24 * 60;
      stockage.setItem(cle, JSON.stringify({ ...sauvee, gameTime, data: { ...sauvee.data, gameTime } }));
      appel('quitter');
      suiteDe(appel('charger', { charger: 1 }));
      expect(vueDe(appel('vue')).corps.decors[prop], saison).toMatchObject(enSaison(saison));
    }
    appel('quitter');
  });
});
