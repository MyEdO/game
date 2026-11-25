/**
 * LE DÉCOR SERVI PAR SON MODÈLE (#4335 ; `CONTRAT.md`, sections « Monde », « Corps d'un combattant » et « Atelier 3D ») :
 * chaque surface d'un décor du volume porte l'id de son type. La vue et l'atelier servent le modèle et ses poses,
 * avec une géométrie de seule prise. Un modèle en panne retrouve la peinture de sa recette, et son rechargement
 * le rend à nouveau disponible. Le modèle saisonnier suit l'horloge du jeu ou la saison demandée par l'atelier.
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
import { currentSeason, famillesDEchantillons, posesDesDecors, sceneDEchantillon, type EchantillonDessine } from '../../../src/noyau/index';
import { SAISONS, type Saison } from '../asset/element';
import { cleDEmplacement } from '../../../src/hote/sauvegardes';
import type { DecorServi, MondeDuPont, MorceauxDuPont, SaisonOfferte } from './pont';
import { figerUnePartie } from '../recettes/atelier';
import { facadeFeatureViz } from '../../../src/noyau/monde/facades';
import { findPropById } from '../../../src/data';
import { scenario as rueOrnee } from '../../../src/scenes/test-scenarios/rue-ornee';
import { idsDeTest } from '../../../src/engine/idsDeTest.testkit';

const COMMITES = await modelesCommites();
const { appel, pont } = table();

describe('les décors de la scène en cours', () => {
  /** Par type de décor des surfaces du volume, les cases `x,y,z` de leurs triangles. */
  let casesParDecor: Map<string, Set<string>>;
  let volumeInitial: MorceauxDuPont['volume'];
  beforeAll(() => {
    suiteDe(appel('demarrer', { scenario: 'a-bord-de-la-caraque', graine: 7 }));
    casesParDecor = new Map();
    volumeInitial = morceauxDe(appel, 'partie', mondeDe(appel).monde!);
    for (const m of volumeInitial)
      for (const s of m.surfaces) {
        if (s.decor === undefined) continue;
        const cases = casesParDecor.get(s.decor) ?? casesParDecor.set(s.decor, new Set()).get(s.decor)!;
        for (let t = s.debut / 3; t < s.fin / 3; t++) cases.add(m.cases.slice(t * 3, t * 3 + 3).join(','));
      }
  });
  afterAll(() => appel('quitter'));

  it('le volume garde les prises du seul décor servi et ne transporte plus ses attributs de dessin', () => {
    const [prop] = [...casesParDecor.keys()];
    expect(prop, 'la scène pose au moins un décor').toBeDefined();
    servirLesModeles(appel, COMMITES, avecLesSeulsDecors(COMMITES));
    const avant = vueDe(appel('vue'));
    expect(avant.corps.decors).toEqual({});
    const entree = JSON.stringify({ source: 'partie', volume: volumeInitial.map(({ cle }) => cle), toits: [], couronnes: [] });
    const octetsSansModele = JSON.parse(pont.appelerEnOctets('morceaux', entree)).octets as number;
    servirLesModeles(appel, COMMITES, avecLesSeulsDecors(COMMITES, prop));
    const apres = vueDe(appel('vue'));
    expect(apres.plateau!.cleDuMonde).not.toBe(avant.plateau!.cleDuMonde);
    const { decors } = apres.corps;
    expect(Object.keys(decors)).toEqual([prop]);
    expect(decors[prop].element).toBe(`decor--${prop}`);
    expect(new Set(decors[prop].poses.map((p) => p.prop))).toEqual(new Set([prop]));
    expect(new Set(decors[prop].poses.map(({ case: c }) => `${c.x},${c.y},${c.z}`))).toEqual(casesParDecor.get(prop));

    const manifeste = mondeDe(appel).monde!;
    const volumeServi = morceauxDe(appel, 'partie', manifeste);
    expect(volumeServi.map(({ cle, empreinte }) => ({ cle, empreinte }))).toEqual(manifeste.morceaux);
    expect(volumeServi.map(({ positions, cases }) => [positions, cases])).toEqual(volumeInitial.map(({ positions, cases }) => [positions, cases]));
    const prises = volumeServi.flatMap((m) => m.surfaces).filter((s) => s.priseSeulement);
    expect(prises.length).toBeGreaterThan(0);
    expect(new Set(prises.map((s) => s.decor))).toEqual(new Set([prop]));
    const octets = JSON.parse(pont.appelerEnOctets('morceaux', entree));
    expect(octetsSansModele - octets.octets).toBe(prises.reduce((n, s) => n + (s.fin - s.debut) * 7 * Float32Array.BYTES_PER_ELEMENT, 0));
  });

  it('le secours rétablit les seuls morceaux touchés, écarte le modèle jusqu’au prochain index et refuse le jeton périmé', () => {
    const [prop] = [...casesParDecor.keys()];
    servirLesModeles(appel, COMMITES, avecLesSeulsDecors(COMMITES, prop));
    const manifeste = mondeDe(appel).monde!;
    const secours = manifeste.secoursDecors!;
    const cleDuMonde = vueDe(appel('vue')).plateau!.cleDuMonde;
    expect(secours).toMatchObject({ source: 'partie', revision: expect.any(Number) });
    expect(mondeDe(appel).monde!.secoursDecors).toEqual(secours);
    const demande = { ...secours, prop };
    const aReposer = new Set(manifeste.morceaux.filter((m, i) => m.empreinte !== volumeInitial[i].empreinte).map((m) => m.cle));
    expect(aReposer.size).toBeGreaterThan(0);
    expect(appel('retablirDecors', demande)).toEqual({ ok: true, volume: volumeInitial.filter((m) => aReposer.has(m.cle)), toits: [] });
    expect(appel('retablirDecors', demande)).toEqual({ ok: true, volume: [], toits: [] });
    const vueRetablie = vueDe(appel('vue'));
    expect(vueRetablie.corps.decors).toEqual({});
    expect(vueRetablie.plateau!.cleDuMonde).toBe(cleDuMonde);
    const retabli = mondeDe(appel).monde!;
    expect(retabli.secoursDecors).toBeUndefined();
    expect(morceauxDe(appel, 'partie', retabli)).toEqual(volumeInitial);

    servirLesModeles(appel, COMMITES, avecLesSeulsDecors(COMMITES, prop));
    const vueReindexee = vueDe(appel('vue'));
    expect(vueReindexee.corps.decors[prop]).toBeDefined();
    expect(vueReindexee.plateau!.cleDuMonde).not.toBe(cleDuMonde);
    expect(mondeDe(appel).monde!.secoursDecors!.revision).not.toBe(secours.revision);
    expect(erreurDe(appel('retablirDecors', demande)).message).toContain('révision périmée');
    expect(vueDe(appel('vue')).corps.decors[prop]).toBeDefined();
  });
});

