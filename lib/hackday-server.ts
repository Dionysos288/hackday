/* hackday-server.ts: submitting from your editor, and the checks every entry goes through.

   Projects are sent from the editor through the Hackday MCP server, or on the web; both doors run the same checks.
   The server is not built yet. Until it is, SERVER.live is false and no address is shown anywhere: the site says the
   server is not open yet. When it opens, set live and url here and nothing else changes.

   The install lines are copied from each editor's own docs (checked 2026-11-17, see EDITORS). Pure. */

export const SERVER: { live: boolean; url: string | null; name: string } = { live: false, url: null, name: 'hackday' };
/* the lab's stand-in address, so the live state can be seen; never used by a real page */
export const PLACEHOLDER_URL = 'https://hackday.example/mcp';

/* what to say to the editor on the day */
export const sayIt = (city?: string) => 'Submit my project to Supabase Hackday' + (city ? ' in ' + city : '') + '.';

/* the rules that will be checked, said before the day */
export const RULES = [
  'Start a new repository on the day.',
  'Keep it public, so it can be read.',
  'Push as you go, not all at the end.',
];

/* Every check, named by what it catches, where it reads from, and what it does. A block stops the entry and says how to fix it; a flag goes to
   the hosts and judges and never shows on the public page. "Created before the day" is a block on the plan's advice,
   because the rule is printed ahead in Get ready; the owner has not decided it. */
export type Check = { id: string; what: string; from: string; does: 'block' | 'flag' | 'update'; say?: (v: Record<string, string>) => string };
export const CHECKS: Check[] = [
  { id: 'repo', what: 'The repository cannot be read', from: 'GitHub', does: 'block',
    say: (v) => 'We could not read ' + (v.repo || 'that repository') + '. Check the address, make the repository public, then send it again.' },
  { id: 'closed', what: 'Sent after building closed in that city', from: 'Our clock', does: 'block',
    say: (v) => 'Building closed in ' + (v.city || 'your city') + ' at ' + (v.time || 'the end of the session') + '. Entries can’t be sent or changed after that.' },
  { id: 'one', what: 'A second entry from the same person', from: 'Our records', does: 'update',
    say: () => 'You already have an entry. This one replaces it; nothing else changes.' },
  { id: 'age', what: 'The repository was made before the day', from: 'GitHub (when it was created)', does: 'block',
    say: (v) => 'This repository was made on ' + (v.made || 'an earlier day') + ', before the hackathon. Start a new repository today, push your work there, then send it again.' },
  { id: 'fork', what: 'A fork of an older repository', from: 'GitHub', does: 'flag' },
  { id: 'push', what: 'One push carries most of the code, or pushes only at the end', from: 'GitHub activity', does: 'flag' },
  { id: 'dates', what: 'Commit dates from before the start', from: 'GitHub commits', does: 'flag' },
  { id: 'demo', what: 'The demo does not answer', from: 'A guarded fetch', does: 'flag' },
  { id: 'supabase', what: 'No sign of Supabase in the project', from: 'The repository', does: 'flag' },
];

/* The editors in the picker, and how each adds a remote (Streamable HTTP) server, from each tool's own docs, read on
   2026-11-17. kind: a command to run, or a snippet for a file. All eight take a remote server directly; none needs a
   bridge. Where a page showed only part of a form, the form its docs do show is used:
   - VS Code: the file (the docs give no full `code --add-mcp` line); its top key is "servers" and it needs "type".
   - Codex: the config.toml table (the docs' one `codex mcp add --url` example also passes an OAuth client id).
   - Gemini CLI: "httpUrl"; plain "url" means the older SSE transport there.
   - Cline: "type": "streamableHttp", or it falls back to SSE.
   - Goose: the YAML is put together from the field names its docs list. */
export type Editor = { id: string; name: string; kind: 'command' | 'file'; where?: string; line: (url: string, name: string) => string; docs: string };
export const EDITORS: Editor[] = [
  { id: 'claude', name: 'Claude Code', kind: 'command', line: (u, n) => `claude mcp add --transport http ${n} ${u}`, docs: 'https://code.claude.com/docs/en/mcp' },
  { id: 'cursor', name: 'Cursor', kind: 'file', where: '~/.cursor/mcp.json', line: (u, n) => `{\n  "mcpServers": {\n    "${n}": { "url": "${u}" }\n  }\n}`, docs: 'https://cursor.com/docs/context/mcp' },
  { id: 'vscode', name: 'VS Code', kind: 'file', where: '.vscode/mcp.json', line: (u, n) => `{\n  "servers": {\n    "${n}": { "type": "http", "url": "${u}" }\n  }\n}`, docs: 'https://code.visualstudio.com/docs/agents/reference/mcp-configuration' },
  { id: 'codex', name: 'Codex', kind: 'file', where: '~/.codex/config.toml', line: (u, n) => `[mcp_servers.${n}]\nurl = "${u}"`, docs: 'https://developers.openai.com/codex/mcp' },
  { id: 'gemini', name: 'Gemini CLI', kind: 'command', line: (u, n) => `gemini mcp add --transport http ${n} ${u}`, docs: 'https://geminicli.com/docs/tools/mcp-server/' },
  { id: 'zed', name: 'Zed', kind: 'file', where: 'settings.json', line: (u, n) => `"context_servers": {\n  "${n}": { "url": "${u}" }\n}`, docs: 'https://zed.dev/docs/ai/mcp' },
  { id: 'cline', name: 'Cline', kind: 'command', line: (u, n) => `cline mcp add ${n} ${u} --transport http`, docs: 'https://docs.cline.bot/mcp/connecting-to-a-remote-server' },
  { id: 'goose', name: 'Goose', kind: 'file', where: '~/.config/goose/config.yaml', line: (u, n) => `extensions:\n  ${n}:\n    name: ${n}\n    type: streamable_http\n    uri: ${u}\n    enabled: true`, docs: 'https://goose-docs.ai/docs/getting-started/using-extensions' },
];
