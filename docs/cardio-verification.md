# Existing cardio metrics update

## Existing structure and scope

The catalog already defines RUNNING, WALKING, CYCLING, STAIR CLIMBER and ROWING as cardio. The existing Workout card edits string inputs; account-scoped AsyncStorage persists active workouts and history. `completedWorkoutExercises` validates FINISH and retains completed Strength sets. `buildPostExercises` converts cardio strings into numeric snapshots, and the durable outbox publishes those snapshots to Supabase `posts.exercises` JSONB. Feed, post composer and history share `CardioSummaryCard`; clipboard output uses `workoutToText`.

No database migration, column deletion, RLS, Supabase client, retry algorithm, navigation or Strength set/PR change is needed. Existing working-tree changes were preserved.

## Updated input and storage

- RUNNING / Treadmill and WALKING / Incline Walk: duration, distance, speed, incline.
- CYCLING / Bike: duration, distance, speed, resistance level.
- STAIR CLIMBER: duration, level/resistance, floors.
- ROWING: duration, distance, pace per 500 m.

Existing catalog names are retained. Treadmill, Incline Walk and Bike search aliases lead to the corresponding existing entries.

Duration is required, accepts decimal minutes or m:ss, and allows zero while rejecting negatives and blank input at FINISH. All other metrics are optional. Decimal points and commas are accepted for numeric metrics. Pace accepts m:ss with seconds 00-59; blank is permitted. No machine values are calculated or estimated.

Existing `durationMinutes` and `distanceKm` names/units are retained. Numeric snapshots add nullable `speedKmh`, `inclinePercent`, `resistanceLevel`, `paceSeconds` (seconds per 500 m), and `floors`. Input strings preserve drafts; optional blank values become null, explicit zero stays zero. New type fields are optional so old records remain valid.

Calories are removed from input, new active/history writes, completed records, generated post snapshots, shared summary and clipboard text. Old persisted records and old pending post snapshots remain readable; the optional legacy calorie field is retained for compatibility. No bulk data rewrite occurs. Retrying an old pending snapshot retains its existing payload.

Summary example: `30:00 · 5.2 km · 10.4 km/h · Incline 3%`. Blank metrics are omitted, including missing fields in old posts. Strength-only and mixed workout aggregates keep the existing behavior.

## Files changed for this update

- `src/components/cardio-exercise-card.tsx`
- `src/lib/cardio.ts`
- `src/lib/workoutStorage.ts`
- `src/lib/postStorage.ts`
- `src/lib/postValidation.ts`
- `src/lib/workoutText.ts`
- `src/lib/exerciseLibrary.ts`
- `tests/cardio.test.cjs`
- `tests/cardio-ui.test.cjs`
- `tests/cardio-display.test.cjs`
- `tests/cloud-posts.test.cjs`
- `tests/workout-text.test.cjs`
- `docs/cardio-verification.md`

## Automated verification

Commands: `npm test`, `npm run lint`, `npm run typecheck`.

Final result (2026-10-05): all 129 tests passed; lint and TypeScript checks passed with exit code 0.

Tests cover the existing screen/picker/input/FINISH callbacks, every machine-specific card, absent calorie inputs, blank optional fields, explicit zero, negative and malformed input, local active/history/template/outbox restart, legacy calories, numeric post validation, shared summary/Feed/clipboard rendering, Strength-only and mixed workouts. Supabase tests use a mocked publish/feed transport and PGlite with existing migrations and owner/follower permissions. Quantitative snapshots retain all fields through a lost response and retry without duplicate inserts.

These checks do not constitute native-device or production-network verification.

## Device verification

1. Open the existing Cardio category. Search Treadmill, Incline Walk and Bike; check that the corresponding existing RUNNING, WALKING and CYCLING entries open.
2. Verify fields for every machine. Ensure calories are absent and m:ss can be typed on iOS and Android keyboards. Check small screens and keyboard visibility.
3. Record RUNNING with 30:00, 5.2 km, 10.4 km/h, incline 3%; save and inspect history, composer and Feed.
4. Save duration-only entries and entries with optional zeros. Restart during input and after finishing; confirm all values and blank/zero distinctions survive.
5. Try negative values, blank Duration and invalid pace such as 2:60. Confirm FINISH shows an error without partial saves. Duration 0 and pace 0:00 are valid.
6. Record Strength-only and mixed workouts. Confirm weights, reps, completed sets, PRs, ordering and templates behave as before.
7. Open old calorie-containing history and posts; verify no errors and no calorie display.
8. Publish while offline, restart, reconnect and retry. Verify one post and all recorded metrics on the author's and follower's devices.
