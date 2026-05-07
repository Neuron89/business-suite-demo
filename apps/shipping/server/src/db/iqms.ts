import oracledb from 'oracledb';

// IQMS Oracle is accessed read-only via the mcp_readonly account. This module
// owns connection pooling and safe-query helpers; all IQMS reads should go
// through queryIqms() so behavior stays consistent (auto-commit off, bind
// params, camelCase-compatible output).

let initialized = false;

export async function initIqmsPool(): Promise<void> {
  if (initialized) return;

  // Thick mode is required on Linux for this IQMS server. The Instant Client
  // location comes from env so the systemd unit can pin it explicitly.
  if (process.env.ORACLE_CLIENT_LIB_DIR) {
    try {
      oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB_DIR });
    } catch (err: any) {
      if (!/already been initialized/i.test(err?.message || '')) throw err;
    }
  }

  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.autoCommit = false;

  await oracledb.createPool({
    user: process.env.IQMS_USER || 'mcp_readonly',
    password: process.env.IQMS_PASSWORD || '',
    connectString: `${process.env.IQMS_HOST}:${process.env.IQMS_PORT}/${process.env.IQMS_SERVICE}`,
    poolMin: 1,
    poolMax: 4,
    poolIncrement: 1,
    poolTimeout: 60,
  });

  initialized = true;
}

export async function closeIqmsPool(): Promise<void> {
  if (!initialized) return;
  await oracledb.getPool().close(10);
  initialized = false;
}

export interface IqmsQueryOptions {
  maxRows?: number;
  binds?: Record<string, unknown>;
}

export async function queryIqms<T = Record<string, any>>(
  sql: string,
  opts: IqmsQueryOptions = {}
): Promise<T[]> {
  await initIqmsPool();
  const conn = await oracledb.getConnection();
  try {
    const result = await conn.execute<T>(sql, (opts.binds || {}) as any, {
      maxRows: opts.maxRows ?? 10000,
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return (result.rows || []) as T[];
  } finally {
    await conn.close();
  }
}

export async function testIqmsConnection(): Promise<boolean> {
  try {
    const rows = await queryIqms<{ N: number }>('SELECT 1 AS N FROM DUAL');
    return rows[0]?.N === 1;
  } catch (err) {
    console.error('IQMS connection test failed:', err);
    return false;
  }
}
