import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

// KeyboardAvoidingView's "height"/"padding" modes rely on the OS actually
// resizing the window when the keyboard opens (windowSoftInputMode
// "adjustResize"), which Android's edge-to-edge display mode (required by
// RN's New Architecture) frequently doesn't do anymore — the app owns its
// own insets instead. Reading the real keyboard height directly from the
// show/hide events and applying it as padding works regardless of that,
// since it doesn't depend on the OS auto-resizing anything.
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
