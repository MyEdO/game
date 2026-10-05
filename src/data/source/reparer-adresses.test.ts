/**
 * Tests de l'outil de RÉPARATION d'adresse (`scripts/source/reparer-adresses.mjs`, #1389 item 7) —
 * le geste humain « corriger un défaut d'extraction » : le chapitre du `Source/` est ÉDITÉ, les
 * `descRef` qui le visaient ne résolvent plus, l'outil les relocalise par leur TEXTE D'ORIGINE (lu à
 * `--depuis` par `git show`) et propose l'adresse corrigée.
 *
 * La fixture est un DÉPÔT GIT jetable (`instanceDeDepot`, `scripts/guards/lib/depotGabarit.mjs`) :
 * l'outil lit vraiment une histoire, avec le vrai `git show`, sur un vrai arbre — aucun état de
 * départ n'est simulé. Rien n'est écrit dans le dépôt de travail, et l'instance est jetée en
 * `finally`.
 *
 * Les adresses de la fixture sont FABRIQUÉES par les primitives du parseur (`findRuns`, `findCells`
 * + `cellRefFor`, empreintes posées par `empreinteDe` au fond de celles-ci) : une adresse écrite à
 * la main ne prouverait que la patience de qui l'a écrite.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  cellRefFor, estErreur, findCells, findRuns, normText, parseChapitre, resoudreAdresse,
  type ChapitreParse, type DescRef,
} from './decoupe.ts';
import { instanceDeDepot } from '../../../scripts/guards/lib/depotGabarit.mjs';
// @ts-expect-error - outil ESM JS (pas de types) — même convention que `vite.config.ts`
import { optionsDe, reparerAdresses } from '../../../scripts/source/reparer-adresses.mjs';

const LIVRE = 'livre-jouet';
const CH = '21';
const CHEMIN = `Source/${LIVRE}/${CH} - Chapitre.md`;
const DATASET = 'src/data/jouet.json';
/** La SECONDE racine de documents authorés, vide : l'outil balaie les deux, comme en production. */
const AUTRE_RACINE = 'src/scenes/vide.json';

/** Le passage adressé par `blocs` : premier paragraphe de la section « Terreur ». */
const P1 = 'Les créatures les plus perturbantes du monde connu glacent le sang de quiconque croise leur route.';
/** Le second paragraphe de la même section — il reste en place, et sert de voisin. */
const P2 = 'Une fois le Test effectué, la créature cause la Peur au lieu de la Terreur pour le reste de la rencontre.';
/** Le paragraphe qu'une correction d'extraction INSÈRE en tête de section (tous les blocs décalent). */
const INSERE = 'Cette introduction restituée au folio 88 décale tous les blocs de la section qui la porte.';
/** La ligne de table que la correction DÉPLACE vers la suite de table qu'elle ouvre. */
const LIGNE_TETE = '| Tete | Le coup porte au front et la vue se brouille un long moment. | Humain |';

const CHAPITRE_V1 = `# Chapitre de fixture

<span data-folio="88"></span>

Le préambule du chapitre dit ce que le chapitre couvre, et rien de plus que cela.

## Terreur

${P1}

${P2}

## Localisations

| Localisation | Effet | Race |
| --- | --- | --- |
${LIGNE_TETE}
| Bras | Le coup porte au bras et la main lache ce qu elle tenait. | Nain |
`;

/** Le chapitre CORRIGÉ : un paragraphe restitué en tête de section, une ligne de table déplacée
 *  dans la suite de table que la correction a ouverte. */
const CHAPITRE_DEPLACE = `${CHAPITRE_V1
  .replace(`## Terreur\n\n${P1}`, `## Terreur\n\n${INSERE}\n\n${P1}`)
  .replace(`${LIGNE_TETE}\n`, '')}
## Localisations de la seconde table

| Localisation | Effet | Race |
| --- | --- | --- |
${LIGNE_TETE}
`;

/** La table est légendée, et une seconde table légendée de la MÊME section porte la même rangée : la
 *  case d'origine se lit dans les deux, à la même clé de ligne et au même en-tête. */
const CHAPITRE_DEUX_TABLES = `${CHAPITRE_V1.replace('## Localisations\n\n', '## Localisations\n\n**Table des coups**\n\n')}
**Table des rechutes**

| Localisation | Effet | Race |
| --- | --- | --- |
${LIGNE_TETE}
`;

/** La page entière a disparu de l'extraction : la section n'a plus un seul bloc. */
const CHAPITRE_SANS_TERREUR = CHAPITRE_V1.replace(`${P1}\n\n${P2}\n\n`, '');

/** Le passage corrigé est aussi RECOPIÉ ailleurs : deux emplacements le rendent. */
const CHAPITRE_DUPLIQUE = `${CHAPITRE_DEPLACE}
## Encadré qui répète le passage

