/**
 * MORSURE des PORTES de la migration #1687 — l'ASSISE d'un décor s'ACTIVE à l'éditeur.
 *
 *  - `2026-09-10-1687-usable-sieges.mjs` (racine `src/scenes`, `src/data/props.json` en LECTURE
 *    SEULE) : pose `usable: {}` sur chaque entité dont le TYPE de décor porte des `seatSlots`, et
 *    porte le document au `schema` 10. Sa borne haute est OUVERTE (`schema` ∈ {9, ≥ 10}) : un
 *    document déjà porté plus loin par un passage postérieur y traverse en NO-OP nominatif, sans
 *    être RABAISSÉ — le rôle de sentinelle du `schema` futur appartient à la DERNIÈRE de la chaîne
 *    dans l'ordre lexical (`DERNIERE`, dérivée par `src/scenes/migrations-format-projet.test.ts`).
 *
 * Une déclaration n'est pas une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la migration
 * sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige la sortie attendue, un
 * message NOMINATIF, et — pour les rouges d'avant-écriture — ZÉRO fichier touché (octet ET
 * horodatage antidaté).
 *
 * NI l'état d'entrée NI l'état d'arrivée de ce passage ne vivent encore dans l'arbre — un passage
 * postérieur l'a mené plus loin (`usable` y porte des faits NOMMÉS, `schema` y est plus récent) — et
 * AUCUNE révision ne sert de fixture : les DEUX se projettent depuis les documents VIVANTS,
 * `projetAvant` (`usable` retiré des entités à places, `schema` rendu à 9) et `projetApres`
 * (`usable` réduit à l'enveloppe VIDE, `schema` à 10). Une fixture GELÉE ne tiendrait pas : les
 * cardinaux d'identité de la migration (projets, Scènes, entités à places) portent sur l'arbre
 * ENTIER. Les TYPES à places et tous les cardinaux se LISENT (catalogue et documents), jamais
 * récités ici.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../guards/lib/lister.mjs';
import { joue } from './joue.mjs';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const MIGRATION = '2026-09-10-1687-usable-sieges.mjs';
const PROPS = 'src/data/props.json';

const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');
/** Formatage canonique d'un document de projet de scène. */
const serialise = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

const ANTIDATE = new Date('2000-01-01T00:00:00Z');

/** Dépôt jetable portant EXACTEMENT les fichiers demandés, plus la migration. Le catalogue de décors
 *  est une ENTRÉE de la migration : à défaut d'être fourni par le scénario, l'arbre le prête. */
function depot(fichiers) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-1687-'));
  const avant = new Map();
  const tous = { [PROPS]: lire(PROPS), ...fichiers };
  for (const [rel, texte] of Object.entries(tous)) {
    const cible = path.join(racine, rel);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, texte, 'utf8');
    fs.utimesSync(cible, ANTIDATE, ANTIDATE);
    avant.set(rel, texte);
  }
  return { racine, avant };
}

const efface = (racine) => fs.rmSync(racine, { recursive: true, force: true });

/** Les fichiers posés sont INTACTS (octet + horodatage). */
function rienTouche(racine, avant) {
  const fautes = [];
  for (const [rel, texte] of avant) {
    const cible = path.join(racine, rel);
    if (!fs.existsSync(cible)) { fautes.push(`${rel} : SUPPRIMÉ`); continue; }
    if (fs.readFileSync(cible, 'utf8') !== texte) fautes.push(`${rel} : octet DIVERGENT`);
    if (fs.statSync(cible).mtimeMs !== ANTIDATE.getTime()) fautes.push(`${rel} : horodatage remonté (écriture)`);
  }
  return fautes;
}

/** Les projets de scène de l'arbre (listage par la primitive `listerDossier` — ordre total ; une
 *  entrée qui n'est pas un dossier de campagne ne porte aucun document et tombe au filtre). */
const PROJETS = listerDossier(path.join(RACINE, 'src/scenes'))
  .map((nom) => `src/scenes/${nom}/${nom}-projet.json`)
  .filter((rel) => fs.existsSync(path.join(RACINE, rel)));
assert.ok(PROJETS.length > 0, 'aucun projet de scène — la fixture ne mesure rien');

/** Les TYPES de décor qui portent des places — LUS au catalogue, comme la migration, mais par un
 *  chemin qui lui est propre : un banc qui importerait le dériveur de la migration mesurerait
 *  seulement sa cohérence avec elle-même. */
