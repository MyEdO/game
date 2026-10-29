/**
 * #1686 — ce que le SCHÉMA de `materials.json` tient au parse, sur le document RÉEL.
 *
 * Deux contrats, tous deux à mutation :
 *  - la DISJONCTION par domaine (`refusDeCharge`) : chaque domaine EXIGE ses clés requises et REFUSE
 *    les clés d'un autre domaine, nommément — c'est ce qui remplace les trois schémas fusionnés ;
 *  - `couverture` n'a qu'UNE graphie : le champ vaut `true`, ou il est ABSENT. `z.boolean()` laissait
 *    entrer `couverture: false`, deuxième façon d'écrire « ne couvre pas » que rien ne distinguerait
 *    de l'absence à la lecture (`roofMaterial(id).couverture` est falsy dans les deux cas).
 * Le pendant POSITIF (le `plan` vu du dessus ne porte pas le champ, les trois couvertures le portent)
 * est tenu par `src/gameIso/catalog/roofs/roofs.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './materials';
import materialsJson from '../../materials.json';

type Entree = { id: string; domain: string; couverture?: unknown; [k: string]: unknown };
const clone = (): Entree[] => structuredClone(materialsJson) as unknown as Entree[];
const uneDe = (doc: Entree[], domaine: string): Entree => {
  const e = doc.find((x) => x.domain === domaine);
  expect(e, `aucune entrée de domaine « ${domaine} » — la fixture ne mesure rien`).toBeDefined();
  return e!;
};
/** Message(s) d'erreur du parse, à plat — la garde vérifie qu'ils NOMMENT le domaine et la clé. */
const refus = (doc: unknown): string[] => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('materials.json — un document, trois domaines, une disjonction gardée au parse', () => {
  it('m0 TÉMOIN : le document RÉEL parse', () => {
    expect(schema.safeParse(materialsJson).success).toBe(true);
  });

  it('une clé ÉTRANGÈRE à son domaine est refusée, en nommant le domaine et la clé', () => {
    const doc = clone();
    uneDe(doc, 'prop').N = '#a04836';
    expect(refus(doc).join(' ')).toMatch(/« N » n’appartient qu’au\(x\) cas domain « roof » — refusée sur « .+ » \(domain « prop »\)/);
  });

  it('une clé REQUISE par le domaine est exigée, en nommant le domaine et la clé', () => {
    const doc = clone();
    delete uneDe(doc, 'relief').face;
    expect(refus(doc).join(' ')).toMatch(/\(domain « relief »\) exige « face »/);
  });

  it('un `domain` HORS périmètre est refusé (les cinq domaines de `MaterialRef` ne sont pas tous ici)', () => {
    const doc = clone();
    uneDe(doc, 'prop').domain = 'terrain';
    expect(schema.safeParse(doc).success).toBe(false);
  });

  it('`couverture: false` est REFUSÉ au parse (deuxième graphie de l’absence)', () => {
    const doc = clone();
    const plan = doc.find((e) => e.domain === 'roof' && e.couverture === undefined)!;
    expect(plan, 'aucune entrée de toit sans `couverture` — la fixture ne mesure rien').toBeDefined();
    plan.couverture = false;
    expect(schema.safeParse(doc).success).toBe(false);
  });

  // Que `couverture: true` PARSE est tenu par `m0` : les trois couvertures du document réel le
  // portent. Ce qui se mesure ici est le contrat #1691 — l'entrée qui EST le plan vu du dessus ne
  // peut pas, en plus, couvrir un pan.
  it('une entrée de toit ne peut pas être à la fois COUVERTURE et PLAN vu du dessus (#1691)', () => {
    const doc = clone();
    const plan = doc.find((e) => e.vueDeDessus === true)!;
    expect(plan, 'aucune entrée marquée `vueDeDessus` — la fixture ne mesure rien').toBeDefined();
    plan.couverture = true;
    expect(refus(doc).join(' ')).toMatch(/à la fois une couverture de pan et le plan vu du dessus/);
  });

  it('le PLAN vu du dessus est UNIQUE dans le dataset : zéro marqueur est refusé, en le chiffrant', () => {
    const doc = clone();
    delete doc.find((e) => e.vueDeDessus === true)!.vueDeDessus;
    expect(refus(doc).join(' ')).toMatch(/0 entrée\(s\) marquée\(s\) « plan vu du dessus »/);
  });

  it('…et DEUX marqueurs le sont aussi, en les NOMMANT', () => {
    const doc = clone();
    const couvrante = doc.find((e) => e.domain === 'roof' && e.couverture === true)!;
    delete couvrante.couverture;
    couvrante.vueDeDessus = true;
    expect(refus(doc).join(' ')).toMatch(new RegExp(`2 entrée\\(s\\) marquée\\(s\\) « plan vu du dessus ».*${couvrante.id}`));
  });
});
