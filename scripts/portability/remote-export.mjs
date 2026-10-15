import { createReadStream } from 'node:fs';
import { readFile, unlink, link } from 'node:fs/promises';
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
 const staged = path + '.pending', journalPath = path + '.erasure-journal.json';
 for (const file of [path, journalPath, staged, staged + '.partial', staged + '.transfer.json']) await privateDestination(file);
 let checkpoint, cleanup = false, writtenJournal = false, complete = false;
 try {
  await transfer(['export', '--origin', origin, '--session-file', sessionFile, '--out', staged]);
  const { journal, manifest, closing } = await archiveJournal(Readable.toWeb(createReadStream(staged)));
  checkpoint = JSON.parse(await readFile(staged + '.transfer.json', 'utf8'));
  await transfer(['abort', '--origin', origin, '--session-file', sessionFile, '--resume', checkpoint.id]);
  cleanup = true;
  await unlink(staged + '.transfer.json');
  await privateWrite(journalPath, journal); writtenJournal = true;
  // Exclusive promotion never overwrites an archive created while downloading.
  await link(staged, path); complete = true;
  return { target: 'remote', output: path, journal: journalPath, contentHash: closing.contentHash, tables: manifest.tables.map(({ name, count }) => ({ name, count })), objects: manifest.objects.length };
 } finally {
  if (!cleanup) {
   checkpoint ??= await readFile(staged + '.transfer.json', 'utf8').then(JSON.parse).catch(() => null);
   if (checkpoint) {
    try { await transfer(['abort', '--origin', origin, '--session-file', sessionFile, '--resume', checkpoint.id]); await unlink(staged + '.transfer.json'); }
    catch { process.stderr.write('Source cleanup was not confirmed. Preserve the private .pending.transfer.json checkpoint and recover this export before further data changes.\n'); }
   }
  }
  for (const file of [staged, staged + '.partial', ...(!complete && writtenJournal ? [journalPath] : [])]) await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
 }
}
try { console.log(JSON.stringify({ ok: true, ...await remoteExport(...process.argv.slice(2)) })); }
catch { console.error('Hosted export did not finish cleanly. Check the native owner session, origin, private output paths and source data operation; preserve existing files and the private checkpoint.'); process.exitCode = 1; }
