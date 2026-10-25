// Oktéo AI — point d'entrée du cœur. Le code est réparti dans src/core/ (un fichier par thème).
// Les étapes de démarrage sont appelées ici dans l'ordre d'origine.
import { init1 } from "./core/model.js";
import { init2 } from "./core/persist.js";
import { init3 } from "./core/attach.js";
import { init4 } from "./core/groups.js";
import { init5 } from "./core/interact.js";
import { init6 } from "./core/controls.js";
import { init7 } from "./core/api.js";

init1();
init2();
init3();
init4();
init5();
init6();
init7();
