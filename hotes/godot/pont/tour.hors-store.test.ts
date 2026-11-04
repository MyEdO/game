/**
 * UN TOUR COMPLET JOUÉ PAR LE PONT (#2928, `CONTRAT.md`, plan critère 4) sur le combat de l'hôte texte (`dome`) : le
 * round ouvert, l'attaque d'un héros, le déplacement d'un second héros vers une case de la vue, puis, ses jetons
 * repris, l'attaque adverse que joue le noyau et la Défense du héros. Chaque geste se joue comme Godot le joue : par
 * l'intention que porte l'élément qu'il presse (`vue.zones`, `src/hote/elements.ts`), une offre, un geste de la fenêtre
 * ou une valeur de son choix. À chaque réponse, la fenêtre ouverte se dessine (`fautesDeLaFenetre`) ; le test ne
 * calcule rien.
 */
import { describe, it, expect } from 'vitest';
import { corpsDe, drainer, fautesDeLaFenetre, gesteDe, table, type Reponse } from './pont.testkit';
import type { Suite } from './pont';
import type { Bouton, Ligne } from '../../../src/hote/elements';

const { appel: appelNu } = table();

/** Les fenêtres vues au fil du tour, par leur clé et l'étape de séquence qu'elles tiennent. */
const vues = new Set<string>();

/** L'appel du pont, chaque vue rendue contrôlée : la fenêtre ouverte se dessine verbe par verbe. */
const appel = (methode: string, entree?: unknown): Reponse => {
  const r = appelNu(methode, entree);
  if (r.ok && r.vue) {
    const f = r.vue.projection.fenetre;
    expect(fautesDeLaFenetre(r.vue), `la fenêtre ${f?.cle ?? 'aucune'} se dessine verbe par verbe`).toEqual([]);
    if (f) vues.add(f.etape ? `${f.cle}:${f.etape.genre}` : f.cle);
  }
  return r;
};

/** Le geste joué, ses jetons repris : la dernière suite, toutes les lignes de journal et celles de l'écran. */
const jouer = (geste: Record<string, unknown>) => drainer(appel, appel('jouer', geste));

/** Le bouton pressé : l'intention qu'il porte, jouée. */
const presser = (b: Bouton) => jouer(b.jeu);

/** Le bouton du geste d'identité `cle`. */
const bouton = (s: Suite, cle: string): Bouton => {
  const g = gesteDe(s.vue, cle);
  if (g.type !== 'bouton') throw new Error(`${cle} : ${g.type}, pas un bouton`);
  return g;
};

/** L'identité du geste qui a le focus : celui que la fenêtre joue à l'Entrée. */
const attendu = (s: Suite): string => {
  const g = s.vue.zones['fenetre.gestes'].filter((x) => 'focus' in x && x.focus);
  expect(g.length, `un seul geste en focus dans ${JSON.stringify(s.vue.zones['fenetre.gestes'].map((x) => x.id))}`).toBe(1);
  return g[0].id;
};

/** La valeur que le bouton `b` d'un choix pose : son dernier argument. */
const valeurDe = (b: Bouton): unknown => ('args' in b.jeu ? b.jeu.args[b.jeu.args.length - 1] : undefined);

const actifDe = (s: Suite) => s.vue.projection.combat!.actif!;

/** La fin du tour par son offre, confirmée par la même offre quand la vue la dit armée (`finDeTourArmee`). */
function finirLeTour(): ReturnType<typeof jouer> {
  const arme = jouer({ offre: 'end-turn' });
  if (!arme.suite.vue.projection.combat!.finDeTourArmee) return arme;
  const fin = jouer({ offre: 'end-turn' });
  return { suite: fin.suite, journal: [...arme.journal, ...fin.journal], lignes: [...arme.lignes, ...fin.lignes] };
}

