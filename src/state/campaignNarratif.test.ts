/**
 * Paquet de campagne (#765) — le bloc NARRATIF parse et VALIDE au bon format, et
 * `parseProject` LÈVE fail-fast sur chaque violation d'invariant (collision id narratif ↔ règle
 * globale, référence par id morte, id interne dupliqué) — invariants portés par `narratifSchema`
 * (`src/data/schemas/defs-scenes/narratif.ts`), qui NOMME le chemin fautif dans le message. Contrat
 * POSITIF : un doc minimal valide restitue son narratif.
 */
import { describe, it, expect } from 'vitest';
import { exigerUnRefus, parseProject } from './worldMap';
import { emptyNarratif, type NarratifBlock } from './campaignNarratif';
import { emptyScene } from './scene';

// ids RÉELS de la règle globale (`src/data`) — base de preset valide + cible de collision.
const GLOBAL_CREATURE = 'humain';

const scene = { ...emptyScene(3, 3), id: 's1', label: 'Le quai' };

/** L'identité est REQUISE depuis #1552 : sans elle la porte refuse, et ce n'est plus le narratif qu'on
 *  mesurerait. Une `identite` d'appelant la REMPLACE (les cas d'identité de ce fichier). */
function enveloppe(identite: Record<string, unknown> = { id: 'fixture', label: 'Fixture', versionContenu: 1 }) {
  return { type: 'projet', ...identite, maison: 'fixture de test', scenes: [scene] };
}
function doc(narratif: NarratifBlock, identite?: Record<string, unknown>) {
  return { ...enveloppe(identite), narratif };
}

const validNarratif = (): NarratifBlock => ({
  ...emptyNarratif(),
  affaires: [{ id: 'af-sel', titre: 'L\'affaire du sel' }],
  indices: [
    { id: 'in-quai', affaireId: 'af-sel', kind: 'indice', titre: 'Le quai désert', stades: [{ id: 'st1', prose: 'Un quai vide.' }] },
    { id: 'ru-taverne', affaireId: 'af-sel', kind: 'rumeur', titre: 'On chuchote', stades: [{ id: 'st1', prose: 'Une rumeur.' }], refs: ['in-quai'] },
  ],
  presetsPnj: [{ id: 'pnj-marin', base: GLOBAL_CREATURE }],
  objets: [{ id: 'obj-lettre', label: 'Lettre cachetée', categorie: 'trapping', subType: null } as NarratifBlock['objets'][number]],
});

