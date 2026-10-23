import { describe, it, expect } from 'vitest';
import { t, trous, interpolate, getLocale, avecSigne, pluriel } from './index';
import type { TrousVerifies } from './index';
import { fr } from './messages/fr';
import { CHAR_LABELS, DIFFICULTY_LABELS, HIT_LOCATION_LABELS, BODY_SHAPE_LOC_LABELS } from '../engine/types';
import { DEFENSE_LABEL } from '../engine/combat';
import { cibleLabel } from '../engine/psychology';
import { psychologyLabel } from '../data';
import type { PsychType } from '../engine/psychology';

describe('i18n — primitive t() + catalogue FR (seam, plan → #320)', () => {
  it('résout une clé en texte FR', () => {
    expect(t('char.capacite-de-combat')).toBe('Capacité de Combat');
    expect(t('difficulty.difficile')).toBe('Difficile (−20)');
  });

  it('interpolate remplace {param} et laisse {x} intact si absent', () => {
    expect(interpolate('{actor} réussit (DR {sl}).', { actor: 'Bob', sl: 2 })).toBe('Bob réussit (DR 2).');
    expect(interpolate('{a} et {b}', { a: 'X' })).toBe('X et {b}');
    expect(interpolate('aucun param')).toBe('aucun param');
  });

  it('locale par défaut = fr', () => {
    expect(getLocale()).toBe('fr');
  });

  it('les maps de labels DÉRIVENT du catalogue (source unique, parité verbatim)', () => {
    expect(CHAR_LABELS['capacite-de-combat']).toBe(t('char.capacite-de-combat'));
    expect(CHAR_LABELS.sociabilite).toBe('Sociabilité');
    expect(DIFFICULTY_LABELS.tresFacile).toBe(t('difficulty.tresFacile'));
    expect(DIFFICULTY_LABELS.intermediaire).toBe('Intermédiaire (+0)');
    // Difficultés extrêmes EDO (App.2) : labels dérivés du catalogue comme les autres.
    expect(DIFFICULTY_LABELS.presqueImpossible).toBe(t('difficulty.presqueImpossible'));
    expect(DIFFICULTY_LABELS.impossible).toBe('Impossible (−50)');
    expect(HIT_LOCATION_LABELS.tete).toBe(t('hitloc.tete'));
    expect(HIT_LOCATION_LABELS.jambeD).toBe('Jambe droite');
    expect(DEFENSE_LABEL.parade).toBe('Parade');
    expect(BODY_SHAPE_LOC_LABELS.quadrupede.brasG).toBe('Membre antérieur gauche');
    expect(BODY_SHAPE_LOC_LABELS.oiseau.brasG).toBe(t('hitloc.oiseau.brasG'));
    // Le libellé d'un type psy CIBLÉ DÉRIVE de psychology.json (donnée app-owned, comme etats.json),
    // pas du catalogue t().
    expect(cibleLabel('animosite')!.label).toBe(psychologyLabel('animosite'));
    expect(cibleLabel('haine')!.icon).toBe('flag/anger'); // icône du registre <Icon>, portée par la donnée
  });

  it('trous de message (#2938) : un id de vocabulaire fermé ne compile pas ; texte, libellé et nombre passent', () => {
    const psy = 'animosite' as PsychType;
    // @ts-expect-error — `PsychType` est un vocabulaire fermé : il se nomme par `psychologyLabel`
    const brut = t('turn.recompose', { name: 'Gob', type: psy });
    const nomme = t('turn.recompose', { name: 'Gob', type: psychologyLabel(psy) });
    const texte = t('op.cond', { name: 'Gob', v: 2, cond: 'texte libre' });
    expect([brut, nomme, texte]).toEqual(['Gob se ressaisit (animosite).', `Gob se ressaisit (${psychologyLabel(psy)}).`, 'Gob reçoit 2 État texte libre.']);
  });

  it('trous de message (#2938) : élargir l\'id ou le marier à un texte ne le fait pas passer', () => {
    const psyOpt = undefined as PsychType | undefined;
    const psy = 'haine' as PsychType;
    const cond = psy === 'haine';
    const n = 2 as number;
    const rendus = [
      // @ts-expect-error — repli vide : l'union reste un vocabulaire fermé
      t('turn.recompose', { name: 'Gob', type: psyOpt ?? '' }),
      // @ts-expect-error — repli texte : idem
      t('turn.recompose', { name: 'Gob', type: psyOpt ?? '?' }),
      // @ts-expect-error — ternaire vers un littéral
      t('turn.recompose', { name: 'Gob', type: cond ? psy : 'autre' }),
      // @ts-expect-error — gabarit qui recopie l'id
      t('turn.recompose', { name: 'Gob', type: `${psy}` }),
      // @ts-expect-error — accord écrit au site : il se dit par `pluriel`
      t('turn.recompose', { name: 'Gob', type: n > 1 ? 's' : '' }),
      // @ts-expect-error — signe écrit au site : il se dit par `avecSigne`
      t('turn.recompose', { name: 'Gob', type: `${n >= 0 ? '+' : '-'}${n}` }),
    ];
    expect(rendus).toHaveLength(6);
  });

  it('accords hors du site (#2938) : signe typographique et pluriel d\'un compte', () => {
    expect([avecSigne(2), avecSigne(-3), avecSigne(0)]).toEqual(['+2', '−3', '+0']);
    expect([pluriel(0), pluriel(1), pluriel(-1), pluriel(2), pluriel(-2)]).toEqual(['', '', '', 's', 's']);
  });

  it('trous de message (#2938) : les canaux `Record` stockés passent par `trous()`, seul émetteur de la marque', () => {
    const psy = 'animosite' as PsychType;
    const verifies: TrousVerifies = trous({ name: 'Gob', type: psychologyLabel(psy) });
    // @ts-expect-error — un objet brut n'est pas un jeu de trous vérifiés
    const brut: TrousVerifies = { name: 'Gob', type: psy };
    // @ts-expect-error — `trous()` applique le même typage que `t()`
    const viaTrous = trous({ name: 'Gob', type: psy });
    expect([verifies, brut, viaTrous].map((v) => v.name)).toEqual(['Gob', 'Gob', 'Gob']);
  });

  it('garde `out.*` : aucune clé ne re-imprime le jet (roll/sl/drow, ou {target} en paire avec {roll}) — #295 Lot 0 Décision 1b/ceinture', () => {
    const offenders = Object.entries(fr)
      .filter(([k]) => k.startsWith('out.'))
      .filter(([, v]) => /\{(roll|sl|drow)\}/.test(v) || (/\{target\}/.test(v) && /\{roll\}/.test(v)));
    expect(offenders).toEqual([]);
  });

  it('chute (#700) : une longueur ne se sépare jamais de son unité — espace INSÉCABLE entre la valeur et « m »', () => {
    // Juge-vision de #700, modale « Chute volontaire » à 360px : « (chute de 2 » / « m) ». Chaque clé
    // de chute est RENDUE (tous ses trous remplis par une longueur) : aucune valeur suivie d'une espace
    // ordinaire puis de « m », et celles qui disent une longueur la collent par U+00A0.
    const cles = (Object.keys(fr) as (keyof typeof fr)[]).filter((k) => /^fall\.(modale|situation|option)\.|^eff\.fallOuverte$/.test(k));
    const rendus = cles.map((k) => [k, interpolate(fr[k], new Proxy({}, { get: () => 2, has: () => true }) as Record<string, number>)] as const);
    expect(rendus.filter(([, v]) => /\d[ \t]m\b/.test(v)).map(([k]) => k), 'unité orpheline possible : espace ordinaire avant « m »').toEqual([]);
    const colles = rendus.filter(([, v]) => /\d\u00a0m\b/.test(v)).map(([k]) => k);
    expect(colles).toEqual(expect.arrayContaining(['fall.option.sauter', 'fall.option.suspendreSauter', 'fall.option.suspendreTenter', 'fall.modale.denivele', 'eff.fallOuverte']));
  });
});
