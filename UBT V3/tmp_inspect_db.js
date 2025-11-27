const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const dbPath = path.join(__dirname, "data.db");
const db = new sqlite3.Database(dbPath);

function q(sql, params = []) {
  return new Promise((res, rej) =>
    db.all(sql, params, (e, r) => (e ? rej(e) : res(r)))
  );
}

(async () => {
  try {
    const partners = await q(
      "SELECT id, name, code, province_code, created_at FROM partner WHERE code LIKE 'AUTOPT%'"
    );
    console.log("FOUND_PARTNERS:", JSON.stringify(partners, null, 2));
    const protocols = await q(
      "SELECT id, code, patient_name, healthcare_facility, status, created_at FROM protocols ORDER BY id DESC LIMIT 10"
    );
    console.log("RECENT_PROTOCOLS:", JSON.stringify(protocols, null, 2));
  } catch (err) {
    console.error("DB_ERROR", err);
  } finally {
    db.close();
  }
})();
