import { describe, it, expect } from 'vitest';
// Inventaire des adresses : la DÉFINITION unique du walk (`scripts/source/adresses.mjs`), que la
// sonde de matérialisation et l'outil de réparation prennent au même endroit — un second walk local
// ici et le périmètre des trois divergerait en silence.
import { RACINES_PAR_DEFAUT, adressesDuDepot, fichiersJsonDe } from '../../scripts/source/adresses.mjs';
// @ts-expect-error - résolveur ESM JS (pas de types) — même convention que `vite.config.ts`
import { cheminChapitre, resoudreProse } from '../../scripts/source/resoudre.mjs';
import { fragmentBlocs, fragmentCellule, graphieDuFichier, parseChapitre, type ChapitreParse, type Fragment, type FragmentBlocs } from './source/decoupe';
// Le prédicat de la règle 5, là où il est DÉFINI (partagé avec `no-html-in-prose.test.ts`).
import { HTML_TAG } from './source/normalize';

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475).
 */
const GARDE = {
  question:
    'A — toute `descRef` des deux racines (`src/data/**/*.json`, `src/scenes/**/*.json`) résout-elle dans ' +
    'le `Source/` COURANT (chapitre présent, section présente, bornes dans la section, ligne et colonne ' +
    'de table trouvées) ? ' +
    'B — l’empreinte `sum` de chaque fragment colle-t-elle au texte que l’adresse résout AUJOURD’HUI ? ' +
    'D — un MONTAGE (2 ou 3 fragments) a-t-il des fragments d’au moins 40 caractères normalisés, chacun ' +
    'unique dans son chapitre, DISJOINTS entre eux, et pas plus de trois ? ' +
    'E — le texte RÉSOLU est-il exempt de balise HTML (règle 5 : prose en Markdown, jamais en HTML) ? ' +
    'F — la GRAPHIE du `ch` est-elle EXACTEMENT le préfixe du fichier que l’adresse résout ? C’est ' +
    'ici, et ici seulement, que le LIVRE est connu : le schéma ne peut exiger que des chiffres, la ' +
    'largeur JUSTE est celle du dossier résolu (`largeurDeChapitre`, #1739).',
  primitive:
    '`resoudreProse` (`scripts/source/resoudre.mjs`) — le résolveur FAIL-CLOSED, qui compose le parseur ' +
    'PUR `src/data/source/decoupe.ts` et le lecteur fs `scripts/source/lecteur-fs.mjs`. Aucun second ' +
    'chemin de résolution : ce que la garde éprouve est exactement ce que le plugin `wfrp:prose-source` ' +
    'exécute au build et ce que les scripts Node exécutent par `materialiser`.',
  perimetre:
    'Les DEUX racines de documents authorés (`src/data`, `src/scenes`), à toute profondeur, par un walk ' +
    'GÉNÉRIQUE (patron de `citedEntriesOf`, `scripts/guards/lib/folioIntegrity.mjs`) — jamais une liste ' +
    'de fichiers. Il est MESURÉ au run et imprimé (nombre d’adresses, nombre de chapitres distincts).',
  angleMort:
    'L’empreinte `sum` est calculée sur le texte NORMALISÉ (`normText` : emphase, guillemets, tirets, ' +
    'casse, espaces, et depuis #1384 B2 le `<br>` de cellule via `sansBr`) — une ré-extraction qui ne ' +
    'change QUE l’habillage markdown passe le volet B sans rien dire, et `sumOf` ne voit PLUS un ' +
    '`<br>` gagné ou perdu dans une cellule (la coupure imprimée change, l’empreinte non : c’est le ' +
    'prix de l’adressage stable d’une clé coupée par l’extraction). ' +
    'Les `desc` INLINE ne sont pas le sujet de cette garde — `maison` COMPRISES : le champ ' +
    '`maison` ne dispense pas d’adresser (`grammaire/prose.ts` V3), et ces nœuds sont déjà au ' +
    'dénominateur décroissant du stock `PROSE_INLINE_TOLEREE` ' +
    '(`src/data/schemas/grammaire/prose-inline.ts`), que le refine de parse tient. Un second stock ici ' +
    'compterait les mêmes nœuds deux fois.',
  baseline: {
    fichier: null,
    decroissant: false,
    raison:
      'Tolérance ZÉRO, donc aucun fichier de stock : une adresse qui ne résout plus rend une prose ABSENTE ' +
      'ou FAUSSE au joueur, et la garde est FAIL-CLOSED par construction. Une exception inscrite serait ' +
      'la corruption silencieuse que l’adressage existe pour empêcher.',
  },
  ticket: '#1389 (épique #1388)',
} as const;

