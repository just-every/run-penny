-- The digest has no item foreign key: erasure must not permit replay resurrection.
CREATE TABLE penny_email_capture_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 capture_address TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE penny_email_capture_domains (
 domain TEXT PRIMARY KEY NOT NULL
);
CREATE TABLE penny_email_capture_messages (
 message_digest TEXT PRIMARY KEY NOT NULL CHECK(length(message_digest)=64)
);
CREATE TABLE penny_email_capture_refusals (
 reason TEXT PRIMARY KEY NOT NULL,
 count INTEGER NOT NULL CHECK(count>0)
);
