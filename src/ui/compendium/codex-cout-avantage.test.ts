/**
 * Le Codex ne montre JAMAIS un template d'instance. Un coût d'Avantage authoré en `$indice`
 * (`engine/flowCore::INDICE_TEMPLATE`, substitué au runtime par `withArg` depuis l'Indice de l'arme
 * portée) n'a pas d'instance quand on lit la FICHE d'une qualité : il s'y lit comme le livre l'imprime,
 * « X » — `AA 08 l.87` « **Taillade (XA) :** … Vous pouvez dépenser X Avantages pour que votre opposant
 * subisse 1 État *Hémorragique* supplémentaire. »
 *
 * Les DEUX lecteurs joueur du Codex sont mesurés sur le catalogue RÉEL (jamais une fixture) :
 * `humanizeFlowSentence` (phrase) et `effectsSection` (rangées de la fiche, dont le repli technique).
 */
import { describe, it, expect } from 'vitest';
import { qualities, findQualityById } from '../../data';
import { humanizeFlowSentence } from '../../noyau/codex/humanize';
import { effectsSection } from './describe';
import type { EtatDeclare } from '../../data/schemas/defs-scenes/formes-d-etat';

/** Aucun état de campagne : les données du dépôt n'en déclarent pas (#767). */
const AUCUN_ETAT: readonly EtatDeclare[] = [];

/** Tout le texte JOUEUR que la section « Effets déclenchés » d'une fiche rend, aplati. */
function textesDeFiche(effects: Parameters<typeof effectsSection>[0]): string[] {
  const section = effectsSection(effects, AUCUN_ETAT);
  return (section?.rows ?? []).flatMap((r) => {
    const o = r as { text?: string; label?: string; summary?: string; show?: string };
    return [o.text, o.label, o.summary, o.show].filter((s): s is string => typeof s === 'string');
  });
}

describe('Codex des qualités — aucun template d’instance n’atteint le joueur', () => {
  const porteuses = qualities.filter((q) => q.effects?.length);

  it('le scan VOIT le corpus (sinon un vert vide passerait)', () => {
    expect(porteuses.length, 'aucune qualité ne porte d’effet déclenché : le test ne mesure plus rien.').toBeGreaterThan(0);
  });

  it('aucune phrase ni rangée de fiche ne contient un « $ » — le fautif est NOMMÉ', () => {
    const fuites: string[] = [];
    for (const q of porteuses) {
      for (const e of q.effects!) {
        const phrase = humanizeFlowSentence(e.flow, AUCUN_ETAT);
        if (phrase.includes('$')) fuites.push(`${q.id} → phrase : ${phrase}`);
      }
      for (const t of textesDeFiche(q.effects)) if (t.includes('$')) fuites.push(`${q.id} → fiche : ${t}`);
    }
    expect(
      fuites,
      `Template(s) d'instance rendu(s) tel(s) quel(s) au joueur :\n  ${fuites.join('\n  ')}`,
    ).toEqual([]);
  });

  it('Taillade : le coût resté TEMPLATE se lit « X », comme le livre l’imprime (AA 08 l.87)', () => {
    const taillade = findQualityById('taillade')!;
    const phrase = humanizeFlowSentence(taillade.effects![0].flow, AUCUN_ETAT);
    expect(phrase).toContain('(X Avantage)');
    const fiche = textesDeFiche(taillade.effects);
    expect(fiche.some((t) => t.includes('(X Av)')), `le repli technique n'imprime pas « (X Av) » :\n  ${fiche.join('\n  ')}`).toBe(true);
    expect(phrase, 'un « ; sinon » pend sur une branche `no` absente.').not.toContain('sinon');
  });

  it('Déstabilisante : un coût LITTÉRAL reste chiffré, et sa branche `no` absente ne pend pas', () => {
    const destab = findQualityById('destabilisante')!;
    const phrase = humanizeFlowSentence(destab.effects![0].flow, AUCUN_ETAT);
    expect(phrase).toContain('(2 Avantage)');
    expect(phrase, 'un « ; sinon » pend sur une branche `no` absente.').not.toContain('sinon');
  });
});
