/** LDB 04 l.93-101 ; NADJ 14 l.66-75 ; ADE II 02 l.112-121 ; `tableDesRacesAleatoires` (`src/data/index.ts`) */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import especesAleatoiresJson from '../../especes-aleatoires.json';

const FICHIER = 'especes-aleatoires.json';
const table = (entries: { id: string; min: number; max: number }[]) => [
  { id: 'races-fixture', type: 'especes-aleatoires', label: 'Fixture', die: 'd100', source: { book: 'livre-de-base', page: 24 }, entries },
];

describe('especes-aleatoires.json — couverture du dé', () => {
  it('accepte une table qui couvre le d100 d’un seul tenant', () => {
    expect(validateDataset(FICHIER, table([{ id: 'humains-reiklander', min: 1, max: 99 }, { id: 'nains', min: 100, max: 100 }]))).toBeNull();
  });

  it('REFUSE, en le nommant, un trou entre deux rangées', () => {
    expect(validateDataset(FICHIER, table([{ id: 'humains-reiklander', min: 1, max: 90 }, { id: 'nains', min: 92, max: 100 }]))).toMatch(
      /especes-aleatoires\.json › races-fixture : les rangées ne couvrent pas le d100 d'un seul tenant/,
    );
  });
});

type Document = { id: string; entries: { id: string; min: number; max: number }[] };
const clone = () => structuredClone(especesAleatoiresJson) as unknown as Document[];
const nomme = (docs: Document[], id: string) => {
  const d = docs.find((x) => x.id === id);
  expect(d, `le document « ${id} » est dans especes-aleatoires.json`).toBeDefined();
  return structuredClone(d!);
};

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
