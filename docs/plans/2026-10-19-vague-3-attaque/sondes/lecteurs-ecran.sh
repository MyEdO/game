#!/bin/sh
# Lecteurs de l'écran AFFICHÉ (`screen` de l'état) hors test, à cf4f18bcf, moins les 12 sites du §1 de design.md v5.
cd /home/user/game
git grep -nE "(getState\(\)|\bs|\bst|\bmine|\bg\(\)|get\(\))\.screen\b|useGame\(\(s\) => s\.screen\)|const \{ screen" cf4f18bcf -- src scripts ':!*.test.*' ':!*.test.mjs' \
 | grep -vE "src/ui/App.tsx:51:|keybindings.ts:(220|253|275|276|281|283|495):|audio/music.ts:27:|devtools.ts:(599|757):|store.ts:(2136|2142):|modalArbiter.ts:332:|netFlow.ts:165:|store.ts:2287:" \
 | cut -c1-170
