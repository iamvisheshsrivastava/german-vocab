# Play Store listing copy

Copy-paste these directly into Play Console → your app → Grow → Store presence → Main store listing.

## App name
(30 characters max)

```
German Vocab
```

## Short description
(80 characters max)

```
Learn 1000 German words offline with flashcards, audio & quizzes.
```
(68 characters — fits with room to spare)

## Full description
(4000 characters max)

```
German Vocab is a simple, offline-first flashcard app for learning essential German vocabulary — no account, no ads, no internet required.

FLASHCARDS
Swipe through 1000 English–German word pairs across 10 categories: Basics & Grammar, Numbers & Time, People & Feelings, Body & Health, Home & Clothing, Food & Drink, School Work & Money, Places & Travel, Nature & Animals, and Verbs Adjectives & Hobbies. Tap a card to reveal the translation.

HEAR IT SPOKEN
Tap the speaker icon to hear any German word pronounced aloud using your device's built-in text-to-speech — works completely offline, no API key or internet needed.

SEARCH
Instantly search all 1000 words in English or German to jump straight to the one you need.

TRACK YOUR PROGRESS
Reviewed words are saved on your device and persist between sessions, so you always know how far you've come. Reset your progress anytime with one tap.

TEST YOURSELF
Switch to the Test tab for a multiple-choice quiz. Choose 10, 20, 30, 100, or a custom number of questions, answer English→German prompts with 4 options, hear each option pronounced, see your live score, and replay as many times as you like.

PRIVACY FIRST
German Vocab doesn't collect any personal data, doesn't require sign-in, and doesn't need an internet connection to work. Everything happens on your device.

Whether you're starting from scratch or brushing up before a trip, German Vocab is a fast, distraction-free way to build your German vocabulary.
```

## App category
```
Education
```

## Tags (optional, pick up to 5 in Play Console)
```
Language learning, German, Flashcards, Vocabulary, Education
```

## Contact details
- Email: srivastava.vishesh9@gmail.com
- Privacy policy URL: <fill in once PRIVACY_POLICY.md is hosted — see DEPLOYMENT.md>

## Content rating questionnaire — expected answers
- Violence: None
- Sexual content: None
- Profanity: None
- Controlled substances: None
- User-generated content / user communication: None (no accounts, no sharing, no chat)
- Shares location: No
- Digital purchases: No
- Ads: No
→ This should land the app at "Everyone" / PEGI 3.

## Data safety form — expected answers
- Does your app collect or share any of the required user data types? **No**
  (Reviewed-word IDs are stored only in local device storage via AsyncStorage — never transmitted, so this doesn't count as "collected" for the Data safety form.)
- Is all user data encrypted in transit? N/A (nothing is transmitted)
- Do you provide a way for users to request data deletion? N/A — the in-app "Reset Progress" button already clears local data, and uninstalling the app removes it entirely.

## Screenshots
Minimum 2, recommended 4–8, phone screenshots. I wasn't able to auto-capture these (no working screenshot pipeline in this session) — quickest way to get them yourself:

1. `cd frontend && npm run web` (or `yarn start` and press `w`)
2. Open http://localhost:8081 (or whatever port it prints) in Chrome
3. DevTools (F12) → toggle device toolbar (Ctrl+Shift+M) → pick "iPhone 14 Pro" or similar phone preset
4. Screenshot 3–4 good moments: the Learn tab with a card revealed, the category picker open, the Test tab mid-quiz, and the quiz results screen
5. Save into `store-assets/screenshots/`

Or even simpler: run the app on your phone via Expo Go (`npm run start`, scan the QR code) and just take real screenshots there — those will look the most authentic anyway.

## Feature graphic
`store-assets/feature-graphic-1024x500.png` (1024×500, required)

## App icon
`store-assets/play-store-icon-512.png` (512×512, required)
