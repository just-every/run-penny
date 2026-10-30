import { readFile, writeFile } from 'node:fs/promises';
const surface = JSON.parse(await readFile(new URL('../agent-surface.json', import.meta.url), 'utf8'));
const path = new URL('../docs/AGENTS.md', import.meta.url);
const tools = surface.tools.map(tool => `| \`${tool.name}\` | \`${tool.scope}\` | ${tool.readOnly ? 'Read' : 'Write'} | ${tool.classes.join(', ')} | ${tool.clauses.join(', ')} |`).join('\n');
const text = `# Company agents in Penny

Give a company agent this installation's URL and a Business-issued scoped credential. Penny serves one shared MCP door at \`/mcp\`, with discovery, signed policy reception, native person approvals and the audit/Pause controls at \`/agents\`. Both supported protocol eras use the same registry. An agent cannot approve for a person.

The current specialist supports internal feedback triage and decision work: find records, capture source evidence, review and link it, prepare unpublished requests, assign their native owners, add private notes and tags, compare and commit internal bets, record outcome reviews, maintain product hierarchy, and save prioritization views and account context. Creating a public board changes the live portal and is classified from its real visibility. Source evidence, comments and imported wording are untrusted; they cannot change classes or give authority.

The door declares tools, policy, Pause, audit, idempotency and resources. Evidence capture and update return resource links using \`penny://evidence/{id}\`. Reading a link requires \`evidence:read\` and current native operator authority; it uses the same private evidence projection and wording history as the native reader, with an untrusted marker. A URI grants no access. Other record-resource families, events, specialist prompts and subscriptions remain incomplete or undeclared.

Business owner_id and team ids bind to current native operator ids. The real owner setup and native actor-creation lifecycle establish the product actor binding once; token email cannot move it. Business admin maps to native admin and Business editor; Business member maps to native member and has no policy-editor role. All admitted native operators currently share Penny's product access; no new field-role system is invented. A locally promoted admin gains no Business editor role. Original integration keys keep their original scope ceiling: requests:write can capture an unpublished request, while requests:read exposes the existing public projection, never the private operator reader. Sign-in sessions, device, import, connector and installation credentials keep their existing purposes.

| Tool | Scope | Effect | Possible classes | Clauses |
| --- | --- | --- | --- | --- |
${tools}

All writes require an idempotency_key. Repeating it returns one retained outcome; changed arguments conflict. Native wording edits, decision revisions and saved-view revisions retain their own current-version checks. Server summaries name the proposed target and effect. Native activity carries the agent, sponsor, preparer label, operation and real approvers in addition to the door audit. There is no invented Undo operation.

Expected refusals include unauthenticated, insufficient_scope, policy_unset, policy_unavailable, agents_paused, approval_required, consent_revoked, idempotency_conflict, revision_conflict, resource_unavailable and capability_not_declared. Missing and inaccessible record reads share resource_unavailable. Use the refusal metadata and the same-origin human approval handle; retrying cannot grant authority or approve a call.

No provider cost or spend is registered (spend.none). Declared tool executions make no payment, LLM, mail, tracker, connector or webhook call. Decision review dates still feed Penny's existing system reminder workflow; agent attribution and policy/Pause fencing of that later mail family are not declared. Native publication, outreach, destructive erasure/redaction, key/operator administration, connector management and embedded learning workflows are not yet exposed through this registry. They remain gaps in CONTRACT.md; the target surface table is broader than this declared subset.

Base retains exact outcome, approval and audit evidence. Client-scoped erasure of those stores is not yet supported. Native erasure and archive restore therefore refuse with agent_retained_evidence_requires_review once agent evidence exists, before deleting product data or displacing a bound actor. A pristine installation may restore its archive before any agent is admitted. Do not remove retained evidence or replay receipts manually. Business policy/audit/replay stores and native person bindings are installation data and stay out of portable archives.

Migrations 0100–0106 are additive: apply them with the normal migration runner before starting this version. Keep the expanded schema on source rollback, and preserve pending approvals, signed policy and outcomes. An installation without native owner-claim trust uses the shared local person policy controls; it accepts no unsigned Business documents.
`;
if (process.argv[2] === 'write') await writeFile(path, text);
else if (process.argv[2] !== 'check' || await readFile(path, 'utf8') !== text) { console.error('Agent docs are stale. Run node scripts/agent-docs.mjs write.'); process.exitCode = 1; }
else console.log('Agent docs match the declared registry.');
