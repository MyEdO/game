/**
 * L'EXPLORATION PAR L'HÔTE TEXTE (#2898 lot D) : la vue donne chaque geste du groupe prêt à jouer (`gestesDExploration`),
 * et chacun se joue tel qu'écrit, dans tout scénario de test qui commence en exploration ; un pas qui vise la case
 * voisine sans son étage se refuse en le nommant ; un accès ouvert ne s'actionne pas, il se franchit ; la fenêtre qui
 * tient la main se lit hors combat.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { lireLeFichier, ligneDuFichier, rejouer } from './partieTexte';
import { nouvelEntete } from '../hote/partie';
import { fermerLaTable, table, verbe } from './hote.testkit';
import { gestesDExploration } from '../noyau/index';
import { testScenarios } from '../scenes/test-scenarios';

afterEach(fermerLaTable);

/** Un fichier de partie committé à côté de ce test. */
const fixture = (nom: string): string => readFileSync(new URL(`./${nom}`, import.meta.url), 'utf8');

/** Les gestes d'exploration de la partie que ce texte rejoue. */
function gestesDuTexte(texte: string) {
  const { entete, gestes } = lireLeFichier(texte);
  const r = rejouer(entete, gestes);
  try {
    return gestesDExploration(r.partie.etat());
  } finally {
    r.partie.fermer();
  }
}

/** Les parties à l'ouverture de chaque scénario de test sans combat d'entrée, et la croisée des écuries. */
const PARTIES = [
  ...testScenarios.filter((s) => !s.autoCombat).map((s) => [s.id, ligneDuFichier(nouvelEntete(s.id, {}))] as const),
  ['croisee-ecuries', fixture('croisee-ecuries.jsonl')] as const,
];

describe('chaque geste d’exploration que la vue donne se joue tel qu’écrit', () => {
  it.each(PARTIES)('%s', { timeout: 120_000 }, (_, texte) => {
    for (const g of gestesDuTexte(texte)) {
      const t = table(texte);
      const r = t.jouer(...g.gestes.map((x) => verbe(x.verbe, ...x.args)));
      expect(r.erreur, `${g.libelle} : ${r.texte}`).toBeNull();
    }
  });

  it('témoin : la croisée des écuries offre le saut par la fenêtre, et la vue l’écrit prêt à jouer', () => {
    const [saut] = gestesDuTexte(fixture('croisee-ecuries.jsonl')).filter((g) => g.gestes.length === 1 && g.gestes[0].args.length === 2);
    expect(saut, 'aucun geste d’arête depuis la croisée').toBeDefined();
    const t = table(fixture('croisee-ecuries.jsonl'));
    const vue = t.lire('vue').texte.split('\n  ').join(' ');
    expect(vue).toContain(`${saut.libelle} : \`jouer {"gestes":[`);
    expect(vue).toMatch(/groupe \(7,2\) étage 1 · cap /);
  });
});

describe('le groupe en exploration', () => {
  it('un accès ouvert ne s’actionne pas : le refus dit qu’il se franchit en marchant, et la vue le donne en marche', () => {
    const texte = fixture('porte-ouverte.jsonl');
    const { entete, gestes } = lireLeFichier(texte);
    const [id] = gestes.flatMap((g) => ('type' in g && g.type === 'actionnerLaPorte' ? g.args : []));
    if (typeof id !== 'string') throw new Error('la partie n’ouvre aucune porte');
    expect(gestesDuTexte(texte).map((g) => g.gestes.length)).toContain(1);
    const t = table(texte);
    const avant = t.fichier();
    const r = t.jouer(verbe('actionnerLaPorte', id));
    expect(r.erreur, r.texte).toBe('regle');
    expect(r.texte.split('\n  ').join(' ')).toMatch(/le groupe le franchit en marchant/);
    expect(t.fichier()).toBe(avant);
    expect(entete.scenario).toBe('porte-close');
  });

  it('un geste qui part d’ailleurs à l’étage se donne avec le clic de la case qui mène le groupe jusqu’à lui (`cliquerLaCase`)', () => {
    const lointains = gestesDuTexte(ligneDuFichier(nouvelEntete('fenetre-ecuries', {}))).filter((g) => g.gestes.length === 2);
    expect(lointains.map((g) => g.gestes.map((x) => x.verbe))).toContainEqual(['cliquerLaCase', 'franchirLArete']);
  });

  it('le clic d’une case qu’aucun chemin n’atteint se refuse en la nommant, et rien ne s’écrit', () => {
    const t = table(fixture('croisee-ecuries.jsonl'));
    const avant = t.fichier();
    const r = t.jouer(verbe('cliquerLaCase', { x: 99, y: 99 }));
    expect(r.erreur, r.texte).toBe('regle');
    expect(r.texte.split('\n  ').join(' ')).toMatch(/Marche refusée : aucun chemin du groupe ne mène à \(99,99\)/);
    expect(t.fichier()).toBe(avant);
  });

  it('la chute de groupe : le jet attend que chaque tombant ait déclaré, le refus les nomme, et le pid de la fenêtre est le prochain à déclarer', () => {
    const [saut] = gestesDuTexte(fixture('croisee-ecuries.jsonl')).filter((g) => g.gestes.length === 1 && g.gestes[0].verbe === 'franchirLArete');
    const t = table(fixture('croisee-ecuries.jsonl'));
    t.jouer(...saut.gestes.map((x) => verbe(x.verbe, ...x.args)));
    const pid = /pid (\S+)\)/.exec(t.lire('vue').texte)![1];
    const r = t.jouer(verbe('jetLancer', 'chute', pid));
    expect(r.erreur, r.texte).toBe('regle');
    expect(r.texte.split('\n  ').join(' ')).toMatch(new RegExp(`chaque tombant déclare d’abord s’il tente le Test et s’il se suspend d’abord ; reste à déclarer : [^(]+ \\(${pid}\\)`));
    expect(t.jouer(verbe('jetRegler', 'chute', 'suspendre', false, pid), verbe('jetRegler', 'chute', 'tenter', false, pid)).erreur).toBeNull();
    expect(/pid (\S+)\)/.exec(t.lire('vue').texte)?.[1], 'le pid passe au tombant suivant').not.toBe(pid);
  });

  it('la carte d’exploration nomme les héros du groupe avec leur id', () => {
    const t = table(fixture('croisee-ecuries.jsonl'));
    expect(t.lire('carte').texte).toMatch(/^groupe \(\d+,\d+\) · \d+ héros · \d+ entité\(s\)\n {2}soldat-de-test · heros · Soldat$/m);
  });

  it('la fenêtre qui tient la main se lit hors combat, avec ses verbes', () => {
    const [saut] = gestesDuTexte(fixture('croisee-ecuries.jsonl')).filter((g) => g.gestes.length === 1 && g.gestes[0].args.length === 2);
    const t = table(fixture('croisee-ecuries.jsonl'));
    const r = t.jouer(...saut.gestes.map((x) => verbe(x.verbe, ...x.args)));
    expect(r.erreur, r.texte).toBeNull();
    expect(r.texte).toMatch(/^fenêtre \S+ \(à /m);
    expect(r.texte).toMatch(/^verbes/m);
  });
});
