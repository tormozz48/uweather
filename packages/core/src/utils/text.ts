/**
 * Text processing utilities shared across prompt/agent code.
 */

/**
 * Remove leading/trailing markdown code fences from a string.
 * Bedrock models sometimes wrap JSON responses in ```json ... ``` blocks.
 *
 * Examples:
 *   "```json\n{...}\n```" → "{...}"
 *   "```\n{...}\n```"     → "{...}"
 *   "{...}"               → "{...}"
 */
export function stripMarkdownFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
}
