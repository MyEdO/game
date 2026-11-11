/**
 * SOCLE d'enjeu (#1117 L0b) — la porte UNIQUE et sa primitive de rendu.
 *
 * 1. `resolveStake` est FAIL-CLOSED aux deux bouts (clé inconnue, trou sans valeur) et DÉRIVE la fiche
 *    de règle de la MÊME entrée — un producteur ne nomme jamais la règle.
 * 2. `StakeNote` rend le texte résolu SOUS SA CLASSE PROPRIÉTAIRE `.rm-stake` (Z3b), avec le renvoi.
 * 3. `RollShell.stake` est une prop de PREMIER RANG : la coquille résout et rend sans passer par `extra`.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveStake, nightStakeRef, voyageStakeRef, symptoms } from '../data';
import { StakeNote, StakeRule } from './StakeNote';
import { RollShell } from './RollShell';

describe('resolveStake — la porte UNIQUE, fail-closed (#1117)', () => {
  it('rend le texte de la donnée et DÉRIVE la fiche de règle de la même entrée', () => {
    const r = resolveStake(nightStakeRef('recuperation'));
    expect(r.text?.length ?? 0).toBeGreaterThan(10);
    expect(r.rule).toEqual({ category: 'regles', id: 'guerison-des-blessures' });
  });

  /**
   * La clé DESCEND à l'ENTRÉE jouée (`{dataset, kind, entryId}` du design #1117) — escalade user
   * 2026-08-06 : cliquer la règle de « Blessé (Blessure Purulente) » ouvrait l'INTRO DE CHAPITRE
   * (« Servez-vous en pour inventer des maladies bien répugnantes », du propos d'auteur MJ) au lieu
   * de la règle du symptôme joué. Le repli sur le `kind` reste, DÉCLARÉ, pour un id introuvable.
   */
  it('l’ENTRÉE jouée prime : une étape de maladie renvoie au SYMPTÔME, pas à l’intro de chapitre', () => {
    expect(resolveStake(nightStakeRef('maladie-test-quotidien', 'blesse')).rule).toEqual({ category: 'symptoms', id: 'blesse' });
    expect(resolveStake(nightStakeRef('maladie-gangrene', 'gangrene')).rule).toEqual({ category: 'symptoms', id: 'gangrene' });
    expect(resolveStake(nightStakeRef('maladie-persistance', 'persistant')).rule).toEqual({ category: 'symptoms', id: 'persistant' });
  });

  it('la fiche du SYMPTÔME porte bien la règle attendue (le verbatim du Test quotidien)', () => {
    const fiche = symptoms.find((s) => s.id === 'blesse')!;
    expect(fiche.desc).toContain('Chaque jour, réussissez un Test de **Résistance Accessible (+20)**');
  });

  it('REPLI DÉCLARÉ : sans entrée jouée — ou entrée inconnue — la fiche du `kind` reprend la main', () => {
    expect(resolveStake(nightStakeRef('maladie-test-quotidien')).rule).toEqual({ category: 'regles', id: 'symptomes-des-maladies' });
    expect(resolveStake(nightStakeRef('maladie-test-quotidien', 'symptome-fantome')).rule).toEqual({ category: 'regles', id: 'symptomes-des-maladies' });
  });

  it('un `entryId` sur un kind SANS catalogue d’entrées est ignoré (aucun renvoi fabriqué)', () => {
    expect(resolveStake(nightStakeRef('recuperation', 'blesse')).rule).toEqual({ category: 'regles', id: 'guerison-des-blessures' });
  });

  it('remplit les trous du gabarit avec les valeurs CALCULÉES', () => {
    const r = resolveStake(voyageStakeRef('fleuve-navigation', { driftKm: 7, driftPct: 25 }));
    expect(r.text).toContain('7');
    expect(r.text).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('une clé INCONNUE jette (aucune surface muette en silence)', () => {
    expect(() => resolveStake({ key: { dataset: 'voyage', kind: 'kind-fantome' } })).toThrow(/aucune entrée d’enjeu|aucune entrée d'enjeu/);
    // @ts-expect-error — `kind-fantome` n'est l'id d'aucun enjeu de voyage
    expect(() => voyageStakeRef('kind-fantome')).toThrow(/aucune entrée d'enjeu/);
  });

  it('un TROU sans valeur jette (jamais un « {driftKm} » rendu au joueur)', () => {
    expect(() => resolveStake(voyageStakeRef('fleuve-navigation'))).toThrow(/driftKm/);
  });
});

describe('StakeNote — la primitive de la zone Z3b (#1117)', () => {
  it('rend la PHRASE sous SA classe propriétaire `.rm-stake`', () => {
    const html = renderToStaticMarkup(<StakeNote stake={nightStakeRef('recuperation')} />);
    expect(html, 'Z3b a un propriétaire distinguable').toContain('class="rm-stake"');
    expect(html).toContain('Points de Blessure');
    // Ton NEUTRE : ni la note générique, ni la menace SUBIE (fond rouge).
    expect(html).not.toContain('rm-note');
    expect(html).not.toContain("data-ton=\"menace\"");
  });

  it('ne porte PLUS le lien textuel « la règle » (arbitrage user 2026-08-06 : le renvoi va au TITRE)', () => {
    const html = renderToStaticMarkup(<StakeNote stake={nightStakeRef('cauchemar')} />);
    expect(html).not.toContain('la règle');
    // L'auto-liage de `<Prose>` (« Exténué » → sa fiche d'État) RESTE : chaque terme de règle est sa
    // propre porte (#1078). Ce qui meurt, c'est le LIEN NOMMÉ « la règle » posé sous la phrase.
    expect(html).not.toContain('ab-codex-info');
  });
});

describe('RollShell.stake — prop de PREMIER RANG (#1117)', () => {
  it('la coquille résout la RÉFÉRENCE et la rend en Z3b', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Récupération"
        stake={nightStakeRef('recuperation')}
        rolled={false}
        rows={[]}
        actions={[]}
        embedded
      />,
    );
    expect(html, 'l’enjeu est rendu par la coquille, sans passer par `extra`').toContain('class="rm-stake"');
    expect(html).toContain('Points de Blessure');
  });
});

