// @vitest-environment jsdom
/**
 * L'Étoile du Sorcier se lit sur sa donnée (#1667) : le dé du sous-tirage (`stars.json › sub`, ADE II 03
 * l.63) suit `starSubDie` au titre des destins du créateur et au domaine du champ « Sous-tirage » de
 * l'atelier ; le compte de ses destins suit ses membres jusque dans l'invite de la position pointée.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import * as data from '../../data';
import { deDeLaTableTiree } from '../../engine/tables';
import { CodexEdit } from '../editor/codex/CodexEdit';
import { StarScreen } from './CharacterCreator';
import { newDraft } from '../../noyau/creation/brouillon';
import { demonterRacines, monterRacine } from '../../monterRacine.testkit';

const SORCIER = 'l-etoile-du-sorcier-seconde-vue';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  demonterRacines();
  vi.restoreAllMocks();
});

function EcranAstral() {
  const [d, setD] = useState(() => newDraft(7));
  return <StarScreen d={d} setD={setD} />;
}

describe('L’Étoile du Sorcier — dé et compte lus sur la donnée', () => {
  it('un d6 au sous-tirage : le titre des destins et le domaine du Sous-tirage le suivent', () => {
    vi.spyOn(data, 'starSubDie').mockReturnValue(deDeLaTableTiree({ die: 'd6' }));

    const html = renderToStaticMarkup(<StarScreen d={{ ...newDraft(7), star: SORCIER }} setD={() => {}} />);
    expect(html).toContain('4 destins — 1d6');

    const { container } = monterRacine(<CodexEdit categoryKey="stars" id={SORCIER} onClose={() => {}} />);
    expect(container.textContent).toContain('Sous-tirage — 1d6');
  });

  it('la position pointée sans destin élu invite au choix parmi ses destins comptés', () => {
    const { container } = monterRacine(<EcranAstral />);
    const position = container.querySelector<SVGGElement>('[role="radio"][aria-label="L\'Étoile du Sorcier"]');
    expect(position, 'la roue porte la position de L’Étoile du Sorcier').not.toBeNull();
    act(() => { position!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('L’Étoile du Sorcier ouvre 4 destins — choisissez le vôtre ci-dessus.');
  });
});
