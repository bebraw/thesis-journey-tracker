import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { unstable_splitSqlQuery } from "wrangler";
import { prepareRestoreFile, prepareRestoreSql } from "./prepare-d1-restore.mjs";

const note = "First line; -- an SQL comment?\r\nO'Brien wrote “BEGIN TRANSACTION; COMMIT;”\n/* draft */";
const otherNote = "O'Brien\r\nCREATE TABLE students;\n-- discuss next week";
const dump = `PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE notes(id INTEGER PRIMARY KEY AUTOINCREMENT, student_name TEXT REFERENCES students(name), body TEXT);
INSERT INTO notes VALUES(3,'Ada','${note.replaceAll("'", "''")}');
INSERT INTO notes VALUES(4,'Ada','${otherNote.replaceAll("'", "''")}');
CREATE TABLE students(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
INSERT INTO students VALUES(9,'Ada');
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('notes',12);
INSERT INTO sqlite_sequence VALUES('students',20);
CREATE UNIQUE INDEX student_name ON students(name);
CREATE TRIGGER add_student INSTEAD OF INSERT ON names BEGIN
  INSERT INTO students(name) VALUES(NEW.name);
  INSERT INTO notes(student_name,body) VALUES(NEW.name,'Say ''hello;'' then continue.');
END;
CREATE VIEW names AS SELECT name FROM students;
`;

describe("preparing native D1 SQL for restore", () => {
  it("restores child rows, exact multiline text, sequences and triggers through Wrangler's statement splitter", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("PRAGMA foreign_keys=ON; BEGIN");
      for (const statement of unstable_splitSqlQuery(prepareRestoreSql(dump))) db.exec(statement);
      db.exec("COMMIT");
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect(db.prepare("SELECT * FROM notes ORDER BY id").all()).toEqual([
        { id: 3, student_name: "Ada", body: note },
        { id: 4, student_name: "Ada", body: otherNote },
      ]);
      db.prepare("INSERT INTO names VALUES (?)").run("Leo");
      expect(db.prepare("SELECT * FROM notes WHERE student_name='Leo'").get()).toEqual({
        id: 13,
        student_name: "Leo",
        body: "Say 'hello;' then continue.",
      });
      expect(db.prepare("SELECT id FROM students WHERE name='Leo'").get()).toEqual({ id: 21 });
    } finally {
      db.close();
    }
  });

  it("writes a private new file, preserves the original, and fails before writing unsupported input", () => {
    const directory = mkdtempSync(join(tmpdir(), "d1-prepare-restore-"));
    try {
      const original = join(directory, "original.sql");
      const prepared = join(directory, "prepared.sql");
      writeFileSync(original, dump, { mode: 0o600 });
      prepareRestoreFile(original, prepared);
      expect(readFileSync(original, "utf8")).toBe(dump);
      expect(readFileSync(prepared, "utf8")).toBe(prepareRestoreSql(dump));
      if (process.platform !== "win32") expect(statSync(prepared).mode & 0o777).toBe(0o600);
      expect(() => prepareRestoreFile(original, original)).toThrow();
      expect(() => prepareRestoreFile(original, prepared)).toThrow();
      expect(readFileSync(original, "utf8")).toBe(dump);
      const broken = join(directory, "broken.sql");
      writeFileSync(broken, dump + "DROP TABLE students;", { mode: 0o600 });
      const failed = join(directory, "failed.sql");
      expect(() => prepareRestoreFile(broken, failed)).toThrow("Unexpected SQL statement");
      expect(existsSync(failed)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
