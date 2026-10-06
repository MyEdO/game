/** Carnet d'enquête (#670 dernier lot) — surface de lecture JOUEUR du système d'enquête. Présentation
 *  MAISON (aucun livre ne définit de carnet) : lit `campaignNarratif` (données) + `clues` (état runtime,
 *  `src/state/clues.ts`) — un indice ABSENT de `clues` est CACHÉ, jamais affiché ici. */
import { useState } from 'react';
import { ScreenShell } from './ScreenShell';
import { MasterDetail } from './MasterDetail';
import { Band } from './Band';
import { Prose } from './Prose';
import { ParchmentCard } from './ParchmentCard';
import { Icon } from './Icon';
import { ListRow } from './ListRow';
import { SourceBadge, sourceAffichee } from './SourceBadge';
import { useGame } from '../state/store';
import type { Affaire, DocumentNarratif, Indice, IndiceStade } from '../state/campaignNarratif';
import type { ClueState } from '../state/clues';
import { Row, Stack } from './Layout';

/** Sentinelle du pseudo-groupe « Épinglés », en tête de liste — jamais un id de donnée réelle. */
const PINNED_SEL = '__pinned__';

function StadeSource({ source }: { source: IndiceStade['source'] }) {
  return source ? <SourceBadge source={sourceAffichee(source)} /> : null;
}

function indicesRevélésDe(affaireId: string, indices: Indice[], clues: Record<string, ClueState>): Indice[] {
  return indices.filter((i) => i.affaireId === affaireId && clues[i.id]);
}

function EpingleButton({ clue, onToggle }: { clue: ClueState; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={!!clue.épinglé}
      onClick={onToggle}
      title={clue.épinglé ? 'Désépingler' : 'Épingler'}
    >
      <Icon id="map-tool/pin" size="sm" /> {clue.épinglé ? 'Épinglé' : 'Épingler'}
    </button>
  );
}

/** Ce qu'un stade révèle : sa prose (absente permise) et sa source, puis le document qu'il croise (#679),
 *  sur parchemin, titré et sourcé. */
function StadeLu({ stade, documents, attenue }: { stade: IndiceStade; documents: readonly DocumentNarratif[]; attenue?: boolean }) {
  const doc = stade.documentId !== undefined ? documents.find((d) => d.id === stade.documentId) : undefined;
  return (
    <>
      {stade.prose !== undefined && <Prose md={stade.prose} />}
      <StadeSource source={stade.source} />
      {doc && (
        <ParchmentCard title={doc.titre} attenue={attenue}>
          <Prose md={doc.prose} />
          <StadeSource source={doc.source} />
        </ParchmentCard>
      )}
    </>
  );
}

function ClueBand({ indice, clue, documents, onTogglePin }: { indice: Indice; clue: ClueState; documents: readonly DocumentNarratif[]; onTogglePin: (id: string) => void }) {
  const stadeCourant = indice.stades.find((s) => s.id === clue.stadeCourant);
  const précédents = clue.historique.filter((h) => h.stade !== clue.stadeCourant);
  return (
    <Band
      title={
        <span className={clue.statut === 'réfuté' ? 'clue-refuted' : undefined}>
          {indice.titre}
        </span>
      }
      right={
        <Row as="span">
          <span className="chip">{indice.kind === 'rumeur' ? 'Rumeur' : 'Indice'}</span>
          {clue.statut === 'réfuté' && <span className="chip tone-danger">Fausse piste</span>}
          <EpingleButton clue={clue} onToggle={() => onTogglePin(indice.id)} />
        </Row>
      }
    >
      <div className={clue.statut === 'réfuté' ? 'clue-refuted' : undefined}>
        {stadeCourant && <StadeLu stade={stadeCourant} documents={documents} />}
        {précédents.length > 0 && (
          <div className="clue-history">
            <div className="mini-title">Lectures précédentes</div>
            {précédents.map((h) => {
              const stade = indice.stades.find((s) => s.id === h.stade);
              if (!stade) return null;
              return (
                <div key={h.stade} className="clue-history-entry">
                  <StadeLu stade={stade} documents={documents} attenue />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Band>
  );
}

export function CarnetScreen({ onClose }: { onClose: () => void }) {
  const campaignNarratif = useGame((s) => s.campaignNarratif);
  const clues = useGame((s) => s.clues);
  const toggleCluePin = useGame((s) => s.toggleCluePin);

  const affaires: Affaire[] = campaignNarratif?.affaires ?? [];
  const indices: Indice[] = campaignNarratif?.indices ?? [];
  const documents: readonly DocumentNarratif[] = campaignNarratif?.documents ?? [];

  const affairesAvecIndices = affaires.filter((a) => indicesRevélésDe(a.id, indices, clues).length > 0);
  const indicesÉpinglés = indices.filter((i) => clues[i.id]?.épinglé);
  const hasPinned = indicesÉpinglés.length > 0;

  const [selId, setSelId] = useState<string | null>(
    () => (hasPinned ? PINNED_SEL : (affairesAvecIndices[0]?.id ?? null)),
  );

  const aucunIndice = Object.keys(clues).length === 0;

  const list = aucunIndice ? (
    <p className="empty">Aucun indice découvert pour l’instant.</p>
  ) : (
    <Stack>
      {hasPinned && (
        <ListRow
          variant="codex"
          selected={selId === PINNED_SEL}
          onClick={() => setSelId(PINNED_SEL)}
          label={<><Icon id="map-tool/pin" size="sm" /> Épinglés</>}
        >
          <span className="chip">{indicesÉpinglés.length}</span>
        </ListRow>
      )}
      {affairesAvecIndices.map((a) => {
        const revélés = indicesRevélésDe(a.id, indices, clues);
        return (
          <ListRow
            key={a.id}
            variant="codex"
            selected={selId === a.id}
            onClick={() => setSelId(a.id)}
            label={a.titre}
          >
            <span className="chip">{revélés.length}</span>
          </ListRow>
        );
      })}
    </Stack>
  );

  const indicesDétail: Indice[] =
    selId === PINNED_SEL
      ? indicesÉpinglés
      : selId != null
        ? indicesRevélésDe(selId, indices, clues)
        : [];

  const detail = aucunIndice ? null : indicesDétail.length === 0 ? (
    <p className="empty">Sélectionnez une affaire pour consulter ses indices.</p>
  ) : (
    <Stack>
      {indicesDétail.map((i) => {
        const clue = clues[i.id];
        if (!clue) return null;
        return <ClueBand key={i.id} indice={i} clue={clue} documents={documents} onTogglePin={toggleCluePin} />;
      })}
    </Stack>
  );

  return (
    <ScreenShell title={<><Icon id="nav/compendium" size="lg" /> Carnet d’enquête</>} onClose={onClose} body="centered-wide">
      <MasterDetail list={list} detail={detail} listLabel="Affaires" />
    </ScreenShell>
  );
}
