-- Create one database per Node app. The default POSTGRES_USER (demo) owns them all.
-- Python apps (qc-lab, iqms-chat, employee-directory) use SQLite, no DB needed here.

CREATE DATABASE portal_db;
CREATE DATABASE moc_db;
CREATE DATABASE it_request_db;
CREATE DATABASE shipping_db;

GRANT ALL PRIVILEGES ON DATABASE portal_db     TO demo;
GRANT ALL PRIVILEGES ON DATABASE moc_db        TO demo;
GRANT ALL PRIVILEGES ON DATABASE it_request_db TO demo;
GRANT ALL PRIVILEGES ON DATABASE shipping_db   TO demo;
