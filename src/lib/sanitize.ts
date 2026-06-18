/**
 * Clean raw assistant output for display.
 *
 * Some networked models leak their reasoning and chat-template control tokens
 * into the response stream: OpenAI "harmony" channels (`<|channel|>analysis…
 * <|message|>… <|channel|>final<|message|>…`), DeepSeek/Qwen `<think>…</think>`
 * blocks, and stray special tokens like `<|im_end|>`. Regular people should see
 * only the final answer, never the scaffolding.
 *
 * Returns the display text plus whether the model is currently "thinking"
 * (reasoning is in progress and no final answer has streamed yet).
 */
export function sanitizeAssistant(raw: string): {
  text: string;
  thinking: boolean;
} {
  let s = raw ?? "";
  let thinking = false;

  // Harmony channels: keep only the final channel's message.
  if (s.includes("<|channel|>")) {
    const finalIdx = s.lastIndexOf("<|channel|>final");
    if (finalIdx !== -1) {
      const msgIdx = s.indexOf("<|message|>", finalIdx);
      s = msgIdx !== -1 ? s.slice(msgIdx + "<|message|>".length) : s.slice(finalIdx);
    } else {
      // Still reasoning (analysis / thought / commentary). Hide it.
      thinking = true;
      s = "";
    }
  }

  // <think>…</think> reasoning blocks (closed first, then a dangling open one).
  if (s.includes("<think>")) {
    s = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
    const open = s.indexOf("<think>");
    if (open !== -1) {
      thinking = true;
      s = s.slice(0, open);
    }
  }

  // Strip any remaining special tokens: <|...|> and a few bare ones.
  s = s.replace(/<\|[^|]*\|>/g, "");
  s = s.replace(/<\/?(?:s|im_start|im_end|endoftext)>/gi, "");

  return { text: s.replace(/^\s+/, ""), thinking };
}
