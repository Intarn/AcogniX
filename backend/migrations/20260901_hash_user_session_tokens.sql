-- UC21/UC22: migrate legacy UserSession rows that stored raw bearer tokens.
-- New application code stores SHA-256 digests only.

create extension if not exists pgcrypto with schema extensions;

update public."UserSession"
set "tokenHash" = encode(extensions.digest("tokenHash", 'sha256'), 'hex')
where "tokenHash" is not null
  and "tokenHash" !~ '^[0-9a-f]{64}$';
