-- Keep internal delivery windows private. ETA approval is an explicit public action.
ALTER TABLE roadmap_publications ADD COLUMN public_eta TEXT
 CHECK(public_eta IS NULL OR (length(public_eta)=7 AND public_eta GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]' AND substr(public_eta,6,2) BETWEEN '01' AND '12') OR (length(public_eta)=7 AND public_eta GLOB '[0-9][0-9][0-9][0-9]-Q[1-4]'));
ALTER TABLE roadmap_transitions ADD COLUMN kind TEXT NOT NULL DEFAULT 'status' CHECK(kind IN ('status','eta'));
DROP TRIGGER roadmap_move_changed;
CREATE TRIGGER roadmap_move_changed BEFORE INSERT ON roadmap_transitions
WHEN NEW.action_key IS NOT NULL AND NEW.from_status=NEW.to_status AND NEW.kind='status'
BEGIN SELECT RAISE(ABORT,'Choose a different status'); END;
CREATE TRIGGER roadmap_eta_not_status BEFORE INSERT ON roadmap_transitions
WHEN NEW.kind='eta' AND NEW.from_status IS NOT NEW.to_status
BEGIN SELECT RAISE(ABORT,'ETA approval cannot change status'); END;
