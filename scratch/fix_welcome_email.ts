import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('factory.db');

try {
    const ceo = db.prepare('SELECT id, name FROM agents WHERE role = ?').get('CEO') as any;
    
    if (ceo) {
        console.log(`Inserindo email de boas-vindas para: ${ceo.name}`);
        const msg = `[EMAIL] Assunto: Boas-vindas à nossa nova estrutura! | Mensagem: Olá, Diretoria! Eu sou ${ceo.name}, e já assumi o comando d'A Fábrica. Minha primeira tarefa será planejar nossa missão e montar a equipe ideal. Estou pronto para começar assim que você lançar o primeiro projeto!`;
        
        // Verificar se já existe
        const exists = db.prepare('SELECT id FROM production_logs WHERE message LIKE ?').get('%Boas-vindas à nossa nova estrutura%');
        
        if (!exists) {
            db.prepare(`
                INSERT INTO production_logs (project_id, agent_id, message, type, is_read)
                VALUES (NULL, ?, ?, 'email_to_user', 0)
            `).run(ceo.id, msg);
            console.log('Sucesso: Email de boas-vindas inserido.');
        } else {
            console.log('Aviso: Email de boas-vindas já existe.');
        }
    } else {
        console.log('Erro: CEO não encontrado no banco de dados.');
    }
} catch (err) {
    console.error('Erro ao executar script de correção:', err);
} finally {
    db.close();
}
