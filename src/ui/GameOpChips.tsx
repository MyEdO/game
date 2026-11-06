/**
 * Rendu JOUEUR d'une liste de `GameOp[]` (passifs d'entité, effets de signe astral) — chips codex-liées
 * (`EntityRef`) pour les ops à ancre, phrase humanisée en repli pour le reste. Une op `rollTable`
 * s'expanse en ses rangées (`opRows`/`tableRows`, ref #540) : sous-en-tête de fourchette (`.codex-rowsub`,
 * même rendu que la catégorie « Tables d'effets ») + chips des ops de la rangée. Compose `opRows` (ref
 * #495) : SOURCE UNIQUE, jamais le résumeur d'atelier `opSummary`. Composable dans une rangée
 * `.skill-tags` existante.
 *
 * `sl` — le DR d'un jet DÉJÀ résolu : les quantités à échelle par DR (`valuePerSL`) s'affichent alors
 * au nombre RÉELLEMENT appliqué par `applyOps`. Absent (annonce, fiche, passif) : la chip dit la règle
 * — base + échelle — au lieu d'un nombre que la résolution démentirait.
 */
import { Fragment } from 'react';
import type { GameOp } from '../engine/ops';
import { opRows } from '../noyau/codex/opRows';
import { EntityRef } from './EntityChip';

export function GameOpChips({ ops, sl }: { ops: GameOp[]; sl?: number }) {
  return (
    <>
      {opRows(ops, sl != null ? { sl } : undefined).map((row, i) => (
        <Fragment key={i}>
          {row.t === 'ref' ? (
            <EntityRef category={row.category} id={row.id} label={row.label} show={row.show} badge={row.badge} />
          ) : row.t === 'sub' ? (
            <span className="codex-rowsub">{row.label}</span>
          ) : (
            <span className="chip">{row.t === 'text' ? row.text : ''}</span>
          )}
        </Fragment>
      ))}
    </>
  );
}
