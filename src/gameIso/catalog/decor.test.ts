import { describe, it, expect } from 'vitest';
import { PROPS, propSvg, missingPropSvg } from './decor';
import { MISSING_TONE } from './missing';
import { findPropById } from '../../data';
import { CAP_IDENTITE_PROP, empreinteDuProp } from '../../data/props.types';
import { sceneMetresPerTile } from '../../state/scene';

/** L'échelle à laquelle ce catalogue est jugé : le défaut du monde (`LDB 15 l.12`), LU à sa source
 *  unique — l'empreinte d'un décor à recette en dépend depuis #1509. */
const MPT = sceneMetresPerTile(undefined);
/** Les cases qu'un décor couvre au cap d'identité : `foot` déclaré pour un billboard, corps tourné
 *  pour une recette — la couture UNIQUE, celle que la scène lit. */
const empreinteDe = (id: string) => empreinteDuProp(findPropById(id), CAP_IDENTITE_PROP, MPT);

describe('catalogue décors', () => {
  it('contient les placeables de base', () => {
    for (const id of [
      'tonneau',
      'caisse',
      'charrette',
      'puits',
      'fontaine',
      'etal-marche',
      'statue',
      'lampadaire',
      'panneau',
      'cloture',
      'tas-foin',
      'feu-camp',
      'arbre',
      'cadavre',
      'mare-sang',
      'cheval-mort',
      'epave-carrosse',
    ])
      expect(PROPS[id], id).toBeDefined();
  });
  it('id absent du registre → repli VISIBLE d’erreur (#877), le MÊME que les objets inertes sans art (#223)', () => {
    const svg = propSvg('zzz');
    expect(svg).toContain(MISSING_TONE); // caisse d'alarme barrée d'un « ? », repérable en jeu
    expect(svg).toBe(missingPropSvg('zzz')); // ancré aux pieds de la boîte 120×150
    expect(svg).not.toBe(propSvg('tonneau')); // un ref inconnu n'emprunte l'identité d'AUCUN décor réel
  });
  it('un prop SANS ref suit le MÊME chemin qu’un ref hors registre : le repli VISIBLE d’erreur (#877)', () => {
    expect(propSvg(undefined)).toBe(missingPropSvg(undefined));
    expect(propSvg(undefined)).toContain(MISSING_TONE);
    expect(missingPropSvg(undefined)).toBe(missingPropSvg('zzz')); // même silhouette, même alarme
  });
  it('rend un SVG non vide pour les décors d ambush', () => {
    for (const id of ['cadavre', 'mare-sang', 'cheval-mort', 'epave-carrosse'])
      expect(propSvg(id).length, id).toBeGreaterThan(40);
  });
});

describe('SP2 — décors fouillables', () => {
  const NEW = ['lettre', 'coffre', 'cle', 'bourse', 'etagere'];
  it('les 5 nouveaux décors sont enregistrés, searchable, et rendus non vides', () => {
    for (const id of NEW) {
      expect(PROPS[id], id).toBeDefined();
      expect(PROPS[id].searchable, id).toBe(true);
      expect(propSvg(id).length, id).toBeGreaterThan(40);
    }
  });
  it('un décor pur n’est pas searchable', () => {
    expect(PROPS.tonneau.searchable).toBeFalsy();
    expect(PROPS.cadavre.searchable).toBeFalsy();
  });
});

describe('Opéra — props de théâtre', () => {
  const OPERA = ['rangee-sieges', 'rideau-scene', 'balustrade-loge', 'lustre-opera'];
  it('les props d’opéra sont enregistrés et rendus non vides', () => {
    for (const id of OPERA) {
      expect(PROPS[id], id).toBeDefined();
      expect(propSvg(id).length, id).toBeGreaterThan(120);
    }
  });
  it('le mobilier de salle porte une empreinte 3×1, le garde-corps se pose à la CASE ; le lustre est en surplomb (sans empreinte)', () => {
    // Le mobilier de salle est une RECETTE (#1343) : son 3×1 se DÉRIVE des corps (rangée de 5,40 m,
    // manteau de scène de 5,60 m) — c'est l'empreinte EFFECTIVE qui le porte, comme pour `table-2x1`.
    expect(empreinteDe('rangee-sieges')).toEqual({ w: 3, h: 1 });
    expect(empreinteDe('rideau-scene')).toEqual({ w: 3, h: 1 });
    // La rive d'un puits suit l'ovale en marches d'une à deux cases : une travée par case de rive
    // l'épouse, là qu'une volée de trois enjamberait les refends (`opera/floorplan.ts` `puitsRim`).
    expect(findPropById('balustrade-loge')?.foot).toEqual({ w: 1, h: 1 });
    expect(findPropById('lustre-opera')?.foot).toBeUndefined();
  });
  it('les trois variantes longues 2×1 sont enregistrées, rendues, et empreintées par le catalogue', () => {
    for (const [id, base] of [['table-2x1', 'table'], ['bureau-2x1', 'bureau'], ['etabli-2x1', 'etabli']] as const) {
      expect(PROPS[id], id).toBeDefined();
      expect(PROPS[id].label, id).not.toBe(PROPS[base].label);
      expect(propSvg(id), id).toBe(propSvg(base)); // même vignette que sa base
      expect(propSvg(id).length, id).toBeGreaterThan(40);
      // L'empreinte EFFECTIVE, jamais un `foot` déclaré : les trois variantes longues sont des
      // RECETTES, et un décor à recette ne porte aucun `foot` (#1509) — leurs deux cases viennent de
      // leur corps (plateaux de 3,40 à 3,80 m), comme la case unique de leur base.
      expect(empreinteDe(id), id).toEqual({ w: 2, h: 1 });
      expect(empreinteDe(base), base).toEqual({ w: 1, h: 1 });
    }
  });
  it('le mobilier d’ambiance d’opéra est enregistré et rendu (applique, pupitre, fauteuil)', () => {
    for (const id of ['applique-murale', 'pupitre-chef', 'fauteuil-loge']) {
      expect(PROPS[id], id).toBeDefined();
      expect(propSvg(id).length, id).toBeGreaterThan(120);
    }
  });
  it('la plante en pot (réceptacle de la bombe) est enregistrée et rendue', () => {
    expect(PROPS['plante-pot']).toBeDefined();
    expect(propSvg('plante-pot').length).toBeGreaterThan(120);
  });
});
