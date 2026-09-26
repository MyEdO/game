import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Combatant } from '../engine/types';
import { EtatPanel, zoneAfflictions } from './EtatPanel';
import { traumaById, consolidateAmputations, traumaCharPenalties } from '../engine/trauma';
import { useGame } from '../state/store';
import { ETAT_ANCHOR_CRITIQUES, ETAT_ANCHOR_MALADIES, ETAT_ANCHOR_MUTATIONS, ETAT_ANCHOR_TRAUMAS, ETAT_ANCHOR_PSYCHOLOGIE, ETAT_ANCHOR_ENCOMBREMENT } from './sheetAlarms';

/** Héros minimal, patron `sheetAlarms.test.ts`/`CharacterSheet.test.tsx` (mkHero). */
const mkHero = (mut?: (c: Combatant) => void): Combatant => {
  const c = {
    id: 'h',
    name: 'H',
    kind: 'hero',
    species: 'humains-reiklander',
    career: 'soldat',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    conditions: [],
    skills: [],
    talents: [],
    movement: 4,
    items: [],
  } as unknown as Combatant;
  mut?.(c);
  return c;
};

/** Héros AFFLIGÉ : 1 critique subi (Tête, LDB), 1 État, Corruption, 1 trauma, 1 maladie, 1 mutation,
 *  1 affliction psy (Peur active) et une Surcharge — les rubriques d'affliction ancrées. */
const afflictedHero = (): Combatant =>
  mkHero((c) => {
    c.critEntriesSuffered = ['blessure-spectaculaire'];
    c.conditions = [{ id: 'assourdi', value: 1 } as never];
    c.corruption = 2;
    c.traumas = [{ label: 'Bras cassé', location: 'brasG', desc: 'Description verbatim du trauma.' } as never];
    c.diseases = [{ name: 'infection-mineure', symptoms: [], phase: 'active', minutesLeft: 100, durationMinutes: 100 } as never];
    c.mutations = [{ id: 'pattes-d-animaux', label: 'Pattes d’animaux', desc: '+1 Mouvement', kind: 'physique', roll: 1, passive: [{ op: 'moveMod', mod: 1 }] } as never];
    c.psychState = [{ type: 'peur', indice: 2, calmeDR: 0 } as never];
    c.items = [{ uid: 'x', kind: 'misc', enc: 999, qualities: [] } as never];
  });