${P1}
`;

/** Le passage a bougé ET son habillage markdown a changé : le texte rendu ne serait plus celui
 *  qui a été relu, alors que la normalisation de comparaison, elle, ne voit aucune différence. */
const CHAPITRE_REHABILLE = CHAPITRE_DEPLACE.replace(P1, P1.replace('perturbantes', '**perturbantes**'));

const V1 = parseChapitre(CHAPITRE_V1);

const adresse = (parts: unknown[]): DescRef => ({ book: LIVRE, ch: CH, parts } as DescRef);

/** L'adresse de BLOCS du passage `P1`, bâtie sur le chapitre de fondation. */
const REF_BLOCS = adresse([findRuns(V1, normText(P1))]);
/** L'adresse de CELLULE de la case « Humain », bâtie sur le chapitre de fondation. */
const REF_CELLULE = adresse([cellRefFor(V1, findCells(V1, normText('Humain'))[0])]);
/** Une adresse qui ne résout NULLE PART, pas même au commit de fondation. */
const REF_MORTE = adresse([{ kind: 'blocs', sec: 'terreur', secOcc: 1, b0: 7, b1: 9, sum: '0'.repeat(16) }]);

const ENTREES = [
  { id: 'terreur', label: 'Terreur', descRef: REF_BLOCS },
  { id: 'race-tete', label: 'Race de la tête', descRef: REF_CELLULE },
];

/** Le dataset à l'INDENTATION habituelle : chaque clé sur sa ligne. */
const jouet = (entrees: object[]) => `${JSON.stringify(entrees, null, 2)}\n`;
/** Le MÊME dataset écrit COMPACT : une entrée par ligne, l'adresse en MILIEU de ligne. */
const jouetCompact = (entrees: object[]) => `[\n${entrees.map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n]\n`;

/** Lecteur de chapitre de l'instance : relit le disque, et ne re-parse que si le texte a changé. */
function lecteurDe(racine: string) {
  let memo: { texte: string; parse: ChapitreParse } | null = null;
  return (book: string, ch: string): ChapitreParse | null => {
    if (book !== LIVRE || ch !== CH) return null;
    const texte = readFileSync(join(racine, CHEMIN), 'utf8');
    if (!memo || memo.texte !== texte) memo = { texte, parse: parseChapitre(texte) };
    return memo.parse;
  };
}

interface Verdict {
  fichier: string; id: string; code: string; verdict: string; raison?: string; proposition?: string; nouvelle?: DescRef;
}
interface Bilan {
  adresses: number; cassees: Verdict[]; recalees: number; ecrits: number; echecs: string[]; restantes: Verdict[];
}

/**
 * Monte une instance de dépôt (chapitre de fondation + dataset COMMITTÉS), applique l'ÉDITION du
 * chapitre, joue l'outil autant de fois que le cas le demande, et jette l'instance.
 *
 * L'instance porte les DEUX racines réelles (`src/data` et `src/scenes`, ce second document restant
 * vide) : l'outil y tourne sur ses racines PAR DÉFAUT, donc sur le même périmètre qu'en production —
 * une liste de racines passée ici ferait de la fixture un second périmètre, à côté du vrai.
 */
function surCorrection(
  chapitreCorrige: string,
  fn: (jouer: (apply?: boolean) => Bilan, racine: string) => void,
  entrees: object[] = ENTREES,
  serialiser: (entrees: object[]) => string = jouet,
): void {
  const depot = instanceDeDepot({
    fichiers: { [CHEMIN]: CHAPITRE_V1, [DATASET]: serialiser(entrees), [AUTRE_RACINE]: '[]\n' },
  });
  try {
    writeFileSync(join(depot.racine, CHEMIN), chapitreCorrige, 'utf8');
    const jouer = (apply = false): Bilan =>
      reparerAdresses({
        racine: depot.racine,
        depuis: depot.sha,
        apply,
        lecteur: lecteurDe(depot.racine),
        chemin: () => CHEMIN,
      }) as Bilan;
    fn(jouer, depot.racine);
  } finally {
    rmSync(depot.racine, { recursive: true, force: true });
  }
}

const verdictDe = (bilan: Bilan, id: string) => bilan.cassees.find((c) => c.id === id);

/** Adresse qu'une entrée du dataset porte SUR LE DISQUE de l'instance. */
function refSurDisque(racine: string, id: string): DescRef {
  const entrees = JSON.parse(readFileSync(join(racine, DATASET), 'utf8')) as { id: string; descRef: DescRef }[];
  const ref = entrees.find((e) => e.id === id)?.descRef;
  if (!ref) throw new Error(`entrée ${id} absente du dataset de la fixture`);
  return ref;
}

/** Texte que cette adresse rend dans le chapitre COURANT de l'instance, par le parseur lui-même. */
function texteRendu(racine: string, id: string): string {
  const chapitre = parseChapitre(readFileSync(join(racine, CHEMIN), 'utf8'));
  const res = resoudreAdresse(chapitre, refSurDisque(racine, id));
  return estErreur(res) ? `ERREUR ${res.error} : ${res.detail}` : res.md;
}

describe('réparation d’adresse — un défaut d’extraction corrigé à la main (#1389)', () => {
  it('la correction CASSE les adresses, et chaque code nomme sa rupture', () => {
    surCorrection(CHAPITRE_DEPLACE, (jouer) => {
      const bilan = jouer();
      expect(bilan.adresses).toBe(2);
      expect(verdictDe(bilan, 'terreur')?.code).toBe('empreinte-divergente');
      expect(verdictDe(bilan, 'race-tete')?.code).toBe('ligne-introuvable');
    });
  });

  it('RECALÉE : les deux adresses sont relocalisées, `--apply` les écrit, et la re-résolution est verte', () => {
    surCorrection(CHAPITRE_DEPLACE, (jouer, racine) => {
      const propose = jouer();
      expect(propose.cassees.map((c) => c.verdict)).toEqual(['RECALÉE', 'RECALÉE']);
      // Le rapport SEUL n'écrit rien : le dataset porte encore les adresses cassées.
      expect(texteRendu(racine, 'terreur')).toContain('ERREUR empreinte-divergente');

      const avant = readFileSync(join(racine, DATASET), 'utf8');
      const applique = jouer(true);
      expect(applique.ecrits).toBe(2);
      expect(applique.echecs).toEqual([]);
      expect(applique.restantes).toEqual([]);

      // Le texte rendu par les adresses ÉCRITES est celui d'origine, à l'octet.
      expect(texteRendu(racine, 'terreur')).toBe(P1);
      expect(texteRendu(racine, 'race-tete')).toBe('Humain');
      // Réécriture ANCRÉE : seuls les deux blocs `descRef` bougent, le reste du document est intact.
      const apres = readFileSync(join(racine, DATASET), 'utf8');
      expect(apres).not.toBe(avant);
      expect(apres.split('"id"').length).toBe(avant.split('"id"').length);
      expect(apres).toContain('"label": "Race de la tête"');
    });
  });

  it('PERDUE : un passage supprimé de la source ne se recale pas, et rien n’est écrit', () => {
    surCorrection(CHAPITRE_SANS_TERREUR, (jouer, racine) => {
      const avant = readFileSync(join(racine, DATASET), 'utf8');
      const bilan = jouer(true);
      const terreur = verdictDe(bilan, 'terreur');
      expect(terreur?.code).toBe('bornes-hors-limites');
      expect(terreur?.verdict).toBe('PERDUE');
      expect(terreur?.raison).toContain("n'est plus dans le chapitre");
      expect(bilan.ecrits).toBe(0);
      expect(readFileSync(join(racine, DATASET), 'utf8')).toBe(avant);
    });
  });

  it('AMBIGUË : deux emplacements rendent le texte d’origine — ils sont LISTÉS, et `--apply` n’en écrit aucun', () => {
    surCorrection(CHAPITRE_DUPLIQUE, (jouer, racine) => {
      const bilan = jouer(true);
      const terreur = verdictDe(bilan, 'terreur');
      expect(terreur?.verdict).toBe('AMBIGUË');
      expect(terreur?.raison).toContain('2 emplacements');
      expect(terreur?.raison).toContain('§terreur#1');
      // L'adresse AMBIGUË reste telle quelle sur le disque : `--apply` n'écrit que les RECALÉE.
      expect(refSurDisque(racine, 'terreur')).toEqual(REF_BLOCS);
      expect(bilan.restantes.map((c) => c.id)).toEqual(['terreur']);
    });
  });

  it('AMBIGUË : deux tables, même rangée et même colonne — deux emplacements, que seule la table distingue', () => {
    surCorrection(CHAPITRE_DEUX_TABLES, (jouer, racine) => {
      const cellule = verdictDe(jouer(true), 'race-tete');
      expect(cellule?.verdict).toBe('AMBIGUË');
      expect(cellule?.raison).toContain('2 emplacements');
      expect(cellule?.raison).toContain('table[table des coups#1]');
      expect(cellule?.raison).toContain('table[table des rechutes#1]');
      expect(refSurDisque(racine, 'race-tete')).toEqual(REF_CELLULE);
    }, [ENTREES[1]]);
  });

  it('IRRÉCUPÉRABLE : une adresse déjà cassée à `--depuis` n’a aucun texte d’origine à relocaliser', () => {
    surCorrection(
      CHAPITRE_DEPLACE,
      (jouer) => {
        const morte = verdictDe(jouer(), 'morte');
        expect(morte?.verdict).toBe('IRRÉCUPÉRABLE');
        expect(morte?.raison).toContain('bornes-hors-limites');
      },
      [...ENTREES, { id: 'morte', label: 'Adresse morte', descRef: REF_MORTE }],
    );
  });

  it('dataset COMPACT : l’adresse vit en MILIEU de ligne — le document réécrit reste du JSON VALIDE', () => {
    surCorrection(
      CHAPITRE_DEPLACE,
      (jouer, racine) => {
        const bilan = jouer(true);
        expect(bilan.echecs).toEqual([]);
        expect(bilan.ecrits).toBe(2);
        expect(bilan.restantes).toEqual([]);
        const brut = readFileSync(join(racine, DATASET), 'utf8');
        // Le document doit PARSER : c'est la seule chose qu'une réécriture textuelle peut casser.
        expect(() => JSON.parse(brut) as unknown).not.toThrow();
        // Ré-indenté sur le BLANC DE TÊTE de la ligne porteuse (deux espaces), jamais sur le préfixe
        // `{"id":"terreur",…` — qui replacerait des accolades et une clé au milieu de l'objet posé.
        expect(brut).toContain('"descRef":{\n    "book": "livre-jouet",');
        expect(texteRendu(racine, 'terreur')).toBe(P1);
        expect(texteRendu(racine, 'race-tete')).toBe('Humain');
      },
      ENTREES,
      jouetCompact,
    );
  });

  it('IRRÉCUPÉRABLE : un passage RÉ-HABILLÉ n’est pas un passage déplacé — la preuve à l’octet le refuse', () => {
    surCorrection(CHAPITRE_REHABILLE, (jouer, racine) => {
      const bilan = jouer(true);
      const terreur = verdictDe(bilan, 'terreur');
      expect(terreur?.verdict).toBe('IRRÉCUPÉRABLE');
      expect(terreur?.raison).toContain('AUTRE texte');
      expect(refSurDisque(racine, 'terreur')).toEqual(REF_BLOCS);
    });
  });
});

describe('réparation d’adresse — le CÂBLAGE de production, sans rien injecter (#1389)', () => {
  it('sur le dépôt RÉEL (lecteur fs et chemins par défaut), toute adresse résout', () => {
    const bilan = reparerAdresses() as Bilan;
    console.log(`RÉPARATION — ${bilan.adresses} adresse(s) inventoriée(s) sur le dépôt, ${bilan.cassees.length} cassée(s).`);
    // Le détecteur ne prouve rien sur un périmètre vide : la donnée DOIT porter des adresses.
    expect(bilan.adresses, 'aucune adresse dans le dépôt — l’outil mesurerait le vide').toBeGreaterThan(0);
    expect(
      bilan.cassees.map((c) => `${c.fichier}:${c.id} → ${c.code} (${c.verdict})`),
      'adresse(s) cassée(s) sur l’arbre — jouer `node scripts/source/reparer-adresses.mjs`',
    ).toEqual([]);
  });

  it('le filtre `--dataset` borne l’inventaire à UN document, et il en reste', () => {
    const bilan = reparerAdresses({ dataset: 'psychology' }) as Bilan;
    expect(bilan.adresses).toBeGreaterThan(0);
    expect(bilan.adresses).toBeLessThanOrEqual((reparerAdresses() as Bilan).adresses);
    expect(bilan.cassees).toEqual([]);
  });

  it('`optionsDe` lit la ligne de commande — et ses défauts sont `HEAD`, tout le dépôt, sans écriture', () => {
    expect(optionsDe([])).toEqual({ dataset: null, depuis: 'HEAD', apply: false });
    expect(optionsDe(['--dataset', 'psychology', '--depuis', '2998720aa', '--apply'])).toEqual({
      dataset: 'psychology', depuis: '2998720aa', apply: true,
    });
  });
});