describe('un tour complet par le pont', () => {
  it('attaque d’un héros par ses gestes, déplacement, attaque adverse jouée par le noyau, Défense', { timeout: 240_000 }, () => {
    let { suite } = drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
    expect(gesteDe(suite.vue, 'confirmRoundStart'), 'l’ouverture du round : un bouton nommé').toMatchObject({ libelle: 'Commencer le round', type: 'bouton' });
    expect(suite.vue.champ, 'la barre fermée, le champ ne se clique pas').toBeNull();
    ({ suite } = presser(bouton(suite, 'confirmRoundStart')));

    const heros = actifDe(suite);
    expect(heros.camp).toBe('hero');
    expect(suite.vue.projection.combat!.barre).toEqual({ forme: 'ouverte', raison: null });
    expect(suite.vue.zones['combat.offres'].find((o) => o.id === 'charge')?.libelle, 'chaque offre de la barre a son libellé').toMatch(/^Charger/);
    expect(suite.vue.zones['combat.actif'][0]?.nom, 'le panneau nomme l’actif').toBe(heros.nom);
    ({ suite } = jouer({ offre: 'charge' }));
    expect(suite.vue.projection.combat!.intention, 'l’offre arme son intention').toBe('charge');
    expect(suite.vue.zones['combat.offres'].find((o) => o.presse)?.id, 'l’offre armée est pressée').toBe('charge');
    const [cible] = suite.vue.projection.combat!.cibles.liste; // les cibles que le clic accepte, la Charge armée
    const nomDe = (id: string) => suite.vue.projection.combat!.voisins.liste.find((v) => v.id === id)!.nom;
    const nomDeLaCible = nomDe(cible);
    ({ suite } = jouer({ type: suite.vue.champ!.combattant, args: [cible] }));
    expect(suite.vue.projection.fenetre, 'la charge ouvre la fenêtre d’attaque').toMatchObject({ cle: 'cascade', etape: { genre: 'attackJet' } });
    expect(corpsDe(suite.vue, 'cible'), 'la fenêtre nomme la cible').toMatchObject({ type: 'ligne', texte: expect.stringContaining(nomDeLaCible) });
    expect(corpsDe(suite.vue, 'jet'), 'le jet de l’attaquant, à lancer').toMatchObject({ type: 'jet', qui: heros.nom, resultat: 'à lancer', verdict: null });
    expect(attendu(suite), 'avant le jet, le jet est attendu').toBe('jetRoll@attack');

    const localiser = () => {
      const g = gesteDe(suite.vue, 'attackSetLocation');
      if (g.type !== 'choix' && g.type !== 'liste') throw new Error(`la Localisation : ${g.type}, pas un choix`);
      return g.valeurs;
    };
    const lieu = localiser().find((v) => valeurDe(v) !== null)!;
    ({ suite } = presser(lieu));
    expect(localiser().find((v) => v.presse)?.id, 'le choix dit la Localisation retenue').toBe(lieu.id);
    const auHasard = localiser().find((v) => valeurDe(v) === null)!;
    ({ suite } = presser(auHasard));
    expect(localiser().find((v) => v.presse)?.id, 'au hasard').toBe(auHasard.id);
    ({ suite } = presser(bouton(suite, attendu(suite))));
    expect(corpsDe(suite.vue, 'jet'), 'le jet tombé dit son verdict').toMatchObject({ type: 'jet', verdict: expect.any(String) });
    const issue = corpsDe(suite.vue, 'issue');
    expect(issue, 'le jet tombé dit son issue').toMatchObject({ type: 'ligne' });
    expect(attendu(suite), 'le jet tombé, la confirmation est attendue').toBe('jetConfirm@attack');
    const confirmee = presser(bouton(suite, attendu(suite)));
    suite = confirmee.suite;
    expect(suite.vue.projection.fenetre?.etape?.genre, 'confirmée, la fenêtre d’attaque se ferme').not.toBe('attackJet');
    expect(confirmee.lignes.map((l) => l.texte), 'l’issue confirmée entre au journal de l’écran').toContain((issue as Ligne).texte);
    ({ suite } = finirLeTour());

    const second = actifDe(suite);
    expect(second.id).not.toBe(heros.id);
    const vers = suite.vue.cases.find((c) => c.zone === 'marche' && c.cout === 1)!.case;
    ({ suite } = jouer({ type: suite.vue.champ!.case, args: [vers] }));
    expect(suite.vue.projection.combat!.apercu, 'le premier clic montre l’aperçu').toMatchObject({ genre: 'move', cible: null, case: [vers.x, vers.y] });
    expect(suite.vue.zones['combat.avis'].map((l) => l.id), 'le panneau dit ce que l’aperçu coûte').toContain('apercu');
    ({ suite } = jouer({ type: suite.vue.champ!.case, args: [vers] }));
    expect(actifDe(suite).pos, 'le second clic déplace le héros').toEqual([vers.x, vers.y]);
    expect(suite.vue.occupants[`${vers.x},${vers.y}`], 'la case porte son occupant').toBe(second.id);

    let journal: ReturnType<typeof jouer>['journal'];
    ({ suite, journal } = finirLeTour());
    const adversaire = actifDe(suite);
    expect(adversaire.camp, 'les jetons repris, le noyau joue l’adversaire').toBe('enemy');
    const defense = suite.vue.projection.fenetre!;
    expect(defense, 'la fenêtre de la Défense : l’étape du jet de Défense de la cascade').toMatchObject({ cle: 'cascade', etape: { genre: 'defenseJet' } });
    expect(corpsDe(suite.vue, 'defense/qui'), 'la Défense dit qui attaque').toMatchObject({ type: 'ligne', texte: expect.stringContaining(adversaire.nom) });
    const etape = suite.vue.zones['fenetre.etape'][0]?.texte;
    expect(attendu(suite), 'avant le jet de Défense, le jet est attendu').toBe('jetRoll@defense');
    const evenements = [...journal];
    ({ suite, journal } = presser(bouton(suite, attendu(suite))));
    evenements.push(...journal);
    expect(attendu(suite), 'le jet de Défense tombé, sa confirmation est attendue').toBe('jetConfirm@defense');
    ({ suite, journal } = presser(bouton(suite, attendu(suite))));
    evenements.push(...journal);
    expect(corpsDe(suite.vue, 'defense/qui'), 'la Défense confirmée, sa fenêtre se ferme').toBeUndefined();
    const attaque = evenements.find((l) => l.de === 'combat' && l.evenement.actorId === adversaire.id && l.evenement.targetId);
    expect(attaque, 'l’attaque adverse entre au journal, sa cible nommée').toBeDefined();
    const vise = suite.vue.projection.combat!.voisins.liste.find((v) => attaque!.de === 'combat' && v.id === attaque!.evenement.targetId)!;
    expect(vise.camp, 'l’adversaire vise un héros').toBe('hero');
    expect(defense.proprietaire, 'la Défense est au héros attaqué').toEqual({ genre: 'porteur', nom: vise.nom });
    expect(etape, 'l’étape nomme le héros qui se défend').toContain(vise.nom);
    expect([...vues], 'les fenêtres du tour, chacune dessinée verbe par verbe').toEqual(expect.arrayContaining(['roundStart', 'cascade:attackJet', 'cascade:defenseJet']));
    expect(appel('erreursGlobales')).toEqual({ ok: true, erreurs: [] });
  });
});
