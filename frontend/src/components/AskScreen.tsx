import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  ChatMessage,
  chatComplete,
  clearApiKey,
  getApiKey,
  OpenRouterError,
  setApiKey,
} from "@/src/services/openrouter-service";
import { ThemeColors, useThemeColors } from "@/src/theme/colors";
import { renderMarkdownLite } from "@/src/utils/markdown-lite";

const SYSTEM_PROMPT: ChatMessage = {
  role: "system",
  content:
    "You are a friendly, concise German tutor helping an intermediate learner (already conversational, living in Germany) prepare for the Goethe/telc A1/A2 exam. Keep answers short and practical — a few sentences, not essays. Default to English explanations with German examples; if asked to write or correct German text, give the corrected version first, then a brief note on what changed and why. Avoid long grammar lectures unless asked for one.",
};

type DisplayMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
};

let messageCounter = 0;
function nextId(): string {
  messageCounter += 1;
  return `m${messageCounter}`;
}

export function AskScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [checkingKey, setCheckingKey] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [showChangeKey, setShowChangeKey] = useState(false);

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<DisplayMessage>>(null);

  useEffect(() => {
    getApiKey()
      .then((key) => setHasKey(key !== null))
      .finally(() => setCheckingKey(false));
  }, []);

  const handleSaveKey = async () => {
    const trimmed = keyInput.trim();
    if (trimmed.length === 0) {
      setKeyError("Paste a key first.");
      return;
    }
    setSavingKey(true);
    setKeyError(null);
    const ok = await setApiKey(trimmed);
    setSavingKey(false);
    if (!ok) {
      setKeyError("Couldn't save the key on this device — try again.");
      return;
    }
    setKeyInput("");
    setHasKey(true);
    setShowChangeKey(false);
  };

  const handleClearKey = async () => {
    await clearApiKey();
    setHasKey(false);
    setShowChangeKey(false);
    setMessages([]);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (text.length === 0 || sending) return;
    const userMessage: DisplayMessage = { id: nextId(), role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputText("");
    setSending(true);

    const history: ChatMessage[] = [
      SYSTEM_PROMPT,
      ...nextMessages
        .filter((m) => m.role !== "error")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    try {
      const reply = await chatComplete(history);
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content: reply }]);
    } catch (e) {
      const message =
        e instanceof OpenRouterError
          ? e.code === "no_key"
            ? "No API key is saved anymore — add one below."
            : e.message
          : "Something went wrong.";
      if (e instanceof OpenRouterError && e.code === "no_key") {
        setHasKey(false);
      }
      setMessages((prev) => [...prev, { id: nextId(), role: "error", content: message }]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  };

  if (checkingKey) {
    return (
      <View style={[styles.container, styles.centerFill]} testID="ask-loading">
        <ActivityIndicator color={colors.textMuted} />
      </View>
    );
  }

  if (!hasKey) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        testID="ask-setup-screen"
      >
        <View style={styles.setupCard}>
          <Ionicons name="key-outline" size={28} color={colors.accent} />
          <Text style={styles.setupTitle}>Connect OpenRouter</Text>
          <Text style={styles.setupBody}>
            Paste a free OpenRouter API key to ask German questions here. Get one at
            openrouter.ai — it&apos;s stored only on this device and is only ever sent
            directly to OpenRouter.
          </Text>
          <TextInput
            style={styles.keyInput}
            value={keyInput}
            onChangeText={(t) => {
              setKeyInput(t);
              setKeyError(null);
            }}
            placeholder="sk-or-v1-..."
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            testID="openrouter-key-input"
          />
          {keyError ? <Text style={styles.errorText}>{keyError}</Text> : null}
          <Pressable
            style={[styles.primaryButton, savingKey && styles.primaryButtonDisabled]}
            onPress={handleSaveKey}
            disabled={savingKey}
            testID="openrouter-key-save"
          >
            {savingKey ? (
              <ActivityIndicator color={colors.inverseText} />
            ) : (
              <Text style={styles.primaryButtonText}>Save key</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      testID="ask-chat-screen"
    >
      <View style={styles.chatHeader}>
        <View>
          <Text style={styles.chatTitle}>Ask</Text>
          <Text style={styles.chatSubtitle}>German A1/A2 tutor</Text>
        </View>
        <Pressable
          onPress={() => setShowChangeKey((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="API key settings"
          testID="ask-settings-button"
        >
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      {showChangeKey ? (
        <View style={styles.keySettingsBox}>
          <Text style={styles.keySettingsText}>OpenRouter key is connected.</Text>
          <Pressable onPress={handleClearKey} testID="ask-remove-key">
            <Text style={styles.removeKeyText}>Remove key</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.textFaint} />
            <Text style={styles.emptyChatText}>
              Ask about grammar, vocabulary, or paste a German sentence to get it corrected.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubbleRow,
              item.role === "user" ? styles.bubbleRowUser : styles.bubbleRowOther,
            ]}
          >
            <View
              style={[
                styles.bubble,
                item.role === "user"
                  ? styles.bubbleUser
                  : item.role === "error"
                    ? styles.bubbleError
                    : styles.bubbleAssistant,
              ]}
              testID={`chat-bubble-${item.role}`}
            >
              <Text
                selectable
                style={
                  item.role === "user"
                    ? styles.bubbleTextUser
                    : item.role === "error"
                      ? styles.bubbleTextError
                      : styles.bubbleTextAssistant
                }
              >
                {renderMarkdownLite(item.content, styles.bubbleTextBold)}
              </Text>
            </View>
          </View>
        )}
      />

      {sending ? (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text style={styles.typingText}>Thinking...</Text>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.chatInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask a question..."
          placeholderTextColor={colors.textFaint}
          multiline
          testID="chat-input"
        />
        <Pressable
          style={[
            styles.sendButton,
            (sending || inputText.trim().length === 0) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={sending || inputText.trim().length === 0}
          testID="chat-send-button"
        >
          <Ionicons name="arrow-up" size={20} color={colors.inverseText} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    centerFill: {
      justifyContent: "center",
      alignItems: "center",
    },
    setupCard: {
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      padding: 24,
      alignItems: "center",
      marginTop: 40,
    },
    setupTitle: {
      fontSize: 19,
      fontWeight: "700",
      color: c.textPrimary,
      marginTop: 12,
      marginBottom: 8,
    },
    setupBody: {
      fontSize: 13,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 19,
      marginBottom: 20,
    },
    keyInput: {
      width: "100%",
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: c.textPrimary,
      marginBottom: 8,
    },
    errorText: {
      color: c.danger,
      fontSize: 12,
      marginBottom: 8,
      alignSelf: "flex-start",
    },
    primaryButton: {
      width: "100%",
      backgroundColor: c.inverseSurface,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: c.inverseText,
      fontSize: 15,
      fontWeight: "700",
    },
    chatHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    chatTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: c.textPrimary,
    },
    chatSubtitle: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 2,
    },
    keySettingsBox: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    keySettingsText: {
      fontSize: 12,
      color: c.textSecondary,
    },
    removeKeyText: {
      fontSize: 12,
      fontWeight: "700",
      color: c.danger,
    },
    messageList: {
      flex: 1,
    },
    messageListContent: {
      paddingVertical: 12,
      flexGrow: 1,
    },
    emptyChat: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 30,
      paddingTop: 40,
      gap: 12,
    },
    emptyChatText: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 19,
    },
    bubbleRow: {
      marginBottom: 10,
      flexDirection: "row",
    },
    bubbleRowUser: {
      justifyContent: "flex-end",
    },
    bubbleRowOther: {
      justifyContent: "flex-start",
    },
    bubble: {
      maxWidth: "82%",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleUser: {
      backgroundColor: c.inverseSurface,
      borderBottomRightRadius: 4,
    },
    bubbleAssistant: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderBottomLeftRadius: 4,
    },
    bubbleError: {
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.danger,
      borderBottomLeftRadius: 4,
    },
    bubbleTextUser: {
      color: c.inverseText,
      fontSize: 15,
      lineHeight: 21,
    },
    bubbleTextAssistant: {
      color: c.textPrimary,
      fontSize: 15,
      lineHeight: 21,
    },
    bubbleTextError: {
      color: c.danger,
      fontSize: 13,
      lineHeight: 19,
    },
    bubbleTextBold: {
      fontWeight: "700",
    },
    typingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingBottom: 8,
    },
    typingText: {
      fontSize: 12,
      color: c.textMuted,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      paddingVertical: 10,
    },
    chatInput: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      color: c.textPrimary,
      maxHeight: 100,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.inverseSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
