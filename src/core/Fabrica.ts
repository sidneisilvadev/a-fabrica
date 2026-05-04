import db from '../db/sqlite';
import { Alma } from './Alma';
import { Warehouse } from './Warehouse';
import { Colaborador } from './Colaborador';
import { RH } from './RH';
import { Parser } from '../services/Parser';
import * as path from 'path';
import * as fs from 'fs-extra';

export class Fabrica {
  private alma: Alma;
  private warehouse: Warehouse;
  
  constructor(private factoryId: number, model: string, projectId: number, productionPath?: string) {
    this.alma = new Alma({ model });
    this.warehouse = new Warehouse(projectId, productionPath);
  }

  async iniciarProducao(projetoId: number, descricao: string, imageUrl?: string) {
    const project = db.prepare('SELECT is_processing FROM projects WHERE id = ?').get(projetoId) as any;
    if (project?.is_processing) {
      console.log(`[Fabrica] Projeto #${projetoId} já está sendo processado. Abortando nova instância.`);
      return;
    }

    db.prepare('UPDATE projects SET is_processing = 1 WHERE id = ?').run(projetoId);
    console.log(`--- Iniciando Fluxo Estruturado [#${projetoId}] ---`);
    
    const checkActive = () => {
      const p = db.prepare('SELECT id, status FROM projects WHERE id = ?').get(projetoId) as any;
      if (!p) throw new Error('ABORT_DELETED');
      return p.status;
    };

    try {
      const currentStatus = checkActive();
      const config = db.prepare('SELECT * FROM factory_config WHERE id = ?').get(this.factoryId) as any;
      let context = `--- MURAL DE COLABORAÇÃO (#${projetoId}) ---\nPROJETO: ${descricao}\nSTATUS ATUAL: ${currentStatus}\n`;

      // Loop de Iteração Inteligente
      for (let i = 0; i < 15; i++) { 
        const status = checkActive();
        
        // --- NOVO: Processamento de Uploads e Documentos ---
        const uploadedImageUrl = await this.processarUploads(projetoId);
        const currentTurnImageUrl = uploadedImageUrl || imageUrl;

        const colaboradoresData = db.prepare('SELECT * FROM agents WHERE soul_id = ?').all(this.factoryId) as any[];
        const agentes: Record<string, Colaborador> = {};
        colaboradoresData.forEach(c => {
          agentes[c.role.toLowerCase()] = new Colaborador(c, this.alma);
        });

        // --- NOVO: Priorização de Respostas da Equipe à Diretoria ---
        // Verificamos se há e-mails pendentes para QUALQUER agente ativo nesta rodada
        for (const [role, agente] of Object.entries(agentes)) {
          const unreadEmail = db.prepare(`
            SELECT * FROM production_logs 
            WHERE project_id = ? AND to_agent_id = ? AND type = 'email_to_agent' AND is_read = 0 
            ORDER BY created_at ASC LIMIT 1
          `).get(projetoId, agente.data.id) as any;

          if (unreadEmail) {
            console.log(`[Fabrica] ${agente.data.role} detectou nova mensagem da Diretoria. Priorizando resposta.`);
            const resp = await agente.agir(projetoId, 'RESPOSTA', `A Diretoria enviou uma mensagem direta para você: "${unreadEmail.message}". Responda-a agora com [EMAIL] ou tome as ações necessárias.`, currentTurnImageUrl);
            db.prepare('UPDATE production_logs SET is_read = 1 WHERE id = ?').run(unreadEmail.id);
            checkActive();
            context += `\n[${agente.data.role} - RESPOSTA]: ${resp}\n`;
            this.processFiles(resp);
            this.processTasks(projetoId, resp);
            await new Promise(resolve => setTimeout(resolve, 3000));
            // Se o agente enviou um e-mail, encerramos a vez dele para aguardar resposta
            if (resp.startsWith('[EMAIL]')) break;
          }
        }

        // 1. AÇÃO DO CEO: O Maestro do Fluxo
        if (agentes.ceo) {
          let ceoPrompt = `Analise o estado do projeto.
STATUS ATUAL: ${status}.

DIRETRIZES POR FASE:
- PENDING (PLANEJAMENTO): Siga esta ordem obrigatória e detalhada:
  1. ANÁLISE DE IDEIA: Entenda o objetivo real, o público-alvo e a proposta de valor. Elabore a ideia antes de planejar.
  2. MAPA DE DESENVOLVIMENTO: Registre em "MAPA_DESENVOLVIMENTO.md" a arquitetura, as etapas técnicas e os profissionais necessários.
  3. CONTRATAÇÃO: Identifique quem falta. Se hiring_mode = auto, contrate com [HIRE: Função]. Se manual, envie [EMAIL] como pedido de aprovação detalhado.
  4. REUNIÃO DE BRIEFING: Após todos contratados, realize uma reunião (salve em "REUNIAO_EQUIPE.md") explicando o projeto e as responsabilidades de cada um.
  5. TAREFAS: Distribua o trabalho em [ADD_TASK] com descrição clara, prioridade e atribuindo ao papel correto (@Papel).
  6. APROVAÇÃO FINAL: Explique o plano completo à Diretoria por [EMAIL] e peça autorização para iniciar a produção.
  7. Só mova para in_progress ([MOVE: in_progress]) após briefing realizado e aprovação da Diretoria.

- IN_PROGRESS (PRODUÇÃO): Monitore as tarefas. Se houver erros reportados, analise-os antes de seguir. Se tudo estiver pronto, [MOVE: review].
- REVIEW (REVISÃO): Acione o 'Reviewer'. Peça aprovação final da Diretoria por [EMAIL] antes de marcar como completed.

COMANDOS ESPECIAIS:
- [MOVE: status]: Altera a fase do projeto (pending, in_progress, review, completed).
- [EMAIL]: Fala com a Diretoria.
- [HIRE: Função]: Contrata agente.

${context}`;

          const resp = await agentes.ceo.agir(projetoId, 'GESTAO', ceoPrompt, currentTurnImageUrl);
          checkActive();
          context += `\n[CEO]: ${resp}\n`;
          this.processFiles(resp);
          this.processTasks(projetoId, resp);

          // Manter o contexto sob controle (últimos 5000 caracteres)
          if (context.length > 5000) {
            context = "--- (Contexto truncado para economizar tokens) ---\n" + context.slice(-5000);
          }

          // Pacing
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Pausa para resposta do usuário
          if (resp.startsWith('[EMAIL]')) {
            console.log('[Fabrica] CEO aguardando resposta da Diretoria via Mailbox.');
            break;
          }

          // Lógica de Movimentação de Status
          if (resp.includes('[MOVE:')) {
            const nextStatus = resp.match(/\[MOVE:\s*(\w+)\]/)?.[1];
            if (nextStatus) {
              if (status === 'pending' && nextStatus === 'in_progress') {
                const planningCheck = this.validatePlanningReadiness(projetoId);
                if (!planningCheck.ready) {
                  context += `\n[SISTEMA]: BLOQUEIO DE AVANÇO. Pendências do planejamento: ${planningCheck.reasons.join('; ')}.\n`;
                  continue;
                }
              }
              db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(nextStatus, projetoId);
              context += `\n[SISTEMA]: Projeto movido para fase: ${nextStatus.toUpperCase()}.\n`;
              break; // Reiniciar ciclo no novo status
            }
          }

          // Lógica de Contratação
          if (resp.includes('[HIRE:')) {
            const match = resp.match(/\[HIRE:\s*([^\]]+)\]/);
            if (match) {
              const rec = match[1];
              if (config.hiring_mode === 'auto') {
                const rh = new RH(this.alma);
                await rh.contratarEspecialista(this.factoryId, rec);
                context += `\n[SISTEMA]: Especialista ${rec} contratado.\n`;
              } else {
                context += `\n[SISTEMA]: Contratação de ${rec} aguardando aprovação via [EMAIL].\n`;
                break;
              }
            }
          }
        }

        // 2. AÇÃO DOS ESPECIALISTAS
        let shouldPause = false;
        for (const [role, agente] of Object.entries(agentes)) {
          if (role === 'ceo') continue;

          const isReviewPhase = status === 'review' && role === 'reviewer';
          const isProductionPhase = status === 'in_progress' && role !== 'reviewer';
          const isMentioned = context.toLowerCase().includes(role) || context.toLowerCase().includes(agente.data.name.toLowerCase());

          if (isMentioned || isReviewPhase || (isProductionPhase && i > 2)) {
             await new Promise(resolve => setTimeout(resolve, 5000));
             const resp = await agente.agir(projetoId, 'EXECUÇÃO', `Atue conforme as ordens do CEO e o Mapa de Desenvolvimento.\n${context}`);
             checkActive();
             this.processFiles(resp);
             this.processTasks(projetoId, resp);
             context += `\n[${agente.data.role}]: ${resp.slice(0, 300)}...\n`;
             
             // Manter o contexto sob controle
             if (context.length > 5000) {
               context = "--- (Contexto truncado para economizar tokens) ---\n" + context.slice(-5000);
             }

             if (resp.startsWith('[EMAIL]')) {
                console.log(`[Fabrica] ${agente.data.role} aguardando resposta da Diretoria.`);
                shouldPause = true;
                break;
             }
          }
        }

        if (shouldPause) break; // Sair do loop de iteração também

        // 3. CHECK-IN AUTOMÁTICO (A cada 4 iterações ou ao final)
        if (i > 0 && i % 4 === 0 && agentes.ceo) {
           await agentes.ceo.agir(projetoId, 'INFORMATIVO', `Gere um e-mail curto de "Check-in" informando o progresso atual das tarefas e o que será feito a seguir.`);
        }
      }

      console.log(`--- Ciclo Estruturado [#${projetoId}] finalizado ---`);
    } catch (err: any) {
      console.error(`--- Erro no Fluxo [#${projetoId}] ---`, err.message);
    } finally {
      db.prepare('UPDATE projects SET is_processing = 0 WHERE id = ?').run(projetoId);
    }
  }

  private processFiles(text: string) {
    const files = this.extractFiles(text);
    for (const f of files) {
      this.warehouse.saveFile(f.name, f.content);
    }
  }

  private processTasks(projectId: number, text: string) {
    // [ADD_TASK: Título | Descrição | Prioridade | @Papel]
    const addTaskRegex = /\[ADD_TASK:\s*([^|\]]+)(?:\|\s*([^|\]]+))?(?:\|\s*([^|\]]+))?(?:\|\s*@([^\]]+))?\]/gi;
    let addMatch;
    while ((addMatch = addTaskRegex.exec(text)) !== null) {
      const title = addMatch[1].trim();
      const desc = addMatch[2]?.trim() || '';
      const priority = addMatch[3]?.trim().toLowerCase() || 'medium';
      const roleTarget = addMatch[4]?.trim();

      let assignedTo = null;
      if (roleTarget) {
        const agent = db.prepare('SELECT id FROM agents WHERE soul_id = ? AND LOWER(role) = LOWER(?)')
          .get(this.factoryId, roleTarget) as any;
        if (agent) assignedTo = agent.id;
      }
      
      db.prepare('INSERT INTO tasks (project_id, title, description, status, priority, assigned_to) VALUES (?, ?, ?, ?, ?, ?)')
        .run(projectId, title, desc, 'pending', priority, assignedTo);
      console.log(`[Fabrica] Nova tarefa adicionada: ${title} (${priority}) ${roleTarget ? `-> @${roleTarget}` : ''}`);
    }

    // [COMPLETE_TASK: Título ou ID]
    const completeTaskRegex = /\[COMPLETE_TASK:\s*([^\]]+)\]/gi;
    let completeMatch;
    while ((completeMatch = completeTaskRegex.exec(text)) !== null) {
      const identifier = completeMatch[1].trim();
      if (/^\d+$/.test(identifier)) {
        db.prepare('UPDATE tasks SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id = ?')
          .run(parseInt(identifier), projectId);
      } else {
        db.prepare('UPDATE tasks SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE title LIKE ? AND project_id = ?')
          .run(`%${identifier}%`, projectId);
      }
      console.log(`[Fabrica] Tarefa marcada como concluída: ${identifier}`);
    }
  }

  private extractFiles(text: string): { name: string, content: string }[] {
    const files: { name: string, content: string }[] = [];
    // Regex melhorada para capturar arquivos em diversos formatos de markdown
    const regex = /(?:###|\*\*|Arquivo:)\s*([\w\.\/\-_]+)\s*(?:\*\*|)\s*\n+```[\w]*\n([\s\S]*?)```/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      files.push({ name: match[1].trim(), content: match[2] });
    }
    return files;
  }

  private async processarUploads(projetoId: number): Promise<string | undefined> {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) return;

    let lastImageUrl: string | undefined;
    const files = fs.readdirSync(uploadDir);
    
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const ext = path.extname(file).toLowerCase();
      console.log(`[Fabrica] Detectado novo arquivo em /uploads: ${file}`);
      
      try {
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
          const buffer = fs.readFileSync(filePath);
          lastImageUrl = `data:image/${ext.slice(1)};base64,${buffer.toString('base64')}`;
          
          db.prepare(`
            INSERT INTO production_logs (project_id, message, type, is_read)
            VALUES (?, ?, 'document_parsed', 1)
          `).run(projetoId, `Imagem detectada: ${file}. Analisando via Vision.`);
        } else {
          await Parser.processAndStore(filePath, projetoId);
        }
        
        // Move para docs ou remove
        const destPath = path.join(process.cwd(), 'docs', file);
        if (lastImageUrl) {
           fs.moveSync(filePath, destPath, { overwrite: true });
        } else {
           fs.removeSync(filePath);
        }
      } catch (err: any) {
        console.error(`[Fabrica] Erro ao processar upload ${file}:`, err.message);
      }
    }
    return lastImageUrl;
  }

  private validatePlanningReadiness(projectId: number): { ready: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const mapExists = this.warehouse.readFile('MAPA_DESENVOLVIMENTO.md').trim().length > 0;
    const meetingExists = this.warehouse.readFile('REUNIAO_EQUIPE.md').trim().length > 0;
    const taskCount = (db.prepare('SELECT COUNT(*) as c FROM tasks WHERE project_id = ?').get(projectId) as any)?.c || 0;

    if (!mapExists) reasons.push('falta MAPA_DESENVOLVIMENTO.md');
    if (!meetingExists) reasons.push('falta REUNIAO_EQUIPE.md');
    if (taskCount < 2) reasons.push('faltam tarefas suficientes');

    return { ready: reasons.length === 0, reasons };
  }
}
