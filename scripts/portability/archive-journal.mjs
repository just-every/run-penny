import { readArchive, sha256 } from '@runeditrun/rer/modules/portability';
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value !== null && typeof value === 'object' ? '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}' : JSON.stringify(value);
/** Derive the sidecar from verified snapshot records, never a later live journal. */
export async function archiveJournal(source) {
 let state, manifest, closing;
 const tombstones = [];
 for await (const record of readArchive(source)) {
  if (record.kind === 'manifest') { manifest = record; if (record.product !== 'just-every/penny') throw Error('wrong_archive_product'); }
  if (record.kind === 'closing') closing = record;
  if (record.kind === 'part') for (const item of record.items) if (item.kind === 'row') {
   if (item.table === 'data_state') { if (state) throw Error('invalid_archive_state'); state = item.row; }
   if (item.table === 'data_tombstones') { if (tombstones.length >= 20000) throw Error('erasure_journal_limit'); tombstones.push(item.row); }
  }
 }
 if (!state || state.singleton !== 1 || state.phase !== 'idle' || state.lock_id !== null || !/^[a-f0-9]{32}$/.test(state.origin) || !Number.isSafeInteger(state.epoch) || state.epoch < 0) throw Error('invalid_archive_state');
 if (tombstones.some(item => !Number.isSafeInteger(item.epoch) || item.epoch <= 0 || item.epoch > state.epoch || typeof item.table_name !== 'string' || !/^[a-f0-9]{64}$/.test(item.key_hash))) throw Error('invalid_erasure_journal');
 tombstones.sort((a, b) => a.table_name.localeCompare(b.table_name) || a.key_hash.localeCompare(b.key_hash));
 const body = { version: 1, origin: state.origin, epoch: state.epoch, tombstones };
 return { journal: { ...body, sha256: await sha256(canonical(body)) }, manifest, closing };
}
