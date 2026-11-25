import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { unstable_splitSqlQuery } from "wrangler";

function protectTransactionText(sql) {
  if (!sql.includes("BEGIN TRANSACTION")) return sql;
  // Wrangler removes transaction wrappers before tokenizing, even inside a quoted cell.
  // Preserve affected strings as SQLite text and leave quoted identifiers and comments alone.
  const quotedTokens = /'(?:[^']|'')*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]|--[^\n]*|\/\*[\s\S]*?\*\//g;
  const protectedSql = sql.replace(quotedTokens, (token) => {
    if (!token.startsWith("'") || !token.includes("BEGIN TRANSACTION")) return token;
    const value = token.slice(1, -1).replaceAll("''", "'");
    return `CAST(X'${Buffer.from(value, "utf8").toString("hex")}' AS TEXT)`;
  });
  if (protectedSql.includes("BEGIN TRANSACTION")) throw new Error("Expected a native D1 export without explicit transaction wrappers.");
  return protectedSql;
}

export function prepareRestoreSql(sql) {
  const [pragma, ...statements] = unstable_splitSqlQuery(protectTransactionText(sql));
  if (!/^PRAGMA\s+defer_foreign_keys\s*=\s*TRUE$/i.test(pragma)) {
    throw new Error("Expected a full native D1 SQL export starting with its deferred foreign key pragma.");
  }
  const tables = [];
  const indexes = [];
  const records = [];
  const views = [];
  const triggers = [];
  for (const statement of statements) {
    if (/^CREATE\s+TABLE\b/i.test(statement)) tables.push(statement);
    else if (/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(statement)) indexes.push(statement);
    else if (/^CREATE\s+VIEW\b/i.test(statement)) views.push(statement);
    else if (/^CREATE\s+TRIGGER\b/i.test(statement)) triggers.push(statement);
    else if (/^INSERT\s+INTO\b|^DELETE\s+FROM\s+["']?sqlite_sequence["']?$|^ANALYZE\s+sqlite_schema$/i.test(statement)) {
      records.push(statement);
    } else {
      throw new Error("Unexpected SQL statement in the D1 export.");
    }
  }
  if (!tables.length) throw new Error("Expected table definitions in the full D1 export.");
  // Referenced tables and unique indexes must exist before D1 prepares child inserts.
  // Install triggers last so they neither replay side effects nor precede their views.
  return [pragma, ...tables, ...indexes, ...records, ...views, ...triggers].join(";\n") + ";\n";
}

export function prepareRestoreFile(inputPath, outputPath) {
  const sql = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(inputPath));
  const result = prepareRestoreSql(sql);
  const fd = openSync(outputPath, "wx", 0o600);
  try {
    try {
      writeFileSync(fd, result);
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    unlinkSync(outputPath);
    throw error;
  }
}

if (import.meta.main) {
  const paths = process.argv.slice(2);
  if (paths.length !== 2) {
    console.error("Usage: node scripts/prepare-d1-restore.mjs ORIGINAL_EXPORT.sql NEW_RESTORE.sql");
    process.exitCode = 2;
  } else {
    try {
      prepareRestoreFile(...paths);
      console.log("Created the schema-first D1 restore file.");
    } catch (error) {
      console.error(
        error.code === "EEXIST"
          ? "Choose a new output file. The destination already exists."
          : "Could not prepare the D1 restore file. Check the input format and file permissions.",
      );
      process.exitCode = 1;
    }
  }
}
