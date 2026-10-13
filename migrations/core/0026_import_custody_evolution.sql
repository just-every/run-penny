-- Additive import-kit D1 custody schema from Base 8652fba6c98349e4b5ee7e7477cde506d9b93b4a.
-- These schema exports are byte-identical to the preceding d2a7f72 adoption.
-- Existing numbered migrations and original job/plan bytes stay unchanged.

-- d1ErasureSchema
CREATE TABLE IF NOT EXISTS ik_d1_streams (id TEXT PRIMARY KEY, destination TEXT NOT NULL, namespace TEXT NOT NULL, mapping_version TEXT NOT NULL, principal_id TEXT NOT NULL, fingerprint TEXT NOT NULL, operation_key TEXT NOT NULL, total INTEGER NOT NULL, layout_hash TEXT NOT NULL, state TEXT NOT NULL, UNIQUE(destination,principal_id,operation_key));

CREATE TABLE IF NOT EXISTS ik_d1_stream_pages (stream_id TEXT NOT NULL REFERENCES ik_d1_streams(id), ordinal INTEGER NOT NULL, job_id TEXT NOT NULL UNIQUE REFERENCES ik_jobs(id), total INTEGER NOT NULL, erased_records INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(stream_id,ordinal));

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_page_delete AFTER DELETE ON ik_d1_stream_pages BEGIN UPDATE ik_d1_streams SET state='invalid' WHERE id=OLD.stream_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_page_update AFTER UPDATE OF stream_id,ordinal,job_id,total ON ik_d1_stream_pages BEGIN UPDATE ik_d1_streams SET state='invalid' WHERE id=OLD.stream_id OR id=NEW.stream_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_page_insert AFTER INSERT ON ik_d1_stream_pages BEGIN UPDATE ik_d1_streams SET state='invalid' WHERE id=NEW.stream_id; END;

CREATE TABLE IF NOT EXISTS ik_d1_erased_sources (destination TEXT NOT NULL, identity TEXT NOT NULL, PRIMARY KEY(destination,identity));

CREATE TABLE IF NOT EXISTS ik_d1_erased_targets (destination TEXT NOT NULL, identity TEXT NOT NULL, PRIMARY KEY(destination,identity));

