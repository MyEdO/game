/**
 * LA RENCONTRE JOUÉE JUSQU'À SON ISSUE (#4829) : en cadence `auto`, un seul appel mène la rencontre d'un combat direct à
 * la sortie de son écran de fin et rend son issue : le vainqueur, le groupe rendu à l'exploration, les lots que ses
 * héros ont laissés au sol, le Destin perdu par héros.
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeLancement } from './partie';
import { jouerLaRencontre, type IssueDeRencontre, type RencontreClose } from './rencontre';
import { buildScene, type EncounterSpec } from '../noyau/mapSpec';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { REPORT_DE_COMBATTANT } from '../engine/persistence';
import type { Cadence, Combatant } from '../noyau/index';

/** Un héros du groupe au profil `cc` en Capacité de Combat et de Tir, qui porte les objets `trappings`. */
function heros(id: string, cc: number, trappings: readonly string[], over: Partial<Combatant> = {}): Combatant {
  const h = combattantDeTest({ id, label: id, kind: 'heros', characteristics: { 'capacite-de-combat': cc, 'capacite-de-tir': cc, endurance: 40, force: 40 }, fate: 2, ...over });
  h.items = trappings.map((t) => itemFromTrappingById(t, idsDeTest)!);
  recomputeLoadout(h);
  return h;
}

/** La rencontre `id` des créatures `ennemis`, à l'est de l'arène. */
const rencontre = (id: string, ennemis: readonly string[]): EncounterSpec => ({ id, enemies: ennemis.map((creature, i) => ({ creature: { id: creature }, pos: { x: 11, y: 2 + 2 * i } })) });

/** Ouvre en cadence `cadence` le combat direct du `groupe` contre la première des `rencontres` d'une arène en plein
 *  jour. */
function ouvrir(graine: number, groupe: Combatant[], ennemis: readonly string[], cadence: Cadence = 'auto', rencontres: EncounterSpec[] = [rencontre('rencontre', ennemis)]) {
  return ouvrirLeLancement({ graine, regles: {}, cadence, desFixes: false }, () => ({
    party: groupe, projet: null, combatDirect: rencontres[0].id,
    scene: buildScene({ id: 'arene', label: 'Arène', size: [14, 8], terrain: 'herbe', heroStart: [2, 4], ambientLight: 'jour', encounters: rencontres }),
  }), () => {});
}

/** Joue la rencontre ouverte jusqu'à son issue ; rend l'issue, le groupe d'avant la rencontre et l'état d'après, la
 *  partie fermée. */
function jouer(o: ReturnType<typeof ouvrir>) {
  try {
    const avant = structuredClone(o.partie.etat().party);
    const issue = jouerLaRencontre(o, o.lancement);
    return { issue, avant, apres: o.partie.etat() };
  } finally {
    o.partie.fermer();
  }
}

/** L'issue close d'une rencontre, ou l'échec qui dit son impasse. */
function close(issue: IssueDeRencontre): RencontreClose {
  if (issue.issue === 'impasse') throw new Error(`rencontre en impasse sur la fenêtre ${issue.fenetre}`);
  return issue;
}

/** Les champs que la couture de retour garde à la rencontre (`REPORT_DE_COMBATTANT`, `sort: false`). */
const CHAMPS_DE_RENCONTRE = Object.entries(REPORT_DE_COMBATTANT).flatMap(([champ, r]) => (r.sort === false ? [champ as keyof Combatant] : []));

