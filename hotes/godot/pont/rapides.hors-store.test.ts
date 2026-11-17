/**
 * LES EMPLACEMENTS RAPIDES PAR LE PONT (#3935, variante B) : « Magie en combat » joué comme Godot le joue. Au tour de la
 * Haute Sorcière, ses sorts sont aux six rangs de `combat.rapides` dans l'ordre de ses sorts ; le geste d'une case arme
 * son sort ; sous une fenêtre de jet, aucune case, comme aucune offre ; une case refusée reste à son rang ; chaque case et chaque sort de la liste portent au survol la fiche du sort
 * (son nom, son niveau d'incantation), jamais le refus recopié. Chaque case porte la touche de son rang, pleine ou
 * libre ; la fin du tour porte la sienne ; aucun autre bouton de l'écran n'en porte.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { drainer, table, type Reponse, enFocus, gestesDessines } from './pont.testkit';
import { CLIC_DU_CHAMP, findSpellById } from '../../../src/noyau/index';
import { TOUCHES_RAPIDES, type Appel, type Bouton, type Choix, type Ligne } from '../../../src/hote/elements';
import { clicDuCombattant, type Suite } from './pont';

const { appel } = table();
const jouer = (r: Reponse): Suite => drainer(appel, r).suite;
afterEach(() => { appel('quitter'); });

/** Joue le geste que l'Entrée jouerait, ou la première valeur ouverte d'un choix de la fenêtre, tant qu'une fenêtre tient
 *  la main. */
function viderLesFenetres(suite: Suite): Suite {
  for (let pas = 0; suite.vue.projection.fenetre; pas++) {
    expect(pas, 'les fenêtres se vident').toBeLessThan(20);
    const g = gestesDessines(suite.vue);
    const b = g.find((x): x is Bouton => x.type === 'bouton' && x.focus) ?? g.flatMap((x) => (x.type === 'choix' ? x.valeurs : [])).find((v) => !v.refus)!;
    suite = jouer(appel('jouer', b.jeu));
  }
  return suite;
}

const rapides = (suite: Suite): (Bouton | Ligne)[] => suite.vue.zones['combat.rapides'];
const boutons = (suite: Suite): Bouton[] => rapides(suite).filter((e): e is Bouton => e.type === 'bouton');

