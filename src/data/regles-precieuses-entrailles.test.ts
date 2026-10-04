/**
 * Registre `regles.json` (#1887) — les passages de ZI 13 « Précieuses entrailles » que la récolte
 * implémente (#1988 B4a-i : `engine/harvest.ts`) ont chacun leur fiche, dont l'adresse RÉSOUT au `Source/`.
 */
import { describe, it, expect } from 'vitest';
import reglesJson from './regles.json';
import { estErreur, resoudreAdresse, type ChapitreParse, type DescRef } from './source/decoupe';
// @ts-expect-error - outil ESM JS (pas de types) — même convention que `source/reparer-adresses.test.ts`
import { lireChapitre } from '../../scripts/source/lecteur-fs.mjs';

const regles = reglesJson as readonly { id: string; descRef?: DescRef }[];

const FICHES = [
  ['precieuses-entrailles-valeur', "L'unité de mesure de base est 1 point d'Encombrement"],
  ['precieuses-entrailles-quantite', 'Monstrueuse 16 Enc'],
  ['precieuses-entrailles-conservation', 'MODIFICATEUR DE PRIX'],
] as const;

describe('ZI 13 « Précieuses entrailles » au registre', () => {
  it.each(FICHES)('%s résout au Source/ et rend son passage', (id, temoin) => {
    const fiche = regles.find((r) => r.id === id);
    expect(fiche?.descRef, id).toBeDefined();
    const ref = fiche!.descRef!;
    const chapitre = lireChapitre(ref.book, ref.ch) as ChapitreParse | null;
    expect(chapitre, `${ref.book} ch.${ref.ch}`).toBeTruthy();
    const rendu = resoudreAdresse(chapitre!, ref);
    if (estErreur(rendu)) throw new Error(`${id} : ${rendu.error} — ${rendu.detail}`);
    expect(rendu.md).toContain(temoin);
  });
});
