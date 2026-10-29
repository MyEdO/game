/**
 * `auTotal` d'un `attrMod` de Blessures (#3060) n'agit que sur une liste d'ops EXÉCUTÉE (`applyOps`).
 * Le régime d'une liste se déclare à sa CONSTRUCTION : `passifsDe` (refuse `auTotal`) ou `executeesDe`
 * (l'admet). Toute liste d'ops des schémas de document, payloads d'op compris, sort de l'une des deux.
 */
import { describe, expect, it } from 'vitest';
import { DEFS_DE_DOCUMENT } from '../validate';
import { declarationDEnfants, descendre, enfantsDe, ouverts } from './descente';
import { regimeDeListe, type RegimeDeListe } from './mecanique';

const AU_TOTAL = { op: 'attrMod', attr: 'wounds', mod: 4, auTotal: true };
const SANS = { op: 'attrMod', attr: 'wounds', mod: 4 };

type Liste = {
  lieu: string;
  regime: RegimeDeListe | undefined;
  safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[] }[] } };
};

/** Chaque liste d'ops des schémas de document, au chemin de schéma qui l'atteint le premier. */
function listesDOps(): Liste[] {
  const listes: Liste[] = [];
  descendre(DEFS_DE_DOCUMENT.map((d) => d.schema), ({ noeud, def, path, racine }) => {
    if (def.type !== 'array') return;
    const elements = enfantsDe(noeud).filter((e) => e.segment === '[]').map((e) => e.noeud);
    if (!ouverts(elements).some((n) => declarationDEnfants(n)?.nature === 'payloads-op')) return;
    const schema = noeud as Pick<Liste, 'safeParse'>;
    listes.push({ lieu: `${DEFS_DE_DOCUMENT[racine].file} › ${path}`, regime: regimeDeListe(noeud), safeParse: (v) => schema.safeParse(v) });
  });
  return listes;
}

const listes = listesDOps();
const auRegime = (regime: RegimeDeListe) => listes.filter((l) => l.regime === regime);

describe('`auTotal` : le régime de toute liste d’ops est déclaré par sa construction', () => {
  it('toute liste d’ops sort de `passifsDe` ou d’`executeesDe`', () => {
    expect(auRegime('passive').length).toBeGreaterThan(0);
    expect(auRegime('executee').length).toBeGreaterThan(0);
    expect(listes.filter((l) => l.regime === undefined).map((l) => l.lieu)).toEqual([]);
  });

  it('une liste passive refuse `auTotal` et admet l’`attrMod` sans lui', () => {
    const fautes = auRegime('passive').flatMap((l) => {
      const r = l.safeParse([AU_TOTAL]);
      const refus = r.success ? [] : r.error!.issues.map((i) => i.path.join('.'));
      return refus.join() === '0.auTotal' && l.safeParse([SANS]).success ? [] : [l.lieu];
    });
    expect(fautes).toEqual([]);
  });

  it('une liste exécutée admet `auTotal`', () => {
    expect(auRegime('executee').filter((l) => !l.safeParse([AU_TOTAL]).success).map((l) => l.lieu)).toEqual([]);
  });
});