const TYPES = new Set(
  JSON.parse(lire(PROPS)).filter((p) => Array.isArray(p?.seatSlots) && p.seatSlots.length).map((p) => p.id),
);
assert.ok(TYPES.size > 0, 'aucun type de décor à places au catalogue — la fixture ne mesure rien');

const estSiege = (e) => e?.kind === 'prop' && TYPES.has(e?.ref);
const entitesDe = (doc) => doc.scenes.flatMap((s) => (Array.isArray(s.entities) ? s.entities : []));

/** Cardinaux LUS sur les documents migrés — jamais récités. */
const SCENES_PAR_PROJET = Object.fromEntries(PROJETS.map((rel) => [rel, JSON.parse(lire(rel)).scenes.length]));
const SIEGES_PAR_PROJET = Object.fromEntries(PROJETS.map((rel) => [rel, entitesDe(JSON.parse(lire(rel))).filter(estSiege).length]));
const SIEGES = Object.values(SIEGES_PAR_PROJET).reduce((n, v) => n + v, 0);
assert.ok(SIEGES > 0, 'aucune entité à places dans les projets livrés — la fixture ne mesure rien');

/** Le PREMIER projet qui porte des places : c'est lui que les scénarios de faute mutent. */
const PORTEUR = PROJETS.find((rel) => SIEGES_PAR_PROJET[rel] > 0);

/** Forme d'entrée et CIBLE du bump porté par cette migration — borne haute OUVERTE. */
const SCHEMA_AVANT = 9;
const SCHEMA_APRES = 10;
for (const rel of PROJETS) {
  const doc = JSON.parse(lire(rel));
  // L'arbre a PASSÉ ce bump : son numéro est à la cible ou au-delà. Le FIGER à un numéro exact
  // rendrait ce banc rouge à chaque bump ultérieur d'un document que ce passage ne possède plus.
  assert.ok(
    doc.schema >= SCHEMA_APRES,
    `${rel} : \`schema\` ${doc.schema} < ${SCHEMA_APRES} — l’arbre n’a pas passé ce bump`,
  );
  const muettes = entitesDe(doc).filter((e) => estSiege(e) && !e.usable).map((e) => e.id);
  assert.deepEqual(muettes, [], `${rel} : entité(s) à places sans \`usable\` — l’arbre n’a pas passé ce bump`);
}

/** PROJECTION INVERSE d'un projet : `usable` retiré de chaque entité à places, `schema` rendu à la
 *  forme d'entrée. */
function projetAvant(rel) {
  const doc = JSON.parse(lire(rel));
  const scenes = doc.scenes.map((s) => (
    Array.isArray(s.entities)
      ? { ...s, entities: s.entities.map((e) => (estSiege(e) ? (({ usable: _pose, ...reste }) => reste)(e) : e)) }
      : s
  ));
  return { ...doc, schema: SCHEMA_AVANT, scenes };
}

/** PROJECTION AVANT : l'ÉTAT D'ARRIVÉE de ce passage — le document vivant, son enveloppe `usable`
 *  réduite à ce que CE passage pose (vide) et son `schema` à la cible. La position de la clé est
 *  celle de l'arbre, garantie en QUEUE par le scénario (h). */
function projetApres(rel) {
  const doc = JSON.parse(lire(rel));
  const scenes = doc.scenes.map((s) => (
    Array.isArray(s.entities)
      ? { ...s, entities: s.entities.map((e) => (estSiege(e) ? { ...e, usable: {} } : e)) }
      : s
  ));
  return { ...doc, schema: SCHEMA_APRES, scenes };
}

const depotScenes = (fabrique) => depot(Object.fromEntries(PROJETS.map((rel) => [rel, fabrique(rel)])));

test('(a) ALLER-RETOUR : l’état d’avant projeté → chaque projet BYTE-IDENTIQUE à l’état d’arrivée', (t) => {
  const d = depotScenes((rel) => serialise(projetAvant(rel)));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  for (const rel of PROJETS) {
    assert.ok(
      sortie.includes(`${rel} — schema ${SCHEMA_AVANT} → ${SCHEMA_APRES}, usable posés : ${SIEGES_PAR_PROJET[rel]}`),
      `${rel} : le bump ou la pose ne DIT pas son compte : ${sortie.slice(0, 1200)}`,
    );
    assert.equal(fs.readFileSync(path.join(d.racine, rel), 'utf8'), serialise(projetApres(rel)), `${rel} produit ≠ état d’arrivée`);
  }
});

