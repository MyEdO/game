/**
 * MORSURE des PORTES de `2026-09-05-1686-structure-material-mort.mjs` (#1686 lot 3a-2).
 *
 * La migration retire la clé morte `material` des apparences de structure. Elle DÉCLARE quatre
 * verdicts avant toute écriture (formatage non canonique, racine non-tableau, cardinal d'entrées,
 * cardinal de porteuses) et un verdict APRÈS écriture (une clé restante). Une déclaration n'est pas
 * une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la migration sur un dépôt JETABLE
 * (`os.tmpdir()`), une fois par scénario, et exige la sortie attendue, un message NOMINATIF, et —
 * pour les rouges d'avant-écriture — ZÉRO fichier touché (octet ET horodatage antidaté).
 *
 * L'état d'AVANT n'existe plus dans l'arbre et AUCUNE révision ne sert de fixture (un banc qui
 * lirait `git show <rev>:` mourrait au commit suivant) : il est reconstruit par projection INVERSE
 * du `structureAppearance.json` VIVANT — une clé `material` réinjectée sur chaque entrée. La valeur
 * réinjectée est arbitraire : la migration ne lit que la PRÉSENCE de la clé, jamais sa valeur. La
 * position de la clé l'est aussi — la retirer rend l'ordre des autres clés, d'où l'aller-retour
 * BYTE-IDENTIQUE de la porte (a). Aucun cardinal n'est récité : ils se lisent sur le dataset.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ — un `.test.mjs` posé à côté des migrations y serait rejoué ou refusé.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { FORME_DATA, serialise } from './croissance.mjs';
import { crees, depot, efface, joue, lireArbre, lireDans, rienTouche } from './joue.mjs';

const MIGRATION = '2026-09-05-1686-structure-material-mort.mjs';
const CIBLE = 'src/data/structureAppearance.json';
const CLE = 'material';

const TEXTE_CIBLE = lireArbre(CIBLE);
const CIBLE_DOC = JSON.parse(TEXTE_CIBLE);
const TEXTE_MIGRATION = lireArbre(`scripts/migrations/${MIGRATION}`);

/** Cardinal LU sur le dataset — jamais récité. */
const CARDINAL = CIBLE_DOC.length;
assert.ok(CARDINAL > 0, `${CIBLE} : dataset VIDE — la fixture ne mesure rien`);

/** PROJECTION INVERSE : l'état d'AVANT, chaque apparence reportant la clé morte. */
const avantDoc = () => CIBLE_DOC.map((e, i) => ({ ...e, [CLE]: i % 2 === 0 ? 'bois' : 'pierre' }));
const TEXTE_AVANT = serialise(avantDoc(), FORME_DATA);
assert.notEqual(TEXTE_AVANT, TEXTE_CIBLE, 'la projection inverse ne réinjecte rien — la fixture ne mesure rien');

test('(a) ALLER-RETOUR : l’état d’avant projeté → `structureAppearance.json` BYTE-IDENTIQUE à celui de l’arbre', (t) => {
  const { racine } = depot({ [CIBLE]: TEXTE_AVANT });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — la purge doit passer : ${sortie.slice(0, 800)}`);
  assert.ok(
    sortie.includes(`retirée de ${CARDINAL} apparence(s)`),
    `la purge ne DIT pas son compte : ${sortie.slice(0, 800)}`,
  );
  assert.equal(
    lireDans(racine, CIBLE),
    TEXTE_CIBLE,
    'le `structureAppearance.json` produit diffère à l’octet de celui de l’arbre',
  );
});

test('(b) REJEU sur arbre migré : sortie 0, rien d’écrit (octet ET horodatage)', (t) => {
  const { racine, avant } = depot({ [CIBLE]: TEXTE_CIBLE });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — un rejeu doit être un no-op vert : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /déjà migrée/, `le no-op ne se DIT pas : ${sortie.slice(0, 800)}`);
  assert.deepEqual([...rienTouche(racine, avant), ...crees(racine, avant, 'src/data')], [], 'le rejeu a écrit');
});

test('(c) CARDINAL DÉPLACÉ (une apparence retirée) : le passage PASSE, sans recalage (#1812)', (t) => {
  // Le catalogue des apparences est app-owned et GRANDIT : geler son compte ici ferait payer un
  // recalage à tout lot qui ajoute un mur. Ce que ce passage possède, c'est la clé morte.
  const ampute = avantDoc();
  ampute.pop();
  const { racine } = depot({ [CIBLE]: serialise(ampute, FORME_DATA) });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — une apparence en moins n’est pas une anomalie : ${sortie.slice(0, 800)}`);
  assert.ok(
    sortie.includes(`clé \`${CLE}\` retirée de ${CARDINAL - 1} apparence(s)`),
    `le passage ne retire pas la clé des apparences qui RESTENT : ${sortie.slice(0, 800)}`,
  );
  const relu = JSON.parse(lireDans(racine, CIBLE));
  assert.deepEqual(relu.filter((e) => CLE in e), [], `\`${CLE}\` survit à l’écriture`);
});

