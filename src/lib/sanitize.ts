/**
 * Clean raw assistant output for display.
 *
 * Some networked models leak their reasoning and chat-template control tokens
 * into the response stream: OpenAI "harmony" channels (`<|channel|>analysis…
 * <|message|>… <|channel|>final<|message|>…`), DeepSeek/Qwen `<think>…</think>`
 * blocks, and stray special tokens like `<|im_end|>`. Regular people should see
 * only the final answer — but the reasoning is interesting, so we keep it and
 * surface it behind a collapsible "Thinking" dropdown instead of throwing it out.
 *
 * Returns:
 *  - `text`: the clean final answer
 *  - `reasoning`: the model's hidden chain-of-thought (may be empty)
 *  - `thinking`: true while reasoning is in progress and no answer has streamed
 */
export function sanitizeAssistant(raw: string): {
  text: string;
  reasoning: string;
  thinking: boolean;
} {
  let s = raw ?? "";
  let reasoning = "";
  let thinking = false;

  const addReasoning = (piece: string) => {
    const t = piece.trim();
    if (t) reasoning = reasoning ? `${reasoning}\n${t}` : t;
  };

  // Harmony channels: the final channel holds the answer; the rest is reasoning.
  if (s.includes("<|channel|>")) {
    const finalIdx = s.lastIndexOf("<|channel|>final");
    if (finalIdx !== -1) {
      addReasoning(stripHarmony(s.slice(0, finalIdx)));
      const msgIdx = s.indexOf("<|message|>", finalIdx);
      s = msgIdx !== -1 ? s.slice(msgIdx + "<|message|>".length) : s.slice(finalIdx);
    } else {
      // Still reasoning (analysis / thought / commentary) — no answer yet.
      thinking = true;
      addReasoning(stripHarmony(s));
      s = "";
    }
  }

  // <think>…</think> reasoning blocks (closed first, then a dangling open one).
  if (s.includes("<think>")) {
    s = s.replace(/<think>([\s\S]*?)<\/think>/gi, (_, inner) => {
      addReasoning(inner);
      return "";
    });
    const open = s.indexOf("<think>");
    if (open !== -1) {
      thinking = true;
      addReasoning(s.slice(open + "<think>".length));
      s = s.slice(0, open);
    }
  }

  // Strip any remaining special tokens: <|...|> and a few bare ones.
  s = s.replace(/<\|[^|]*\|>/g, "");
  s = s.replace(/<\/?(?:s|im_start|im_end|endoftext)>/gi, "");

  return { text: s.replace(/^\s+/, ""), reasoning, thinking };
}

/** Remove harmony channel/role headers and control tokens, leaving prose. */
function stripHarmony(s: string): string {
  return s
    .replace(/<\|channel\|>\s*\w+/g, "")
    .replace(/<\|start\|>\s*\w+/g, "")
    .replace(/<\|[^|]*\|>/g, "")
    .replace(/<\/?(?:s|im_start|im_end|endoftext)>/gi, "")
    .trim();
}
