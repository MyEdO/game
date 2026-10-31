/**
 * #3086 — ce que le SCHÉMA de `presets-de-personnage.json` tient au parse : toute référence (tenue, pièce,
 * objet instanciable) résout dans son espace, la corpulence reste dans son domaine (`src/lib/corpulence.ts`), et
 * rien n'est porté deux fois, ni un objet ni une pièce (D6(b)).
 */
import { describe, expect, it } from 'vitest';
import { schema } from './presets-de-personnage';
import presetsJson from '../../presets-de-personnage.json';
import { findEnsembleParHabille, findPresetDePersonnageById, trappings, trappingsInstanciables } from '../../index';

type Entree = { id: string; [k: string]: unknown };
const avec = (champs: Record<string, unknown>): Entree[] => {
  const doc = structuredClone(presetsJson) as Entree[];
  Object.assign(doc.find((e) => e.id === 'soldat')!, champs);
  return doc;
};
const issues = (doc: unknown): { path: string; message: string }[] => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? [] : r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
};
const accepte = (doc: unknown) => {
  const r = schema.safeParse(doc);
  expect(r.success, r.success ? '' : r.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join('\n')).toBe(true);
};

describe('presets-de-personnage.json — preset de personnage entier (#3086)', () => {
  it('le document réel parse, et le lecteur le rend par son id', () => {
    accepte(presetsJson);
    expect(findPresetDePersonnageById('soldat')?.tenue).toEqual({ id: 'uniforme-de-soldat' });
  });

  it('un id de tenue, de pièce ou d’objet inconnu est refusé', () => {
    issues(avec({ tenue: { id: 'tenue-inconnue' } }));
    issues(avec({ tenue: { id: 'ruban' } }));
    issues(avec({ pieces: ['piece-inconnue'] }));
    issues(avec({ objets: ['objet-inconnu'] }));
    issues(avec({ prises: { main: { id: 'objet-inconnu' } } }));
  });

  it('un objet non instanciable (un service) n’est ni porté ni tenu', () => {
    const service = trappings.find((t) => !trappingsInstanciables().includes(t))!;
    expect(service, 'aucun trapping hors de la sous-liste instanciable').toBeDefined();
    expect(issues(avec({ objets: ['heaume', 'plastron', service.id] })).map((i) => i.path)).toEqual(['0.objets.2']);
    expect(issues(avec({ prises: { main: { id: service.id } } })).map((i) => i.path)).toEqual(['0.prises.main.id']);
  });

  it('la corpulence reste sur [0 ; 1]', () => {
    accepte(avec({ build: 0 }));
    accepte(avec({ build: 1 }));
    expect(issues(avec({ build: -0.01 })).map((i) => i.path)).toEqual(['0.build']);
    expect(issues(avec({ build: 1.01 })).map((i) => i.path)).toEqual(['0.build']);
  });

  it('une chose portée deux fois est refusée à l’élément qui la porte la seconde fois', () => {
    const [chemise] = findEnsembleParHabille({ id: 'uniforme-de-soldat', type: 'tenue' })!.pieces;
    const [casque] = findEnsembleParHabille({ id: 'heaume', type: 'trapping' })!.pieces;
    const cas: [string, Record<string, unknown>, { path: string; message: string }][] = [
      ['pièce de l’ensemble de la tenue', { pieces: ['ruban', chemise] }, { path: '0.pieces.1', message: `« ${chemise} » est porté deux fois : déjà par l’ensemble de la tenue « uniforme-de-soldat ».` }],
      ['pièce en double', { pieces: ['ruban', 'ruban'] }, { path: '0.pieces.1', message: '« ruban » est porté deux fois : déjà par pieces[0].' }],
      ['pièce et ensemble d’un objet', { pieces: ['ruban', casque] }, { path: '0.objets.0', message: `« ${casque} » est porté deux fois : déjà par pieces[1].` }],
      ['objet aux deux mains', { prises: { main: { id: 'hallebarde' }, off: { id: 'hallebarde' } } }, { path: '0.prises.off', message: '« hallebarde » est porté deux fois : déjà par la prise main.' }],
      ['objet en double', { objets: ['heaume', 'heaume', 'plastron'] }, { path: '0.objets.1', message: '« heaume » est porté deux fois : déjà par objets[0].' }],
      ['objet tenu et rangé', { objets: ['heaume', 'hallebarde'] }, { path: '0.objets.1', message: '« hallebarde » est porté deux fois : déjà par la prise main.' }],
    ];
    for (const [nom, champs, attendu] of cas) expect(issues(avec(champs)), nom).toEqual([attendu]);
  });
});
