/**
 * « Fiche vivante » du créateur (Zone C) — page blanche cérémonielle (arbitrage 2026-07-13) : la
 * structure est STABLE dès l'étape 1 (tous les blocs présents — figurine, Caractéristiques, dérivées,
 * PX, bourse, Talents, Compétences), GRISÉE tant qu'un choix ne l'a pas renseignée, et se remplit
 * choix par choix. Elle ne gagne JAMAIS un bloc en cours de route (fin de l'apparition surprise).
 *
 * Source de vérité UNIQUE des Caractéristiques : la fiche montre le RÉSULTAT (via buildHero — talents
 * +5 et Augmentations gratuites inclus), le centre montre l'ÉDITION. Le compteur PX recalcule `xpTotal`
 * à chaque changement du brouillon → un tirage accepté l'incrémente EN DIRECT.
 *
 * La fiche compose la primitive `HeroSheet` (`../HeroSheet.tsx`, consécration #417 suite — constat
 * utilisateur fondateur « La fiche vivante ce n'est pas une primitive ? », 2026-07-15) EN ENTIER dès
 * qu'un héros prévisualisé existe — bande d'en-tête COMPRISE (`header` actif) : la fiche du créateur
 * est IDENTIQUE à celle du détail candidat du lobby (`PartyScreen`, correctif utilisateur 2026-07-15,
 * « elle est censée être identique à celle utilisée pour le choix des personnages »), plus d'alcôve
 * propre au créateur. Seuls le compteur PX de création et la page blanche pré-héros (apparence de
 * secours, tirage EN DIRECT) restent des encarts PROPRES au créateur — hors mandat de `HeroSheet`
 * (entrée = un `Combatant`).
 */
import { CSSProperties, useMemo } from 'react';
import { CHAR_KEYS, CharKey, Combatant } from '../../engine/types';
import { effectiveChar } from '../../engine/characteristics';
import { Coins } from '../Coins';
import type { Appearance } from '../../gameIso/rig/appearance';
import { CharacterPreview } from '../CharacterPreview';
import { Icon } from '../Icon';
import { CharStatsGrid } from '../CharStatsGrid';
import { HeroSheet, RoadmapChip } from '../HeroSheet';
import { careerLabelFor, findStarById, rigSpeciesId } from '../../data';
import {
  CreatorDraft,
  StepId,
  buildHero,
  draftSpecies,
  draftLevel,
  draftWealth,
  draftChars,
  hasSpecies,
  xpTotal,
  speciesXp,
  careerXp,
  charsXp,
  starXp,
  stepIds,
  careerSkillsDone,
  speciesTalentChoicesDone,
  speciesTalentRandomCount,
  tiragesSansUtilisation,
} from './draft';
import { Row } from '../Layout';

/** Grisage cérémoniel d'un bloc « non renseigné » (page blanche). */
const DIM: CSSProperties = { opacity: 0.38 };

export function previewHero(d: CreatorDraft): Combatant | null {
  try {
    return buildHero(d, 'preview');
  } catch {
    return null;
  }
}

/** Étapes du créateur pas ULTÉRIEUREMENT franchies (index STRICTEMENT devant `step`, `stepIds()`
 *  SOURCE UNIQUE de l'ordre) — la fiche vivante masque le contenu vif d'une rubrique et pose une
 *  `RoadmapChip` tant que son étape est devant, quel que soit ce que le moteur a déjà résolu par
 *  défaut (LDB 05 : compétences/talent de carrière/possessions ont tous une valeur de repli avant
 *  même que le joueur ne visite l'étape). */
function useCreatorRoadmap(step: number) {
  const ids = stepIds();
  const idxOf = (id: StepId) => ids.indexOf(id);
  const ahead = (id: StepId) => { const i = idxOf(id); return i !== -1 && step < i; };
  const stepNo = (id: StepId) => idxOf(id) + 1;
  return { ids, ahead, stepNo };
}