describe('jouerLaRencontre (#4829)', () => {
  it('mène un combat direct à la victoire et sort de son écran de fin : le groupe rendu à l’exploration, sans rien de la rencontre', () => {
    const { issue, avant, apres } = jouer(ouvrir(1, [heros('h1', 60, ['epee-batarde']), heros('h2', 60, ['epee-batarde'])], ['jeune-gobelin']));
    const r = close(issue);
    expect(r.issue).toBe('victoire');
    expect([apres.battle, apres.mode, apres.pendingVictory], 'la rencontre n’est pas close').toEqual([null, 'exploration', null]);
    expect(r.groupe.map((h) => h.id)).toEqual(['h1', 'h2']);
    for (const h of r.groupe) {
      const a = avant.find((x) => x.id === h.id)!;
      for (const champ of CHAMPS_DE_RENCONTRE) expect(h[champ], `${h.id}.${champ} sort de la rencontre`).toEqual(a[champ]);
    }
  });

  it('liste par porteur le lot qu’un héros a laissé au sol : le javelot lancé, et le décor qui le montre', () => {
    const o = ouvrir(1, [heros('h1', 60, ['javelot', 'epee-batarde']), heros('h2', 60, ['epee-batarde'])], ['jeune-gobelin']);
    const javelot = o.partie.etat().party[0].items!.find((i) => i.trappingId === 'javelot')!;
    const { issue, apres } = jouer(o);
    const { auSol, groupe } = close(issue);
    expect(auSol.map((l) => [l.porteur, l.objets.map((i) => i.uid)])).toEqual([['h1', [javelot.uid]]]);
    expect(apres.objetsAuSol[auSol[0].decor].map((i) => i.uid), 'le décor ne montre pas le lot').toEqual([javelot.uid]);
    expect(groupe[0].items!.some((i) => i.uid === javelot.uid), 'le javelot au sol est resté au héros').toBe(false);
  });

  it('trace le Destin que chaque héros a perdu pendant la rencontre (« Meurs un autre jour », LDB 17 l.31)', () => {
    const { issue } = jouer(ouvrir(1, [heros('h1', 30, [], { wounds: { current: 1, max: 10 } as Combatant['wounds'] }), heros('h2', 70, ['epee-batarde'], { wounds: { current: 40, max: 40 } as Combatant['wounds'] })], ['troll']));
    const { destinDepense, groupe } = close(issue);
    expect(destinDepense).toEqual({ h1: 1, h2: 0 });
    expect(groupe.map((h) => h.fate)).toEqual([1, 2]);
  });

  it('une défaite se clôt aussi : le groupe rendu, la sortie de l’écran de défaite jouée', () => {
    const { issue, apres } = jouer(ouvrir(1, [heros('h1', 30, [], { wounds: { current: 1, max: 10 } as Combatant['wounds'] })], ['troll']));
    expect(close(issue).issue).toBe('defaite');
    expect(apres.battle).toBeNull();
  });

  it('une rencontre que sa victoire enchaîne sur une autre (`onVictory`) se clôt, et un nouvel appel joue la suivante', () => {
    const o = ouvrir(1, [heros('h1', 60, ['epee-batarde']), heros('h2', 60, ['epee-batarde'])], [], 'auto', [
      { ...rencontre('r1', ['jeune-gobelin']), onVictory: { kind: 'effet', effet: { type: 'startCombat', encounter: { id: 'r2' } } } },
      rencontre('r2', ['jeune-gobelin']),
    ]);
    try {
      expect(close(jouerLaRencontre(o, o.lancement)).issue).toBe('victoire');
      expect(o.partie.etat().battle?.over, 'la rencontre suivante n’est pas ouverte').toBeNull();
      expect(close(jouerLaRencontre(o)).issue).toBe('victoire');
      expect(o.partie.etat().battle).toBeNull();
    } finally {
      o.partie.fermer();
    }
  });

  it('hors de la cadence `auto`, la rencontre s’arrête en impasse au tour du héros, que l’hôte joue', () => {
    const { issue, apres } = jouer(ouvrir(1, [heros('h1', 60, ['epee-batarde'])], ['jeune-gobelin'], 'manuel'));
    expect(issue).toEqual({ issue: 'impasse', fenetre: null });
    expect(apres.battle?.over, 'témoin : le combat dure').toBeNull();
  });

  it('sans rencontre ouverte, l’appel se refuse en `validation`', () => {
    const o = ouvrirLeLancement({ graine: 1, regles: {}, cadence: 'auto', desFixes: false }, () => ({ party: [heros('h1', 30, [])], projet: null, scene: buildScene({ id: 'arene', label: 'Arène', size: [6, 6], heroStart: [2, 2] }) }), () => {});
    try {
      expect(() => jouerLaRencontre(o, o.lancement)).toThrow(expect.objectContaining({ categorie: 'validation', message: 'aucune rencontre ouverte' }));
    } finally {
      o.partie.fermer();
    }
  });
});
