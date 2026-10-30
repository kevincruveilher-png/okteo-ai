// Vérifie la syntaxe de tous les fichiers du logiciel (cœur découpé dans src/core, extensions, relevés).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const dirs = ["src", "src/core", "src/ext", "src/walls", "src/cablage", "src/web", "server"];
let n = 0;
for (const d of dirs) for (const f of fs.readdirSync(d)) if (f.endsWith(".js")) { execFileSync(process.execPath, ["--check", `${d}/${f}`], { stdio: "inherit" }); n++; }
console.log(`Syntaxe vérifiée : ${n} fichiers.`);