CREATE TABLE IF NOT EXISTS ik_d1_indexed_jobs (job_id TEXT PRIMARY KEY REFERENCES ik_jobs(id), fingerprint TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS ik_d1_plan_index (job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, source_identity TEXT NOT NULL, target_identity TEXT NOT NULL, PRIMARY KEY(job_id,ordinal,target_identity));

CREATE INDEX IF NOT EXISTS ik_d1_plan_index_source ON ik_d1_plan_index(source_identity,job_id);

CREATE INDEX IF NOT EXISTS ik_d1_plan_index_target ON ik_d1_plan_index(target_identity,job_id);

CREATE TRIGGER IF NOT EXISTS ik_d1_plan_index_insert AFTER INSERT ON ik_d1_plan_index BEGIN DELETE FROM ik_d1_indexed_jobs WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_plan_index_delete AFTER DELETE ON ik_d1_plan_index BEGIN DELETE FROM ik_d1_indexed_jobs WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_plan_index_update AFTER UPDATE ON ik_d1_plan_index BEGIN DELETE FROM ik_d1_indexed_jobs WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

-- d1StreamOriginSchema
CREATE TABLE IF NOT EXISTS ik_d1_stream_origins (job_id TEXT PRIMARY KEY,stream_id TEXT NOT NULL,ordinal INTEGER NOT NULL,page_total INTEGER NOT NULL,job_operation_key TEXT NOT NULL,parent_destination TEXT NOT NULL,parent_namespace TEXT NOT NULL,parent_mapping_version TEXT NOT NULL,parent_principal_id TEXT NOT NULL,parent_fingerprint TEXT NOT NULL,parent_operation_key TEXT NOT NULL,parent_total INTEGER NOT NULL,parent_layout_hash TEXT NOT NULL);

CREATE INDEX IF NOT EXISTS ik_d1_stream_origin_parent ON ik_d1_stream_origins(stream_id,ordinal);

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_origin_insert BEFORE INSERT ON ik_d1_stream_origins WHEN EXISTS(SELECT 1 FROM ik_d1_stream_origins WHERE job_id=NEW.job_id) OR NOT EXISTS(SELECT 1 FROM ik_d1_stream_pages p JOIN ik_d1_streams s ON s.id=p.stream_id JOIN ik_jobs j ON j.id=p.job_id WHERE ((((NEW.job_id IS p.job_id AND NEW.stream_id IS s.id) AND (NEW.ordinal IS p.ordinal AND NEW.page_total IS p.total)) AND ((NEW.job_operation_key IS j.operation_key AND NEW.parent_destination IS s.destination) AND (NEW.parent_namespace IS s.namespace AND (NEW.parent_mapping_version IS s.mapping_version AND NEW.parent_principal_id IS s.principal_id)))) AND (((NEW.parent_fingerprint IS s.fingerprint AND NEW.parent_operation_key IS s.operation_key) AND (NEW.parent_total IS s.total AND (NEW.parent_layout_hash IS s.layout_hash AND p.stream_id IS s.id))) AND ((j.total IS p.total AND j.destination IS s.destination) AND (j.namespace IS s.namespace AND (j.mapping_version IS s.mapping_version AND j.principal_id IS s.principal_id)))))) BEGIN SELECT RAISE(ABORT,'IMPORT_STREAM_ORIGIN_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_origin_update BEFORE UPDATE ON ik_d1_stream_origins BEGIN SELECT RAISE(ABORT,'IMPORT_STREAM_ORIGIN_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_origin_delete BEFORE DELETE ON ik_d1_stream_origins WHEN EXISTS(SELECT 1 FROM ik_jobs WHERE id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_STREAM_ORIGIN_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_origin_job_delete AFTER DELETE ON ik_jobs BEGIN DELETE FROM ik_d1_stream_origins WHERE job_id=OLD.id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_origin_page_insert AFTER INSERT ON ik_d1_stream_pages BEGIN INSERT INTO ik_d1_stream_origins(job_id,stream_id,ordinal,page_total,job_operation_key,parent_destination,parent_namespace,parent_mapping_version,parent_principal_id,parent_fingerprint,parent_operation_key,parent_total,parent_layout_hash) SELECT p.job_id,s.id,p.ordinal,p.total,j.operation_key,s.destination,s.namespace,s.mapping_version,s.principal_id,s.fingerprint,s.operation_key,s.total,s.layout_hash FROM ik_d1_stream_pages p JOIN ik_d1_streams s ON s.id=p.stream_id JOIN ik_jobs j ON j.id=p.job_id WHERE NOT EXISTS(SELECT 1 FROM ik_d1_stream_origins o WHERE o.job_id=p.job_id) AND j.total IS p.total AND j.destination IS s.destination AND j.namespace IS s.namespace AND j.mapping_version IS s.mapping_version AND j.principal_id IS s.principal_id AND p.job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_origin_page_update AFTER UPDATE OF stream_id,ordinal,job_id,total ON ik_d1_stream_pages BEGIN INSERT INTO ik_d1_stream_origins(job_id,stream_id,ordinal,page_total,job_operation_key,parent_destination,parent_namespace,parent_mapping_version,parent_principal_id,parent_fingerprint,parent_operation_key,parent_total,parent_layout_hash) SELECT p.job_id,s.id,p.ordinal,p.total,j.operation_key,s.destination,s.namespace,s.mapping_version,s.principal_id,s.fingerprint,s.operation_key,s.total,s.layout_hash FROM ik_d1_stream_pages p JOIN ik_d1_streams s ON s.id=p.stream_id JOIN ik_jobs j ON j.id=p.job_id WHERE NOT EXISTS(SELECT 1 FROM ik_d1_stream_origins o WHERE o.job_id=p.job_id) AND j.total IS p.total AND j.destination IS s.destination AND j.namespace IS s.namespace AND j.mapping_version IS s.mapping_version AND j.principal_id IS s.principal_id AND p.job_id=NEW.job_id; END;

INSERT INTO ik_d1_stream_origins(job_id,stream_id,ordinal,page_total,job_operation_key,parent_destination,parent_namespace,parent_mapping_version,parent_principal_id,parent_fingerprint,parent_operation_key,parent_total,parent_layout_hash) SELECT p.job_id,s.id,p.ordinal,p.total,j.operation_key,s.destination,s.namespace,s.mapping_version,s.principal_id,s.fingerprint,s.operation_key,s.total,s.layout_hash FROM ik_d1_stream_pages p JOIN ik_d1_streams s ON s.id=p.stream_id JOIN ik_jobs j ON j.id=p.job_id WHERE NOT EXISTS(SELECT 1 FROM ik_d1_stream_origins o WHERE o.job_id=p.job_id) AND j.total IS p.total AND j.destination IS s.destination AND j.namespace IS s.namespace AND j.mapping_version IS s.mapping_version AND j.principal_id IS s.principal_id;

CREATE TABLE IF NOT EXISTS ik_d1_stream_revisions(stream_id TEXT PRIMARY KEY,destination TEXT NOT NULL,namespace TEXT NOT NULL,mapping_version TEXT NOT NULL,principal_id TEXT NOT NULL,fingerprint TEXT NOT NULL,operation_key TEXT NOT NULL,total INTEGER NOT NULL,layout_hash TEXT NOT NULL,layout_revision INTEGER NOT NULL DEFAULT 0 CHECK(typeof(layout_revision)='integer' AND layout_revision>=0),progress_revision INTEGER NOT NULL DEFAULT 0 CHECK(typeof(progress_revision)='integer' AND progress_revision>=0));

INSERT INTO ik_d1_stream_revisions(stream_id,destination,namespace,mapping_version,principal_id,fingerprint,operation_key,total,layout_hash) SELECT id,destination,namespace,mapping_version,principal_id,fingerprint,operation_key,total,layout_hash FROM ik_d1_streams WHERE NOT EXISTS(SELECT 1 FROM ik_d1_stream_revisions WHERE stream_id=ik_d1_streams.id);

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_insert BEFORE INSERT ON ik_d1_stream_revisions WHEN EXISTS(SELECT 1 FROM ik_d1_stream_revisions WHERE stream_id=NEW.stream_id) BEGIN SELECT RAISE(ABORT,'IMPORT_STREAM_REVISION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_update BEFORE UPDATE ON ik_d1_stream_revisions WHEN NEW.stream_id IS NOT OLD.stream_id OR NEW.destination IS NOT OLD.destination OR NEW.namespace IS NOT OLD.namespace OR NEW.mapping_version IS NOT OLD.mapping_version OR NEW.principal_id IS NOT OLD.principal_id OR NEW.fingerprint IS NOT OLD.fingerprint OR NEW.operation_key IS NOT OLD.operation_key OR NEW.total IS NOT OLD.total OR NEW.layout_hash IS NOT OLD.layout_hash OR NEW.layout_revision<OLD.layout_revision OR NEW.progress_revision<=OLD.progress_revision BEGIN SELECT RAISE(ABORT,'IMPORT_STREAM_REVISION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_delete BEFORE DELETE ON ik_d1_stream_revisions BEGIN SELECT RAISE(ABORT,'IMPORT_STREAM_REVISION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_parent_insert AFTER INSERT ON ik_d1_streams BEGIN INSERT INTO ik_d1_stream_revisions(stream_id,destination,namespace,mapping_version,principal_id,fingerprint,operation_key,total,layout_hash) SELECT NEW.id,NEW.destination,NEW.namespace,NEW.mapping_version,NEW.principal_id,NEW.fingerprint,NEW.operation_key,NEW.total,NEW.layout_hash WHERE NOT EXISTS(SELECT 1 FROM ik_d1_stream_revisions WHERE stream_id=NEW.id); UPDATE ik_d1_stream_revisions SET layout_revision=layout_revision+1,progress_revision=progress_revision+1 WHERE stream_id=NEW.id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_parent_delete AFTER DELETE ON ik_d1_streams BEGIN UPDATE ik_d1_stream_revisions SET layout_revision=layout_revision+1,progress_revision=progress_revision+1 WHERE stream_id=OLD.id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_parent_update AFTER UPDATE ON ik_d1_streams BEGIN UPDATE ik_d1_stream_revisions SET progress_revision=progress_revision+1 WHERE stream_id=OLD.id OR stream_id=NEW.id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_parent_layout AFTER UPDATE OF id,destination,namespace,mapping_version,principal_id,fingerprint,operation_key,total,layout_hash ON ik_d1_streams BEGIN UPDATE ik_d1_stream_revisions SET layout_revision=layout_revision+1,progress_revision=progress_revision+1 WHERE stream_id=OLD.id OR stream_id=NEW.id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_ik_d1_stream_pages_insert AFTER INSERT ON ik_d1_stream_pages BEGIN UPDATE ik_d1_stream_revisions SET layout_revision=layout_revision+1,progress_revision=progress_revision+1 WHERE stream_id=NEW.stream_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_ik_d1_stream_pages_update AFTER UPDATE OF stream_id,ordinal,job_id,total ON ik_d1_stream_pages BEGIN UPDATE ik_d1_stream_revisions SET layout_revision=layout_revision+1,progress_revision=progress_revision+1 WHERE stream_id=OLD.stream_id OR stream_id=NEW.stream_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_ik_d1_stream_pages_delete AFTER DELETE ON ik_d1_stream_pages BEGIN UPDATE ik_d1_stream_revisions SET layout_revision=layout_revision+1,progress_revision=progress_revision+1 WHERE stream_id=OLD.stream_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_ik_d1_stream_origins_insert AFTER INSERT ON ik_d1_stream_origins BEGIN UPDATE ik_d1_stream_revisions SET layout_revision=layout_revision+1,progress_revision=progress_revision+1 WHERE stream_id=NEW.stream_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_ik_d1_stream_origins_update AFTER UPDATE ON ik_d1_stream_origins BEGIN UPDATE ik_d1_stream_revisions SET layout_revision=layout_revision+1,progress_revision=progress_revision+1 WHERE stream_id=OLD.stream_id OR stream_id=NEW.stream_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_ik_d1_stream_origins_delete AFTER DELETE ON ik_d1_stream_origins BEGIN UPDATE ik_d1_stream_revisions SET layout_revision=layout_revision+1,progress_revision=progress_revision+1 WHERE stream_id=OLD.stream_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_page_erasure AFTER UPDATE OF erased_records ON ik_d1_stream_pages BEGIN UPDATE ik_d1_stream_revisions SET progress_revision=progress_revision+1 WHERE stream_id=OLD.stream_id OR stream_id=NEW.stream_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_job_insert AFTER INSERT ON ik_jobs BEGIN UPDATE ik_d1_stream_revisions SET layout_revision=layout_revision+1,progress_revision=progress_revision+1 WHERE stream_id IN (SELECT stream_id FROM ik_d1_stream_pages WHERE job_id=NEW.id UNION SELECT stream_id FROM ik_d1_stream_origins WHERE job_id=NEW.id); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_job_update AFTER UPDATE ON ik_jobs BEGIN UPDATE ik_d1_stream_revisions SET progress_revision=progress_revision+1 WHERE stream_id IN (SELECT stream_id FROM ik_d1_stream_pages WHERE job_id=OLD.id OR job_id=NEW.id UNION SELECT stream_id FROM ik_d1_stream_origins WHERE job_id=OLD.id OR job_id=NEW.id); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_job_delete AFTER DELETE ON ik_jobs BEGIN UPDATE ik_d1_stream_revisions SET layout_revision=layout_revision+1,progress_revision=progress_revision+1 WHERE stream_id IN (SELECT stream_id FROM ik_d1_stream_pages WHERE job_id=OLD.id UNION SELECT stream_id FROM ik_d1_stream_origins WHERE job_id=OLD.id); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_stream_revision_job_layout AFTER UPDATE OF id,destination,namespace,mapping_version,principal_id,fingerprint,operation_key,total,reversal_policy,reversal_policy_hash ON ik_jobs BEGIN UPDATE ik_d1_stream_revisions SET layout_revision=layout_revision+1,progress_revision=progress_revision+1 WHERE stream_id IN (SELECT stream_id FROM ik_d1_stream_pages WHERE job_id=OLD.id OR job_id=NEW.id UNION SELECT stream_id FROM ik_d1_stream_origins WHERE job_id=OLD.id OR job_id=NEW.id); END;

-- d1LegacyStreamReceiptUpgrade
INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ik_jobs legacy WHERE (EXISTS(SELECT 1 FROM ik_original_sets os WHERE os.job_id=legacy.id AND os.version=4) OR EXISTS(SELECT 1 FROM ik_d1_stream_origins oo WHERE oo.job_id=legacy.id) OR EXISTS(SELECT 1 FROM ik_d1_stream_pages op WHERE op.job_id=legacy.id)) AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_origins o JOIN ik_d1_stream_pages p ON p.job_id=o.job_id JOIN ik_d1_streams s ON s.id=o.stream_id JOIN ik_jobs j ON j.id=o.job_id WHERE o.job_id=legacy.id AND ((((o.job_id IS p.job_id AND o.stream_id IS s.id) AND (o.ordinal IS p.ordinal AND o.page_total IS p.total)) AND ((o.job_operation_key IS j.operation_key AND o.parent_destination IS s.destination) AND (o.parent_namespace IS s.namespace AND (o.parent_mapping_version IS s.mapping_version AND o.parent_principal_id IS s.principal_id)))) AND (((o.parent_fingerprint IS s.fingerprint AND o.parent_operation_key IS s.operation_key) AND (o.parent_total IS s.total AND (o.parent_layout_hash IS s.layout_hash AND p.stream_id IS s.id))) AND ((j.total IS p.total AND j.destination IS s.destination) AND (j.namespace IS s.namespace AND (j.mapping_version IS s.mapping_version AND j.principal_id IS s.principal_id))))) AND s.state IN ('applying','undoing') AND EXISTS(SELECT 1 FROM ik_d1_stream_revisions sr WHERE sr.stream_id=s.id AND s.destination IS sr.destination AND s.namespace IS sr.namespace AND s.mapping_version IS sr.mapping_version AND s.principal_id IS sr.principal_id AND s.fingerprint IS sr.fingerprint AND s.operation_key IS sr.operation_key AND s.total IS sr.total AND s.layout_hash IS sr.layout_hash) AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_pages op WHERE op.stream_id=s.id AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_origins oo JOIN ik_jobs oj ON oj.id=oo.job_id WHERE ((((oo.job_id IS op.job_id AND oo.stream_id IS s.id) AND (oo.ordinal IS op.ordinal AND oo.page_total IS op.total)) AND ((oo.job_operation_key IS oj.operation_key AND oo.parent_destination IS s.destination) AND (oo.parent_namespace IS s.namespace AND (oo.parent_mapping_version IS s.mapping_version AND oo.parent_principal_id IS s.principal_id)))) AND (((oo.parent_fingerprint IS s.fingerprint AND oo.parent_operation_key IS s.operation_key) AND (oo.parent_total IS s.total AND (oo.parent_layout_hash IS s.layout_hash AND op.stream_id IS s.id))) AND ((oj.total IS op.total AND oj.destination IS s.destination) AND (oj.namespace IS s.namespace AND (oj.mapping_version IS s.mapping_version AND oj.principal_id IS s.principal_id))))))) AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_origins oo WHERE oo.stream_id=s.id AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_pages op JOIN ik_jobs oj ON oj.id=op.job_id WHERE ((((oo.job_id IS op.job_id AND oo.stream_id IS s.id) AND (oo.ordinal IS op.ordinal AND oo.page_total IS op.total)) AND ((oo.job_operation_key IS oj.operation_key AND oo.parent_destination IS s.destination) AND (oo.parent_namespace IS s.namespace AND (oo.parent_mapping_version IS s.mapping_version AND oo.parent_principal_id IS s.principal_id)))) AND (((oo.parent_fingerprint IS s.fingerprint AND oo.parent_operation_key IS s.operation_key) AND (oo.parent_total IS s.total AND (oo.parent_layout_hash IS s.layout_hash AND op.stream_id IS s.id))) AND ((oj.total IS op.total AND oj.destination IS s.destination) AND (oj.namespace IS s.namespace AND (oj.mapping_version IS s.mapping_version AND oj.principal_id IS s.principal_id))))))))) THEN 1 ELSE 0 END;

