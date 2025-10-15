import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const file = process.env.DATABASE_FILE || "./data/hibe.db";
const sqlite = new Database(file);
export const db = drizzle(sqlite);
export default db;
