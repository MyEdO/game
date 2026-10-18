/**
 * VOLET 1 — l'espace d'espèces DÉCLARÉ par les gabarits corporels est un sous-ensemble du
 * vocabulaire d'ids DÉRIVÉ des registres. `speciesNames()` d'un plan expose des `appearance.species`
 * (ids stables) : un libellé d'affichage y est une valeur qui ne résout dans aucun registre exact.
 * Cf. `AGENTS.md` § Pour TOUT agent (id stable ≠ label) ; garde jumelle sur la DONNÉE :
 * `src/data/refs-migrated.test.ts` (« appearance.species — id stable »).
 * Périmètre : l'espace DÉCLARÉ. L'espace ÉMIS au runtime (resolveRender/rigSpeciesId) est le volet 2.
 *
 * ⚠ Le `VOCAB` ci-dessous est PROVISOIRE : c'est une union LARGE de 6 registres, posée pour ce volet 1.
 * LA définition du vocabulaire d'ids d'espèce (type fermé vs garde sur la DONNÉE, p. ex.
 * `VALID_SPECIES = species ∪ créatures`) est la question OUVERTE de #1537 — ce volet ne la tranche pas.
 * En particulier `SWARM_FORMS` y est admis alors que `appearance.species` ne déclare pas les nuées :
 * l'`it` de MORSURE ci-dessous fige ce qu'un retrait des nuées coûterait (le plan swarm sort 8 ids).
 * Retrait d'UNE source du vocabulaire — violations mesurées le 2026-08-29 : species 0, créatures 100,
 * raceAppearance 20, formes de nuée 8, véhicules 0, siegeRig 0 (3 sources sur 6 sont inertes ici).
 */
import { describe, it, expect, vi } from 'vitest';
import { PLAN_LIST } from './plans/_registry.generated';
import { creatureSpeciesOptions, bipedSpeciesNames, CREATURES, defId } from './creatures';
import { SWARM_FORMS } from './swarm/forms';
import { rigSpeciesVocab, asRigSpeciesId } from './appearance';
import { resolveRender } from './bodyPlan';
import { rigSpeciesId, species, creatures, raceAppearance, vehicles, trappings } from '../../data';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';

/** Vocabulaire CANONIQUE des ids d'espèce — DÉRIVÉ des 6 registres par la SOURCE UNIQUE de
 *  production `rigSpeciesVocab()` (celle contre laquelle `asRigSpeciesId` valide), jamais recopié ici. */
const VOCAB = rigSpeciesVocab();

