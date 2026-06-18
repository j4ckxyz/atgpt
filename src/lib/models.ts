/**
 * Client-safe model helpers (no server-only imports).
 */

/**
 * Turn a raw network model id into something a non-technical person can read.
 * "mlx-community/Qwen2.5-7B-Instruct-4bit" -> "Qwen2.5 7B"
 * "stub" -> "Echo (test)"
 */
export function prettyModel(id: string): string {
  if (!id) return "";
  if (id === "stub") return "Echo (test)";
  let name = id.includes("/") ? id.split("/").pop()! : id;
  // Drop quantization and instruct-tuning noise.
  name = name
    .replace(/-?(\d+)bit\b/gi, "")
    .replace(/-?(4bit|8bit|fp16|bf16|gguf|mlx|q\d+(_\w+)?)\b/gi, "")
    .replace(/-?(instruct|chat|it)\b/gi, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name || id;
}
