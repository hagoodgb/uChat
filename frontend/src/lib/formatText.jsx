// Splits message text into segments, tagging *actions* as dim italics and
// "speech" as a lighter tone, SillyTavern-style. Plain text passes through
// untouched. This never injects raw HTML — output is always React nodes.

export function formatMessage(text) {
  if (!text) return null;
  // Matches *...* (non-greedy, no nested *) or "..." (non-greedy)
  const pattern = /(\*[^*]+\*)|("[^"]+")/g;
  const nodes = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith("*")) {
      // Keep the italic styling but hide the asterisks themselves —
      // SillyTavern-style. Only paired asterisks reach this branch at all
      // (the regex requires both a leading and trailing *), so a stray lone
      // "*word" with no closing asterisk never matches and passes through
      // as plain, unformatted text further down.
      nodes.push(
        <span key={key++} className="msg-action">
          {token.slice(1, -1)}
        </span>
      );
    } else {
      nodes.push(
        <span key={key++} className="msg-speech">
          {token}
        </span>
      );
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }
  return nodes;
}
