/**
 * #1657 B3-2b-b — le NOM ACCESSIBLE du renvoi de règle ⓘ nomme la FICHE VISÉE, jamais le pas qui
 * l'accueille (trouvaille de recette : un pas « Initiative » annonçait « Règle : Initiative » pendant
 * que le lien menait ailleurs — le ⓘ mentait donc à qui ne voit pas l'écran).
 *
 * La correction vit dans la PRIMITIVE : `StakeRule` ne prend plus de libellé, `CodexRef` dérive le nom
 * de l'entrée du Codex et lui préfixe le rôle (`ariaPrefix`). Contrat POSITIF sur des données RÉELLES
 * (aucune fiche fabriquée) : l'enjeu « Retirer la voile (chavirage) » (MSRC 7 l.40) a pour foyer
 * `regles/navigation-chavirage`, dont le libellé n'est PAS celui du pas.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { voyageStakeRef } from '../data';
import { codexLookupById } from './compendium/registry';
import { StakeRule, stakeRuleOf } from './StakeNote';
import { RollShell } from './RollShell';
import type { RollAction } from './RollShell';

const stake = voyageStakeRef('riverCapsize', { rounds: 3 });
const FICHE = codexLookupById('regles', 'navigation-chavirage')!.label;

describe('StakeRule — le ⓘ s’annonce par sa FICHE, pas par le pas qui le porte', () => {
  it('1. le nom accessible est « Règle : <libellé de la fiche> »', () => {
    const html = renderToStaticMarkup(<StakeRule rule={stakeRuleOf(stake)} />);
    expect(FICHE, 'la fiche du chavirage n’est pas nommée « Initiative »').toBe('Navigation — Chavirage et redressement');
    expect(html).toContain(`aria-label="Règle : ${FICHE}"`);
  });

  it('2. un pas d’un AUTRE nom ne déteint pas dessus (la coquille pose le ⓘ elle-même)', () => {
    const actions: RollAction[] = [{ key: 'ack', label: 'Continuer', onClick: () => {} }];
    const html = renderToStaticMarkup(
      <RollShell title="Initiative" rows={[]} rolled={false} actions={actions} stake={stake} />,
    );
    expect(html, 'le titre du pas reste affiché').toContain('Initiative');
    expect(html, 'mais il ne NOMME plus le renvoi').not.toContain('aria-label="Règle : Initiative"');
    expect(html).toContain(`aria-label="Règle : ${FICHE}"`);
  });
});
