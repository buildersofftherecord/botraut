import { armarPlaca } from "../lib/placa";
import { readFile, writeFile } from "node:fs/promises";
(async () => {
  const datos = JSON.parse(await readFile("placas/muestra/gr.json", "utf8"));
  const foto = await readFile("placas/muestra/gr.png");
  for (const e of [1.15, 1.3, 1.45]) {
    const r = await armarPlaca(datos, foto, { escalaSujeto: e });
    if (r.ok) { await writeFile(`salidas/esc-${e}.png`, r.png); console.log("✅", e); }
    else console.log("❌", e, r.motivo);
  }
})();
