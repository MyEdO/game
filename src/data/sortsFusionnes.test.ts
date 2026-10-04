/**
 * CONTRAT — toute place de sort du document de PROJET est une forme que `remapSortsFusionnesDeep`
 * réécrit (#1897, `PROJECT_MIGRATIONS[15]`, `src/data/migrationsDeProjet.ts`).
 *
 * Deux mesures. Le SCHÉMA : chaque feuille `idDe('spell')` que `projetSchema` et les payloads d'op
 * (`OP_DEFS`, lus par le raffinement de `gameOpSchema`) déclarent, sous la clé de son PORTEUR, en chaîne
 * ou en liste. Les DONNÉES livrées : chaque repère `spell` du parse de mesure des 4 projets
 * (`reperesDuParse`). Une place dont la forme n'est pas réécrite rend le banc rouge en la NOMMANT.
 */
import { describe, expect, it } from 'vitest';
import { reperesDuParse, typeDeFeuilleDId } from './schemas/grammaire/ref';
import { descendre, enfantsDe } from './schemas/grammaire/descente';
import { OP_DEFS } from './schemas/grammaire/mecanique';
import { projetSchema } from './schemas/defs-scenes/projet';
import { remapSortsFusionnesDeep } from './sortsFusionnes';
import areneProjet from '../scenes/arene/arene-projet.json';
import bargeProjet from '../scenes/barge-du-sel/barge-du-sel-projet.json';
import diligenceProjet from '../scenes/diligence/diligence-projet.json';
import loupProjet from '../scenes/loup-et-saumure/loup-et-saumure-projet.json';

const PROJETS: readonly unknown[] = [areneProjet, bargeProjet, diligenceProjet, loupProjet];

type Forme = { cle: string; liste: boolean };
type Place = Forme & { chemin: string };

/** Chaque référence de sort validée au parse, à son path de DONNÉE. */
const REPERES = PROJETS.flatMap((p) => reperesDuParse(projetSchema, p)).filter((r) => r.type === 'spell' && !r.parCle);

/** La FORME terminale d'un repère : la clé qui porte la valeur, et si la valeur est une liste. */
function formeDuRepere(path: readonly PropertyKey[]): Forme {
  const liste = typeof path[path.length - 1] === 'number';
  const cle = String((liste ? path[path.length - 2] : path[path.length - 1]) ?? '');
  return { cle, liste };
}

/**
 * Les places `spell` DÉCLARÉES : chaque objet atteint par `descendre` est un PORTEUR, et chaque clé
 * (`enfantsDe`) y descend jusqu'à sa feuille `idDe` sans franchir d'autre objet. Une feuille partagée
 * par deux porteurs y est deux places. Sous la clé, le segment restant (unions et enveloppes ôtées) dit
 * la forme : `''` chaîne, `[]` liste ; toute autre forme est rendue telle quelle, clé suffixée.
 */
function placesDeclarees(racines: readonly unknown[]): Place[] {
  const places: Place[] = [];
  descendre(racines, ({ noeud, def, path }) => {
    if (def.type !== 'object') return;
    for (const enfant of enfantsDe(noeud)) {
      if (!enfant.segment.startsWith('.')) continue;
      descendre([enfant.noeud], (v) => {
        if (typeDeFeuilleDId(v.noeud) === 'spell') {
          const sous = v.path.replace(/\|\d+/g, '');
          const cle = enfant.cle ?? enfant.segment;
          const chemin = path + enfant.segment + v.path;
          if (sous === '' || sous === '[]') places.push({ cle, liste: sous === '[]', chemin });
          else places.push({ cle: cle + sous, liste: false, chemin });
          return 'elaguer';
        }
        if (v.def.type === 'object') return 'elaguer';
      });
    }
  });
  return places;
}

const DECLAREES = placesDeclarees([projetSchema, ...Object.values(OP_DEFS)]);

/** La forme est-elle réécrite par la primitive (`alarme` → `alerte`, #1897) ? */
function reecrite({ cle, liste }: Forme): boolean {
  const avant = { [cle]: liste ? ['alarme'] : 'alarme' };
  const attendu = { [cle]: liste ? ['alerte'] : 'alerte' };
  return JSON.stringify(remapSortsFusionnesDeep(avant)) === JSON.stringify(attendu);
}

describe('remapSortsFusionnesDeep — contrat avec les places de sort du schéma de projet', () => {
  it('le schéma déclare des places de sort, et les projets livrés en portent (sans quoi le banc ne mesurerait rien)', () => {
    expect(DECLAREES.length).toBeGreaterThan(0);
    expect(REPERES.length).toBeGreaterThan(0);
  });

  it('chaque place `spell` DÉCLARÉE par le schéma a une forme que la primitive réécrit', () => {
    const nonReecrites = DECLAREES.filter((p) => !reecrite(p)).map((p) => `${p.cle}${p.liste ? '[]' : ''} @ ${p.chemin}`);
    expect(nonReecrites).toEqual([]);
  });

  it('chaque place `spell` du parse de mesure des projets livrés aboutit à une forme que la primitive réécrit', () => {
    const nonReecrites = REPERES.filter((r) => !reecrite(formeDuRepere(r.path))).map((r) => r.path.map(String).join('.'));
    expect(nonReecrites).toEqual([]);
  });
});
