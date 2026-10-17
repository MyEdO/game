// Messages RÉELS de refus de mise en file rendus par GitHub, verbatim, sans le point final que le
// commentaire de reprise ajoute (`reprendre-file.mjs`, `signaler`) (#2392).
export const REFUS_DE_FILE = Object.freeze({
  // https://github.com/MyEdO/game/pull/2445#issuecomment-6030089060
  prefixe: 'Pull request could not be added to the merge queue: Enqueuer is not authorized to merge',
  // https://github.com/MyEdO/game/pull/2445#issuecomment-6029869798
  concatene: 'Pull request could not be added to the merge queue: Pull request has merge conflicts, Enqueuer is not authorized to merge, and Pull request not in mergeable state',
})