/** Une adresse rencontrée dans la donnée, telle que l'inventaire la rend. */
interface AdresseVue {
  fichier: string;
  id: string;
  noeud: { descRef?: { book: string; ch: string } };
}

/** Chargeur de chapitre injecté dans le résolveur (la fixture en fournit un ; la donnée réelle prend
 *  le lecteur fs par défaut). */
type Lecteur = (book: string, ch: string) => ChapitreParse | null;

/** Code d'erreur d'une résolution ratée (`<code> : <détail>`), ou `null` si elle a rendu son texte. */
function echecDe(noeud: unknown, lecteur?: Lecteur): { code: string; message: string } | null {
  try {
    resoudreProse(noeud, lecteur);
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { code: message.split(' : ')[0], message };
  }
}

/** Texte RÉSOLU d'une adresse, ou `null` si elle ne résout pas (les volets A/B/D la tiennent déjà :
 *  le volet E ne juge que ce qui rend effectivement un texte au joueur). */
function texteResolu(noeud: unknown, lecteur?: Lecteur): string | null {
  try {
    return resoudreProse(noeud, lecteur).md as string;
  } catch {
    return null;
  }
}

/** Préfixe NUMÉRIQUE du fichier de chapitre qu'une adresse résout au disque, ou `null` quand elle
 *  n'en résout aucun (le volet A nomme déjà ce cas). La résolution, elle, compare des ENTIERS :
 *  c'est précisément pourquoi la GRAPHIE doit être jugée à part. */
function prefixeResolu(ref: { book: string; ch: string } | undefined): string | null {
  if (!ref) return null;
  const chemin = cheminChapitre(ref.book, ref.ch) as string | null;
  return chemin ? graphieDuFichier(chemin.split(/[\\/]/).pop() ?? '') : null;
}

/** Le `ch` d'une adresse est-il EXACTEMENT la graphie du fichier qu'elle résout ? C'est le FILTRE du
 *  volet F. Une adresse qui ne résout AUCUN fichier-chapitre (`'00'`, qui désigne l'index, ou un
 *  numéro absent) n'a pas de graphie juste : elle est fautive ici aussi, et le volet A dit sa cause. */
const graphieFautive = (ref: { book: string; ch: string }): boolean => prefixeResolu(ref) !== ref.ch;

/** Les trois volets, par le CODE que le résolveur rend — un code de plus sans volet est une omission
 *  visible (il tombe dans `A`, le volet de la résolution elle-même). */
const CODES_B = new Set(['empreinte-divergente']);
const CODES_D = new Set(['fragment-trop-court', 'fragment-ambigu', 'fragments-chevauchants', 'montage-hors-plafond']);

const ADRESSES: AdresseVue[] = adressesDuDepot();
const ECHECS = ADRESSES.map((a) => ({ ...a, echec: echecDe(a.noeud) }));
const chapitres = new Set(ADRESSES.map((a) => `${a.noeud.descRef?.book}|${a.noeud.descRef?.ch}`));

const lignes = (volet: (code: string) => boolean): string[] =>
  ECHECS.filter((e) => e.echec && volet(e.echec.code))
    .map((e) => `${e.fichier}:${e.id} → ${e.echec!.message}`)
    .sort();