test('(b) REJEU sur arbre migré : sortie 0, rien d’écrit', (t) => {
  const d = depotScenes((rel) => lire(rel));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.ok(
    sortie.includes(`usable posés : 0 (déjà activées : ${SIEGES_PAR_PROJET[PORTEUR]}`),
    `le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`,
  );
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le rejeu a écrit');
});

test('(c) `usable` de FORME inattendue (une chaîne) → sortie 1 NOMMANT l’entité, rien d’écrit', (t) => {
  let vise = null;
  const d = depotScenes((rel) => {
    const doc = JSON.parse(lire(rel));
    if (rel !== PORTEUR) return serialise(doc);
    const scenes = doc.scenes.map((s) => {
      if (!Array.isArray(s.entities)) return s;
      return {
        ...s,
        entities: s.entities.map((e) => {
          if (!estSiege(e) || vise) return e;
          vise = e.id;
          return { ...e, usable: 'oui' };
        }),
      };
    });
    return serialise({ ...doc, scenes });
  });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.ok(vise, 'aucune entité à places mutée — le scénario ne mord pas');
  assert.equal(code, 1, `sortie ${code} — un \`usable\` de forme inattendue doit ARRÊTER : ${sortie.slice(0, 1200)}`);
  assert.ok(
    sortie.includes(`${vise} : \`usable\` de forme inattendue "oui"`),
    `arrêt sans NOMMER l’entité fautive : ${sortie.slice(0, 1200)}`,
  );
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(d) FORMATAGE non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  const d = depotScenes((rel) => `${JSON.stringify(projetAvant(rel), null, 4)}\n`);
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 1, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /FORME NON CANONIQUE/, `arrêt sans NOMMER la faute : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(e) CARDINAL DÉPLACÉ (une Scène retirée) : le passage PASSE, sans recalage (#1812)', (t) => {
  // Une Scène est une donnée ÉDITABLE : en ajouter ou en retirer une est un geste LÉGITIME de
  // campagne. Un COMPTE gelé ici ferait payer un recalage à ce lot-là ; ce que ce passage possède,
  // c'est la FORME de `usable` et le `schema`, et c'est cela qu'il continue de poser.
  const sansPlaces = PROJETS.find((rel) => SIEGES_PAR_PROJET[rel] === 0 && SCENES_PAR_PROJET[rel] > 1);
  assert.ok(sansPlaces, 'aucun projet sans place à amputer — le scénario toucherait aussi aux places');
  const d = depotScenes((rel) => {
    const doc = projetAvant(rel);
    return serialise(rel === sansPlaces ? { ...doc, scenes: doc.scenes.slice(1) } : doc);
  });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — une Scène en moins n’est pas une anomalie : ${sortie.slice(0, 1200)}`);
  assert.ok(
    sortie.includes(`${PORTEUR} — schema ${SCHEMA_AVANT} → ${SCHEMA_APRES}, usable posés : ${SIEGES_PAR_PROJET[PORTEUR]}`),
    `le projet porteur n’est plus migré comme avant : ${sortie.slice(0, 1200)}`,
  );
});

test('(e bis) CARDINAL DÉPLACÉ (un siège retiré) : le passage PASSE et pose ce qui RESTE (#1812)', (t) => {
  let ampute = false;
  const d = depotScenes((rel) => {
    const doc = projetAvant(rel);
    if (rel !== PORTEUR) return serialise(doc);
    const scenes = doc.scenes.map((s) => {
      if (!Array.isArray(s.entities)) return s;
      return {
        ...s,
        entities: s.entities.filter((e) => {
          if (!estSiege(e) || ampute) return true;
          ampute = true;
          return false;
        }),
      };
    });
    return serialise({ ...doc, scenes });
  });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.ok(ampute, 'aucune entité à places retirée — le scénario ne mord pas');
  assert.equal(code, 0, `sortie ${code} — un siège en moins n’est pas une anomalie : ${sortie.slice(0, 1200)}`);
  assert.ok(
    sortie.includes(`${PORTEUR} — schema ${SCHEMA_AVANT} → ${SCHEMA_APRES}, usable posés : ${SIEGES_PAR_PROJET[PORTEUR] - 1}`),
    `le passage ne pose pas EXACTEMENT les places qui RESTENT : ${sortie.slice(0, 1200)}`,
  );
});

