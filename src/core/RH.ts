import db from '../db/sqlite';
import { Alma } from './Alma';

export interface ColaboradorData {
  name: string;
  role: string;
  expertise: string;
  personality: string;
}

export class RH {
  constructor(private alma: Alma) {}

  async contratarCEO(factoryId: number, projectDesc: string) {
    // Verificar se já existe um CEO para esta fábrica
    const existing = db.prepare('SELECT * FROM agents WHERE soul_id = ? AND role = ?').get(factoryId, 'CEO') as any;
    if (existing) {
      console.log(`--- RH: CEO ${existing.name} já está no comando. ---`);
      return existing;
    }

    console.log('--- RH d\'A Fábrica: Contratando CEO Estratégico ---');
    const systemPrompt = `Você é o RH d'A Fábrica. Sua missão é contratar o CEO (Diretor Geral) ideal para liderar um projeto.
Retorne um JSON com: name, role (deve ser 'CEO'), expertise, personality.
Considere o projeto: ${projectDesc}`;
    
    const especialistas = await this.alma.contratar(projectDesc, systemPrompt);
    const ceo = especialistas[0] || { 
      name: 'Diretor Principal', 
      role: 'CEO', 
      expertise: 'Gestão de Software e Visão Estratégica', 
      personality: 'Líder Decisivo' 
    };

    const insert = db.prepare(`
      INSERT INTO agents (name, role, expertise, personality, soul_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    console.log(`Contratando CEO: ${ceo.name}`);
    const info = insert.run(ceo.name, 'CEO', ceo.expertise, ceo.personality, factoryId);
    
    // Atualiza info do CEO na config da fábrica
    db.prepare('UPDATE factory_config SET ceo_name = ?, ceo_bio = ? WHERE id = ?')
      .run(ceo.name, `${ceo.expertise} | ${ceo.personality}`, factoryId);

    return { ...ceo, id: Number(info.lastInsertRowid) };
  }

  async contratarEspecialista(factoryId: number, recomendacao: string) {
    console.log(`--- RH d'A Fábrica: Contratando Especialista Sob Demanda: ${recomendacao} ---`);
    
    // Evitar duplicidade de cargos (Normalizar para comparação)
    const existing = db.prepare('SELECT id FROM agents WHERE soul_id = ? AND LOWER(role) = LOWER(?)')
      .get(factoryId, recomendacao.trim()) as any;
    
    if (existing) {
      console.log(`--- RH: Especialista para o cargo "${recomendacao}" já existe. ---`);
      return null;
    }

    const systemPrompt = `Você é o RH d'A Fábrica. O CEO solicitou a contratação de um especialista: ${recomendacao}.
Retorne um JSON com a lista 'colaboradores' contendo UM especialista com: name, role, expertise, personality.`;
    
    const novos = await this.alma.contratar(recomendacao, systemPrompt);
    const contratado = novos[0];

    if (contratado) {
      const insert = db.prepare(`
        INSERT INTO agents (name, role, expertise, personality, soul_id)
        VALUES (?, ?, ?, ?, ?)
      `);
      insert.run(contratado.name, contratado.role, contratado.expertise, contratado.personality, factoryId);
      console.log(`Especialista contratado: ${contratado.name} (${contratado.role})`);
      return contratado;
    }
    return null;
  }

  listarColaboradores(factoryId: number) {
    return db.prepare('SELECT * FROM agents WHERE soul_id = ?').all(factoryId);
  }
}
