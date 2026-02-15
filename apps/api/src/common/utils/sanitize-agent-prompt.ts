const MAX_PROMPT_LENGTH = 4000;

export function sanitizeAgentPrompt(prompt: string): string {
  return prompt
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROMPT_LENGTH);
}
