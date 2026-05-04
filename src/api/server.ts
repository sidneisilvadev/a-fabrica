import fastify from 'fastify';
import cors from '@fastify/cors';
import staticFiles from '@fastify/static';
import * as path from 'path';
import * as fs from 'fs-extra';
import OpenAI from 'openai';
import db from '../db/sqlite';
import { Alma } from '../core/Alma';
import { RH } from '../core/RH';
import { Fabrica } from '../core/Fabrica';
import { Colaborador } from '../core/Colaborador';
import multipart from '@fastify/multipart';
import { Parser } from '../services/Parser';

const server = fastify({ logger: true });

server.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

server.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

server.setErrorHandler((error: any, request, reply) => {
  console.error('[GLOBAL ERROR]', error);
  reply.status(500).send({ error: error.message });
});

// Endpoints
server.get('/', async () => {
  return { status: 'A Fábrica API is running', version: '1.2.0' };
});

server.post('/upload', async (request: any, reply) => {
  const data = await request.file();
  if (!data) return { error: 'No file uploaded' };

  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

  const filePath = path.join(uploadDir, data.filename);
  await fs.writeFile(filePath, await data.toBuffer());

  // Parse text for AI context
  const textContent = await Parser.parseFile(filePath);

  // Registrar o conteúdo do documento nos logs para memória de contexto
  db.prepare(`
    INSERT INTO production_logs (project_id, message, type, is_read)
    VALUES (NULL, ?, 'document_parsed', 1)
  `).run(`Arquivo: ${data.filename}\nConteúdo: ${textContent.slice(0, 5000)}`);

  // Se for imagem, gerar URL base64 para o Vision
  let imageUrl = null;
  const ext = path.extname(data.filename).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
    const buffer = await data.toBuffer();
    imageUrl = `data:image/${ext.slice(1)};base64,${buffer.toString('base64')}`;
  }
  
  return { 
    filename: data.filename, 
    path: filePath,
    preview: textContent.slice(0, 1000),
    imageUrl
  };
});

