import fs from 'fs-extra';
import path from 'path';

export class Warehouse {
  private projectPath: string;

  constructor(projectId: number, customBasePath?: string) {
    const base = customBasePath || path.join(process.cwd(), 'projects');
    this.projectPath = path.join(base, projectId.toString());
    fs.ensureDirSync(this.projectPath);
  }

  saveFile(filename: string, content: string) {
    // Prevent path traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(this.projectPath, safeFilename);
    const dir = path.dirname(filePath);
    fs.ensureDirSync(dir);
    fs.writeFileSync(filePath, content);
    console.log(`[Warehouse] Arquivo salvo: ${safeFilename}`);
  }

  readFile(filename: string): string {
    const safeFilename = path.basename(filename);
    const filePath = path.join(this.projectPath, safeFilename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
  }

  listFiles(): string[] {
    return fs.readdirSync(this.projectPath);
  }

  getPath(): string {
    return this.projectPath;
  }
}