test('(f) BORNE HAUTE OUVERTE : un `schema` FUTUR traverse en NO-OP nommé — aucun RABAISSEMENT', (t) => {
  // Ce que les amont avalent, la DERNIÈRE de la chaîne le refuse, et l'invariant se déplace à chaque
  // bump (`DERNIERE`, dérivée par `src/scenes/migrations-format-projet.test.ts`). Ici, le document
  // part comme il est venu :
  // c'est ce que le rejeu de la chaîne (`npm run migrations:replay`) exige de tout passage dépassé.
  const futur = SCHEMA_APRES + 7;
  const d = depotScenes((rel) => serialise({ ...JSON.parse(lire(rel)), schema: futur }));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — un schema futur doit TRAVERSER : ${sortie.slice(0, 1200)}`);
  for (const rel of PROJETS) {
    assert.ok(
      sortie.includes(`${rel} — schema ${futur} → ${futur} — DÉJÀ MIGRÉ au-delà de ${SCHEMA_APRES}`),
      `${rel} : le no-op ne se DIT pas, ou le document est rabaissé : ${sortie.slice(0, 1200)}`,
    );
  }
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le passage a écrit sur un document qu’il ne possède plus');
});

test('(f bis) `schema` ANTÉRIEUR à la chaîne → sortie 1 NOMMANT le numéro : la borne BASSE est close aussi', (t) => {
  const ancien = SCHEMA_AVANT - 1;
  const d = depotScenes((rel) => serialise({ ...projetAvant(rel), schema: ancien }));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 1, `sortie ${code} — un schema antérieur doit ARRÊTER : ${sortie.slice(0, 1200)}`);
  assert.ok(
    sortie.includes(`\`schema\` inattendu ${ancien} (${SCHEMA_AVANT} ou plus récent attendu)`),
    `arrêt sans NOMMER le numéro : ${sortie.slice(0, 1200)}`,
  );
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(g) CATALOGUE MUET (aucun type à places) → sortie 1 demandant l’arbitrage, rien d’écrit', (t) => {
  const sansPlaces = JSON.parse(lire(PROPS)).map(({ seatSlots: _p, ...reste }) => reste);
  const d = depot({
    [PROPS]: `${JSON.stringify(sansPlaces, null, 1)}\n`,
    ...Object.fromEntries(PROJETS.map((rel) => [rel, serialise(projetAvant(rel))])),
  });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 1, `sortie ${code} — un catalogue sans place doit ARRÊTER : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /ARBITRAGE REQUIS — aucun type de décor à `seatSlots`/, `arrêt sans DIRE pourquoi : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(h) PARITÉ au RÉEL : sur les projets LIVRÉS, chaque entité à places porte `usable` en QUEUE', () => {
  // Les tests (a)–(g) mesurent la migration sur un dépôt jetable ; celui-ci mesure L'ARBRE. La
  // POSITION est porteuse : `usable` posé ailleurs qu'en queue et le fichier cesse d'être
  // byte-identique à ce que la migration reposerait au rejeu — et à ce que l'éditeur écrit
  // (`editEntity`, `src/state/sceneEdit.ts`).
  const fautes = [];
  for (const rel of PROJETS) {
    const doc = JSON.parse(lire(rel));
    for (const e of entitesDe(doc)) {
      // Une entité SANS place peut porter une enveloppe `usable` (d'autres capacités y vivent) ;
      // ce qu'elle ne peut pas porter, c'est l'ASSISE — la seule que CE passage active, et qui se
      // dérive du TYPE de décor.
      if (!estSiege(e)) {
        if (e?.usable?.assise !== undefined) fautes.push(`${rel} › ${e.id} : \`assise\` sur une entité SANS place`);
        continue;
      }
      const k = Object.keys(e);
      if (!k.includes('usable')) { fautes.push(`${rel} › ${e.id} : AUCUN \`usable\``); continue; }
      if (k[k.length - 1] !== 'usable') fautes.push(`${rel} › ${e.id} : \`usable\` en position ${k.indexOf('usable')} sur ${k.length} — pas en QUEUE`);
    }
  }
  assert.deepEqual(fautes, [], `entité(s) divergente(s) de la forme d’arrivée :\n${fautes.join('\n')}`);
});