/**
 * `StakeRule` — le déclencheur lui-même : il compose le patron EXISTANT de `CodexRef`
 * (`ab-codex-info` + glyphe `journal/information`, patron de la barre d'action), aucun bouton local, aucun
 * caractère typographique bricolé (arbitrage user 2026-08-06 : « "la régle" ? C'est moche. Je
 * pensais que tu allais mettre un "i" a coté de "Cauchemars", pas "la régle" en dessous »). SA
 * POSITION — la ligne de titre de la fenêtre de cascade — se mesure à l'écran dans
 * `cascade-subtitle.test.tsx` (montage réel de `CascadeBody`).
 */
describe('StakeRule — le déclencheur-icône (#1117, arbitrage 2026-08-06)', () => {
  it('porte le patron partagé, NOMMÉ par la FICHE qu’il ouvre', () => {
    const html = renderToStaticMarkup(<StakeRule rule={{ category: 'regles', id: 'trauma' }} />);
    expect(html, 'le déclencheur-icône partagé, pas un bouton local').toContain('ab-codex-info');
    expect(html, 'l’icône vient du pipeline (journal/information), jamais un caractère bricolé').toContain('<svg');
    // Le pas qui l'accueille peut s'appeler « Cauchemars » : le renvoi, lui, mène à la fiche Trauma —
    // et c'est elle qu'il annonce (#1657 B3-2b-b, `stake-rule-nom-accessible.test.tsx`).
    expect(html, 'nom accessible dérivé de la FICHE, préfixé de son rôle').toContain('aria-label="Règle : Trauma"');
    expect(html).toContain('role="button"');
    expect(html, 'aucun lien textuel').not.toContain('la règle');
  });

  it('sans foyer déclaré, rien n’est rendu (aucune icône morte)', () => {
    expect(renderToStaticMarkup(<StakeRule />)).toBe('');
  });
});
