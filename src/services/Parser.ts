import fs from 'fs-extra';
import path from 'path';
import pdf from 'pdf-parse';
import * as mammoth from 'mammoth';

export class Parser {
  static async parseFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await (pdf as any)(dataBuffer);
        return data.text;
      }
      
      if (ext === '.docx') {
        const data = await mammoth.extractRawText({ path: filePath });
        return data.value;
      }

      const textExtensions = [
        '.txt', '.md', '.json', '.ts', '.js', '.py', '.html', '.css', 
        '.sql', '.env', '.yaml', '.yml', '.xml', '.csv'
      ];

      if (textExtensions.includes(ext)) {
        return fs.readFileSync(filePath, 'utf-8');
      }

      return `[Arquivo não suportado: ${ext}]`;
    } catch (err: any) {
      console.error(`Erro ao processar arquivo ${filePath}:`, err.message);
      return `[Erro ao ler arquivo: ${err.message}]`;
    }
  }

  static async processAndStore(filePath: string, projectId?: number): Promise<string> {
    const content = await this.parseFile(filePath);
    const fileName = path.basename(filePath);
    const docPath = path.join(process.cwd(), 'docs', `${fileName}.md`);
    
    // Salva na base de conhecimento local
    await fs.ensureDir(path.join(process.cwd(), 'docs'));
    await fs.writeFile(docPath, `--- SOURCE: ${fileName} ---\n\n${content}`);

    // Registra no banco de dados para os agentes verem
    const db = (await import('../db/sqlite')).default;
    db.prepare(`
      INSERT INTO production_logs (project_id, message, type, is_read)
      VALUES (?, ?, 'document_parsed', 1)
    `).run(projectId || null, `Arquivo: ${fileName} processado e adicionado à base /docs.\n\nCONTEÚDO EXTRAÍDO:\n${content.slice(0, 3000)}${content.length > 3000 ? '...' : ''}`);

    return content;
  }
}