describe('les ornements du bâti de la scène en cours (#4471)', () => {
  it('sert la souche de chaque foyer et chaque enseigne des façades de la rue ornée, l’une portée avec sa nappe', () => {
    const { appel: jeu } = table();
    suiteDe(jeu('demarrer', { scenario: 'rue-ornee', graine: 7 }));
    try {
      const { architecture, entities } = rueOrnee.construire(idsDeTest).scene;
      const enseignes = (architecture ?? []).flatMap((corps) => corps.facades.flatMap((section) =>
        (section.features ?? [])
          .filter((f) => {
            const viz = facadeFeatureViz(section.appearance, f.kind);
            return viz !== undefined && (f.appearance ?? viz.prop) === 'enseigne';
          })
          .map((f) => `architecture/${corps.id}:${section.id}:${f.id}`)));
      const souches = entities.filter((e) => e.kind === 'prop' && findPropById(e.decor?.id)?.conduit).map((e) => `souche/${e.id}`);
      const deLaDonnee: Record<string, string[]> = { cheminee: souches.sort(), enseigne: enseignes.sort() };
      servirLesModeles(jeu, COMMITES, avecLesSeulsDecors(COMMITES, 'cheminee', 'enseigne'));
      const { decors } = vueDe(jeu('vue')).corps;
      const servies = (prop: string) => (decors[prop]?.poses ?? []).filter((p) => /^(architecture|souche)\//.test(p.cle));
      for (const prop of ['cheminee', 'enseigne']) {
        expect(deLaDonnee[prop].length, `${prop} : la rue ornée en porte`).toBeGreaterThan(0);
        expect(servies(prop).map((p) => p.cle).sort(), prop).toEqual(deLaDonnee[prop]);
      }
      const portees = [...servies('cheminee'), ...servies('enseigne')].filter((p) => p.nappe);
      expect(portees.length, 'une cheminée assise sur un toit').toBeGreaterThan(0);
      const r = jeu('morceaux', { source: 'partie', volume: [], toits: portees.map((p) => p.nappe), couronnes: [] });
      expect(r.ok, JSON.stringify(r)).toBe(true);
      const { toits } = r as unknown as MorceauxDuPont;
      const nappes = new Map(toits.map((n) => [n.cle, n.surfaces.map((s) => s.decor)]));
      for (const p of portees) expect(nappes.get(p.nappe!), p.cle).not.toContain(p.prop);

      const manifeste = mondeDe(jeu);
      const retour = jeu('retablirDecors', { ...manifeste.monde!.secoursDecors, prop: 'cheminee' });
      expect(retour.ok).toBe(true);
      const restaurees = (retour as unknown as MorceauxDuPont).toits;
      expect(new Set(restaurees.map(({ cle }) => cle))).toEqual(new Set(portees.filter((p) => p.prop === 'cheminee').map((p) => p.nappe)));
      expect(restaurees.every((n) => n.surfaces.some((s) => s.decor === 'cheminee'))).toBe(true);
      const terrain = mondeDe(jeu);
      expect(terrain.monde!.secoursDecors).toEqual(manifeste.monde!.secoursDecors);
      expect(terrain.toits).toEqual(manifeste.toits.map((n) => {
        const restauree = restaurees.find(({ cle }) => cle === n.cle);
        return restauree ? { cle: restauree.cle, empreinte: restauree.empreinte } : n;
      }));
    } finally {
      jeu('quitter');
    }
  });
});

describe('l’échantillon d’un décor dans l’atelier', () => {
  it('le pont figé garde le modèle servi et sa recette dessinable dans l’échantillon et la partie', () => {
    const prop = 'cheminee';
    const element = `decor--${prop}`;
    figerUnePartie(COMMITES, (id) => id === element, ({ appel: fige }) => {
      const echantillon = fige('echantillon', { famille: 'decor', id: prop }) as unknown as EchantillonDessine & {
        decors: Record<string, DecorServi>;
      };
      expect(echantillon.decors[prop]).toMatchObject({ element });
      expect(echantillon.monde).not.toHaveProperty('secoursDecors');
      const morceau = echantillon.monde.morceaux.find((m) => m.surfaces.some((s) => s.decor === prop))!;
      expect(morceau.surfaces.some((s) => s.decor === prop && !s.priseSeulement)).toBe(true);
      expect(morceau.normales).toHaveLength(morceau.positions.length);
      expect(morceau.couleurs).toHaveLength(4 * morceau.positions.length / 3);

      const partie = fige('demarrer', { scenario: 'rue-ornee', graine: 7 }) as Parameters<typeof suiteDe>[0];
      const { vue } = suiteDe(partie);
      expect(vue.corps.decors[prop]).toMatchObject({ element });
      expect(vue.plateau!.cleDuMonde).toMatch(/^[0-9a-z]+$/);
      const monde = fige('monde') as unknown as MondeDuPont;
      expect(monde.monde).not.toHaveProperty('secoursDecors');
      const recus = fige('morceaux', { source: 'partie', volume: [], toits: monde.toits.map(({ cle }) => cle), couronnes: [] }) as unknown as MorceauxDuPont;
      expect(recus.toits.map(({ cle, empreinte }) => ({ cle, empreinte }))).toEqual(monde.toits);
      expect(recus.toits.some((n) => n.surfaces.some((s) => s.decor === prop && !s.priseSeulement))).toBe(true);
    });
  });

  it('l’index validé des modèles couvre chaque type du catalogue', () => {
    const { appel: atelier } = table();
    const reponse = atelier('modeles', { manifestes: COMMITES.manifestes, osDesRigides: COMMITES.osDesRigides });
    expect(reponse.ok).toBe(true);
    const catalogue = famillesDEchantillons().find((f) => f.id === 'decor')!.entrees;
    expect(Object.keys((reponse as unknown as { decors: Record<string, string> }).decors).sort()).toEqual(catalogue.map(({ id }) => id).sort());
  });

  it('sert le modèle du décor et sa pose, celle du noyau ; un décor sans modèle, aucun', () => {
    const { appel: atelier } = table();
    servirLesModeles(atelier, COMMITES, avecLesSeulsDecors(COMMITES, 'tonneau'));
    const demande = { famille: 'decor', id: 'tonneau' };
    const echantillon = (saison?: Saison) => atelier('echantillon', { ...demande, saison }) as unknown as EchantillonDessine & {
      monde: Pick<NonNullable<ReturnType<typeof mondeDe>['monde']>, 'secoursDecors'>;
      decors: Record<string, DecorServi>;
    };
    const { decors, monde } = echantillon();
    expect(decors).toEqual({ tonneau: { element: 'decor--tonneau', poses: posesDesDecors(sceneDEchantillon('decor', 'tonneau')), palette: {}, caches: [] } });
    expect(decors.tonneau.poses).toHaveLength(1);
    expect(monde.morceaux.some((m) => m.surfaces.some((s) => s.priseSeulement))).toBe(true);
    expect(monde.secoursDecors).toMatchObject({ source: 'atelier', revision: expect.any(Number) });
    expect(echantillon('hiver').monde.secoursDecors).toEqual(monde.secoursDecors);
    const secours = atelier('retablirDecors', { ...monde.secoursDecors, prop: 'tonneau' });
    expect(secours.ok).toBe(true);
    const retabli = echantillon();
    expect(retabli.decors).toEqual({});
    expect((secours as unknown as MorceauxDuPont).volume).toEqual(retabli.monde.morceaux.filter((m) => m.surfaces.some((s) => s.decor === 'tonneau')));
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
