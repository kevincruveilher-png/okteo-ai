// Lot 9 (FA-05) : nuage de révision et indice (test pur)
import { scallops, cloudPoints, indiceMark, nextIndice, nearCloud, rectOf } from "../src/print/nuage.js";
let ok = 0, ko = 0;
const check = (n, c, i) => { if (c) { ok++; console.log("  ✓ " + n); } else { ko++; console.log("  ✗ " + n + (i ? " — " + i : "")); } };
const q = { x0: 4, y0: 3, x1: 1, y1: 1 };
check("rectangle remis dans l'ordre", JSON.stringify(rectOf(q)) === JSON.stringify({ x0: 1, y0: 1, x1: 4, y1: 3 }));
const S = scallops(q, 0.18);
check("festons tout autour (≈ 36 cm, au moins 2 par côté)", S.length >= 8 && S.every(([ax, ay, bx, by]) => Math.hypot(bx - ax, by - ay) < 0.5));
const P = cloudPoints(q, 0.18), out = P.every(([x, y]) => x <= 1.001 || x >= 3.999 || y <= 1.001 || y >= 2.999 || false);
const R = rectOf(q), inside = P.filter(([x, y]) => x > R.x0 + 0.01 && x < R.x1 - 0.01 && y > R.y0 + 0.01 && y < R.y1 - 0.01).length;
check("les festons bombent vers l'extérieur (aucun point à l'intérieur)", inside === 0 && P.some(([x, y]) => y < 0.9), String(inside));
const M = indiceMark(q);
check("triangle de l'indice sur l'angle haut droit, pointe en haut", Math.abs(M.tx - 4) < 1e-9 && M.pts[2][1] < M.pts[0][1] && M.ty < 1);
check("indice suivant : A → B, Z → AA, AZ → BA, vide → A", nextIndice("A") === "B" && nextIndice("Z") === "AA" && nextIndice("az") === "BA" && nextIndice("") === "A");
check("clic : près du contour = 0, au centre = loin, dehors = distance", nearCloud(q, 1, 2) === 0 && nearCloud(q, 2.5, 2) === 1 && Math.abs(nearCloud(q, 0, 2) - 1) < 1e-9);
console.log(`\n${ok} vérifications réussies, ${ko} en échec.`);
if (ko) process.exit(1);