export function CreatorSummary({ d, step = 0 }: { d: CreatorDraft; step?: number }) {
  const hero = useMemo(() => previewHero(d), [d]);
  const { ids, ahead, stepNo } = useCreatorRoadmap(step);
  const starActive = ids.includes('star');
  const sp = draftSpecies(d);
  const level = draftLevel(d);
  const baseChars = draftChars(d);
  // Surlignage des Caractéristiques MODIFIÉES (talents +5, Augmentations gratuites, malus) : l'écart
  // se mesure à la valeur EFFECTIVE (`effectiveChar`, lecteur canonique #498) contre l'ÉDITION brute
  // du brouillon (`baseChars`) — idiome du site canonique `CharacterSheet.tsx` (`ok-text`/`warn-text`,
  // `HeroSheet` `statAnnotations`, data-driven, aucun branchement créateur dans la primitive).
  const statAnnotations = useMemo(() => {
    if (!hero) return undefined;
    const out: Partial<Record<CharKey, { valClass?: string; note?: string }>> = {};
    for (const k of CHAR_KEYS) {
      const e = effectiveChar(hero, k);
      const b = baseChars[k];
      if (e > b) {
        out[k] = { valClass: 'ok-text', note: `${b} + Augmentations/talents` };
      } else if (e < b) {
        out[k] = { valClass: 'warn-text', note: `Base ${b} (${e - b} de modificateurs)` };
      }
    }
    return out;
  }, [hero, baseChars]);
  const started = hasSpecies(d); // au moins une race choisie → la fiche commence à vivre
  const careerLabel = d.careerId ? careerLabelFor({ career: d.careerId, appearance: { sex: d.apparence.sex } }) : '';
  // Repli si le brouillon ne construit aucun héros valide : apparence du brouillon (race choisie), sans équipement.
  const appearance: Appearance | null = sp
    ? { ...d.apparence, species: rigSpeciesId(d.speciesId) }
    : null;
  const wealth = d.careerId ? draftWealth(d).wealth : null;

  return (
    <aside className="creator-summary">
      {started && (starActive || ahead('details')) && (
        <Row className="creator-identity-roadmap">
          {starActive && (ahead('star')
            ? <RoadmapChip>signe — étape {stepNo('star')}</RoadmapChip>
            : d.star ? <span className="chip">{findStarById(d.star)?.label ?? d.star}</span> : null)}
          {ahead('details') && <RoadmapChip>nom, traits — étape {stepNo('details')}</RoadmapChip>}
        </Row>
      )}

      {hero ? (
        // Fiche IDENTIQUE au détail candidat du lobby (correctif utilisateur 2026-07-15) : bande
        // d'en-tête HeroSheet COMPRISE (figurine+nom+statut+rose) — plus d'alcôve propre au créateur.
        <HeroSheet
          hero={hero}
          wealth={wealth ?? undefined}
          statAnnotations={statAnnotations}
          className="creator-hero-sheet"
          pending={{
            // Résolution EN DIRECT au fil des sous-écrans 5a/5b/5c (#393 P4) : le tout-ou-rien
            // `ahead('skills')` ne joue qu'AVANT d'atteindre l'étape — une fois dessus, chaque
            // rubrique se résout à SA propre complétion (`careerSkillsDone`/`speciesTalentChoicesDone`,
            // draft.ts) plutôt que d'un bloc à l'arrivée sur l'étape.
            skills: ahead('skills')
              ? <RoadmapChip>à répartir — étape {stepNo('skills')}</RoadmapChip>
              : !careerSkillsDone(d) ? <RoadmapChip>carrière — 5b</RoadmapChip> : undefined,
            // Talents aléatoires (#393 agentivité) : un tirage non encore LANCÉ n'apparaît nulle
            // part — la fiche montre l'emplacement « à tirer » (compte dérivé de la DONNÉE,
            // `speciesTalentRandomCount`, jamais un « 3 » codé) jusqu'au geste 5c.
            talents: ahead('skills') ? (
              <>
                <RoadmapChip>au choix — étape {stepNo('skills')}</RoadmapChip>
                {speciesTalentRandomCount(d) > 0 && (
                  <RoadmapChip>{speciesTalentRandomCount(d)} à tirer au d100 — étape {stepNo('skills')}</RoadmapChip>
                )}
              </>
            ) : !speciesTalentChoicesDone(d) || (speciesTalentRandomCount(d) > 0 && !d.talentsRolled) || tiragesSansUtilisation(d).length > 0 ? (
              <>
                {!speciesTalentChoicesDone(d) && <RoadmapChip>au choix — 5c</RoadmapChip>}
                {speciesTalentRandomCount(d) > 0 && !d.talentsRolled && (
                  <RoadmapChip>{speciesTalentRandomCount(d)} à tirer au d100 — 5c</RoadmapChip>
                )}
                {tiragesSansUtilisation(d).length > 0 && <RoadmapChip>utilisation à choisir — 5c</RoadmapChip>}
              </>
            ) : undefined,
            possessions: ahead('trappings') ? <RoadmapChip>dotations — étape {stepNo('trappings')}</RoadmapChip> : undefined,
          }}
        />
      ) : (
        <>
          {/* Page blanche pré-héros (hors mandat HeroSheet, entrée = un Combatant) : apparence de
              secours + identité minimale, mêmes rubriques grisées jusqu'au 1ᵉʳ héros constructible. */}
          {appearance ? (
            <CharacterPreview appearance={appearance} career={d.careerId || undefined} size="fill" ambiance="panel" className="creator-fig" />
          ) : (
            <div className="creator-fig" style={DIM} aria-hidden />
          )}
          <div className="creator-id" style={started ? undefined : DIM}>
            <strong>{d.label.trim() || 'Aventurier'}</strong>
            <span className="char-sub">
              {level ? `${level.label} (${careerLabel})` : careerLabel || 'Carrière à choisir'}
              {level?.status ? ` · ${level.status}` : ''}
            </span>
            <span className="char-sub">{sp?.label ?? 'Race à choisir'}</span>
          </div>
          <div style={started ? undefined : DIM}>
            <CharStatsGrid size="sm" value={(k) => (sp ? baseChars[k] : '—')} />
          </div>
          <div className="creator-derived" style={started ? undefined : DIM}>
            <span>
              <Icon id="resource/wounds" size="sm" /> Blessures <b>—</b>
            </span>
            <span>
              <Icon id="resource/movement" size="sm" /> Mouvement <b>{sp?.movement ?? '—'}</b>
            </span>
            <span>
              <Icon id="resource/fate" size="sm" /> Destin <b>{sp?.fate.fate ?? '—'}</b> · Chance <b>—</b>
            </span>
            <span>
              <Icon id="resource/resilience" size="sm" /> Résilience <b>{sp?.fate.resilience ?? '—'}</b> · Déterm. <b>—</b>
            </span>
          </div>
          <div className="creator-derived" style={started ? undefined : DIM}>
            <span>
              <Icon id="resource/gold-purse" size="sm" /> Bourse <b>{wealth ? <Coins money={wealth} /> : '—'}</b>
            </span>
          </div>
        </>
      )}

      <div
        className="creator-xp"
        style={started ? undefined : DIM}
        title={`Espèce +${speciesXp(d)} · Carrière +${careerXp(d)} · Caractéristiques +${charsXp(d)}${stepIds().includes('star') ? ` · Signe +${starXp(d)}` : ''}`}
      >
        PX bonus de création : <b>+{xpTotal(d)}</b>
      </div>
    </aside>
  );
}