import sqlite3
import config


def get_db():
    db = sqlite3.connect(config.DATABASE)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    return db


def init_db():
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            role TEXT NOT NULL DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_code TEXT UNIQUE NOT NULL,
            product_name TEXT NOT NULL,
            manufacturer TEXT,
            revision_date TEXT,
            hazard_class TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sds_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            uploaded_by INTEGER NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS access_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT UNIQUE NOT NULL,
            product_id INTEGER NOT NULL,
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    ''')

    # --- Idempotent column upgrades (for DBs created before these columns) ---
    def _ensure_column(table, column, ddl):
        cols = {r['name'] for r in db.execute(f'PRAGMA table_info({table})').fetchall()}
        if column not in cols:
            db.execute(f'ALTER TABLE {table} ADD COLUMN {ddl}')

    _ensure_column('users', 'full_name', 'full_name TEXT')
    _ensure_column('users', 'role', "role TEXT NOT NULL DEFAULT 'admin'")
    _ensure_column('products', 'manufacturer', 'manufacturer TEXT')
    _ensure_column('products', 'revision_date', 'revision_date TEXT')
    _ensure_column('products', 'hazard_class', 'hazard_class TEXT')

    db.commit()
    db.close()