test('(c bis) PÉRIMÈTRE MIXTE (une apparence déjà à la forme CIBLE) : les porteuses SEULES sont purgées', (t) => {
  // Une apparence née APRÈS ce passage arrive sans `material` : le mélange source/cible est l'état
  // NORMAL d'un dataset vivant, pas une anomalie — seule une forme TIERCE en serait une.
  const partiel = avantDoc();
  delete partiel[0][CLE];
  const { racine } = depot({ [CIBLE]: serialise(partiel, FORME_DATA) });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — un périmètre mixte est légitime : ${sortie.slice(0, 800)}`);
  assert.ok(
    sortie.includes(`clé \`${CLE}\` retirée de ${CARDINAL - 1} apparence(s)`),
    `le passage ne purge pas EXACTEMENT les porteuses : ${sortie.slice(0, 800)}`,
  );
  const relu = JSON.parse(lireDans(racine, CIBLE));
  assert.equal(relu.length, CARDINAL, 'le passage a perdu ou ajouté une entrée');
});

test('(d1) RACINE non-TABLEAU (document canoniquement formaté) → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  const { racine, avant } = depot({ [CIBLE]: serialise({ entries: avantDoc() }, FORME_DATA) });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine, MIGRATION);
  assert.equal(code, 1, `sortie ${code} — une racine non-tableau doit ARRÊTER la migration : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /racine non-TABLEAU/, `arrêt sans NOMMER la faute : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /structureAppearance\.json/, `arrêt sans NOMMER le document : ${sortie.slice(0, 800)}`);
  assert.deepEqual([...rienTouche(racine, avant), ...crees(racine, avant, 'src/data')], [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(d2) FORMATAGE non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  const { racine, avant } = depot({ [CIBLE]: JSON.stringify(avantDoc(), null, 4) });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine, MIGRATION);
  assert.equal(code, 1, `sortie ${code} — un formatage non canonique doit ARRÊTER la migration : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /formatage non canonique/, `arrêt sans NOMMER la faute : ${sortie.slice(0, 800)}`);
  assert.deepEqual([...rienTouche(racine, avant), ...crees(racine, avant, 'src/data')], [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

/**
 * La porte POST-ÉCRITURE ne peut pas être atteinte par une ENTRÉE : la suppression réussit sur toute
 * porteuse issue d'un `JSON.parse`. Ce qu'elle garde, c'est une ÉCRITURE défectueuse — elle se mesure
 * donc sur un MUTANT de la migration, joué dans le dépôt jetable : suppression neutralisée, tout le
 * reste identique. C'est le seul scénario du banc où la migration de l'arbre n'est pas jouée telle
 * quelle, et l'assertion sur la substitution garantit que le mutant est bien celui annoncé.
 */
test('(e) CLÉ RESTANTE après écriture (mutant : suppression neutralisée) → sortie 1 NOMMANT les porteuses', (t) => {
  const original = `for (const e of porteuses) delete e[CLE];`;
  assert.ok(TEXTE_MIGRATION.includes(original), 'la ligne de suppression a changé de forme — le mutant ne mesure rien');
  const mutant = TEXTE_MIGRATION.replace(original, `for (const e of porteuses) void e;`);
  const { racine } = depot({ [CIBLE]: TEXTE_AVANT, [`scripts/migrations/${MIGRATION}`]: mutant });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine, MIGRATION);
  assert.equal(code, 1, `sortie ${code} — une clé restante doit être REFUSÉE : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /ÉCHEC POST-ÉCRITURE/, `le refus ne se DIT pas : ${sortie.slice(0, 800)}`);
  assert.match(sortie, new RegExp(`\`${CLE}\` encore présent sur `), `refus sans NOMMER la clé : ${sortie.slice(0, 800)}`);
  assert.match(sortie, new RegExp(CIBLE_DOC[0].id), `refus sans NOMMER les apparences porteuses : ${sortie.slice(0, 800)}`);
});