server.post('/setup', async (request: any) => {
  const { factoryName, industry, mission, seo, apiKey, baseUrl, model, productionPath, hiringMode } = request.body;
  const factoryId = 1;

  console.log('[API] Recebendo Setup:', { factoryName, seo });

  try {
    db.transaction(() => {
      // 1. Config da Fábrica
      db.prepare(`
        INSERT OR REPLACE INTO factory_config (id, name, industry, mission, api_key, base_url, soul_model, production_path, hiring_mode, ceo_name, ceo_bio) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(factoryId, factoryName, industry, mission, apiKey, baseUrl, model, productionPath, hiringMode || 'auto', seo, mission);

      // 2. Criar Agente CEO na tabela de agentes (Fixamos ID 1 para o CEO inicial)
      db.prepare(`
        INSERT OR REPLACE INTO agents (id, name, role, expertise, personality, soul_id)
        VALUES (1, ?, 'CEO', ?, ?, ?)
      `).run(seo || 'CEO Nexus', mission || 'Liderança Estratégica', 'Gestão, Planejamento e RH', factoryId);

      // 3. Email de boas-vindas do CEO (idempotente para evitar duplicidade)
      const welcomeMsg = `[EMAIL] Assunto: Boas-vindas à nossa nova estrutura! | Mensagem: Olá, Diretoria! Eu sou ${seo || 'seu CEO'}, e já assumi o comando d'A Fábrica. Minha primeira tarefa será planejar nossa missão e montar a equipe ideal. Estou pronto para começar assim que você lançar o primeiro projeto!`;
      const existingWelcome = db.prepare(`
        SELECT id
        FROM production_logs
        WHERE project_id IS NULL
          AND agent_id = 1
          AND type = 'email_to_user'
          AND message LIKE '%Assunto: Boas-vindas à nossa nova estrutura!%'
        ORDER BY id DESC
        LIMIT 1
      `).get() as any;

      if (!existingWelcome) {
        db.prepare(`
          INSERT INTO production_logs (project_id, agent_id, message, type, is_read)
          VALUES (NULL, 1, ?, 'email_to_user', 0)
        `).run(welcomeMsg);
      }
    })();
    
    console.log('[DB] Configurações, CEO e Boas-vindas salvos.');
    return { status: 'ok' };
  } catch (err: any) {
    console.error('[DB] Erro ao salvar configurações:', err.message);
    throw err;
  }
});

server.get('/factory', async () => {
  return db.prepare('SELECT * FROM factory_config').all();
});

server.get('/agents', async () => {
  return db.prepare('SELECT * FROM agents').all();
});

server.get('/projects', async () => {
  return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
});

server.get('/logs/:projectId', async (request: any) => {
  const { projectId } = request.params;
  return db.prepare("SELECT * FROM production_logs WHERE project_id = ? AND type NOT LIKE 'email%'").all(projectId);
});

server.get('/projects/:projectId', async (request: any) => {
  const { projectId } = request.params;
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
});

server.get('/files/:projectId', async (request: any) => {
  const { projectId } = request.params;
  try {
    const config = db.prepare('SELECT production_path FROM factory_config WHERE id = 1').get() as any;
    const base = config?.production_path || path.join(process.cwd(), 'projects');
    const projectPath = path.join(base, projectId);
    
    if (fs.existsSync(projectPath) && fs.lstatSync(projectPath).isDirectory()) {
      const allItems = fs.readdirSync(projectPath);
      const result = [];
      
      for (const item of allItems) {
        const itemPath = path.join(projectPath, item);
        if (fs.lstatSync(itemPath).isFile()) {
          const ext = path.extname(item).toLowerCase();
          const isBinary = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.docx', '.zip'].includes(ext);
          
          result.push({
            name: item,
            content: isBinary ? `[Arquivo binário: ${ext}]` : fs.readFileSync(itemPath, 'utf-8'),
            isBinary
          });
        }
      }
      return result;
    }
    return [];
  } catch (err: any) {
    console.error(`[API] Erro ao ler arquivos do projeto #${projectId}:`, err.message);
    return [];
  }
});

server.post('/move-project', async (request: any) => {
  const { projectId, status, justification } = request.body;
  const factoryId = 1;

  db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(status, projectId);
  
  if (justification && (status === 'pending' || status === 'in_progress')) {
    (async () => {
      try {
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get() as any;
        const factory = db.prepare('SELECT * FROM factory_config WHERE id = ?').get() as any;
        const alma = new Alma({ model: factory.soul_model });
        const fabrica = new Fabrica(factoryId, factory.soul_model, projectId, factory.production_path);
        const colaboradoresData = db.prepare('SELECT * FROM agents WHERE soul_id = ? AND role = "CEO"').get() as any;
        if (colaboradoresData) {
          const ceo = new Colaborador(colaboradoresData, alma);
          await ceo.agir(projectId, 'REWORK', `USUÁRIO SOLICITOU ALTERAÇÃO: "${justification}"`);
        }
        await fabrica.iniciarProducao(projectId, project.description + '\n\n[REWORK FEEDBACK]: ' + justification);
      } catch (err) { console.error(err); }
    })();
  }
  return { status: 'ok' };
});

server.delete('/projects/:projectId', async (request: any) => {
  const { projectId } = request.params;
  const pid = parseInt(projectId);
  
  if (isNaN(pid)) {
    console.error(`[API] ID de projeto inválido: ${projectId}`);
    return { error: 'Invalid ID' };
  }

  console.log(`[API] Solicitando exclusão da missão #${pid}`);
  
  const config = db.prepare('SELECT production_path FROM factory_config WHERE id = 1').get() as any;
  const base = config?.production_path || path.join(process.cwd(), 'projects');
  const projectPath = path.join(base, pid.toString());

  try {
    const taskDel = db.prepare('DELETE FROM tasks WHERE project_id = ?').run(pid);
    const logDel = db.prepare('DELETE FROM production_logs WHERE project_id = ?').run(pid);
    const projDel = db.prepare('DELETE FROM projects WHERE id = ?').run(pid);
    console.log(`[DB] Removidos ${taskDel.changes} tasks, ${logDel.changes} logs e ${projDel.changes} projeto.`);

    if (fs.existsSync(projectPath)) {
      console.log(`[Warehouse] Deletando pasta física: ${projectPath}`);
      fs.removeSync(projectPath);
    }

    return { status: 'ok' };
  } catch (err: any) {
    console.error(`[API] Erro ao deletar missão #${pid}:`, err.message);
    throw err;
  }
});

server.post('/start', async (request: any, reply) => {
  try {
    const { name, description, model = 'gpt-4o' } = request.body;
    const factoryId = 1;
    const config = db.prepare('SELECT production_path FROM factory_config WHERE id = 1').get() as any;

    db.prepare('INSERT OR IGNORE INTO factory_config (id, name, soul_model) VALUES (?, ?, ?)')
      .run(factoryId, 'A Fábrica Principal', model);

    const projectInsert = db.prepare('INSERT INTO projects (name, description, status, factory_id) VALUES (?, ?, ?, ?)')
      .run(name, description, 'pending', factoryId);
    const projectId = Number(projectInsert.lastInsertRowid);

    (async () => {
      try {
        const alma = new Alma({ model });
        const rh = new RH(alma);
        await rh.contratarCEO(factoryId, description);
        
        const fabrica = new Fabrica(factoryId, model, projectId, config?.production_path);
        await fabrica.iniciarProducao(projectId, description);
      } catch (err) { console.error(err); }
    })();

    return { projectId, status: 'pending' };
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

server.get('/emails/all', async () => {
  return db.prepare(`
    SELECT l.*, a.name as sender_name, a.role as sender_role, r.name as receiver_name, r.role as receiver_role
    FROM production_logs l
    LEFT JOIN agents a ON l.agent_id = a.id
    LEFT JOIN agents r ON l.to_agent_id = r.id
    WHERE l.type LIKE 'email%'
    ORDER BY l.created_at ASC
  `).all();
});

server.get('/tasks/:projectId', async (request: any) => {
  const { projectId } = request.params;
  return db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
});

server.post('/tasks/update', async (request: any) => {
  const { taskId, status } = request.body;
  db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, taskId);
  return { status: 'ok' };
});

server.get('/emails/:projectId', async (request: any) => {
  const { projectId } = request.params;
  return db.prepare(`
    SELECT l.*, a.name as sender_name, a.role as sender_role, r.name as receiver_name, r.role as receiver_role
    FROM production_logs l
    LEFT JOIN agents a ON l.agent_id = a.id
    LEFT JOIN agents r ON l.to_agent_id = r.id
    WHERE (l.project_id = ? OR l.project_id IS NULL) AND (l.type LIKE 'email%')
    ORDER BY l.created_at ASC
  `).all(projectId);
});

server.post('/emails', async (request: any, reply) => {
  try {
    const { projectId, agentId, toAgentId, message, type, metadata } = request.body;
    
    console.log('[API] Tentativa de envio de e-mail:', { projectId, agentId, toAgentId, type });

    if (!message) {
      return reply.status(400).send({ error: 'Mensagem é obrigatória' });
    }

    // agentId 0 ou null vira NULL no banco (Diretoria)
    const finalAgentId = (agentId === 0 || !agentId) ? null : agentId;
    let finalToAgentId = (toAgentId === 0 || !toAgentId) ? null : toAgentId;
    let finalProjectId = projectId || null;
    const isUser = !finalAgentId;

    // Evita erro de FK quando o projeto/agente já não existe mais
    if (finalProjectId) {
      const projectExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(finalProjectId) as any;
      if (!projectExists) finalProjectId = null;
    }

    if (finalToAgentId) {
      const receiverExists = db.prepare('SELECT id FROM agents WHERE id = ?').get(finalToAgentId) as any;
      if (!receiverExists) finalToAgentId = null;
    }

    // Para mensagens da Diretoria sem destinatário explícito, usa o CEO como padrão
    if (isUser && !finalToAgentId && type !== 'email_broadcast') {
      const ceo = db.prepare(`
        SELECT id
        FROM agents
        WHERE soul_id = 1 AND role = 'CEO'
        ORDER BY id ASC
        LIMIT 1
      `).get() as any;
      if (ceo) finalToAgentId = ceo.id;
    }

    // Evita e-mail órfão: se ainda não houver projeto, tenta anexar ao projeto ativo mais recente
    if (isUser && !finalProjectId) {
      const activeProject = db.prepare(`
        SELECT id
        FROM projects
        WHERE status IN ('pending', 'in_progress', 'review')
        ORDER BY created_at DESC
        LIMIT 1
      `).get() as any;
      if (activeProject) finalProjectId = activeProject.id;
    }

    // Se a Diretoria responder sem projectId (ex.: resposta ao e-mail de boas-vindas) 
    // E não houver nenhum projeto ativo para herdar, cria uma nova missão automaticamente.
    if (isUser && !finalProjectId && (type === 'email_to_agent' || finalToAgentId)) {
      const factory = db.prepare('SELECT * FROM factory_config WHERE id = 1').get() as any;
      if (factory) {
        const title = (message || 'Nova Missão').trim().slice(0, 60) || 'Nova Missão';
        const model = factory.soul_model || 'gpt-4o';

        const projectInsert = db.prepare(`
          INSERT INTO projects (name, description, status, factory_id)
          VALUES (?, ?, 'pending', ?)
        `).run(title, message, 1);
        finalProjectId = Number(projectInsert.lastInsertRowid);

        console.log(`[API] Nova missão criada via e-mail da Diretoria: #${finalProjectId}`);

        (async () => {
          try {
            const alma = new Alma({ model });
            const rh = new RH(alma);
            await rh.contratarCEO(1, message);

            const fabrica = new Fabrica(1, model, finalProjectId, factory.production_path);
            await fabrica.iniciarProducao(finalProjectId, message);
          } catch (err) {
            console.error('[API] Erro ao iniciar missão via e-mail:', err);
          }
        })();
      }
    }

    const insert = db.prepare(`
      INSERT INTO production_logs (project_id, agent_id, to_agent_id, message, type, metadata, is_read)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `);

    let autoMetadata = metadata || {};
    if (typeof autoMetadata === 'string') autoMetadata = JSON.parse(autoMetadata);

    if (message.includes('[HIRE:')) autoMetadata.category = 'approval_request';
    else if (message.includes('[MOVE:')) autoMetadata.category = 'status_change';
    else if (message.toLowerCase().includes('erro') || message.toLowerCase().includes('falha')) autoMetadata.category = 'error_alert';
    else if (type === 'email_to_user') autoMetadata.category = 'status_report';

    const info = insert.run(
      finalProjectId, 
      finalAgentId, 
      finalToAgentId, 
      message, 
      type || 'email_to_agent', 
      Object.keys(autoMetadata).length > 0 ? JSON.stringify(autoMetadata) : null
    );

    // Se for e-mail da Diretoria (User) e contiver termos de aprovação, retomar produção
    const isApproval = /aprovado|ok|pode seguir|autorizado|prosseguir/i.test(message);

    if (isUser && isApproval && finalProjectId) {
      console.log(`[API] Aprovação detectada para Projeto #${finalProjectId}.`);
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(finalProjectId) as any;
      
      if (project) {
        const config = db.prepare('SELECT * FROM factory_config WHERE id = ?').get(project.factory_id) as any;
        
        if (config) {
          (async () => {
            try {
              const fabrica = new Fabrica(project.factory_id, config.soul_model, finalProjectId, config.production_path);
              await fabrica.iniciarProducao(finalProjectId, project.description);
            } catch (err) { console.error('[API] Erro ao retomar produção:', err); }
          })();
        }
      }
    }

    return { id: Number(info.lastInsertRowid), status: 'sent' };
  } catch (error: any) {
    console.error('[API] Erro fatal ao enviar e-mail:', error);
    return reply.status(500).send({ error: error.message });
  }
});

server.post('/emails/read', async (request: any) => {
  const { logId } = request.body;
  db.prepare('UPDATE production_logs SET is_read = 1 WHERE id = ?').run(logId);
  return { status: 'ok' };
});

server.delete('/emails/:logId', async (request: any, reply) => {
  const { logId } = request.params as any;
  const id = Number(logId);
  if (!id || Number.isNaN(id)) {
    return reply.status(400).send({ error: 'Invalid logId' });
  }

  const info = db.prepare(`DELETE FROM production_logs WHERE id = ? AND type LIKE 'email%'`).run(id);
  if (info.changes === 0) {
    return reply.status(404).send({ error: 'Email not found' });
  }
  return { status: 'ok' };
});

server.post('/reset', async () => {
  console.log('[API] ATENÇÃO: Iniciando Reset Total do Sistema...');
  
  try {
    const config = db.prepare('SELECT production_path FROM factory_config WHERE id = 1').get() as any;
    
    db.transaction(() => {
      db.prepare('DELETE FROM production_logs').run();
      db.prepare('DELETE FROM agents').run();
      db.prepare('DELETE FROM projects').run();
      db.prepare('DELETE FROM factory_config').run();
    })();

    const uploadDir = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploadDir)) fs.removeSync(uploadDir);

    if (config?.production_path && fs.existsSync(config.production_path)) {
      fs.removeSync(config.production_path);
    }

    console.log('[API] Reset concluído com sucesso.');
    return { status: 'ok' };
  } catch (err: any) {
    console.error('[API] Erro no Reset:', err.message);
    throw err;
  }
});

server.post('/hire/approve', async (request: any) => {
  const { projectId, recomendacao } = request.body;
  const factory = db.prepare('SELECT factory_id FROM projects WHERE id = ?').get(projectId) as any;
  const config = db.prepare('SELECT soul_model FROM factory_config WHERE id = ?').get(factory.factory_id) as any;
  
  const alma = new Alma({ model: config.soul_model });
  const rh = new RH(alma);
  const contratado = await rh.contratarEspecialista(factory.factory_id, recomendacao);
  
  return { status: 'ok', agent: contratado };
});

server.post('/models', async (request: any) => {
  const { apiKey, baseUrl } = request.body;
  try {
    const client = new OpenAI({ 
      apiKey: apiKey || 'no-key', 
      baseURL: baseUrl || 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: false,
      timeout: 5000 
    });
    const list = await client.models.list();
    const modelIds = list.data.map((m: any) => m.id).sort();
    return modelIds.length > 0 ? modelIds : ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  } catch (error: any) {
    console.error('[API] Erro ao buscar modelos do gateway:', error.message);
    return ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'local-model'];
  }
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log('🚀 Servidor d\'A Fábrica rodando em http://localhost:3001');
  } catch (err) { 
    console.error('CRITICAL STARTUP ERROR:', err);
    process.exit(1); 
  }
};
start();
