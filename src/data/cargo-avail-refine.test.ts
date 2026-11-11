/**
 * CONTRAT des refus du Tableau des cargaisons (#1659 L-1659-2, #3578 L5) — `defs/cargaisons-aleatoires.ts` :
 * chaque document couvre son dé d'un seul tenant, une rangée ne désigne qu'une MARCHANDISE de SA voie, une
 * colonne (voie × saison) n'est tirée que par un document. MDG 15 l.404-418 ; MSRC 13 l.69-78
 *
 * Les fautes sont injectées dans une COPIE PROFONDE du fichier réel, jamais dans le fichier.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schema } from './schemas/defs/cargaisons-aleatoires';

type Document = { id: string; voie: string; saison: string; die: string; entries: { id: string; min: number; max: number }[] };

const charger = (): Document[] => JSON.parse(readFileSync(fileURLToPath(new URL('./cargaisons-aleatoires.json', import.meta.url)), 'utf8'));

/** Parse une copie du fichier après y avoir injecté une faute ; rend les messages de refus. */
function refus(saboter: (docs: Document[]) => void): string[] {
  const docs = charger();
  saboter(docs);
  const r = schema.safeParse(docs);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

const colonne = (docs: Document[], voie: string, saison: string) => docs.find((d) => d.voie === voie && d.saison === saison)!;

describe('cargaisons-aleatoires.json — les refus MORDENT et NOMMENT', () => {
  it('le fichier COMMITTÉ passe : la sonde ne mesure pas un refus permanent', () => {
    expect(refus(() => {})).toEqual([]);
  });

  it('un TROU dans une colonne est refusé en nommant le document et la rangée', () => {
    for (const voie of ['mer', 'terre']) {
      const messages = refus((docs) => {
        colonne(docs, voie, 'hiver').entries[0].min = 3;
      });
      expect(messages.length, `${voie} : un trou ouvert dans la colonne hiver n’a levé AUCUN refus.`).toBe(1);
      expect(messages[0]).toMatch(new RegExp(`cargaisons-aleatoires\\.json › cargaisons-${voie}-hiver : les rangées ne couvrent pas le d100 d'un seul tenant`));
    }
  });

  it('une rangée qui désigne une cargaison de l’AUTRE voie est refusée', () => {
    const messages = refus((docs) => {
      colonne(docs, 'mer', 'ete').entries[0].id = 'vivres';
    });
    expect(messages).toEqual([expect.stringMatching(/cargaisons-mer-ete : la rangée 1-9 \(vivres\) — « vivres » est hors de la sous-liste « mer »/)]);
  });

  it('une rangée qui désigne un MARQUEUR de colonne Production/Produits est refusée', () => {
    const messages = refus((docs) => {
      colonne(docs, 'terre', 'automne').entries[0].id = 'commerce-terre';
    });
    expect(messages).toEqual([expect.stringMatching(/cargaisons-terre-automne : la rangée 1-35 \(commerce-terre\) — « commerce-terre » ne porte aucun prix/)]);
  });

  it('une colonne tirée par DEUX documents est refusée', () => {
    const messages = refus((docs) => {
      colonne(docs, 'mer', 'automne').saison = 'printemps';
    });
    expect(messages.some((m) => /la colonne mer › printemps est déjà tirée par « cargaisons-mer-printemps »/.test(m)), messages.join('\n')).toBe(true);
  });
});