describe('EtatPanel', () => {
  it('héros affligé : tableau de bord — bandes ancrées, une PlaqueRow codex-liée par affliction lourde, États en chips, ZÉRO prose', () => {
    const html = renderToStaticMarkup(<EtatPanel hero={afflictedHero()} />);
    // La Corruption est une jauge de la bande « Réserves & seuils » (arbitrage user 2026-07-17), pas une
    // bande-catégorie : ces 6 rubriques d'affliction lourde restent ancrées.
    for (const anchor of [ETAT_ANCHOR_CRITIQUES, ETAT_ANCHOR_MALADIES, ETAT_ANCHOR_MUTATIONS, ETAT_ANCHOR_TRAUMAS, ETAT_ANCHOR_PSYCHOLOGIE, ETAT_ANCHOR_ENCOMBREMENT]) {
      expect(html, `ancre manquante : ${anchor}`).toContain(`id="${anchor}"`);
    }
    // Chaque affliction LOURDE = une seule PlaqueRow : 6 (critiques/traumas/maladies/mutations/
    // psychologie/surcharge). Les États actifs sont désormais des CHIPS compactes (0 PlaqueRow), et la
    // Corruption vit dans la bande « Réserves & seuils ».
    // La bande de zones (`ZoneBand`, pt.4) est MORTE (lot « corps-index », #492) : plus de plaques
    // résumées ici, le résumé par Localisation vit dans `FigTile.zoneBadges` (`CharacterSheet.tsx`).
    const rowCount = (html.match(/plaque-row/g) || []).length;
    expect(rowCount).toBe(6);
    // Chip codex-liée par État actif + nom codex-lié de chaque PlaqueRow → au moins 6 refs Codex.
    expect((html.match(/codex-ref/g) || []).length).toBeGreaterThanOrEqual(6);
    // L'État actif (Assourdi) est rendu en chip codex-liée, pas en PlaqueRow.
    expect(html).toContain('class="etat-chips"');
    // Un GameOp = une rangée (doctrine #295) : le moveMod de la mutation est rendu en chip codex-liée
    // sur l'entrée « Mouvement » (catégorie `characteristics`, comme un `charMod`) — jamais la prose
    // moteur (arbitrage user 2026-07-17).
    expect(html).toContain('>Mouvement<');
    expect(html).toContain('class="entity-badge">+1</em>');
    // AUCUNE prose des entrées (règle 5 : le Codex la porte, pas l'onglet État) — le trauma synthétique
    // porte une prose verbatim de test qui ne doit JAMAIS apparaître dans le registre.
    expect(html).not.toContain('Description verbatim du trauma.');
    // Corruption : jauge de la bande « Réserves & seuils » — son libellé de jauge est présent.
    expect(html).toContain('notch-gauge__label">Corruption<');
  });

  it('Corruption DAMNÉ : indicateur DAMNÉ dans le slot droit de la bande « Réserves & seuils », jamais une ligne dédiée', () => {
    const hero = mkHero((c) => {
      c.corruption = 8;
      c.damned = true;
    });
    const html = renderToStaticMarkup(<EtatPanel hero={hero} />);
    expect(html).toContain('DAMNÉ');
    // DAMNÉ vit dans le slot droit de la Band « Réserves & seuils » (chip), pas en PlaqueRow — héros sans
    // affliction lourde → zéro PlaqueRow.
    expect((html.match(/plaque-row/g) || []).length).toBe(0);
  });

  it('bande « Réserves & seuils » (arbitrage 2026-07-17) : mots PLEINS « Critiques actives »/« Mutations physiques »/« Mutations mentales »/« Corruption », NotchGauge, ton NEUTRAL loin du seuil', () => {
    const html = renderToStaticMarkup(<EtatPanel hero={afflictedHero()} />);
    // BE = bonus(Endurance 30) = 3 — `criticalWounds` non posé → 0 actives, `mutations` = 1 physique.
    // Les 4 seuils sont des `NotchGauge` (piste `role="meter"`, jamais un texte brut hors gauge),
    // groupés dans la bande UNIQUE `ReservesSeuilsBand`.
    expect(html).not.toContain('etat-threshold');
    expect(html).not.toContain('actives 0/3');
    expect(html).not.toContain('phys 1/3 · ment 0/3');
    // Aucune réf de seuil de mort (livre) à l'écran.
    expect(html).not.toMatch(/LDB\s*\d/);
    expect(html).toContain('notch-gauge__label">Critiques actives<');
    expect(html).toContain('notch-gauge__label">Mutations physiques<');
    expect(html).toContain('notch-gauge__label">Mutations mentales<');
    expect(html).toContain('notch-gauge__label">Corruption<');
    expect(html).toContain('aria-valuemax="3" aria-valuenow="0"'); // actives = 0
    expect(html).toContain('aria-valuemax="3" aria-valuenow="1"'); // phys : 1 mutation physique
    // 3 seuils d'affliction loin du seuil = neutral ; la Corruption a SON ton (`corruption`), non neutral.
    expect((html.match(/data-tone="neutral"/g) || []).length).toBe(3);
    expect(html).toContain('data-tone="corruption"');
  });

  it('bande « Réserves & seuils » : ton WARN à seuil−1, DANGER au seuil atteint/franchi (contrat POSITIF par seuil, sur la NotchGauge)', () => {
    const auSeuil = mkHero((c) => {
      c.critEntriesSuffered = ['blessure-spectaculaire'];
      c.criticalWounds = 2; // BE = 3 → seuil−1 (warn)
      c.mutations = [
        { id: 'm1', label: 'Mutation physique 1', desc: '', kind: 'physique', roll: 1, passive: [] } as never,
        { id: 'm2', label: 'Mutation physique 2', desc: '', kind: 'physique', roll: 1, passive: [] } as never,
        { id: 'm3', label: 'Mutation physique 3', desc: '', kind: 'physique', roll: 1, passive: [] } as never,
        { id: 'm4', label: 'Mutation physique 4', desc: '', kind: 'physique', roll: 1, passive: [] } as never,
      ]; // phys 4 > BE 3 → danger
    });
    const html = renderToStaticMarkup(<EtatPanel hero={auSeuil} />);
    expect(html).toContain('aria-valuemax="3" aria-valuenow="2"'); // actives = 2, seuil−1
    expect(html).toContain('aria-valuemax="3" aria-valuenow="4"'); // phys = 4 > BE 3
    // Ordre de rendu : sans réserve (ni Destin ni Résilience), le 1er seuil est Critiques actives (warn)
    // avant Mutations physiques (danger).
    const tones = [...html.matchAll(/data-tone="(neutral|warn|danger)"/g)].map((m) => m[1]);
    expect(tones[0]).toBe('warn'); // Critiques actives 2/3
    expect(tones).toContain('danger'); // Mutations physiques 4/3
  });

  it('bandes de rubrique : le compte reste SOBRE (badge droit) SEUL — toutes les jauges de crans vivent dans `ReservesSeuilsBand`', () => {
    const html = renderToStaticMarkup(<EtatPanel hero={afflictedHero()} />);
    // 4 jauges de seuil dans la bande « Réserves & seuils » (Critiques actives/Mutations physiques/Mutations
    // mentales/Corruption) — les bandes de rubrique n'en portent aucune. `afflictedHero` n'a ni Destin
    // ni Résilience → pas de jauge de réserve ici.
    expect((html.match(/class="notch-gauge"/g) || []).length).toBe(4);
  });

  it('bande « Réserves & seuils » : DEUX colonnes MIROIR (piles alignées `.notch-gauge-stack`), seuils réordonnés — Critiques actives→Mutations physiques à GAUCHE, Corruption→Mutations mentales à DROITE', () => {
    const html = renderToStaticMarkup(<EtatPanel hero={afflictedHero()} />);
    // Chaque colonne est une pile alignée subgrid (primitive `NotchGauge`) : exactement 2.
    expect((html.match(/class="notch-gauge-stack"/g) || []).length).toBe(2);
    // Ordre de rendu row-major (arbitrage user 2026-07-17) : colonne GAUCHE = Critiques actives puis
    // Mutations physiques ; colonne DROITE = Corruption puis Mutations mentales.
    const iCrit = html.indexOf('notch-gauge__label">Critiques actives<');
    const iPhys = html.indexOf('notch-gauge__label">Mutations physiques<');
    const iCorr = html.indexOf('notch-gauge__label">Corruption<');
    const iMent = html.indexOf('notch-gauge__label">Mutations mentales<');
    expect(iCrit).toBeLessThan(iPhys); // pile gauche
    expect(iCorr).toBeLessThan(iMent); // pile droite
  });

  it('rangée de zones (pt.4) MORTE dans le registre (lot « corps-index », #492) — seules les ancres de la PREMIÈRE rangée concernée subsistent', () => {
    const html = renderToStaticMarkup(<EtatPanel hero={afflictedHero()} />);
    // Le résumé par zone vit dans `FigTile.zoneBadges` : le registre ne rend ni `PlaqueGrid` ni compte
    // agrégé ("1 critique"/"1 séquelle").
    expect(html).not.toContain('plaque-grid');
    expect(html).not.toContain('1 critique');
    expect(html).not.toContain('1 séquelle');
    // Les ancres de scroll (cible du badge de zone de la colonne) restent posées sur la PREMIÈRE
    // rangée Critiques/Séquelles concernée — Tête (critique) et Bras G (trauma).
    expect(html).toContain('id="etat-zone-tete"');
    expect(html).toContain('id="etat-zone-brasG"');
    // Corps/Jambes/Bras D : intactes → aucune ancre (« une zone intacte n'existe pas »).
    for (const untouched of ['etat-zone-corps', 'etat-zone-brasD', 'etat-zone-jambeG', 'etat-zone-jambeD']) {
      expect(html, `zone intacte inattendue : ${untouched}`).not.toContain(`id="${untouched}"`);
    }
  });

  it('liserés de gravité (pt.5) : `data-tone` sang/ambre/violet posés sur les bandes concernées', () => {
    const html = renderToStaticMarkup(<EtatPanel hero={afflictedHero()} />);
    expect(html).toContain(`id="${ETAT_ANCHOR_CRITIQUES}" data-tone="sang"`);
    expect(html).toContain('id="etat-etats" data-tone="sang"');
    expect(html).toContain(`id="${ETAT_ANCHOR_TRAUMAS}" data-tone="ambre"`);
    expect(html).toContain(`id="${ETAT_ANCHOR_MALADIES}" data-tone="ambre"`);
    expect(html).toContain(`id="${ETAT_ANCHOR_MUTATIONS}" data-tone="violet"`);
    // Psychologie/Encombrement/Effets ne portent AUCUN ton (hors périmètre pt.5).
    expect(html).not.toContain(`id="${ETAT_ANCHOR_PSYCHOLOGIE}" data-tone`);
    expect(html).not.toContain(`id="${ETAT_ANCHOR_ENCOMBREMENT}" data-tone`);
  });

  it('État cumulé + temporisé (données d’instance) : la chip porte ×N ET sa durée, popover codex-lié résolu (LDB 16)', () => {
    const hero = mkHero((c) => {
      c.conditions = [{ id: 'hemorragique', value: 3, roundsLeft: 2 } as never];
    });
    const html = renderToStaticMarkup(<EtatPanel hero={hero} />);
    // Cumul + durée inline dans la chip (`.entity-badge`, même idiome que `EntityChip`) — visibles hors popover.
    expect(html).toContain('×3 · 2 Rounds');
    expect(html).toContain('entity-badge');
    // Chip codex-liée (résolution par id) : la classe `codex-ref` porte le lien, le libellé résolu suit.
    expect(html).toMatch(/codex-ref[\s\S]*?Hémorragique/);
  });

  it('Maladies : la SÉVÉRITÉ d’une instance de symptôme est à l’écran — deux fièvres de paliers différents ne s’affichent pas à l’identique (#674)', () => {
    const grave = mkHero((c) => {
      c.diseases = [{ id: 'pneumonie', symptoms: [{ symptomId: 'fievre', severity: 'grave' }], phase: 'active', minutesLeft: 100, durationMinutes: 100 } as never];
    });
    const base = mkHero((c) => {
      c.diseases = [{ id: 'pneumonie', symptoms: [{ symptomId: 'fievre' }], phase: 'active', minutesLeft: 100, durationMinutes: 100 } as never];
    });
    expect(renderToStaticMarkup(<EtatPanel hero={grave} />)).toContain('Fièvre (Grave)');
    const htmlBase = renderToStaticMarkup(<EtatPanel hero={base} />);
    expect(htmlBase).toContain('Fièvre');
    expect(htmlBase, 'sans sévérité portée, aucun qualificatif fabriqué').not.toContain('Fièvre (');
  });

  it('Mutations : le nom résolu vient du LOOKUP par id (`mutationLabel`), pas du `label` d’instance — même une instance SANS label affiche le vrai nom', () => {
    const hero = mkHero((c) => {
      c.mutations = [{ id: 'pattes-d-animaux', kind: 'physique', roll: 1, passive: [] } as never];
    });
    const html = renderToStaticMarkup(<EtatPanel hero={hero} />);
    expect(html).toContain('Pattes d’animaux');
  });

  it('Surchargé : chip codex-liée (catégorie `encumbranceTiers`) affichant le PALIER réel (LDB 61)', () => {
    const hero = mkHero((c) => {
      // Capacité = BF3 + BE3 = 6 (caracs par défaut à 30) ; 8 Enc porté ∈ (6, 12] → Palier 1.
      c.items = [{ uid: 'x', kind: 'misc', enc: 8, qualities: [] } as never];
    });
    const html = renderToStaticMarkup(<EtatPanel hero={hero} />);
    expect(html).toContain('Palier 1');
    expect(html).toMatch(/codex-ref[^>]*>Surchargé</);
  });

  it('héros sain : l’en-tête de CAPACITÉ (bande « Réserves & seuils ») reste TOUJOURS visible, note discrète au lieu du grand vide, aucune ancre d’affliction ni de zone', () => {
    const html = renderToStaticMarkup(<EtatPanel hero={mkHero()} />);
    // Tableau de bord toujours utile (arbitrage user 2026-07-17) : la bande « Réserves & seuils » s'affiche même sain.
    expect(html).toContain('>Réserves &amp; seuils<');
    expect(html).toContain('notch-gauge__label">Critiques actives<');
    expect(html).toContain('notch-gauge__label">Corruption<');
    // Note « Aucune affliction » retirée (v2.3) : héros sain = juste la bande « Réserves & seuils ».
    expect(html).not.toContain('etat-none');
    // mkHero n'a ni Destin ni Résilience → pas de jauge de réserve.
    expect(html).not.toContain('notch-gauge__label">Chance<');
    for (const anchor of [ETAT_ANCHOR_CRITIQUES, ETAT_ANCHOR_MALADIES, ETAT_ANCHOR_MUTATIONS, ETAT_ANCHOR_TRAUMAS, ETAT_ANCHOR_PSYCHOLOGIE, ETAT_ANCHOR_ENCOMBREMENT]) {
      expect(html, `ancre inattendue : ${anchor}`).not.toContain(`id="${anchor}"`);
    }
    expect(html).not.toContain('etat-zone-');
  });

  it('RÉSERVES dans la bande « Réserves & seuils » (LDB 17) : Chance/Destin (`fortune`/`fate`) et Détermination/Résilience (`resolve`/`resilience`) EN TÊTE des seuils, ton RESSOURCE (jamais danger)', () => {
    const hero = mkHero((c) => {
      c.fate = 3;
      c.fortune = 2;
      c.resilience = 2;
      c.resolve = 1;
    });
    const html = renderToStaticMarkup(<EtatPanel hero={hero} />);
    expect(html).toContain('>Réserves &amp; seuils<');
    expect(html).toContain('notch-gauge__label">Chance<');
    expect(html).toContain('notch-gauge__label">Détermination<');
    // Destin/Résilience = Indice PERMANENT en valeur simple, AU-DESSUS de leur réserve.
    expect(html).toContain('>Destin<');
    expect(html).toContain('>Résilience<');
    expect(html.indexOf('>Destin<')).toBeLessThan(html.indexOf('>Chance<'));
    // Réserves d'abord (ce qu'on a), seuils ensuite : Chance précède Critiques actives.
    expect(html.indexOf('>Chance<')).toBeLessThan(html.indexOf('>Critiques actives<'));
    // Chance = réserve courante (fortune 2) plafonnée par le plafond RÉEL `fortuneMax` (= Destin 3
    // sans talent Chanceux) ; Détermination (resolve 1) par `resolveMax` (= Résilience 2).
    expect(html).toContain('aria-valuemax="3" aria-valuenow="2"');
    // Détermination = réserve courante (resolve 1) plafonnée par la Résilience (resilience 2).
    expect(html).toContain('aria-valuemax="2" aria-valuenow="1"');
    // Ton RESSOURCE : plein = bon — les réserves ne virent jamais au rouge (héros sain : aucun danger).
    expect(html).toContain('data-tone="resource"');
    expect(html).not.toContain('data-tone="danger"');
  });

  it('RÉSERVES masquées quand Destin ET Résilience valent 0 (Elfe, LDB 05 l.366-367) : aucune cellule fantôme, la bande « Réserves & seuils » garde ses seuils', () => {
    const hero = mkHero((c) => {
      c.fate = 0;
      c.fortune = 0;
      c.resilience = 0;
      c.resolve = 0;
    });
    const html = renderToStaticMarkup(<EtatPanel hero={hero} />);
    expect(html).toContain('>Réserves &amp; seuils<');
    expect(html).toContain('notch-gauge__label">Critiques actives<');
    expect(html).not.toContain('notch-gauge__label">Chance<');
    expect(html).not.toContain('notch-gauge__label">Détermination<');
  });

  /** #1318 E4/C-γ — le cumul des séquelles ne doit pas ÉVAPORER la Localisation : `zoneAfflictions`
   *  alimente les badges de zone de la colonne (`FigTile.zoneBadges`), un badge PAR membre touché. */
  it('orteils perdus aux DEUX jambes : les deux zones restent badgées après consolidation (LDB 18 l.281)', () => {
    const hero = mkHero((c) => {
      c.traumas = [traumaById('orteil-ampute', undefined, 'jambeG'), traumaById('orteil-ampute', undefined, 'jambeD')];
    });
    consolidateAmputations(hero);
    const zones = zoneAfflictions(hero).filter((z) => z.trauma > 0);
    expect(zones.map((z) => z.loc).sort()).toEqual(['jambeD', 'jambeG']);
    // …et la pénalité RAW (« pour chaque orteil perdu, −1 Ag et −1 CC ») reste entière au TOTAL.
    expect(traumaCharPenalties(hero, 'agilite').reduce((s, n) => s + n, 0)).toBe(-2);
  });

  /** Cause RÉCURRENTE d'un contrecoup (`op condition perRound` à durée intrinsèque — Purifier la
   *  chair, `LDB 40 l.75`) : un `ActiveEffect` sans caractéristique se rend comme les autres effets
   *  actifs — son LIBELLÉ (le nom de la rangée) et sa durée en Rounds. */
  it('un effet actif à ops récurrentes s’affiche par son libellé et sa durée en Rounds', () => {
    const hero = mkHero((c) => {
      c.conditions = [{ id: 'inconscient', value: 1 } as never];
      c.activeEffects = [{
        label: 'Purifier la chair', bonus: 0, duration: { scale: 'rounds', left: 4 },
        opsPerRound: [{ op: 'condition', id: 'inconscient', value: 1, unlessCondition: 'inconscient' }],
      } as never];
    });
    const html = renderToStaticMarkup(<EtatPanel hero={hero} />);
    expect(html).toContain('Purifier la chair');
    expect(html).toContain('4 Rounds');
  });
});

