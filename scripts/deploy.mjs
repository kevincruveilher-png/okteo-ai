// Mise en ligne : construit le logiciel (dist/) et le publie sur la branche gh-pages du dépôt GitHub.
// Lien : https://kevincruveilher-png.github.io/okteo-ai/  (GitHub Pages, source = branche gh-pages, dossier racine)
// Usage : npm run deploy   (après npm run check, et après avoir poussé main)
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit" });
const out = (cmd, cwd) => execSync(cmd, { cwd }).toString().trim();

run("npm run build");
const remote = out("git remote get-url origin");
const rev = out("git rev-parse --short HEAD");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "okteo-pages-"));
fs.cpSync("dist", tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, ".nojekyll"), "");
run("git init -q -b gh-pages", tmp);
run("git add -A", tmp);
run(`git -c user.name="Oktéo deploy" -c user.email="deploy@okteo.local" commit -q -m "Mise en ligne de ${rev}"`, tmp);
run(`git push -q -f "${remote}" gh-pages`, tmp);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`En ligne (version ${rev}) : https://kevincruveilher-png.github.io/okteo-ai/ (1 à 2 minutes pour la mise à jour)`);
