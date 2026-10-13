-- Local dev identity (Base migration 0028): an API token minted while using a
-- dev session is recorded in oa_dev_credentials by the same insert, so it is
-- admitted only behind the checkout's key gate and never travels in an archive.
-- Tokens minted in any other session are unchanged.
ALTER TABLE penny_api_issuance ADD COLUMN dev INTEGER NOT NULL DEFAULT 0 CHECK(dev IN (0,1));

CREATE TRIGGER penny_api_token_dev_custody AFTER INSERT ON integration_tokens
WHEN NEW.namespace='penny-api' AND EXISTS(SELECT 1 FROM penny_api_issuance WHERE singleton=1 AND dev=1)
BEGIN
 INSERT INTO oa_dev_credentials(credential,id,created_at) VALUES('integration_tokens',NEW.id,unixepoch()*1000);
END;
