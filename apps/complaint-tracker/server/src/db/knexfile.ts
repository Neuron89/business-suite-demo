import type { Knex } from 'knex';

const config: Knex.Config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'complaint_db',
    user: process.env.DB_USER || 'moc_user',
    password: process.env.DB_PASSWORD || 'changeme',
  },
  pool: { min: 2, max: 10 },
  migrations: {
    directory: __dirname + '/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: __dirname + '/seeds',
    extension: 'ts',
  },
};

export default config;
module.exports = config;
