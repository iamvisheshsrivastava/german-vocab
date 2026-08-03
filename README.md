# German Vocab

An offline-first mobile app for learning German vocabulary — swipeable flashcards, spoken pronunciation, and a multiple-choice quiz to test yourself. Built with Expo (React Native).

## Features

- **Flashcards (Learn tab)** — swipe through 1000 English↔German word pairs across 10 categories (Basics & Grammar, Numbers & Time, Food & Drink, Nature & Animals, and more). Tap a card to reveal the translation.
- **Pronunciation** — tap the speaker button on a card to hear the German word spoken aloud, using the device's built-in text-to-speech (no API key, works offline).
- **Progress tracking** — reviewed words are saved locally and persist between sessions. Progress shown is scoped to whichever category is selected ("All" shows overall progress).
- **Reset Progress** — clears all reviewed marks and returns to the first card.
- **Test tab** — a multiple-choice quiz. Choose how many questions (10/20/30/100 or a custom number), answer English→German questions with 4 options (1 correct + 3 random wrong answers, re-shuffled every question), see your live score, and restart anytime.

## Project structure

```
frontend/           Expo (React Native) app — the actual product
  app/               expo-router entry point
  src/
    components/      LearnScreen (flashcards) and TestScreen (quiz)
    data/            vocabulary.json — 1000 word entries (id, category, english, german)
    services/        vocabulary, progress persistence, and quiz-generation logic
    models/          shared TypeScript types
backend/            Minimal FastAPI + MongoDB scaffold (not used by the app's core features)
release_apk/        Locally built release APKs (gitignored — not committed)
```

## Running the app

```bash
cd frontend
yarn install
yarn start
```

Scan the QR code with the **Expo Go** app on your phone (same Wi-Fi network), or press `a` in the terminal to open an Android emulator.

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

## Tech stack

- [Expo](https://expo.dev) / React Native, [expo-router](https://docs.expo.dev/router/introduction/) for navigation
- `expo-speech` for on-device text-to-speech
- `@react-native-async-storage/async-storage` for local progress persistence
- FastAPI + MongoDB backend scaffold (present but not wired into the app's features)
