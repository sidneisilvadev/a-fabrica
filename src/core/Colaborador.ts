import db from '../db/sqlite';
import { Alma } from './Alma';

export interface ColaboradorData {
  id: number;
  name: string;
  role: string;
  expertise: string;
  personality: string;
}

export class Colaborador {
  constructor(
    public data: ColaboradorData,
    private alma: Alma
  ) {}

  async agir(projetoId: number, fase: string, contexto: string, imageUrl?: string) {
    const isCEO = this.data.role === 'CEO';
    
    // Histórico de comunicações e arquivos lidos (últimas 15 mensagens em ordem cronológica)
    const logs = db.prepare(`
      SELECT * FROM (
        SELECT l.message, a.name as sender, l.type, l.id
        FROM production_logs l
        LEFT JOIN agents a ON l.agent_id = a.id
        WHERE (l.project_id = ? OR l.project_id IS NULL) AND (l.type LIKE 'email%' OR l.type = 'document_parsed')
        ORDER BY l.id DESC LIMIT 15
      ) ORDER BY id ASC
    `).all(projetoId) as any[];

    // Lista de tarefas para contexto
    const tasks = db.prepare(`
      SELECT title, status, priority, (SELECT role FROM agents WHERE id = assigned_to) as assigned_role
      FROM tasks WHERE project_id = ? AND status != 'completed'
    `).all(projetoId) as any[];

    const taskContext = tasks.length > 0
      ? `\n--- LISTA DE TAREFAS PENDENTES ---\n${tasks.map(t => `- [${t.priority.toUpperCase()}] ${t.title} ${t.assigned_role ? `(Resp: ${t.assigned_role})` : ''}`).join('\n')}\n`
      : '';

    const mailboxContext = logs.length > 0 
      ? `\n--- MURAL DE CONTEXTO (E-MAILS E DOCUMENTOS) ---\n${logs.map(e => `[${e.type.toUpperCase()}] DE: ${e.sender || 'DIRETORIA'}\nCONTEÚDO: ${e.message}`).join('\n---\n')}\n`
      : '';

    const systemPrompt = `Você é ${this.data.name}, o ${this.data.role} da Fábrica. 
Fase Atual: ${fase}.
Personalidade: ${this.data.personality}.
Expertise: ${this.data.expertise}.

${taskContext}
${mailboxContext}

Ações (Inicie com a TAG):
1. [THOUGHT]: Raciocínio interno.
2. [ACTION]: Produção técnica (Arquivos: ### nome_arquivo + bloco de código).
3. [EMAIL]: Comunicação com a Diretoria (Organizada e profissional).
   Formato: [EMAIL] Assunto: ... | Mensagem: ...
4. [ADD_TASK]: Cria uma tarefa no sistema.
   Formato: [ADD_TASK: Título | Descrição curta | Prioridade (low, medium, high) | @Papel (Opcional)]
5. [COMPLETE_TASK]: Marca uma tarefa como concluída.
   Formato: [COMPLETE_TASK: Título ou ID]

Ao realizar uma [ACTION], mencione sempre qual tarefa (ID ou Título) você está executando.

${isCEO ? 'Como CEO, conduza brainstorming, registre a decisão, faça reunião inicial, distribua tarefas, acompanhe o progresso de cada agente e use [HIRE: Função] para pedir novos talentos.' : 'Como especialista, execute apenas as tarefas ligadas à sua função e reporte progresso de forma objetiva.'}

Consulte sempre o Mural de Contexto acima para ver documentos processados na pasta /docs.
Assine como ${this.data.name} @ ${this.data.role}.`;

    const acao = await this.alma.pensars(contexto, systemPrompt, imageUrl);
    
    const exists = db.prepare('SELECT id FROM projects WHERE id = ?').get(projetoId);
    if (!exists) return '';

    let type = fase;
    let isEmail = false;

    if (acao.startsWith('[EMAIL]')) {
      type = 'email_to_user';
      isEmail = true;
    } else if (acao.startsWith('[THOUGHT]')) {
      type = 'thought';
    } else if (acao.startsWith('[ACTION]')) {
      type = 'action';
    }

    db.prepare(`
      INSERT INTO production_logs (project_id, agent_id, message, type, is_read)
      VALUES (?, ?, ?, ?, ?)
    `).run(projetoId, this.data.id, acao, type, isEmail ? 0 : 1);

    return acao;
  }
}
