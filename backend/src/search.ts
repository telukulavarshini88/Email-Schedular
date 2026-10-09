import { Client } from "@elastic/elasticsearch";
import { pool } from "./db";
import { config } from "./config";

const INDEX = "emails";
const es = new Client({ node: config.elasticUrl });
let ready = false;

async function ensureIndex() {
  if (ready) return;
  const exists = await es.indices.exists({ index: INDEX });
  if (!exists) {
    await es.indices.create({
      index: INDEX,
      mappings: {
        properties: {
          user_id: { type: "keyword" },
          status: { type: "keyword" },
          to_email: { type: "text" },
          subject: { type: "text" },
          body: { type: "text" },
          scheduled_at: { type: "date" },
          sent_at: { type: "date" },
        },
      },
    });
  }
  ready = true;
}

/** Index (or re-index) one email from Postgres. Never throws: search is best-effort. */
export async function indexEmail(id: string) {
  try {
    await ensureIndex();
    const { rows } = await pool.query(
      `SELECT id, user_id, to_email, subject, body, status, scheduled_at, sent_at
       FROM emails WHERE id=$1`,
      [id]
    );
    if (!rows[0]) return;
    const { id: _id, ...doc } = rows[0];
    await es.index({ index: INDEX, id, document: doc });
  } catch (err) {
    console.warn("[search] index failed:", (err as Error).message);
  }
}

export async function indexMany(ids: string[]) {
  for (const id of ids) await indexEmail(id);
}

/** Returns matching email ids, or null if Elasticsearch is unavailable. */
export async function searchEmailIds(userId: string, q: string): Promise<string[] | null> {
  try {
    await ensureIndex();
    const res = await es.search({
      index: INDEX,
      size: 500,
      query: {
        bool: {
          filter: [{ term: { user_id: userId } }],
          must: [
            {
              multi_match: {
                query: q,
                fields: ["to_email", "subject", "body"],
                fuzziness: "AUTO",
              },
            },
          ],
        },
      },
    });
    return res.hits.hits.map((h) => h._id as string);
  } catch (err) {
    console.warn("[search] query failed, falling back to SQL:", (err as Error).message);
    return null;
  }
}