UPDATE ik_original_sets SET version=4 WHERE version=3 AND job_id IN (SELECT job_id FROM ik_d1_stream_pages);

DELETE FROM ik_d1_assertions;

-- d1StagingSchema
CREATE TABLE IF NOT EXISTS ik_d1_publication_fences (stream_id TEXT NOT NULL,job_id TEXT PRIMARY KEY);

CREATE INDEX IF NOT EXISTS ik_d1_publication_fence_stream ON ik_d1_publication_fences(stream_id);

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_jobs_insert BEFORE INSERT ON ik_jobs WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_jobs_update BEFORE UPDATE ON ik_jobs WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.id OR job_id=NEW.id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_jobs_delete BEFORE DELETE ON ik_jobs WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_streams_insert BEFORE INSERT ON ik_d1_streams WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE stream_id=NEW.id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_streams_update BEFORE UPDATE ON ik_d1_streams WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE stream_id=OLD.id OR stream_id=NEW.id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_streams_delete BEFORE DELETE ON ik_d1_streams WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE stream_id=OLD.id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_plan_chunks_insert BEFORE INSERT ON ik_d1_plan_chunks WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_plan_chunks_update BEFORE UPDATE ON ik_d1_plan_chunks WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_plan_chunks_delete BEFORE DELETE ON ik_d1_plan_chunks WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_plan_index_insert BEFORE INSERT ON ik_d1_plan_index WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_plan_index_update BEFORE UPDATE ON ik_d1_plan_index WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_plan_index_delete BEFORE DELETE ON ik_d1_plan_index WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_originals_insert BEFORE INSERT ON ik_originals WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_originals_update BEFORE UPDATE ON ik_originals WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_originals_delete BEFORE DELETE ON ik_originals WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_original_chunks_insert BEFORE INSERT ON ik_d1_original_chunks WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_original_chunks_update BEFORE UPDATE ON ik_d1_original_chunks WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_original_chunks_delete BEFORE DELETE ON ik_d1_original_chunks WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_original_sets_insert BEFORE INSERT ON ik_original_sets WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_original_sets_update BEFORE UPDATE ON ik_original_sets WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_original_sets_delete BEFORE DELETE ON ik_original_sets WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_indexed_jobs_insert BEFORE INSERT ON ik_d1_indexed_jobs WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_indexed_jobs_update BEFORE UPDATE ON ik_d1_indexed_jobs WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_indexed_jobs_delete BEFORE DELETE ON ik_d1_indexed_jobs WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_reversal_reports_insert BEFORE INSERT ON ik_d1_reversal_reports WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_reversal_reports_update BEFORE UPDATE ON ik_d1_reversal_reports WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_reversal_reports_delete BEFORE DELETE ON ik_d1_reversal_reports WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_provenance_insert BEFORE INSERT ON ik_provenance WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_provenance_update BEFORE UPDATE ON ik_provenance WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_provenance_delete BEFORE DELETE ON ik_provenance WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_sources_insert BEFORE INSERT ON ik_sources WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_sources_update BEFORE UPDATE ON ik_sources WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_sources_delete BEFORE DELETE ON ik_sources WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_entries_insert BEFORE INSERT ON ik_d1_entries WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_entries_update BEFORE UPDATE ON ik_d1_entries WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_entries_delete BEFORE DELETE ON ik_d1_entries WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_history_insert BEFORE INSERT ON ik_d1_history WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_history_update BEFORE UPDATE ON ik_d1_history WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_history_delete BEFORE DELETE ON ik_d1_history WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_batches_insert BEFORE INSERT ON ik_batches WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_batches_update BEFORE UPDATE ON ik_batches WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_batches_delete BEFORE DELETE ON ik_batches WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_stream_pages_insert BEFORE INSERT ON ik_d1_stream_pages WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE stream_id=NEW.stream_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_stream_pages_update BEFORE UPDATE ON ik_d1_stream_pages WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE stream_id=OLD.stream_id OR stream_id=NEW.stream_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_ik_d1_stream_pages_delete BEFORE DELETE ON ik_d1_stream_pages WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE stream_id=OLD.stream_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_parent_update BEFORE UPDATE ON ik_d1_streams WHEN EXISTS(SELECT 1 FROM ik_d1_stream_pages p JOIN ik_d1_publication_fences f ON f.job_id=p.job_id WHERE p.stream_id=OLD.id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_parent_delete BEFORE DELETE ON ik_d1_streams WHEN EXISTS(SELECT 1 FROM ik_d1_stream_pages p JOIN ik_d1_publication_fences f ON f.job_id=p.job_id WHERE p.stream_id=OLD.id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_child_page_insert BEFORE INSERT ON ik_d1_stream_pages WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_child_page_update BEFORE UPDATE ON ik_d1_stream_pages WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id OR job_id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_publication_child_page_delete BEFORE DELETE ON ik_d1_stream_pages WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TABLE IF NOT EXISTS ik_d1_staging (id TEXT PRIMARY KEY, generation TEXT NOT NULL, destination TEXT NOT NULL, namespace TEXT NOT NULL, mapping_version TEXT NOT NULL, principal_id TEXT NOT NULL, fingerprint TEXT NOT NULL, operation_key TEXT NOT NULL, total INTEGER NOT NULL, pages INTEGER NOT NULL, layout_hash TEXT NOT NULL, reversal_policy TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, registered_revision INTEGER, sealed_revision INTEGER, UNIQUE(destination,principal_id,operation_key));

CREATE TABLE IF NOT EXISTS ik_d1_staging_pages (stage_id TEXT NOT NULL REFERENCES ik_d1_staging(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL, job_id TEXT NOT NULL UNIQUE, total INTEGER NOT NULL, fingerprint TEXT NOT NULL, plan_json TEXT NOT NULL, body_hash TEXT NOT NULL, body_size INTEGER NOT NULL, chunks INTEGER NOT NULL, identities INTEGER NOT NULL, index_hash TEXT NOT NULL, policy_hash TEXT NOT NULL, inline_plan INTEGER NOT NULL CHECK(inline_plan IN (0,1)), PRIMARY KEY(stage_id,ordinal));

CREATE TABLE IF NOT EXISTS ik_d1_staging_chunks (stage_id TEXT NOT NULL REFERENCES ik_d1_staging(id) ON DELETE CASCADE, page_ordinal INTEGER NOT NULL, ordinal INTEGER NOT NULL, body TEXT NOT NULL, body_hash TEXT NOT NULL, body_size INTEGER NOT NULL, PRIMARY KEY(stage_id,page_ordinal,ordinal));

CREATE TABLE IF NOT EXISTS ik_d1_staging_index (stage_id TEXT NOT NULL REFERENCES ik_d1_staging(id) ON DELETE CASCADE, page_ordinal INTEGER NOT NULL, ordinal INTEGER NOT NULL, source_identity TEXT NOT NULL, target_identity TEXT NOT NULL, PRIMARY KEY(stage_id,page_ordinal,ordinal,target_identity));

CREATE INDEX IF NOT EXISTS ik_d1_staging_source ON ik_d1_staging_index(source_identity,stage_id);

CREATE INDEX IF NOT EXISTS ik_d1_staging_target ON ik_d1_staging_index(target_identity,stage_id);

CREATE TABLE IF NOT EXISTS ik_d1_staging_originals (stage_id TEXT NOT NULL REFERENCES ik_d1_staging(id) ON DELETE CASCADE, original_key TEXT NOT NULL, name TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, PRIMARY KEY(stage_id,original_key));

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_binding BEFORE UPDATE OF id,generation,destination,namespace,mapping_version,principal_id,fingerprint,operation_key,total,pages,layout_hash,reversal_policy ON ik_d1_staging BEGIN SELECT RAISE(ABORT,'IMPORT_STAGE_BINDING_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_pages_insert AFTER INSERT ON ik_d1_staging_pages BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL,registered_revision=NULL WHERE id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_pages_update AFTER UPDATE ON ik_d1_staging_pages BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL,registered_revision=NULL WHERE id=OLD.stage_id OR id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_pages_delete AFTER DELETE ON ik_d1_staging_pages BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL,registered_revision=NULL WHERE id=OLD.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_index_insert AFTER INSERT ON ik_d1_staging_index BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL,registered_revision=NULL WHERE id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_index_update AFTER UPDATE ON ik_d1_staging_index BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL,registered_revision=NULL WHERE id=OLD.stage_id OR id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_index_delete AFTER DELETE ON ik_d1_staging_index BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL,registered_revision=NULL WHERE id=OLD.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_chunks_insert AFTER INSERT ON ik_d1_staging_chunks BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL WHERE id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_chunks_update AFTER UPDATE ON ik_d1_staging_chunks BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL WHERE id=OLD.stage_id OR id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_chunks_delete AFTER DELETE ON ik_d1_staging_chunks BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL WHERE id=OLD.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_originals_insert AFTER INSERT ON ik_d1_staging_originals BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL WHERE id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_originals_update AFTER UPDATE ON ik_d1_staging_originals BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL WHERE id=OLD.stage_id OR id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_originals_delete AFTER DELETE ON ik_d1_staging_originals BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL WHERE id=OLD.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_index_custody_insert AFTER INSERT ON ik_d1_staging_index WHEN EXISTS(SELECT 1 FROM ik_d1_staging_chunks WHERE stage_id=NEW.stage_id) OR EXISTS(SELECT 1 FROM ik_d1_staging_originals WHERE stage_id=NEW.stage_id) BEGIN DELETE FROM ik_d1_staging_chunks WHERE stage_id=NEW.stage_id; DELETE FROM ik_d1_staging_originals WHERE stage_id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_index_custody_update AFTER UPDATE ON ik_d1_staging_index WHEN EXISTS(SELECT 1 FROM ik_d1_staging_chunks WHERE stage_id=OLD.stage_id OR stage_id=NEW.stage_id) OR EXISTS(SELECT 1 FROM ik_d1_staging_originals WHERE stage_id=OLD.stage_id OR stage_id=NEW.stage_id) BEGIN DELETE FROM ik_d1_staging_chunks WHERE stage_id=OLD.stage_id OR stage_id=NEW.stage_id; DELETE FROM ik_d1_staging_originals WHERE stage_id=OLD.stage_id OR stage_id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_index_custody_delete AFTER DELETE ON ik_d1_staging_index WHEN EXISTS(SELECT 1 FROM ik_d1_staging_chunks WHERE stage_id=OLD.stage_id) OR EXISTS(SELECT 1 FROM ik_d1_staging_originals WHERE stage_id=OLD.stage_id) BEGIN DELETE FROM ik_d1_staging_chunks WHERE stage_id=OLD.stage_id; DELETE FROM ik_d1_staging_originals WHERE stage_id=OLD.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_chunks_registered BEFORE INSERT ON ik_d1_staging_chunks WHEN NOT EXISTS(SELECT 1 FROM ik_d1_staging WHERE id=NEW.stage_id AND registered_revision IS NOT NULL) BEGIN SELECT RAISE(ABORT,'IMPORT_STAGE_INDEX_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_originals_registered BEFORE INSERT ON ik_d1_staging_originals WHEN NOT EXISTS(SELECT 1 FROM ik_d1_staging WHERE id=NEW.stage_id AND registered_revision IS NOT NULL) BEGIN SELECT RAISE(ABORT,'IMPORT_STAGE_INDEX_REQUIRED'); END;

-- d1NativeStagingSchema
CREATE TABLE IF NOT EXISTS ik_d1_custody_revisions (job_id TEXT PRIMARY KEY REFERENCES ik_jobs(id) ON DELETE CASCADE,revision INTEGER NOT NULL DEFAULT 0,seal TEXT);

INSERT OR IGNORE INTO ik_d1_custody_revisions(job_id) SELECT id FROM ik_jobs;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_receipt_revision AFTER UPDATE OF revision ON ik_d1_custody_revisions BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_receipt_insert BEFORE INSERT ON ik_d1_custody_revisions WHEN NEW.seal IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id AND stream_id=NEW.seal) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_RECEIPT_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_receipt_seal BEFORE UPDATE OF seal ON ik_d1_custody_revisions WHEN NEW.seal IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ik_d1_publication_fences WHERE job_id=NEW.job_id AND stream_id=NEW.seal) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_RECEIPT_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_jobs_insert AFTER INSERT ON ik_jobs BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_jobs_update AFTER UPDATE ON ik_jobs BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.id OR job_id=NEW.id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_jobs_delete AFTER DELETE ON ik_jobs BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_plan_chunks_insert AFTER INSERT ON ik_d1_plan_chunks BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_plan_chunks_update AFTER UPDATE ON ik_d1_plan_chunks BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_plan_chunks_delete AFTER DELETE ON ik_d1_plan_chunks BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_plan_index_insert AFTER INSERT ON ik_d1_plan_index BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_plan_index_update AFTER UPDATE ON ik_d1_plan_index BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_plan_index_delete AFTER DELETE ON ik_d1_plan_index BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_originals_insert AFTER INSERT ON ik_originals BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_originals_update AFTER UPDATE ON ik_originals BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_originals_delete AFTER DELETE ON ik_originals BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_original_chunks_insert AFTER INSERT ON ik_d1_original_chunks BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_original_chunks_update AFTER UPDATE ON ik_d1_original_chunks BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_original_chunks_delete AFTER DELETE ON ik_d1_original_chunks BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_original_sets_insert AFTER INSERT ON ik_original_sets BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_original_sets_update AFTER UPDATE ON ik_original_sets BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_original_sets_delete AFTER DELETE ON ik_original_sets BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_indexed_jobs_insert AFTER INSERT ON ik_d1_indexed_jobs BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_indexed_jobs_update AFTER UPDATE ON ik_d1_indexed_jobs BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_indexed_jobs_delete AFTER DELETE ON ik_d1_indexed_jobs BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_reversal_reports_insert AFTER INSERT ON ik_d1_reversal_reports BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_reversal_reports_update AFTER UPDATE ON ik_d1_reversal_reports BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_reversal_reports_delete AFTER DELETE ON ik_d1_reversal_reports BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_provenance_insert AFTER INSERT ON ik_provenance BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_provenance_update AFTER UPDATE ON ik_provenance BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_provenance_delete AFTER DELETE ON ik_provenance BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_sources_insert AFTER INSERT ON ik_sources BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_sources_update AFTER UPDATE ON ik_sources BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_sources_delete AFTER DELETE ON ik_sources BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_entries_insert AFTER INSERT ON ik_d1_entries BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_entries_update AFTER UPDATE ON ik_d1_entries BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_entries_delete AFTER DELETE ON ik_d1_entries BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_history_insert AFTER INSERT ON ik_d1_history BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_history_update AFTER UPDATE ON ik_d1_history BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_d1_history_delete AFTER DELETE ON ik_d1_history BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_batches_insert AFTER INSERT ON ik_batches BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_batches_update AFTER UPDATE ON ik_batches BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_ik_batches_delete AFTER DELETE ON ik_batches BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_pages_insert AFTER INSERT ON ik_d1_stream_pages BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_pages_update AFTER UPDATE ON ik_d1_stream_pages BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_pages_delete AFTER DELETE ON ik_d1_stream_pages BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_stream_update BEFORE UPDATE ON ik_d1_streams BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=OLD.id); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_receipt_stream_delete BEFORE DELETE ON ik_d1_streams BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=OLD.id); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_job_insert AFTER INSERT ON ik_jobs BEGIN INSERT INTO ik_d1_custody_revisions(job_id) VALUES(NEW.id); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_job_update AFTER UPDATE OF plan_json ON ik_jobs BEGIN UPDATE ik_d1_custody_revisions SET revision=revision+1 WHERE job_id=OLD.id OR job_id=NEW.id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_chunks_insert AFTER INSERT ON ik_d1_plan_chunks BEGIN UPDATE ik_d1_custody_revisions SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_chunks_update AFTER UPDATE ON ik_d1_plan_chunks BEGIN UPDATE ik_d1_custody_revisions SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_chunks_delete AFTER DELETE ON ik_d1_plan_chunks BEGIN UPDATE ik_d1_custody_revisions SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TABLE IF NOT EXISTS ik_d1_native_staging (id TEXT PRIMARY KEY,generation TEXT NOT NULL,destination TEXT NOT NULL,namespace TEXT NOT NULL,mapping_version TEXT NOT NULL,principal_id TEXT NOT NULL,job_id TEXT NOT NULL REFERENCES ik_jobs(id) ON DELETE CASCADE,fingerprint TEXT NOT NULL,job_fence INTEGER NOT NULL,action TEXT NOT NULL,values_count INTEGER NOT NULL,chunks_count INTEGER NOT NULL,identities INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 0,registered_revision INTEGER,sealed_revision INTEGER,UNIQUE(destination,principal_id,job_id,action));

