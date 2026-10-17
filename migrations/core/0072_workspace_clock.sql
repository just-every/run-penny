-- Installation preferences never travel with a product archive or its authority.
CREATE TABLE penny_workspace_clock (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 timezone TEXT NOT NULL,
 quiet_enabled INTEGER NOT NULL CHECK(quiet_enabled IN (0,1)),
 quiet_start INTEGER NOT NULL CHECK(quiet_start BETWEEN 0 AND 23),
 quiet_end INTEGER NOT NULL CHECK(quiet_end BETWEEN 0 AND 23),
 confirmed_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK(quiet_enabled=0 OR quiet_start<>quiet_end)
);
