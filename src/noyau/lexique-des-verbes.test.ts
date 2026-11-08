import { describe, expect, it } from 'vitest';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { MachinerieDuNoyau } from './machinerieDuNoyau';
import type { VerrouDeLaMachinerie, VerrouDuLexique } from './fabriquesDuNoyau';

type Verbes = keyof ActionsDuNoyau;
type Machinerie = keyof MachinerieDuNoyau;

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
    // @ts-expect-error action de la seule machinerie : un verbe ne la prend pas
    const deLaMachinerie: VerrouDuLexique<Verbes | 'sauter'> = true;
    verdicts.push(anglais, exclu, jetManuscrit, fenetreManuscrite, deLaMachinerie);

    expect(verdicts).toEqual([true, true, true, true, true, true]);
  });
});

describe('le verrou du lexique de la machinerie (#3605)', () => {
  it('admet une action du lexique, pronominale comprise, refuse un nom hors lexique', () => {
    const verdicts: unknown[] = [];
    const admis: VerrouDeLaMachinerie<Machinerie | 'acheterLeSort' | 'seRelever' | 'annulerLeDeplacement' | 'sauter'> = true;
    verdicts.push(admis);

    // @ts-expect-error nom anglais
    const anglais: VerrouDeLaMachinerie<Machinerie | 'battleHeal'> = true;
    // @ts-expect-error préfixe de contexte
    const contexte: VerrouDeLaMachinerie<Machinerie | 'shipTurn'> = true;
    // @ts-expect-error action hors lexique
    const horsLexique: VerrouDeLaMachinerie<Machinerie | 'courirVers'> = true;
    // @ts-expect-error pronominale d'une action hors lexique
    const pronominale: VerrouDeLaMachinerie<Machinerie | 'seBattreEnDuel'> = true;
    verdicts.push(anglais, contexte, horsLexique, pronominale);

    expect(verdicts).toEqual([true, true, true, true, true]);
  });
});
