
# Programmer

- Route A approved with 0 substantive plan returns; actual implementation base d4a17b6. Designer source clarification 053708f cherry-picked as 97e762e. No game run, push or dev merge.
- Files: controller, BattleMovesPanel, battleResolution, shared action/accuracy-adjacent damage/type/end-turn helpers, MoveBattleData builder/types, heldItemRules, itemEffects/moveEffectTable/uiStrings; new resolveFlinch/resolveHeldItemHit/resolveMentalHerb/resolveHealBlock/resolveHealingItem/resolveLegalMoves/prepareMoveUse and heldItemEffects.test.ts. Metadata programmer supplied only the agreed extraction script/tests, generated table/tests and provenance manifest.
- Implemented: priority before Quick Claw; independent King’s Rock; non-consuming Focus Band; shared legal selection and minimal Struggle; all six Mental Herb restrictions plus natural Heal Block chain; natural contact and source eligibility flags. Correct Scope Lens/Boots/Loaded Dice/White Herb paths retained and verified.
- Source-reviewed adjacent findings accepted by orchestrator: target-healing ratios (floral grassy 2/3), Poison Heal withholding recovery while preserving poison immunity, Sleep Talk filtering plus called-move check. Production callback tests cover denied healing candidates, real allowed drain and mixed candidates, with only Sleep Talk PP deducted.
- Validation after final code freeze: npm run lint PASS; npm test 353/353 PASS; npm run build PASS (existing >500kB warning); go test ./... PASS. Parser 7/7 and pinned-source --check PASS. git diff --check PASS.
- Remaining: independent auditor and final-SHA player V1–V10 pending. No natural seven-battle, physical-phone or production acceptance. 35 source identities explicitly unmapped; raw.moves admission, Wish/Baton Pass and other unsupported special interactions remain later release blockers. See implementation.md and plan.md for exact evidence boundaries.

# Auditor

- Checked frozen b068eef against d4a17b6 across production paths, fixed a6adfcf ordinary source, PRD F1–F9, K/M/S, generated metadata and state inheritance. No game/server/browser execution.
- Independent gates: lint PASS; 353/353 tests PASS; build PASS with existing large-chunk warning; Go PASS; parser 7/7 and pinned --check PASS; diff whitespace PASS. Raw gate logs and real production callback reproduction saved under static-audit/.
- Fixed locally: none.
- Found but not fixed: A1 [P1], Struggle simultaneous faint returns after actor-only replacement; opponent faint/terminal settlement skipped, including player-reserve/enemy-wiped and symmetric case; enemy final Struggle double-wipe can schedule WIN instead of fixed-source defeat. See audit.md for eight-case matrix/source and exact reproduction.
- Verdict: BLOCKED. Programmer correction, new freeze and independent re-audit required before player.

# Programmer

- Repaired independent audit A1 after explicit orchestration approval. Source design 2573e56 cherry-picked as 59d744f; original audit and reproduction retained unchanged.
- Production delta: useBattleController.ts adds only double-faint full-team resolution and win/lose callback dependencies. Both teams survive: existing enemy replacement/hazards runs first; only success plus current mounted/epoch/BATTLE permits existing player replacement. A hazard terminal stops the chain. One-side faint, transaction ledger, PP/field/current refs and collection remain unchanged.
- Real callback regression: 8 symmetric Struggle reserve outcomes, both-side enemy hazard exhaustion and epoch invalidation, single actor/target faint, protection, Magic Guard, substitute break and Focus Band not shielding recoil. Uses actual handleAttack/executeTurn/runEnemyAutoAction/sendOut/switchPokemon plus engine and round transaction. Terminal settlement I/O is observed, not browser-verified.
- Serial final gates: npm run lint PASS; npm test 356/356 PASS; npm run build PASS (2253 modules, large chunk warning retained); go test ./... PASS; git diff --check PASS.
- Remaining: independent A1 re-audit, future accepted UI integration/final gates and player. No server/browser/game execution, no push/dev merge.
