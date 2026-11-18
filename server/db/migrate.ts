import { initializeDatabase } from "./client";
import { ensureSeeded } from "./repository";

initializeDatabase();
ensureSeeded();
console.log("Database ready.");
