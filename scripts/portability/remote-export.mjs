import { createReadStream } from 'node:fs';
import { readFile, unlink, link, mkdir, mkdtemp, rmdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { main as transferClient } from '@runeditrun/rer/modules/portability/cli';
import { archiveJournal } from './archive-journal.mjs';
import { privateBytes, privateDestination, privateWrite } from '../data/private-files.mjs';
// Base owns authenticated HTTP transport, framing, verification and private files.
async function transfer(args) {
 const write = process.stdout.write;
 process.stdout.write = (_chunk, encoding, callback) => { const done = typeof encoding === 'function' ? encoding : callback; if (done) queueMicrotask(done); return true; };
 try { return await transferClient(args); } finally { process.stdout.write = write; }
}
async function remoteExport(origin, sessionFile, path) {
 if (!origin || !sessionFile || !path) throw Error('remote_credentials_required');
 const cookie = (await privateBytes(sessionFile, 8192)).toString('utf8').trim();
 if (!/^(?:__Host-operator_session|operator_session_local(?:_\d+)?)=[A-Za-z0-9_-]{20,4096}$/.test(cookie)) throw Error('invalid_native_session_file');
 path = await privateDestination(path);
 const journalPath = await privateDestination(path + '.erasure-journal.json');
 await mkdir(dirname(path), { recursive: true, mode: 0o700 });
 await privateDestination(path);
 // Base's partial file and checkpoint belong to this private invocation only.
 const staging = await mkdtemp(path + '.pending-');
 const staged = join(staging, 'archive'), stagedJournal = join(staging, 'journal.json');
 let checkpoint, cleanup = false, cleanupAttempted = false, writtenJournal = false, complete = false;
 async function cleanupSource() {
  cleanupAttempted = true;
  await transfer(['abort', '--origin', origin, '--session-file', sessionFile, '--resume', checkpoint.id]);
  cleanup = true;
  await unlink(staged + '.transfer.json');
 }
 try {
  await transfer(['export', '--origin', origin, '--session-file', sessionFile, '--out', staged]);
  const { journal, manifest, closing } = await archiveJournal(Readable.toWeb(createReadStream(staged)));
  checkpoint = JSON.parse(await readFile(staged + '.transfer.json', 'utf8'));
  await cleanupSource();
  await privateWrite(stagedJournal, journal);
  await link(stagedJournal, journalPath); writtenJournal = true;
  // Exclusive promotion never overwrites an archive created while downloading.
  await link(staged, path); complete = true;
  return { target: 'remote', output: path, journal: journalPath, contentHash: closing.contentHash, tables: manifest.tables.map(({ name, count }) => ({ name, count })), objects: manifest.objects.length };
 } finally {
  if (!cleanup) {
   checkpoint ??= await readFile(staged + '.transfer.json', 'utf8').then(JSON.parse).catch(() => null);
   if (checkpoint && !cleanupAttempted) await cleanupSource().catch(() => {});
   if (checkpoint && !cleanup) process.stderr.write(`Source cleanup was not confirmed. Preserve the private checkpoint at ${JSON.stringify(staged + '.transfer.json')} and recover this export before further data changes.\n`);
  }
  // Published paths can be replaced by another writer; never unlink them.
  if (!complete && writtenJournal) process.stderr.write(`Archive publication failed after the journal was published at ${JSON.stringify(journalPath)}. Preserve existing files and choose a fresh output path for another export.\n`);
  for (const file of [staged, staged + '.partial', stagedJournal]) await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (cleanup || !checkpoint) await rmdir(staging);
 }
}
try { console.log(JSON.stringify({ ok: true, ...await remoteExport(...process.argv.slice(2)) })); }
catch { console.error('Hosted export did not finish cleanly. Check the native owner session, origin, private output paths and source data operation; preserve existing files and the private checkpoint.'); process.exitCode = 1; }
