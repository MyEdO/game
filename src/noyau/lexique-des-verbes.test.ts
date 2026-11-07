import { describe, expect, it } from 'vitest';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { VerrouDuLexique } from './fabriquesDuNoyau';

type Verbes = keyof ActionsDuNoyau;

describe('le verrou du lexique des verbes (#3371 §3.4)', () => {
  it('admet un nom du lexique, refuse un nom hors lexique', () => {
    const verdicts: unknown[] = [];
    const admis: VerrouDuLexique<Verbes | 'acheterLeSort' | 'debarquer' | 'jouerALaTaverne'> = true;
    verdicts.push(admis);

    // @ts-expect-error nom anglais
    const anglais: VerrouDuLexique<Verbes | 'battleCharge'> = true;
    // @ts-expect-error mot exclu du lexique : un choix de fenêtre se joue par `fenetreChoisir`
    const exclu: VerrouDuLexique<Verbes | 'choisirLaCible'> = true;
    // @ts-expect-error famille de jet sans verbe générique : un geste de jet se joue par son verbe de jet
    const jetManuscrit: VerrouDuLexique<Verbes | 'jetLancerLaCascade'> = true;
    // @ts-expect-error famille de fenêtre hors de ses trois actions
    const fenetreManuscrite: VerrouDuLexique<Verbes | 'fenetreAnnuler'> = true;
    verdicts.push(anglais, exclu, jetManuscrit, fenetreManuscrite);

    expect(verdicts).toEqual([true, true, true, true, true]);
  });
});
