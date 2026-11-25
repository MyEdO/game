// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { installerLesSurvols } from './bulles';
import { achat, apercuDe } from './pieces';
import { texteDuTalent } from '../noyau';

beforeAll(installerLesSurvols);

const survoler = (html: string) => {
  const hote = document.createElement('div');
  hote.innerHTML = html;
  document.body.append(hote);
  hote.querySelector('button')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  return document.querySelector<HTMLElement>('.apercu-du-jeu')!;
};

describe('le survol d’une plaque qui porte un aperçu', () => {
  it('fermée, dit sa raison au pied de l’aperçu', () => {
    const apercu = survoler(achat({ verbe: 'Apprendre', prix: 200, monnaie: 'PX', avoir: 50, attrs: `data-a="talent"${apercuDe({ nom: 'Très résistant', texte: 'Blessures 12 → 14' })}` }));
    expect(apercu.textContent).toContain('Blessures 12 → 14');
    expect(apercu.querySelector('.pied')?.textContent).toBeTruthy();
  });
  it('armée, n’a pas de pied', () => {
    const apercu = survoler(achat({ verbe: 'Apprendre', prix: 200, monnaie: 'PX', avoir: 900, attrs: `data-a="talent"${apercuDe({ nom: 'Très résistant', texte: 'Blessures 12 → 14' })}` }));
    expect(apercu.querySelector('.pied')).toBeNull();
  });
});

describe('le texte du livre dans un aperçu', () => {
  it('rend le tableau de « Magie des Arcanes » en table, ses en-têtes et ses rangées, sans barre de Markdown', () => {
    const apercu = survoler(achat({ verbe: 'Apprendre', prix: 200, monnaie: 'PX', avoir: 900, attrs: `data-a="talent"${apercuDe({ nom: 'Magie des Arcanes', texte: texteDuTalent('magie-des-arcanes') })}` }));
    const table = apercu.querySelector('.corps-apercu table')!;
    expect([...table.querySelectorAll('thead th')].map((c) => c.textContent)).toEqual(['Nbre de Sorts actuellement connus', 'Coût en PX pour un nouveau sort']);
    expect([...table.querySelectorAll('tbody tr')][0].textContent).toBe('Bonus d\'Intelligence x 1100 PX');
    expect(apercu.textContent).not.toContain('|');
  });
});
