import { beforeAll, describe, expect, it } from 'vitest';
import { addCondition, COND, poserInconscientDeSaignement } from '../../../../src/engine/conditions';
import { disponible, nouvellePartie, partir, type Heros } from '../jeu';
import { causesDEtat, libelleDEtat, poserLesReglesDuRoguelite } from '../noyau';
import { carteDeHeros, causeDEtat, etats } from './pieces';
import { ecranDeLExpedition } from './lieux';

beforeAll(() => poserLesReglesDuRoguelite());

const inconscient = (h: Heros) => h.c.conditions.find((x) => x.id === COND.inconscient)!;
/** Les aperçus (`apercuDe`) d'un fragment, dans l'ordre, décodés. */
const apercus = (html: string) => [...html.matchAll(/data-apercu="([^"]*)"/g)].map((m) => m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));

describe('la cause d’un État, telle que le noyau la donne', () => {
  it('l’Inconscient de la perte de sang, Blessures regagnées, dit son verrou Hémorragique', () => {
    const h = nouvellePartie(3).roster[0];
    addCondition(h.c, COND.hemorragique, 1);
    poserInconscientDeSaignement(h.c);
    h.c.wounds.current = 3;
    expect(causesDEtat(h.c, inconscient(h))).toHaveLength(1);
    expect(etats(h.c)).toContain(causeDEtat(h.c, inconscient(h)));
  });

  it('l’Inconscient d’un héros à 0 Blessure le dit', () => {
    const h = nouvellePartie(3).roster[0];
    h.c.wounds.current = 0;
    addCondition(h.c, COND.inconscient, 1);
    expect(causesDEtat(h.c, inconscient(h))).toContain('À 0 Blessure.');
  });

  it('l’Inconscient qu’un effet repose à chaque Round (Colère des Dieux, Blessures restantes) dit cet effet', () => {
    const h = nouvellePartie(3).roster[0];
    h.c.wounds.current = 1;
    addCondition(h.c, COND.inconscient, 1);
    h.c.activeEffects = [...(h.c.activeEffects ?? []), {
      label: 'Purifier la chair', duration: { scale: 'rounds', left: 1 },
      opsPerRound: [{ op: 'condition', id: { id: COND.inconscient } }],
      source: { kind: 'colereDesDieux', id: 'colere-purifier-la-chair' },
    } as never];
    expect(causesDEtat(h.c, inconscient(h)).join(' ')).toContain('Purifier la chair');
  });

  it('chaque État porté a un texte au survol, sur la fiche et sur la carte, même quand le noyau tait sa cause', () => {
    const h = nouvellePartie(3).roster[0];
    addCondition(h.c, COND.inconscient, 1);
    addCondition(h.c, COND.sonne, 2);
    const fiche = apercus(etats(h.c)).map((a) => JSON.parse(a) as { nom: string; texte: string });
    expect(fiche.map((a) => a.nom)).toEqual(h.c.conditions.map((e) => libelleDEtat(e.id, e.value)));
    for (const a of fiche) expect(a.texte, a.nom).not.toBe('');
    const carte = JSON.parse(apercus(carteDeHeros(h, false))[0]) as { texte: string };
    for (const e of h.c.conditions) expect(carte.texte).toContain(`**${libelleDEtat(e.id, e.value)}** : ${causeDEtat(h.c, e)}`);
  });
});

describe('relire la dernière salle', () => {
  it('le récit de la dernière salle se rouvre de l’écran d’expédition', () => {
    const e = nouvellePartie(3);
    partir(e, 'reikwald', e.roster.filter(disponible).map((h) => h.c.id).slice(0, 4));
    expect(ecranDeLExpedition(e, '', null, '', null, true)).toContain('data-a="relire"');
    expect(ecranDeLExpedition(e, '', null, '', null)).not.toContain('data-a="relire"');
  });
});
