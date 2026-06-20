import { describe, expect, it } from "vitest";

import { sanitizeAssistant } from "@/lib/sanitize";

describe("sanitizeAssistant", () => {
  it("leaves clean markdown untouched", () => {
    const md = "## Hi\n\nThis is **bold** and `code`.";
    expect(sanitizeAssistant(md).text).toBe(md);
  });

  it("strips a leaked harmony channel header (the screenshot bug)", () => {
    const raw = "<|channel|>thought\nLet me think about this.";
    const { text, thinking } = sanitizeAssistant(raw);
    expect(text).toBe("");
    expect(thinking).toBe(true);
  });

  it("keeps only the final harmony channel message", () => {
    const raw =
      "<|channel|>analysis<|message|>The user wants X. Let me reason...<|end|>" +
      "<|start|>assistant<|channel|>final<|message|>A Mac mini is a small desktop.";
    expect(sanitizeAssistant(raw).text).toBe("A Mac mini is a small desktop.");
  });

  it("captures harmony analysis as reasoning", () => {
    const raw =
      "<|channel|>analysis<|message|>The user wants X. Let me reason...<|end|>" +
      "<|start|>assistant<|channel|>final<|message|>A Mac mini is a small desktop.";
    expect(sanitizeAssistant(raw).reasoning).toBe(
      "The user wants X. Let me reason..."
    );
  });

  it("removes closed <think> blocks and keeps their content as reasoning", () => {
    const raw = "<think>secret reasoning here</think>The answer is 42.";
    const { text, reasoning } = sanitizeAssistant(raw);
    expect(text).toBe("The answer is 42.");
    expect(reasoning).toBe("secret reasoning here");
  });

  it("exposes the in-progress thought while thinking", () => {
    const raw = "<think>still reasoning, not done";
    const { text, reasoning, thinking } = sanitizeAssistant(raw);
    expect(text).toBe("");
    expect(thinking).toBe(true);
    expect(reasoning).toBe("still reasoning, not done");
  });

  it("reports no reasoning for clean answers", () => {
    expect(sanitizeAssistant("Just a normal answer.").reasoning).toBe("");
  });

  it("hides a dangling <think> mid-stream", () => {
    const raw = "<think>still reasoning, not done";
    const { text, thinking } = sanitizeAssistant(raw);
    expect(text).toBe("");
    expect(thinking).toBe(true);
  });

  it("strips stray control tokens", () => {
    const raw = "Hello there<|im_end|>";
    expect(sanitizeAssistant(raw).text).toBe("Hello there");
  });

  it("does not eat ordinary text with pipes or angle brackets", () => {
    const raw = "Use a || b in JS, and 3 < 4 > 2 is fine.";
    expect(sanitizeAssistant(raw).text).toBe(raw);
  });

  it("handles empty input", () => {
    expect(sanitizeAssistant("").text).toBe("");
  });

  it("trims only leading whitespace from the final answer", () => {
    const raw = "<|channel|>final<|message|>\n\n  Answer.";
    expect(sanitizeAssistant(raw).text).toBe("Answer.");
  });
});
