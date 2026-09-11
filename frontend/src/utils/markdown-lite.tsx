import { Text, TextStyle } from "react-native";

// A tiny markdown subset for plain-text chat bubbles with no rich renderer:
// **bold** spans, and "-"/"*"-prefixed lines become a bullet. Free LLMs
// reliably emit these even when told to keep answers short, so without this
// the bubble just shows literal asterisks. Returns children for a single
// parent <Text> (nested <Text> inherits color/size from it).
export function renderMarkdownLite(raw: string, boldStyle: TextStyle): React.ReactNode[] {
  const lines = raw.split("\n");
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) nodes.push("\n");

    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const content = bulletMatch ? `• ${bulletMatch[1]}` : line;

    const segments = content.split(/(\*\*[^*]+\*\*)/g).filter((s) => s.length > 0);
    segments.forEach((segment, segIndex) => {
      const key = `${lineIndex}-${segIndex}`;
      if (segment.startsWith("**") && segment.endsWith("**") && segment.length > 4) {
        nodes.push(
          <Text key={key} style={boldStyle}>
            {segment.slice(2, -2)}
          </Text>,
        );
      } else {
        nodes.push(segment);
      }
    });
  });

  return nodes;
}