describe('espace d’espèces DÉCLARÉ par les gabarits ⊆ vocabulaire dérivé', () => {
  it('témoins : le vocabulaire porte les IDS, pas les libellés', () => {
    expect(VOCAB.has('humain')).toBe(true);
    expect(VOCAB.has('Humain')).toBe(false);
    expect(VOCAB.size).toBeGreaterThan(50);
  });

  it('∀ plan, speciesNames() ne contient que des ids du vocabulaire', () => {
    const bad: string[] = [];
    for (const p of PLAN_LIST)
      for (const n of p.speciesNames())
        if (!VOCAB.has(n)) bad.push(`plan « ${p.id} » : « ${n} » hors vocabulaire (species.json ∪ defs rig ∪ raceAppearance ∪ formes de nuée ∪ véhicules ∪ siegeRig)`);
    expect(bad, bad.join('\n')).toEqual([]);
  });

  // Complément BIDIRECTIONNEL du `⊆` ci-dessus : un plan qui déclare ∅ passait VACUEMENT (#1537 case 3).
  // L'égalité avec les defs de CE plan mord dans les deux sens : dérivation débranchée OU id sans def.
  it('∀ plan dérivé du registre : speciesNames() ≡ EXACTEMENT les ids des defs de CE plan', () => {
    // Le plan swarm ne tire PAS du registre de créatures : ses ids sont les formes de nuée (SWARM_FORMS),
    // figées par l'`it` de MORSURE ci-dessous.
    const SANS_REGISTRE = new Set(['swarm']);
    const bad: string[] = [];
    for (const p of PLAN_LIST) {
      if (SANS_REGISTRE.has(p.id)) continue;
      const declare = p.speciesNames();
      const registre = CREATURES.filter((c) => c.plan === p.id).map((c) => defId(c));
      for (const id of registre)
        if (!declare.includes(id)) bad.push(`plan « ${p.id} » : def « ${id} » du registre ABSENTE de speciesNames() (dérivation débranchée)`);
      for (const id of declare)
        if (!registre.includes(id)) bad.push(`plan « ${p.id} » : « ${id} » déclaré sans def à ce plan au registre`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
    // Témoin de NON-VACUITÉ : au moins un plan d'art statique (engin) a des defs à couvrir.
    expect(CREATURES.filter((c) => c.plan === 'engin').length, 'plus aucune def d’engin : le témoin de non-vacuité est à re-choisir').toBeGreaterThan(0);
  });

  it('MORSURE — vocabulaire privé des formes de nuée : le plan swarm sort EXACTEMENT ses ids', () => {
    const formes = Object.keys(SWARM_FORMS);
    const sansNuees = new Set([...VOCAB].filter((id) => !formes.includes(id)));
    // Attendu DÉRIVÉ : les formes qu'AUCUN autre registre ne porte (jamais une liste en dur).
    const attendu = formes.filter((f) => !sansNuees.has(f)).map((f) => `swarm:${f}`).sort();
    const bad: string[] = [];
    for (const p of PLAN_LIST)
      for (const n of p.speciesNames())
        if (!sansNuees.has(n)) bad.push(`${p.id}:${n}`);
    expect(bad.sort(), 'la garde ne mord plus : retirer les formes de nuée du vocabulaire ne sort RIEN').toEqual(attendu);
    expect(attendu.length, 'le coût mesuré d’un retrait des nuées du vocabulaire (#1537) a changé — re-mesurer avant de le figer').toBe(8);
  });

  it('l’espace bipède est DÉRIVÉ du registre (non vide, ids de def)', () => {
    const noms = bipedSpeciesNames();
    expect(noms.length, 'bipedSpeciesNames() est vide — la dérivation du registre est débranchée').toBeGreaterThan(0);
    const ids = new Set(creatureSpeciesOptions().map((o) => o.id));
    for (const n of noms) expect(ids.has(n), `« ${n} » n’est pas un id de def de créature`).toBe(true);
  });

  // F3 (#1537) — chaque race d'apparence a SA def rig : sans elle, `defById(id)` est muet et l'espèce ne
  // vit que du repli `baseSpeciesOf`. `humain` était la seule des 21 races sans def (posée scale-inerte :
  // speciesScale('humain') = 1 avant comme après). Ce cliquet REFERME le trou : retirer une def rougit ici.
  it('∀ race de raceAppearance.json : une def rig porte le même id', () => {
    const ids = new Set(creatureSpeciesOptions().map((o) => o.id));
    const sans = raceAppearance.map((r) => r.id).filter((id) => !ids.has(id));
    expect(sans, `races sans def rig (ajouter creatures/defs/<Nom>.ts) : ${sans.join(', ')}`).toEqual([]);
  });
});

/**
 * VOLET 2 — l'espace ÉMIS au runtime ⊆ VOCAB. Les deux producteurs d'ids d'espèce sont balayés sur
 * TOUTE leur population authorée : `resolveRender` (records de créature, véhicules, affûts de siège)
 * et `rigSpeciesId` (espèces jouables).
 * ⚠ CLIQUET, pas une fermeture : ce volet est VERT PAR TAUTOLOGIE — les sorties de `resolveRender`
 * proviennent des mêmes registres que ceux dont `VOCAB` est dérivé (0 violation mesurée). Il ne
 * contrôle donc PAS l'entrée (une donnée fausse entre par `appearance.species`, gardé côté donnée par
 * `src/data/refs-migrated.test.ts` et au producteur par `asRigSpeciesId`) : il borne les RÉGRESSIONS
 * de registre — un producteur qui se mettrait à sortir un libellé, un id inventé ou un repli hors
 * vocabulaire mordrait ici.
 */
describe('espace d’espèces ÉMIS au runtime ⊆ vocabulaire dérivé (volet 2, cliquet tautologique)', () => {
  it('∀ émission de resolveRender/rigSpeciesId : l’id sort du vocabulaire', () => {
    const bad: string[] = [];
    let n = 0;
    const emet = (id: string, ou: string) => { n++; if (!VOCAB.has(id)) bad.push(`${ou} → « ${id} » hors vocabulaire`); };
    for (const c of creatures) emet(resolveRender(undefined, c.traits, c.id).species, `resolveRender(créature ${c.id})`);
    for (const v of vehicles) emet(resolveRender(undefined, undefined, v.id).species, `resolveRender(véhicule ${v.id})`);
    for (const t of trappings) if (t.siegeRig) emet(resolveRender(undefined, undefined, t.id).species, `resolveRender(affût ${t.id})`);
    for (const s of species) emet(rigSpeciesId(s.id), `rigSpeciesId(${s.id})`);
    expect(bad, bad.join('\n')).toEqual([]);
    expect(n, 'la population balayée s’est effondrée — le volet 2 ne mesure plus rien').toBeGreaterThan(400);
  });

  it('asRigSpeciesId : producteur VALIDANT — un id hors vocabulaire lève nominativement en DEV/test', () => {
    expect(() => asRigSpeciesId('zorglub')).toThrowError(/zorglub/);
    expect(asRigSpeciesId('humain')).toBe('humain');
  });

  it('asRigSpeciesId : PASSE-PLAT hors DEV — le rendu ne meurt pas sur une entrée aberrante en prod', () => {
    vi.stubEnv('DEV', false);
    try {
      expect(asRigSpeciesId('zorglub')).toBe('zorglub');
    } finally {
      vi.unstubAllEnvs();
    }
    expect(() => asRigSpeciesId('zorglub')).toThrowError(/zorglub/);
  });
});

/**
 * GARDE STRUCTURELLE — l'ASSERTION DE TYPE vers `RigSpeciesId` n'est plus une monnaie libre : le seul site de PRODUCTION
 * autorisé est le producteur validant `asRigSpeciesId` (appearance.ts). Les sites restants sont une
 * BASELINE NOMINATIVE DÉCROISSANTE (src/ ET scripts/) : chacun est nommé ci-dessous, aucun nouveau n'est admis, et le
 * total ne peut que baisser (migrer un site = le retirer de la liste).
 */
const BASELINE_CASTS: Record<string, number> = {
  // Production — `rigSpeciesId` est l'AUTRE producteur sanctionné (pont rules→rig). Ne peut pas
  // déléguer à `asRigSpeciesId` sans cycle d'import (appearance.ts importe src/data).
  'src/data/index.ts': 1,
};
const SITE_PRODUCTEUR = 'src/gameIso/rig/appearance.ts';
/** Motif recherché, ASSEMBLÉ : écrit en clair, ce fichier se détecterait lui-même (prose + messages). */
const MOTIF = new RegExp(['as', 'RigSpeciesId'].join(' '), 'g');

describe('garde structurelle — assertion vers `RigSpeciesId` = 1 site de production + baseline décroissante', () => {
  it('aucune assertion de type vers `RigSpeciesId` neuve dans src/ NI dans scripts/ ; la baseline ne croît pas', () => {
    const compte: Record<string, number> = {};
    for (const { rel, text } of readCorpus(['src', 'scripts'], { exts: ['.ts', '.tsx', '.mts'], tests: true })) {
      const n = (text.match(MOTIF) ?? []).length;
      if (n) compte[rel] = n;
    }
    const bad: string[] = [];
    for (const [rel, n] of Object.entries(compte)) {
      if (rel === SITE_PRODUCTEUR) {
        if (n !== 1) bad.push(`${SITE_PRODUCTEUR} : ${n} assertions (le producteur validant en porte EXACTEMENT 1)`);
        continue;
      }
      const attendu = BASELINE_CASTS[rel];
      if (attendu === undefined) bad.push(`${rel} : ${n} assertion(s) de type vers RigSpeciesId NEUVE(S) — passer par asRigSpeciesId(), jamais asserter`);
      else if (n > attendu) bad.push(`${rel} : ${n} > ${attendu} — la baseline ne peut que DÉCROÎTRE`);
    }
    for (const rel of Object.keys(BASELINE_CASTS))
      if (compte[rel] === undefined) bad.push(`${rel} : plus aucune assertion — retirer l'entrée de BASELINE_CASTS`);
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