describe('les emplacements rapides par le pont', () => {
  it('les sorts aux rangs, le geste d’une case arme son sort, une case refusée reste à son rang', () => {
    viderLesFenetres(jouer(appel('demarrer', { scenario: 'magie', graine: 7 })));
    let suite = viderLesFenetres(jouer(appel('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 16, y: 11 }] })));
    const actif = suite.vue.projection.combat!.actif!.id;
    const sorts = suite.vue.zones['combat.offres'].find((c): c is Choix => c.id === 'offre/incantation')!.valeurs;
    expect(sorts.length, 'la Haute Sorcière connaît plus de six sorts').toBeGreaterThan(6);

    const ids = rapides(suite).map((e) => e.id);
    expect(ids, 'six rangs, toujours').toEqual(['rapide/0', 'rapide/1', 'rapide/2', 'rapide/3', 'rapide/4', 'rapide/5']);
    expect(boutons(suite).map((b) => b.libelle), 'ses six premiers sorts, dans l’ordre de ses sorts').toEqual(sorts.slice(0, 6).map((b) => b.libelle));
    expect(boutons(suite).map((b) => b.jeu), 'chaque case joue le verbe de son offre, l’actif pour lanceur').toEqual(sorts.slice(0, 6).map((b) => b.jeu));
    expect(boutons(suite).every((b) => b.icone === 'action/incanter' && b.refus === null && !b.presse), 'au dessin de l’incantation, ouvertes, aucune armée').toBe(true);
    const libelles = boutons(suite).map((b) => b.libelle);
    const fiches = boutons(suite).map((b) => b.detail);
    const [premiere] = boutons(suite);
    const niDe = (b: Bouton): number => findSpellById(String((b.jeu as Appel).args[1]))!.cn!;
    expect(premiere.detail!.split('\n')[0], 'la fiche d’une case commence par le nom de son sort').toBe(premiere.libelle);
    expect(premiere.detail, 'puis son niveau d’incantation, lu de la donnée').toContain(`Niveau d’Incantation : ${niDe(premiere)}`);
    expect(fiches, 'la case et le sort de la liste portent la même fiche').toEqual(sorts.slice(0, 6).map((b) => b.detail));

    suite = jouer(appel('jouer', boutons(suite)[1].jeu));
    expect(boutons(suite).map((b) => b.presse), 'le geste de la case arme son sort, seul').toEqual([false, true, false, false, false, false]);

    const flechette = sorts.find((b) => b.libelle === 'Fléchette')!;
    expect(flechette.jeu).toEqual({ type: 'incanterLeSort', args: [actif, 'flechette'] });
    suite = jouer(appel('jouer', flechette.jeu));
    const [cible] = suite.vue.projection.combat!.cibles.liste;
    suite = jouer(appel('jouer', clicDuCombattant(suite.vue, cible)!));
    expect(suite.vue.zones['fenetre.titre'].map((l) => l.texte)).toEqual(['Incantation']);
    expect(suite.vue.zones['combat.offres'], 'sous la fenêtre, aucune offre').toEqual([]);
    expect(rapides(suite), 'ni aucune case : la tablette se retire avec les offres').toEqual([]);

    suite = jouer(appel('jouer', enFocus(suite.vue)!.jeu));
    suite = viderLesFenetres(suite);
    expect(suite.vue.projection.combat!.actif!.action, 'l’Action est prise').toBe('prise');
    expect(boutons(suite).map((b) => b.libelle), 'au retour, l’Action prise, les cases à leur rang').toEqual(libelles);
    expect(boutons(suite).every((b) => b.refus !== null), 'chacune refusée avec sa raison').toBe(true);
    expect(boutons(suite).map((b) => b.detail), 'refusée, la case garde sa fiche, le refus jamais recopié').toEqual(fiches);
  });

  it('chaque case porte la touche de son rang, la fin du tour la sienne, aucun autre bouton', () => {
    /** Chaque bouton que la vue porte, à toute profondeur de ses zones. */
    const tousLesBoutons = (x: unknown): Bouton[] => (Array.isArray(x)
      ? x.flatMap(tousLesBoutons)
      : x && typeof x === 'object'
        ? [...((x as { type?: unknown }).type === 'bouton' ? [x as Bouton] : []), ...Object.values(x).flatMap(tousLesBoutons)]
        : []);
    viderLesFenetres(jouer(appel('demarrer', { scenario: 'magie', graine: 7 })));
    let suite = viderLesFenetres(jouer(appel('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 16, y: 11 }] })));
    const libres = new Set<string>();
    for (let tour = 0; tour < 4 && suite.vue.projection.combat; tour++) {
      const cases = rapides(suite);
      expect(cases.map((e) => [e.id, e.touche]), `au tour ${tour}, chaque case porte la touche de son rang`).toEqual(TOUCHES_RAPIDES.map((k, i) => [`rapide/${i}`, k]));
      cases.filter((e) => e.type === 'ligne').forEach((e) => libres.add(e.id));
      const fin = suite.vue.zones['combat.offres'].flatMap((c) => c.valeurs).find((b) => b.id === 'fin-de-tour')!;
      expect(fin.touche, 'la fin du tour porte la sienne').toBe('fin_de_tour');
      const autres = tousLesBoutons(suite.vue.zones).filter((b) => b !== fin && !cases.includes(b) && b.touche !== null);
      expect(autres.map((b) => b.id), 'aucun autre bouton de l’écran ne porte de touche').toEqual([]);
      suite = viderLesFenetres(jouer(appel('jouer', fin.jeu)));
      if (suite.vue.projection.combat?.finDeTourArmee) suite = viderLesFenetres(jouer(appel('jouer', suite.vue.zones['combat.offres'].flatMap((c) => c.valeurs).find((b) => b.id === 'fin-de-tour')!.jeu)));
    }
    expect(libres.size, 'une case libre a été vue, sa touche à son rang').toBeGreaterThan(0);
  });
});
