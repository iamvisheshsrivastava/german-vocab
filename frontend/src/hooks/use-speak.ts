// Wraps expo-speech for pronouncing German words and surfaces the one
// failure mode it doesn't report on its own.
//
// expo-speech never rejects or fires onError when the requested language
// has no installed voice: Android's SpeechModule.speakOut() falls back to
// Locale.getDefault() whenever isLanguageAvailable() comes back
// LANG_MISSING_DATA/LANG_NOT_SUPPORTED, and iOS falls back to
// AVSpeechSynthesisVoice's own default when `AVSpeechSynthesisVoice(language:)`
// finds nothing. Either way the app just reads the word in whatever
// language the device happens to be set to, with zero signal that German
// TTS isn't actually installed. So we check the voice list ourselves and
// let callers show a warning instead of pretending it worked (see #18).
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";

const SPEAK_OPTIONS = { language: "de-DE", pitch: 1, rate: 0.9 } as const;
const WARNING_DISPLAY_MS = 4000;

// Cached across every useSpeak() instance/call — the installed voice list
// doesn't change during a session, and getAvailableVoicesAsync() is not
// free, so there's no reason to ask more than once.
let germanVoiceCheck: Promise<boolean> | null = null;

function hasGermanVoice(): Promise<boolean> {
  if (!germanVoiceCheck) {
    germanVoiceCheck = Speech.getAvailableVoicesAsync()
      .then((voices) =>
        voices.some((v) => v.language?.toLowerCase().startsWith("de")),
      )
      // If we can't even read the voice list, don't punish the user with
      // a false warning — assume it's fine and let onError catch real
      // failures instead.
      .catch(() => true);
  }
  return germanVoiceCheck;
}

export function useSpeak() {
  const [unavailable, setUnavailable] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flagUnavailable = useCallback(() => {
    setUnavailable(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => setUnavailable(false),
      WARNING_DISPLAY_MS,
    );
  }, []);

  const speak = useCallback(
    (text: string) => {
      Speech.stop();
      hasGermanVoice().then((available) => {
        if (!available) flagUnavailable();
      });
      Speech.speak(text, { ...SPEAK_OPTIONS, onError: flagUnavailable });
    },
    [flagUnavailable],
  );

  return { speak, unavailable };
}
