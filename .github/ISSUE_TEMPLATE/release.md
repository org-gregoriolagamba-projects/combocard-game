---
name: Release
about: Pubblicare una nuova versione (vedi CONTRIBUTING.md, «Pubblicare una release»)
title: "Release X.Y.Z"
type: Task
assignees: gregoriolagamba
---

## Release X.Y.Z

## Passi
- [ ] Branch `feature/release-X.Y.Z` collegato a questa issue, da `develop`
- [ ] **Revisione della documentazione** (README, GAME_DESIGN, DEPLOYMENT, AUTH, DATABASE, TEST_SUITE, CONTRIBUTING) contro il codice, con la lista di CONTRIBUTING.md
- [ ] `check-docs.mjs --release` senza errori: **valori dei testi legali impostati** (`frontend/src/config/legale.js` e `contatti.js`)
- [ ] Bump di versione nei quattro pacchetti (root, backend, frontend, e2e) con i lock
- [ ] PR del bump verso `develop`, unita
- [ ] PR `develop` → `main` con le note di rilascio, CI verde, unita
- [ ] Tag `vX.Y.Z` e release su GitHub sul commit di `main` (identificativo completo)

## Nelle note di rilascio
- Se la versione porta nuovi testi legali o una nuova versione dei termini: chi è già registrato vede la schermata di accettazione al prossimo accesso.

## Issue incluse nella release
- #
