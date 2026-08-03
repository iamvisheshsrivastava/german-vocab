# German Vocabulary — PRD

## Overview
An offline, minimalist German vocabulary learning mobile app built in Expo/React Native. Single-screen, tap-to-reveal flashcards with swipe navigation.

## Core Features
- **Vocabulary loaded from bundled JSON** (`src/data/vocabulary.json`) — replace file to scale to 1000+ words without code changes. 10 seed words across 5 categories (Family, Business, Food, Travel, Home).
- **Single flashcard UI** — English shown by default; tap card to reveal German; tap again to hide.
- **Swipe navigation** — swipe left = next word, swipe right = previous word (circular). Powered by PanResponder + Animated.
- **Auto-reviewed tracking** — a word is marked Reviewed on first reveal. Persisted locally via `@/src/utils/storage` (AsyncStorage-backed).
- **Progress header** — "X / Y reviewed" + percentage + horizontal progress bar.
- **Category filter** — dropdown modal picker with All / Family / Business / Food / Travel / Home. "All" shuffles all words; category-selected filters and sorts by id.
- **Reset Progress** — button with confirmation modal; clears all reviewed state.
- **Fully offline** — no network, no backend, no login, no ads, no notifications.

## Architecture
- `src/data/vocabulary.json` — data (swap to grow).
- `src/models/vocab.ts` — types.
- `src/services/vocabulary-service.ts` — load / categories / filter / shuffle.
- `src/services/progress-service.ts` — persistence layer for reviewed IDs.
- `app/index.tsx` — single-screen UI.

## Notes
- Backend is not used; the app is entirely client-side.
- Designed for Android + iOS via Expo; user requested Android APK deployment via Emergent Publish flow.
