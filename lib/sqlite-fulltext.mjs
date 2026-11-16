// Full-text search store (SQLite FTS5), used instead of the vector stores when no API key is configured.
// Same interface as the vector stores: init, write, find, has, deleteItem, close (+ clear for rebuilding).
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// words that are too common to be useful search terms (the trigram tokenizer ignores terms below 3 characters)
const STOPWORDS = new Set([
	"the",
	"and",
	"for",
	"with",
	"from",
	"all",
	"what",
	"which",
	"der",
	"die",
	"das",
	"den",
	"dem",
	"des",
	"und",
	"oder",
	"ein",
	"eine",
	"einen",
	"einem",
	"einer",
	"ist",
	"sind",
	"mit",
	"von",
	"vom",
	"für",
	"auf",
	"aus",
	"bei",
	"wie",
	"was",
	"welche",
	"welcher",
	"alle",
]);

/**
 * Normalizes text for indexing and searching. The tokenizer removes diacritics (ü → u), but keeps ß.
 *
 * @param {string} text
 */
export function normalizeText(text) {
	return String(text || "")
		.toLowerCase()
		.replace(/ß/g, "ss");
}

/**
 * Builds an FTS5 query that matches any of the words of a free-text search (substring match).
 * Words written with ae/oe/ue also match the umlaut spelling ("kueche" finds "Küche").
 *
 * @param {string} text
 * @returns {string} empty when the text contains no usable word
 */
export function buildFulltextQuery(text) {
	const words = normalizeText(text)
		.split(/[^\p{L}\p{N}_]+/u)
		.filter((w) => w.length >= 3 && !STOPWORDS.has(w));
	const terms = new Set();
	for (const w of words) {
		terms.add(w);
		const umlaut = w.replace(/([aou])e/g, "$1");
		if (umlaut.length >= 3) {
			terms.add(umlaut);
		}
	}
	return [...terms].map((w) => `"${w.replace(/"/g, '""')}"`).join(" OR ");
}

function objectName(obj) {
	const name = obj && obj.common && obj.common.name;
	if (name && typeof name === "object") {
		return Object.values(name).filter(Boolean).join(" ");
	}
	return name ? String(name) : "";
}

export class FulltextSearchDB {
	constructor(options) {
		this.options = options || {};
		this.mode = "fulltext";
		this.logger = this.options.logger || console;
		this.dbDirPath = this.options.dbPath;
		this.dbFileName = this.options.dbFileName || "fulltext_store.sqlite";
		this.dbFilePath = path.join(this.dbDirPath, this.dbFileName);
		this.db = null;
	}

	async init() {
		if (this.db) {
			return;
		}
		if (!fs.existsSync(this.dbDirPath)) {
			fs.mkdirSync(this.dbDirPath, { recursive: true });
		}
		this.db = new Database(this.dbFilePath);
		this.db.pragma("journal_mode = WAL");
		this.db.pragma("synchronous = NORMAL");
		this.db.exec(`
            CREATE TABLE IF NOT EXISTS documents (
                rowid INTEGER PRIMARY KEY,
                iobroker_text_id TEXT UNIQUE NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER,
                metadata TEXT
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
                content, name, iobroker_text_id,
                tokenize = 'trigram remove_diacritics 1'
            );
        `);
		this.getItemStmt = this.db.prepare("SELECT rowid FROM documents WHERE iobroker_text_id = ?;");
		this.insertDocStmt = this.db.prepare(
			"INSERT INTO documents (iobroker_text_id, content, timestamp, metadata) VALUES (?, ?, ?, ?);",
		);
		this.updateDocStmt = this.db.prepare(
			"UPDATE documents SET content = ?, timestamp = ?, metadata = ? WHERE rowid = ?;",
		);
		this.deleteDocStmt = this.db.prepare("DELETE FROM documents WHERE rowid = ?;");
		this.insertFtsStmt = this.db.prepare(
			"INSERT INTO documents_fts (rowid, content, name, iobroker_text_id) VALUES (?, ?, ?, ?);",
		);
		this.deleteFtsStmt = this.db.prepare("DELETE FROM documents_fts WHERE rowid = ?;");
		// bm25 weights per column: description, name, id
		this.searchStmt = this.db.prepare(`
            SELECT d.iobroker_text_id, d.content, d.timestamp, d.metadata,
                   bm25(documents_fts, 1.0, 0.7, 0.4) AS rank
            FROM documents_fts JOIN documents d ON d.rowid = documents_fts.rowid
            WHERE documents_fts MATCH ?
            ORDER BY rank
            LIMIT ?;
        `);
		this.logger.info("[Kiwi DB] Full-text store initialized (no API key: search without embeddings).");
	}

	async write(iobroker_text_id, txt, metadata = {}) {
		if (!this.db) {
			this.logger.error("[Kiwi DB] Write failed! Database not initialized. Call init() first.");
			return;
		}
		const content = String(txt || "");
		const name = objectName(metadata);
		this.db.transaction(() => {
			const existing = this.getItemStmt.get(iobroker_text_id);
			let rowid;
			if (existing) {
				rowid = existing.rowid;
				this.updateDocStmt.run(content, Date.now(), JSON.stringify(metadata), rowid);
				this.deleteFtsStmt.run(rowid);
			} else {
				rowid = this.insertDocStmt.run(
					iobroker_text_id,
					content,
					Date.now(),
					JSON.stringify(metadata),
				).lastInsertRowid;
			}
			this.insertFtsStmt.run(rowid, normalizeText(content), normalizeText(name), iobroker_text_id);
		})();
		return { id: iobroker_text_id, status: "upserted" };
	}

	/**
	 * Matches any word of at least 3 characters (also as part of longer words) in description, name and id.
	 * `distance` is the bm25 rank: lower is better, values are negative.
	 */
	async find(txt, limit = 10) {
		if (!this.db) {
			this.logger.error("[Kiwi DB] Search failed! Database not initialized. Call init() first.");
			return;
		}
		const query = buildFulltextQuery(txt);
		if (!query) {
			return [];
		}
		const rows = this.searchStmt.all(query, Math.max(1, Math.floor(limit)));
		return rows.map((row) => ({
			id: row.iobroker_text_id,
			metadata: JSON.parse(row.metadata || "{}"),
			distance: row.rank,
			content: row.content,
			timestamp: row.timestamp,
		}));
	}

	has(iobroker_text_id) {
		return !!(this.db && this.getItemStmt.get(iobroker_text_id));
	}

	async deleteItem(iobroker_text_id) {
		if (!this.db) {
			this.logger.error("[Kiwi DB] Database not initialized. Call init() first.");
			return false;
		}
		const existing = this.getItemStmt.get(iobroker_text_id);
		if (!existing) {
			return false;
		}
		this.db.transaction(() => {
			this.deleteDocStmt.run(existing.rowid);
			this.deleteFtsStmt.run(existing.rowid);
		})();
		return true;
	}

	/** Removes all entries (the adapter rebuilds this store on every start, which costs no API calls). */
	clear() {
		if (this.db) {
			this.db.exec("DELETE FROM documents; DELETE FROM documents_fts;");
		}
	}

	close() {
		if (this.db) {
			this.db.close();
			this.db = null;
		}
	}
}
