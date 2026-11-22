/** LDB 04 l.93-101 ; NADJ 14 l.66-75 ; ADE II 02 l.112-121 ; `tableDesRacesAleatoires` (`src/data/index.ts`) */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import especesAleatoiresJson from '../../especes-aleatoires.json';

const FICHIER = 'especes-aleatoires.json';
const clone = () => structuredClone(especesAleatoiresJson);
const nomme = (docs: ReturnType<typeof clone>, id: string) => {
  const d = docs.find((x) => x.id === id);
  expect(d, `le document « ${id} » est dans especes-aleatoires.json`).toBeDefined();
  return structuredClone(d!);
};

function avecBornesDuLdb(max: number, min: number) {
  const docs = clone();
  const table = docs.find((d) => d.id === 'races-ldb')!;
  table.entries[0].max = max;
  table.entries[1].min = min;
  return docs;
}

describe('especes-aleatoires.json — couverture du dé', () => {
  it('accepte une table qui couvre le d100 d’un seul tenant', () => {
    expect(validateDataset(FICHIER, avecBornesDuLdb(89, 90))).toBeNull();
  });

  it('REFUSE, en le nommant, un trou entre deux rangées', () => {
    expect(validateDataset(FICHIER, avecBornesDuLdb(88, 90))).toMatch(
      /especes-aleatoires\.json › races-ldb : les rangées ne couvrent pas le 1d100 d'un seul tenant/,
    );
  });
});

describe('especes-aleatoires.json — un seul document par jeu de races', () => {
  it('le schéma accepte la donnée RÉELLE', () => {
    expect(validateDataset(FICHIER, especesAleatoiresJson)).toBeNull();
  });

  it('REFUSE, en nommant le jeu et les deux documents, un second document au même jeu de races', () => {
    const docs = clone();
    const copie = nomme(docs, 'races-ldb');
    copie.id = 'races-ldb-bis';
    docs.push(copie);
    expect(validateDataset(FICHIER, docs)).toMatch(
      /especes-aleatoires\.json › races-ldb-bis : le jeu de races « elfe-sylvain, halfling, haut-elfe, humain, nain » est déjà celui du document « races-ldb » : un seul document par jeu de races\./,
    );
  });

  it('accepte un second document à un jeu de races différent', () => {
    const docs = clone();
    const sansHalfling = nomme(docs, 'races-ldb');
    sansHalfling.id = 'races-sans-halfling';
    sansHalfling.entries = sansHalfling.entries.filter((r) => r.id !== 'halflings').map((r) => (r.id === 'humains-reiklander' ? { ...r, max: 94 } : r));
    docs.push(sansHalfling);
    expect(validateDataset(FICHIER, docs)).toBeNull();
  });
});
