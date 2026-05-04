import { Alma } from './core/Alma';
import { RH } from './core/RH';
import { Fabrica } from './core/Fabrica';
import db from './db/sqlite';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

async function main() {
  const factoryId = 1;
  const model = 'gpt-4o'; // Alma da fábrica
  
  console.log('--- Bem-vindo à Ficha da Fábrica ---');
  
  // 1. Ficha da Fábrica (Setup)
  db.prepare(`
    INSERT OR REPLACE INTO factory_config (id, name, soul_model)
    VALUES (?, ?, ?)
  `).run(factoryId, 'A Fábrica de Sonhos', model);

  const alma = new Alma({ model });
  const rh = new RH(alma);

  // 2. A Ideia
  const ideia = 'Criar um sistema de delivery para pequenos produtores rurais';
  console.log(`\nA Ideia: "${ideia}"`);

  // 3. Contratação (RH) - Inicia com o CEO
  await rh.contratarCEO(factoryId, ideia);

  // 4. Criar Projeto
  const projectInsert = db.prepare(`
    INSERT INTO projects (name, description, factory_id)
    VALUES (?, ?, ?)
  `).run('Delivery Rural', ideia, factoryId);
  const projectId = Number(projectInsert.lastInsertRowid);

  // 5. Linha de Produção (Fabrica)
  const fabrica = new Fabrica(factoryId, model, projectId);
  const resultadoFinal = await fabrica.iniciarProducao(projectId, ideia);

  console.log('\n--- Resultado Final da Produção ---');
  console.log(resultadoFinal);
}

main().catch(console.error);
