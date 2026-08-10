import { armarPlaca } from '../lib/placa';
import { readFile, writeFile } from 'node:fs/promises';
(async()=>{
  const salida = process.argv[2];
  const r = await armarPlaca(JSON.parse(await readFile('placas/muestra/gr.json','utf8')), await readFile('placas/muestra/gr.png'));
  if(r.ok) await writeFile(salida, r.png); else console.log('ERR', r.motivo);
})();