describe('paquet de campagne — bloc narratif', () => {
  it('doc minimal (narratif vide) parse et restitue son narratif', () => {
    const res = parseProject(doc(emptyNarratif()));
    expect(res.scenes.map((s) => s.id)).toEqual(['s1']);
    expect(res.narratif).toEqual(emptyNarratif());
  });

  it('doc peuplé valide restitue son narratif', () => {
    const res = parseProject(doc(validNarratif()));
    expect(res.narratif.affaires.map((a) => a.id)).toEqual(['af-sel']);
    expect(res.narratif.presetsPnj[0].base).toBe(GLOBAL_CREATURE);
  });

  it('(a) LÈVE si un id narratif collisionne avec un id de la règle globale', () => {
    const n = validNarratif();
    n.affaires.push({ id: GLOBAL_CREATURE, titre: 'Collision' });
    expect(() => parseProject(doc(n))).toThrow(/collisionne avec un id de la règle globale/);
  });

  it('(b) LÈVE si indice.affaireId ne résout aucune affaire', () => {
    const n = validNarratif();
    n.indices[0].affaireId = 'af-fantome';
    expect(() => parseProject(doc(n))).toThrow(/Bloc narratif › indice « in-quai » › affaire: affaire inconnue « af-fantome »/);
  });

  it('(c) LÈVE si preset.base ne résout aucune créature globale (FK `creatures.json`)', () => {
    const n = validNarratif();
    n.presetsPnj[0].base = 'creature-inexistante';
    expect(() => parseProject(doc(n))).toThrow(/« creature-inexistante » est absent du catalogue des créatures \(creatures\.json\)/);
  });

  it('(c2) LÈVE si un preset PNJ sans base a un profil sans « char »', () => {
    const n = validNarratif();
    n.presetsPnj.push({ id: 'pnj-adhoc', profil: { label: 'Sans base' } as NarratifBlock['presetsPnj'][number]['profil'] });
    expect(() => parseProject(doc(n))).toThrow(/Bloc narratif › PNJ « pnj-adhoc » › profil › Caractéristiques: « char » absent d’un profil sans base/);
  });

  it('(c3) LÈVE si un preset PNJ n\'a ni base ni profil', () => {
    const n = validNarratif();
    n.presetsPnj.push({ id: 'pnj-vide' });
    expect(() => parseProject(doc(n))).toThrow(/Bloc narratif › PNJ « pnj-vide »: ni base ni profil/);
  });

  it('(d) LÈVE si indice.refs pointe un indice inconnu', () => {
    const n = validNarratif();
    n.indices[1].refs = ['in-fantome'];
    expect(() => parseProject(doc(n))).toThrow(/Bloc narratif › indice « ru-taverne » › renvois 1: indice inconnu « in-fantome »/);
  });

  it('(e) LÈVE si deux entrées du narratif partagent le même id', () => {
    const n = validNarratif();
    n.affaires.push({ id: 'af-sel', titre: 'Doublon' });
    expect(() => parseProject(doc(n))).toThrow(/Bloc narratif › affaires « af-sel »: « af-sel » dupliqué/);
  });

  it('(f) LÈVE (message clair NOMMANT le champ, pas TypeError) si un doc n\'a pas de bloc narratif', () => {
    expect(() => parseProject(enveloppe())).toThrow(/Bloc narratif: Entrée invalide : objet attendu/);
  });

  it('(g) LÈVE si un registre du narratif n\'est pas un tableau', () => {
    expect(() => parseProject({ ...enveloppe(), narratif: { affaires: [], indices: [] } })).toThrow(/Bloc narratif › PNJ précomposés: Entrée invalide : tableau attendu/);
  });

  it('(h) doc à identité valide parse et restitue l’id, à la racine', () => {
    const res = parseProject(doc(emptyNarratif(), { id: 'camp-x', label: 'Campagne X', versionContenu: 1 }));
    expect(res.id).toBe('camp-x');
    expect(res.versionContenu).toBe(1);
  });

  it('(i) LÈVE si l’identité est malformée (id vide) — chemin à la racine', () => {
    let refus: unknown;
    try { parseProject(doc(emptyNarratif(), { id: '', label: 'X', versionContenu: 1 })); }
    catch (erreur) { refus = erreur; }
    expect(refus).toBeDefined();
    exigerUnRefus(refus);
    expect(refus.cause).toBe('schema');
    expect(refus.message).toMatch(/Identifiant:/);
    expect(refus.fautes.map((faute) => faute.chemin)).toContainEqual(['id']);
  });

  // ── #1342 L3 : la référence PAR ID va jusqu'à la spécialisation d'une Compétence de profil.
  const presetSkill = (spec: string) => {
    const n = validNarratif();
    n.presetsPnj.push({ id: 'pnj-savant', base: GLOBAL_CREATURE, profil: { skills: [{ id: 'savoir', spec, value: 40 }] } as NarratifBlock['presetsPnj'][number]['profil'] });
    return n;
  };

  it('(j) preset PNJ : une spec VALIDE passe, y compris HORS pool (statbloc-only, `pool: false`)', () => {
    expect(parseProject(doc(presetSkill('local'))).narratif.presetsPnj.length).toBe(2);
    expect(parseProject(doc(presetSkill('reikland'))).narratif.presetsPnj.length).toBe(2);
  });

  it('(k) preset PNJ : LÈVE sur une spec qui ne résout pas ; la sentinelle « Au choix » est REFUSÉE sur une Compétence (un emplacement non désigné s’écrit « choix »)', () => {
    expect(() => parseProject(doc(presetSkill('Rivières')))).toThrow(/spécialisation inconnue « Rivières »/);
    expect(() => parseProject(doc(presetSkill('Au choix')))).toThrow(/n'est pas une spécialisation mais un EMPLACEMENT non désigné .* s'écrit « choix »/);
  });

  const presetTalent = (spec: string) => {
    const n = validNarratif();
    n.presetsPnj.push({ id: 'pnj-mondain', base: GLOBAL_CREATURE, profil: { talents: [{ id: 'savoir-vivre', spec }] } as NarratifBlock['presetsPnj'][number]['profil'] });
    return n;
  };

  it('(l) preset PNJ : la spec d’un TALENT est validée au même titre', () => {
    expect(() => parseProject(doc(presetTalent('PAS-UN-ID')))).toThrow(/spécialisation inconnue « PAS-UN-ID » pour le Talent/);
    expect(parseProject(doc(presetTalent('Au choix'))).narratif.presetsPnj.length).toBe(2);
  });

  it('(m) preset PNJ : un Talent SANS catalogue de spécs porte un texte d’instance, admis comme dans creatures.json (#1621)', () => {
    const n = validNarratif();
    n.presetsPnj.push({ id: 'pnj-promis', base: GLOBAL_CREATURE, profil: { talents: [{ id: 'destinee', spec: "L'escroc, le cerf et le loup dans la nuit" }] } as NarratifBlock['presetsPnj'][number]['profil'] });
    expect(parseProject(doc(n)).narratif.presetsPnj.length).toBe(2);
  });
});