CREATE TABLE IF NOT EXISTS ik_d1_native_staging_index (stage_id TEXT NOT NULL REFERENCES ik_d1_native_staging(id) ON DELETE CASCADE,ordinal INTEGER NOT NULL,source_identity TEXT NOT NULL,target_identity TEXT NOT NULL,PRIMARY KEY(stage_id,ordinal,target_identity));

CREATE INDEX IF NOT EXISTS ik_d1_native_staging_source ON ik_d1_native_staging_index(source_identity,stage_id);

CREATE INDEX IF NOT EXISTS ik_d1_native_staging_target ON ik_d1_native_staging_index(target_identity,stage_id);

CREATE TABLE IF NOT EXISTS ik_d1_native_staging_values (stage_id TEXT NOT NULL REFERENCES ik_d1_native_staging(id) ON DELETE CASCADE,value_ordinal INTEGER NOT NULL,ordinal INTEGER NOT NULL,body TEXT NOT NULL,body_hash TEXT NOT NULL,body_size INTEGER NOT NULL,value_chunks INTEGER NOT NULL,PRIMARY KEY(stage_id,value_ordinal,ordinal));

CREATE TRIGGER IF NOT EXISTS ik_d1_native_staging_binding BEFORE UPDATE OF id,generation,destination,namespace,mapping_version,principal_id,job_id,fingerprint,job_fence,action,values_count,chunks_count,identities ON ik_d1_native_staging BEGIN SELECT RAISE(ABORT,'IMPORT_NATIVE_STAGE_BINDING_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_native_staging_index_insert AFTER INSERT ON ik_d1_native_staging_index BEGIN UPDATE ik_d1_native_staging SET revision=revision+1,sealed_revision=NULL,registered_revision=NULL WHERE id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_native_staging_index_update AFTER UPDATE ON ik_d1_native_staging_index BEGIN UPDATE ik_d1_native_staging SET revision=revision+1,sealed_revision=NULL,registered_revision=NULL WHERE id=OLD.stage_id OR id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_native_staging_index_delete AFTER DELETE ON ik_d1_native_staging_index BEGIN UPDATE ik_d1_native_staging SET revision=revision+1,sealed_revision=NULL,registered_revision=NULL WHERE id=OLD.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_native_staging_values_insert AFTER INSERT ON ik_d1_native_staging_values BEGIN UPDATE ik_d1_native_staging SET revision=revision+1,sealed_revision=NULL WHERE id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_native_staging_values_update AFTER UPDATE ON ik_d1_native_staging_values BEGIN UPDATE ik_d1_native_staging SET revision=revision+1,sealed_revision=NULL WHERE id=OLD.stage_id OR id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_native_staging_values_delete AFTER DELETE ON ik_d1_native_staging_values BEGIN UPDATE ik_d1_native_staging SET revision=revision+1,sealed_revision=NULL WHERE id=OLD.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_native_staging_index_custody_insert AFTER INSERT ON ik_d1_native_staging_index BEGIN DELETE FROM ik_d1_native_staging_values WHERE stage_id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_native_staging_index_custody_update AFTER UPDATE ON ik_d1_native_staging_index BEGIN DELETE FROM ik_d1_native_staging_values WHERE stage_id=OLD.stage_id OR stage_id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_native_staging_index_custody_delete AFTER DELETE ON ik_d1_native_staging_index BEGIN DELETE FROM ik_d1_native_staging_values WHERE stage_id=OLD.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_native_staging_values_registered BEFORE INSERT ON ik_d1_native_staging_values WHEN NOT EXISTS(SELECT 1 FROM ik_d1_native_staging WHERE id=NEW.stage_id AND registered_revision IS NOT NULL) BEGIN SELECT RAISE(ABORT,'IMPORT_NATIVE_STAGE_INDEX_REQUIRED'); END;

-- d1CustodyStateSchema
CREATE TABLE IF NOT EXISTS ik_d1_custody_states (job_id TEXT PRIMARY KEY REFERENCES ik_jobs(id) ON DELETE CASCADE,revision INTEGER NOT NULL DEFAULT 0);

INSERT OR IGNORE INTO ik_d1_custody_states(job_id) SELECT id FROM ik_jobs;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_monotonic BEFORE UPDATE ON ik_d1_custody_states WHEN NEW.job_id IS NOT OLD.job_id OR NEW.revision<=OLD.revision BEGIN SELECT RAISE(ABORT,'IMPORT_CUSTODY_STATE_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_delete BEFORE DELETE ON ik_d1_custody_states WHEN EXISTS(SELECT 1 FROM ik_jobs WHERE id=OLD.job_id) BEGIN SELECT RAISE(ABORT,'IMPORT_CUSTODY_STATE_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_publication BEFORE UPDATE ON ik_d1_custody_states WHEN EXISTS(SELECT 1 FROM ik_d1_publication_fences f JOIN ik_d1_custody_revisions r ON r.job_id=f.job_id WHERE (f.job_id=OLD.job_id OR f.job_id=NEW.job_id) AND r.seal IS NOT NULL) BEGIN SELECT RAISE(ABORT,'IMPORT_PUBLICATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_receipt AFTER UPDATE ON ik_d1_custody_states BEGIN UPDATE ik_d1_custody_revisions SET seal=NULL WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_create AFTER INSERT ON ik_jobs BEGIN INSERT INTO ik_d1_custody_states(job_id) VALUES(NEW.id); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_jobs_insert AFTER INSERT ON ik_jobs BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_jobs_update AFTER UPDATE ON ik_jobs BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.id OR job_id=NEW.id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_jobs_delete AFTER DELETE ON ik_jobs BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_plan_chunks_insert AFTER INSERT ON ik_d1_plan_chunks BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_plan_chunks_update AFTER UPDATE ON ik_d1_plan_chunks BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_plan_chunks_delete AFTER DELETE ON ik_d1_plan_chunks BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_creation_plans_insert AFTER INSERT ON ik_d1_creation_plans BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_creation_plans_update AFTER UPDATE ON ik_d1_creation_plans BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_creation_plans_delete AFTER DELETE ON ik_d1_creation_plans BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_plan_index_insert AFTER INSERT ON ik_d1_plan_index BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_plan_index_update AFTER UPDATE ON ik_d1_plan_index BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_plan_index_delete AFTER DELETE ON ik_d1_plan_index BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_originals_insert AFTER INSERT ON ik_originals BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_originals_update AFTER UPDATE ON ik_originals BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_originals_delete AFTER DELETE ON ik_originals BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_original_chunks_insert AFTER INSERT ON ik_d1_original_chunks BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_original_chunks_update AFTER UPDATE ON ik_d1_original_chunks BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_original_chunks_delete AFTER DELETE ON ik_d1_original_chunks BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_original_sets_insert AFTER INSERT ON ik_original_sets BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_original_sets_update AFTER UPDATE ON ik_original_sets BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_original_sets_delete AFTER DELETE ON ik_original_sets BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_indexed_jobs_insert AFTER INSERT ON ik_d1_indexed_jobs BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_indexed_jobs_update AFTER UPDATE ON ik_d1_indexed_jobs BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_indexed_jobs_delete AFTER DELETE ON ik_d1_indexed_jobs BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_reversal_reports_insert AFTER INSERT ON ik_d1_reversal_reports BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_reversal_reports_update AFTER UPDATE ON ik_d1_reversal_reports BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_reversal_reports_delete AFTER DELETE ON ik_d1_reversal_reports BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_provenance_insert AFTER INSERT ON ik_provenance BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_provenance_update AFTER UPDATE ON ik_provenance BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_provenance_delete AFTER DELETE ON ik_provenance BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_sources_insert AFTER INSERT ON ik_sources BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_sources_update AFTER UPDATE ON ik_sources BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_sources_delete AFTER DELETE ON ik_sources BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_entries_insert AFTER INSERT ON ik_d1_entries BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_entries_update AFTER UPDATE ON ik_d1_entries BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_entries_delete AFTER DELETE ON ik_d1_entries BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_history_insert AFTER INSERT ON ik_d1_history BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_history_update AFTER UPDATE ON ik_d1_history BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_history_delete AFTER DELETE ON ik_d1_history BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_batches_insert AFTER INSERT ON ik_batches BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_batches_update AFTER UPDATE ON ik_batches BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_batches_delete AFTER DELETE ON ik_batches BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_stream_pages_insert AFTER INSERT ON ik_d1_stream_pages BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_stream_pages_update AFTER UPDATE ON ik_d1_stream_pages BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id OR job_id=NEW.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_stream_pages_delete AFTER DELETE ON ik_d1_stream_pages BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=OLD.job_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_stream_update BEFORE UPDATE ON ik_d1_streams BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=OLD.id); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_stream_delete BEFORE DELETE ON ik_d1_streams BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=OLD.id); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_erased_sources_insert AFTER INSERT ON ik_d1_erased_sources BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id IN (SELECT i.job_id FROM ik_d1_plan_index i JOIN ik_jobs j ON j.id=i.job_id WHERE i.source_identity=NEW.identity AND j.destination=NEW.destination); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_erased_sources_update AFTER UPDATE ON ik_d1_erased_sources BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id IN (SELECT i.job_id FROM ik_d1_plan_index i JOIN ik_jobs j ON j.id=i.job_id WHERE (i.source_identity=OLD.identity AND j.destination=OLD.destination) OR (i.source_identity=NEW.identity AND j.destination=NEW.destination)); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_erased_sources_delete AFTER DELETE ON ik_d1_erased_sources BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id IN (SELECT i.job_id FROM ik_d1_plan_index i JOIN ik_jobs j ON j.id=i.job_id WHERE i.source_identity=OLD.identity AND j.destination=OLD.destination); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_erased_targets_insert AFTER INSERT ON ik_d1_erased_targets BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id IN (SELECT i.job_id FROM ik_d1_plan_index i JOIN ik_jobs j ON j.id=i.job_id WHERE i.target_identity=NEW.identity AND j.destination=NEW.destination); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_erased_targets_update AFTER UPDATE ON ik_d1_erased_targets BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id IN (SELECT i.job_id FROM ik_d1_plan_index i JOIN ik_jobs j ON j.id=i.job_id WHERE (i.target_identity=OLD.identity AND j.destination=OLD.destination) OR (i.target_identity=NEW.identity AND j.destination=NEW.destination)); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_custody_state_ik_d1_erased_targets_delete AFTER DELETE ON ik_d1_erased_targets BEGIN UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id IN (SELECT i.job_id FROM ik_d1_plan_index i JOIN ik_jobs j ON j.id=i.job_id WHERE i.target_identity=OLD.identity AND j.destination=OLD.destination); END;

-- d1PreparationSchema
CREATE TABLE IF NOT EXISTS ik_d1_preparation_receipts (stage_id TEXT PRIMARY KEY REFERENCES ik_d1_staging(id) ON DELETE CASCADE, generation TEXT NOT NULL, codec_id TEXT, header_hash TEXT NOT NULL, header_size INTEGER NOT NULL, header_chunks INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS ik_d1_staging_headers (stage_id TEXT NOT NULL REFERENCES ik_d1_staging(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL, body TEXT NOT NULL, body_hash TEXT NOT NULL, body_size INTEGER NOT NULL, PRIMARY KEY(stage_id,ordinal));

CREATE TRIGGER IF NOT EXISTS ik_d1_preparation_receipts_insert AFTER INSERT ON ik_d1_preparation_receipts BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL WHERE id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_headers_insert AFTER INSERT ON ik_d1_staging_headers BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL WHERE id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_preparation_receipts_update AFTER UPDATE ON ik_d1_preparation_receipts BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL WHERE id=OLD.stage_id OR id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_headers_update AFTER UPDATE ON ik_d1_staging_headers BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL WHERE id=OLD.stage_id OR id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_preparation_receipts_delete AFTER DELETE ON ik_d1_preparation_receipts BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL WHERE id=OLD.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_headers_delete AFTER DELETE ON ik_d1_staging_headers BEGIN UPDATE ik_d1_staging SET revision=revision+1,sealed_revision=NULL WHERE id=OLD.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_preparation_receipt_immutable BEFORE UPDATE ON ik_d1_preparation_receipts BEGIN SELECT RAISE(ABORT,'IMPORT_PREPARATION_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_staging_headers_registered BEFORE INSERT ON ik_d1_staging_headers WHEN NOT EXISTS(SELECT 1 FROM ik_d1_staging WHERE id=NEW.stage_id AND registered_revision IS NOT NULL) BEGIN SELECT RAISE(ABORT,'IMPORT_STAGE_INDEX_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_preparation_privacy_insert AFTER INSERT ON ik_d1_staging_index BEGIN DELETE FROM ik_d1_staging_headers WHERE stage_id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_preparation_privacy_update AFTER UPDATE ON ik_d1_staging_index BEGIN DELETE FROM ik_d1_staging_headers WHERE stage_id=OLD.stage_id OR stage_id=NEW.stage_id; END;

CREATE TRIGGER IF NOT EXISTS ik_d1_preparation_privacy_delete AFTER DELETE ON ik_d1_staging_index BEGIN DELETE FROM ik_d1_staging_headers WHERE stage_id=OLD.stage_id; END;

-- Penny maintenance admission for every newly retained custody table.
CREATE TRIGGER penny_ik_d1_streams_insert BEFORE INSERT ON ik_d1_streams
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_streams_update BEFORE UPDATE ON ik_d1_streams
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_streams_delete BEFORE DELETE ON ik_d1_streams
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_stream_pages_insert BEFORE INSERT ON ik_d1_stream_pages
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_stream_pages_update BEFORE UPDATE ON ik_d1_stream_pages
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_stream_pages_delete BEFORE DELETE ON ik_d1_stream_pages
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_erased_sources_insert BEFORE INSERT ON ik_d1_erased_sources
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_erased_sources_update BEFORE UPDATE ON ik_d1_erased_sources
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_erased_sources_delete BEFORE DELETE ON ik_d1_erased_sources
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_erased_targets_insert BEFORE INSERT ON ik_d1_erased_targets
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_erased_targets_update BEFORE UPDATE ON ik_d1_erased_targets
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_erased_targets_delete BEFORE DELETE ON ik_d1_erased_targets
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_indexed_jobs_insert BEFORE INSERT ON ik_d1_indexed_jobs
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_indexed_jobs_update BEFORE UPDATE ON ik_d1_indexed_jobs
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_indexed_jobs_delete BEFORE DELETE ON ik_d1_indexed_jobs
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_plan_index_insert BEFORE INSERT ON ik_d1_plan_index
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_plan_index_update BEFORE UPDATE ON ik_d1_plan_index
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_plan_index_delete BEFORE DELETE ON ik_d1_plan_index
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_stream_origins_insert BEFORE INSERT ON ik_d1_stream_origins
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_stream_origins_update BEFORE UPDATE ON ik_d1_stream_origins
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_stream_origins_delete BEFORE DELETE ON ik_d1_stream_origins
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_stream_revisions_insert BEFORE INSERT ON ik_d1_stream_revisions
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_stream_revisions_update BEFORE UPDATE ON ik_d1_stream_revisions
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_stream_revisions_delete BEFORE DELETE ON ik_d1_stream_revisions
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_publication_fences_insert BEFORE INSERT ON ik_d1_publication_fences
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_publication_fences_update BEFORE UPDATE ON ik_d1_publication_fences
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_publication_fences_delete BEFORE DELETE ON ik_d1_publication_fences
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_insert BEFORE INSERT ON ik_d1_staging
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_update BEFORE UPDATE ON ik_d1_staging
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_delete BEFORE DELETE ON ik_d1_staging
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_pages_insert BEFORE INSERT ON ik_d1_staging_pages
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_pages_update BEFORE UPDATE ON ik_d1_staging_pages
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_pages_delete BEFORE DELETE ON ik_d1_staging_pages
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_chunks_insert BEFORE INSERT ON ik_d1_staging_chunks
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_chunks_update BEFORE UPDATE ON ik_d1_staging_chunks
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_chunks_delete BEFORE DELETE ON ik_d1_staging_chunks
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_index_insert BEFORE INSERT ON ik_d1_staging_index
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_index_update BEFORE UPDATE ON ik_d1_staging_index
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_index_delete BEFORE DELETE ON ik_d1_staging_index
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_originals_insert BEFORE INSERT ON ik_d1_staging_originals
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_originals_update BEFORE UPDATE ON ik_d1_staging_originals
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_originals_delete BEFORE DELETE ON ik_d1_staging_originals
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_custody_revisions_insert BEFORE INSERT ON ik_d1_custody_revisions
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_custody_revisions_update BEFORE UPDATE ON ik_d1_custody_revisions
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_custody_revisions_delete BEFORE DELETE ON ik_d1_custody_revisions
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_native_staging_insert BEFORE INSERT ON ik_d1_native_staging
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_native_staging_update BEFORE UPDATE ON ik_d1_native_staging
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_native_staging_delete BEFORE DELETE ON ik_d1_native_staging
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_native_staging_index_insert BEFORE INSERT ON ik_d1_native_staging_index
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_native_staging_index_update BEFORE UPDATE ON ik_d1_native_staging_index
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_native_staging_index_delete BEFORE DELETE ON ik_d1_native_staging_index
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_native_staging_values_insert BEFORE INSERT ON ik_d1_native_staging_values
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_native_staging_values_update BEFORE UPDATE ON ik_d1_native_staging_values
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_native_staging_values_delete BEFORE DELETE ON ik_d1_native_staging_values
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_custody_states_insert BEFORE INSERT ON ik_d1_custody_states
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_custody_states_update BEFORE UPDATE ON ik_d1_custody_states
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_custody_states_delete BEFORE DELETE ON ik_d1_custody_states
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_preparation_receipts_insert BEFORE INSERT ON ik_d1_preparation_receipts
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_preparation_receipts_update BEFORE UPDATE ON ik_d1_preparation_receipts
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_preparation_receipts_delete BEFORE DELETE ON ik_d1_preparation_receipts
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_headers_insert BEFORE INSERT ON ik_d1_staging_headers
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_headers_update BEFORE UPDATE ON ik_d1_staging_headers
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_staging_headers_delete BEFORE DELETE ON ik_d1_staging_headers
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
