CREATE TRIGGER penny_learning_agent_regrant AFTER UPDATE ON learning_investigations
 WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 INSERT INTO penny_agent_work(kind,id,principal,label)
 SELECT 'learning',NEW.id,json_object('person',json_object('id',native_id),'agent',json_extract(agent,'$.agent'),
 'consent',consent,'scopes',json(scopes),'clientId',client_id),label FROM penny_agent_transaction WHERE 1
 ON CONFLICT(kind,id) DO UPDATE SET principal=excluded.principal,label=excluded.label;
END;