/**
 * Une échéance d'HORLOGE (`Duration.scale === 'clock'`, minutes de `gameTime` ABSOLUES) ne se rend pas
 * par le mot « durée » : elle dit le TEMPS RESTANT, avec le vocabulaire unique de l'échelle
 * (`clockLabel`, `engine/duration.ts`) — comme `roundsLabel` dit l'échelle tactique.
 */
describe('EtatPanel — une durée d’HORLOGE dit le TEMPS RESTANT', () => {
  // Rendu SSR : `useSyncExternalStore` sert l'INSTANTANÉ INITIAL du store — l'horloge lue par le
  // panneau est donc celle du début de campagne, et les échéances se posent RELATIVEMENT à elle.
  const maintenant = useGame.getInitialState().gameTime;

  it('rend « 4 min » / « 2 h » / « 3 j » selon la grandeur, jamais le mot « durée »', () => {
    const h = mkHero((c) => {
      c.activeEffects = [
        { label: 'Fenêtre de conscience', bonus: 0, duration: { scale: 'clock', until: maintenant + 4 } },
        { label: 'Contrecoup', bonus: 0, duration: { scale: 'clock', until: maintenant + 61 } },
        { label: 'Pensez à vos actes', bonus: 0, duration: { scale: 'clock', until: maintenant + 3 * 24 * 60 } },
      ] as never;
    });
    const html = renderToStaticMarkup(<EtatPanel hero={h} />);
    expect(html, 'le mot « durée » tient encore lieu de reste').not.toContain('· durée');
    expect(html).toContain('4 min');
    expect(html).toContain('2 h');
    expect(html).toContain('3 j');
  });

  it('un État d’instance à échéance d’horloge (Belladone) dit son reste dans sa rangée', () => {
    const h = mkHero((c) => { c.conditions = [{ id: 'inconscient', value: 1, untilTime: maintenant + 5 * 60 } as never]; });
    expect(renderToStaticMarkup(<EtatPanel hero={h} />)).toContain('5 h');
  });
});
