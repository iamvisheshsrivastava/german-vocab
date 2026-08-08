# German Vocab

An offline-first mobile app for learning German vocabulary — swipeable flashcards, spoken pronunciation, and a multiple-choice quiz to test yourself. Built with Expo (React Native).

## Features

- **Flashcards (Learn tab)** — swipe through 2000 English↔German word pairs across 10 categories (Basics & Grammar, Numbers & Time, Food & Drink, Nature & Animals, and more). Tap a card to reveal the translation.
- **View toggle** — switch between "To review" (hides words you've already marked as reviewed, so you always land on something new) and "All" (browse the full deck regardless of progress).
- **Pronunciation** — tap the speaker button on a flashcard, or on any of the 4 answer options in the quiz, to hear the German word spoken aloud using the device's built-in text-to-speech (no API key, works offline).
- **Progress tracking** — reviewed words are saved locally and persist between sessions. Progress shown is scoped to whichever category is selected ("All" shows overall progress).
- **Reset Progress** — clears all reviewed marks and returns to the first card.
- **Test tab** — a multiple-choice quiz, optionally scoped to a single category. Choose how many questions (10/20/30/100/200 or a custom number), answer English→German questions with 4 options (1 correct + 3 random wrong answers, re-shuffled every question), hear any option pronounced, see your live score, and restart anytime.
- **Dark mode** — follows the device's system light/dark setting automatically.

## Project structure

```
frontend/           Expo (React Native) app — the actual product
  app/               expo-router entry point
  src/
    components/      LearnScreen (flashcards) and TestScreen (quiz)
    data/            vocabulary.json — 2000 word entries (id, category, english, german)
    services/        vocabulary, progress persistence, and quiz-generation logic
    theme/           light/dark color tokens
    models/          shared TypeScript types
release_apk/        Locally built release APKs (gitignored — not committed)
```

## Running the app

```bash
cd frontend
yarn install
yarn start
```

Scan the QR code with the **Expo Go** app on your phone (same Wi-Fi network), or press `a` in the terminal to open an Android emulator.

## Running tests

```bash
cd frontend
yarn test
```

Jest (via `jest-expo`) covers the vocabulary data invariants (unique/contiguous ids, no duplicate entries, balanced categories), the word-selection/shuffle logic, quiz-question generation, and progress persistence.

## Building a release APK locally

Requires a JDK (17+) and the Android SDK (`ANDROID_HOME`/`ANDROID_SDK_ROOT` set) in addition to Node/Yarn.

```bash
cd frontend
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

The APK is produced at `frontend/android/app/build/outputs/apk/release/app-release.apk`.

> **Windows note:** if the project path contains a space (e.g. under a folder like `Personal Repositories`), the native build can fail with `ninja: error: manifest 'build.ninja' still dirty after 100 tries`. This is a known Windows Ninja/CMake limitation with spaces in paths — build from a path with no spaces instead.

The release build is signed with the Android **debug keystore** (Expo's default), so it installs fine for testing/sideloading but is **not** ready for Play Store submission — that requires generating a dedicated release keystore.

## Play Store status

The app is currently in **closed testing** on Google Play, which requires at least 12 opted-in testers before it can move to production. If you'd like to help test it, email your Google Account address to **contact@visheshsrivastava.com** and it'll be added to the tester list — you'll then be able to opt in and install the app directly from the Play Store.

## Tech stack

- [Expo](https://expo.dev) / React Native, [expo-router](https://docs.expo.dev/router/introduction/) for navigation
- `expo-speech` for on-device text-to-speech
- `@react-native-async-storage/async-storage` for local progress persistence
- `jest` / `jest-expo` for automated tests