describe('résolution de la prose ADRESSÉE — toute `descRef` rend son texte, aujourd’hui (#1389)', () => {
  it('PÉRIMÈTRE : chaque racine est réellement balayée, et ce qu’elle porte est DIT', () => {
    const balayees = RACINES_PAR_DEFAUT.map((r) => ({ racine: r, fichiers: fichiersJsonDe(r).length }));
    console.log(
      `PROSE ADRESSÉE — ${ADRESSES.length} adresse(s) sur ${balayees.map((b) => `${b.racine} (${b.fichiers} .json)`).join(' + ')}, ` +
        `${ADRESSES.length === 0 ? 'périmètre vide' : `${chapitres.size} chapitre(s) distinct(s) : ${[...chapitres].sort().join(', ')}`}` +
        ` — baseline ${GARDE.baseline.decroissant ? 'décroissante' : 'à ZÉRO'}, ticket ${GARDE.ticket}.`,
    );
    // Le walk voit une POPULATION : une racine dont le chemin a bougé rendrait 0 fichier, et les trois
    // volets passeraient au vert sur le vide.
    expect(
      balayees.filter((b) => b.fichiers === 0),
      'racine(s) balayée(s) SANS aucun `.json` — le chemin a bougé, la garde ne mesure plus rien',
    ).toEqual([]);
  });

  it('A — chaque adresse RÉSOUT dans le `Source/` courant', () => {
    const rouges = lignes((code) => !CODES_B.has(code) && !CODES_D.has(code));
    expect(
      rouges,
      'Adresse(s) que le `Source/` courant ne résout plus — relever le passage et corriger l’adresse ' +
        `(\`node scripts/source/reparer-adresses.mjs\` relocalise et propose, \`--apply\` écrit) :\n${rouges.join('\n')}`,
    ).toEqual([]);
  });

  it('B — l’EMPREINTE de chaque fragment colle au texte résolu', () => {
    const rouges = lignes((code) => CODES_B.has(code));
    expect(
      rouges,
      'Empreinte(s) divergente(s) : le `Source/` a bougé sous l’adresse, la prose rendue n’est plus ' +
        `celle qui a été relue — RE-relever le passage, jamais recopier l’empreinte :\n${rouges.join('\n')}`,
    ).toEqual([]);
  });

  it('D — un MONTAGE tient ses plafonds (fragments longs, uniques, trois au plus)', () => {
    const rouges = lignes((code) => CODES_D.has(code));
    expect(
      rouges,
      'Montage(s) hors plafond : un fragment court ou répété dans son chapitre rendra un AUTRE texte à ' +
        `la première ré-extraction :\n${rouges.join('\n')}`,
    ).toEqual([]);
  });

  it('E — le texte RÉSOLU ne porte aucune balise HTML (règle 5)', () => {
    const rouges = ADRESSES.map((a) => ({ a, md: texteResolu(a.noeud) }))
      .filter((r) => r.md != null && HTML_TAG.test(r.md))
      .map((r) => `${r.a.fichier}:${r.a.id} → ${HTML_TAG.exec(r.md!)?.[0]}`)
      .sort();
    // EFFET RÉEL À LA LIVRAISON (#1384 B2) : ZÉRO rouge — et la porte par laquelle un `<br>` pouvait
    // entrer est désormais FERMÉE PAR LA LIB : une cellule résolue rend le saut de ligne IMPRIMÉ
    // (`brEnSaut`), un fragment de blocs recolle le `<br>` de ses lignes de table en espace
    // (`decoupe.ts`, `mdAffichable`). Le cliquet reste PRÉVENTIF pour les 40 autres balises que
    // `HTML_TAG` couvre, que l'extraction Marker peut semer ailleurs qu'en cellule.
    expect(
      rouges,
      'Texte(s) résolu(s) portant une balise HTML — la règle 5 vaut pour la prose ADRESSÉE comme pour ' +
        `les datasets : réparer le \`Source/\` (geste \`docs/ajouter-un-livre-source.md\` §7), jamais l'adresse :\n${rouges.join('\n')}`,
    ).toEqual([]);
  });

  it('F — la GRAPHIE du `ch` est EXACTEMENT le préfixe du fichier résolu', () => {
    // La population est réelle : sans adresse, ce volet ne jugerait rien (le volet PÉRIMÈTRE imprime
    // le compte, celui-ci refuse de passer au vert sur le vide).
    expect(ADRESSES.length, 'aucune adresse en donnée : le volet F ne juge rien').toBeGreaterThan(0);
    const rouges = ADRESSES.filter((a) => a.noeud.descRef && graphieFautive(a.noeud.descRef))
      .map((a) => `${a.fichier}:${a.id} → ch=« ${a.noeud.descRef!.ch} », fichier « ${prefixeResolu(a.noeud.descRef)} - … »`)
      .sort();
    expect(
      rouges,
      'Graphie(s) de `ch` qui ne sont pas le préfixe du fichier résolu : la résolution compare des ' +
        'ENTIERS, donc l’adresse rendrait bien son texte — mais la route, le manifeste et le tri du ' +
        `dossier parleraient d’un autre chapitre. La largeur est celle du LIVRE (\`largeurDeChapitre\`) :\n${rouges.join('\n')}`,
    ).toEqual([]);
  });

  it('F MORD : par son FILTRE RÉEL — `021`, `7` et `00` fautifs, la graphie du dossier seule passe', () => {
    const ref = ADRESSES[0].noeud.descRef!;
    // La résolution compare des ENTIERS : `021` rend le MÊME fichier que `21`, et c'est bien la
    // GRAPHIE, elle seule, que ce volet refuse.
    expect(prefixeResolu({ ...ref, ch: `0${ref.ch}` })).toBe(ref.ch);
    expect(graphieFautive({ ...ref, ch: `0${ref.ch}` })).toBe(true);
    // Une graphie à UN chiffre ne peut être le préfixe d'aucun fichier (la largeur minimale est 2).
    expect(graphieFautive({ ...ref, ch: '7' })).toBe(true);
    // `00` désigne l'index, qui n'est pas un chapitre : il ne résout rien, donc rien de juste.
    expect(graphieFautive({ ...ref, ch: '00' })).toBe(true);
    expect(graphieFautive(ref)).toBe(false);
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * Les QUATRE volets, PROUVÉS sur une fixture synthétique — la donnée ne porte
 * aujourd'hui aucune adresse, et une garde qu'aucun cas ne fait rougir ne prouve rien.
 * Le chapitre est injecté par le paramètre `lecteur` de `resoudreProse` : aucun fichier
 * temporaire, aucun `Source/` touché.
 * ──────────────────────────────────────────────────────────────────────────── */

const TEXTE_FIXTURE = [
  '### Terreur',
  '',
  "Les créatures les plus perturbantes de l'Empire glacent le sang de quiconque croise leur route.",
  '',
  'Une fois le Test de Psychologie effectué, la créature cause la Peur au lieu de la Terreur glaçante.',
  '',
  'Bref.',
  '',
  // La colonne `Race` porte des cellules d'UN MOT : c'est le cas de la règle D (une cellule est
  // adressée exactement, donc exempte du plancher de 40 caractères), mesuré en recette sur la table
  // des races aléatoires du chapitre 04.
  '| Localisation | Effet | Race |',
  '| --- | --- | --- |',
  '| Tete | Le coup porte au front et la vue se brouille un long moment, sans reprise possible. | Humain |',
  '| Bras | Le coup porte au bras et la main lache tout ce qu elle tenait, sans reprise possible. | Nain |',
  '',
  '### Peur',
  '',
  "Les créatures les plus perturbantes de l'Empire glacent le sang de quiconque croise leur route.",
  '',
  // Deux cas du volet E, dans la même table :
  //  - `Bras` : une cellule que l'extraction Marker a rendue avec un `<br>` LITTÉRAL — la forme
  //    exacte des 391 sites `br-litteral` du `Source/` (`scripts/raw/source-tables-stock.json`). La
  //    lib l'ABSORBE (saut imprimé → `\n`) : c'est le contrat POSITIF ci-dessous.
  //  - `Torse` : une balise `<b>` — du HTML que RIEN n'absorbe, et sur lequel le volet E garde sa
  //    MORSURE (un volet qu'aucune fixture ne fait rougir ne prouve rien).
  '### Sequelle',
  '',
  '| Zone | Effet |',
  '| --- | --- |',
  '| Bras | Gagnez 2 États<br>Hémorragique |',
  '| Jambe | Gagnez 1 État Sonné |',
  '| Torse | Gagnez <b>2</b> États Sonné |',
  '',
].join('\n');

const CHAPITRE: ChapitreParse = parseChapitre(TEXTE_FIXTURE);
const LECTEUR = (book: string, ch: string): ChapitreParse | null =>
  book === 'livre-fixture' && ch === '01' ? CHAPITRE : null;

/** Fragment de blocs de la fixture, empreinte POSÉE par son constructeur (jamais écrite à la main). */
const fragment = (sec: string, b0: number, b1: number): FragmentBlocs => fragmentBlocs(CHAPITRE, { sec, secOcc: 1, b0, b1 });

const adresse = (...parts: Fragment[]) => ({ descRef: { book: 'livre-fixture', ch: '01', parts } });

describe('les trois volets MORDENT — fixture synthétique', () => {
  it('une adresse juste rend son texte, et lui seul', () => {
    const res = resoudreProse(adresse(fragment('terreur', 0, 0)), LECTEUR);
    expect(res.etat).toBe('resolue');
    expect(res.md).toContain('glacent le sang');
    expect(res.md).not.toContain('Bref.');
  });

  it('A — une borne hors de la section est REFUSÉE (`b1` d’un bloc de trop)', () => {
    // La section de fixture porte 4 blocs (trois paragraphes + une table) : viser le 5ᵉ sort.
    const juste = fragment('terreur', 0, 3);
    const faux = { ...juste, b1: juste.b1 + 1 };
    expect(echecDe(adresse(faux), LECTEUR)?.code).toBe('bornes-hors-limites');
  });

  it('A — une section absente du chapitre est REFUSÉE', () => {
    expect(echecDe(adresse({ ...fragment('terreur', 0, 0), sec: 'terreur-glacante' }), LECTEUR)?.code).toBe('section-inconnue');
  });

  it('A — un chapitre que le lecteur ne rend pas est REFUSÉ', () => {
    expect(echecDe({ descRef: { book: 'livre-fixture', ch: '99', parts: [fragment('terreur', 0, 0)] } }, LECTEUR)?.code).toBe('chapitre-introuvable');
  });

  it('B — une empreinte amputée d’un caractère est REFUSÉE', () => {
    const juste = fragment('terreur', 0, 0);
    const ampute = { ...juste, sum: `${juste.sum[0] === '0' ? '1' : '0'}${juste.sum.slice(1)}` };
    expect(echecDe(adresse(ampute), LECTEUR)?.code).toBe('empreinte-divergente');
  });

  it('D — un MONTAGE dont un fragment est trop court est REFUSÉ', () => {
    // Le 3ᵉ bloc de la fixture (« Bref. ») fait moins de 40 caractères normalisés.
    expect(echecDe(adresse(fragment('terreur', 1, 1), fragment('terreur', 2, 2)), LECTEUR)?.code).toBe('fragment-trop-court');
  });

  it('D — une CELLULE d’un mot se monte : le plancher et l’unicité ne visent que les `blocs`', () => {
    // Une cellule est adressée EXACTEMENT (section, ligne, colonne) : rien à discriminer par le texte,
    // et aucune borne à étendre — lui opposer « étendez les bornes de blocs » était un remède
    // impossible (recette : « Humain », valide seul, refusé dès l’ajout d’un 2ᵉ fragment).
    const cellule = fragmentCellule(CHAPITRE, { sec: 'terreur', secOcc: 1, row: 'Tete', col: 'Race' });
    expect(cellule.sum, 'la cellule d’un mot doit résoudre SEULE').not.toBe('');
    const court = resoudreProse(adresse(cellule), LECTEUR);
    expect(court.md, 'la cellule rend bien un texte d’un mot').toBe('Humain');

    const monte = resoudreProse(adresse(cellule, fragment('terreur', 1, 1)), LECTEUR);
    expect(echecDe(adresse(cellule, fragment('terreur', 1, 1)), LECTEUR)?.code).toBeUndefined();
    expect(monte.etat).toBe('resolue');
    expect(monte.md).toContain('Humain');
    expect(monte.md).toContain('Test de Psychologie');
  });

  it('D — un MONTAGE dont un fragment se répète dans le chapitre est REFUSÉ', () => {
    // Le bloc de § peur est le MÊME texte que le premier bloc de § terreur.
    expect(echecDe(adresse(fragment('terreur', 1, 1), fragment('terreur', 0, 0)), LECTEUR)?.code).toBe('fragment-ambigu');
  });

  it('D — un montage qui cite DEUX FOIS le même passage est REFUSÉ', () => {
    // Le cas dégénéré : le même fragment répété, que l’unicité-dans-le-chapitre ne voit pas (chaque
    // fragment est unique PRIS SÉPARÉMENT) — l’adresse rendrait le paragraphe deux fois.
    const f = fragment('terreur', 1, 1);
    expect(echecDe(adresse(f, f), LECTEUR)?.code).toBe('fragments-chevauchants');
  });

  it('D — deux fragments qui SE RECOUVRENT partiellement sont REFUSÉS', () => {
    expect(echecDe(adresse(fragment('terreur', 0, 1), fragment('terreur', 1, 2)), LECTEUR)?.code).toBe('fragments-chevauchants');
  });

  it('D — la TABLE entière puis UNE de ses cellules se recouvrent (les `kind` diffèrent, le bloc non)', () => {
    // Le verrou compare les BLOCS COUVERTS, pas les genres : une cellule est un morceau du bloc-table,
    // l'adresser après la table dirait deux fois la même chose.
    const table = fragment('terreur', 3, 3);
    const cellule = fragmentCellule(CHAPITRE, { sec: 'terreur', secOcc: 1, row: 'Tete', col: 'Effet' });
    expect(cellule.sum, 'la cellule de fixture doit résoudre').not.toBe('');
    expect(echecDe(adresse(table, cellule), LECTEUR)?.code).toBe('fragments-chevauchants');
  });

  it('D — un montage de plus de trois fragments est REFUSÉ', () => {
    const f = fragment('terreur', 1, 1);
    expect(echecDe(adresse(f, f, f, f), LECTEUR)?.code).toBe('montage-hors-plafond');
  });

  it('E — une balise HTML résolue est vue ; un `<br>` de cellule, lui, est ABSORBÉ en saut de ligne', () => {
    const cellule = (row: string) => fragmentCellule(CHAPITRE, { sec: 'sequelle', secOcc: 1, row, col: 'Effet' });
    // MORSURE du volet E, sur une balise que RIEN n'absorbe.
    const html = texteResolu(adresse(cellule('Torse')), LECTEUR);
    expect(html, 'la cellule de fixture rend bien sa balise `<b>`').toContain('<b>');
    expect(HTML_TAG.test(html!), 'le volet E MORD sur le texte résolu').toBe(true);

    // CONTRAT POSITIF du `<br>` (#1384 B2) : le saut IMPRIMÉ est rendu, la balise ne l'est jamais.
    const br = texteResolu(adresse(cellule('Bras')), LECTEUR);
    expect(br, 'une cellule à `<br>` rend le saut de ligne qu’elle imprime').toBe('Gagnez 2 États\nHémorragique');
    expect(HTML_TAG.test(br!), 'et ne rougit plus le volet E : ce n’est plus du HTML').toBe(false);

    const sans = texteResolu(adresse(cellule('Jambe')), LECTEUR);
    expect(HTML_TAG.test(sans!), 'une cellule sans balise ne rougit pas').toBe(false);
  });

  it('EXCLUSIVITÉ — `desc` et `descRef` ensemble LÈVENT (deux vérités pour un texte)', () => {
    expect(echecDe({ desc: 'une copie', ...adresse(fragment('terreur', 0, 0)) }, LECTEUR)?.code).toBe('desc-et-descRef');
  });
});
