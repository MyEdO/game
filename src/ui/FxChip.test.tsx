import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FxChip } from './FxChip';

describe('FxChip — conséquence mécanique non-État', () => {
  it('icône du registre + libellé, famille visuelle .fx-chip', () => {
    const html = renderToStaticMarkup(<FxChip icon="navigation/activite" label="−1 Activité" />);
    expect(html).toContain('fx-chip');
    expect(html).toContain('−1 Activité');
    expect(html).toContain('<svg');
  });
});
