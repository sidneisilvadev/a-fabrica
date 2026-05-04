# 🏭 A Fábrica - Gestão Inteligente & Agentes Autônomos

**A Fábrica** é um ecossistema de agentes de IA projetado para operar como uma empresa real. Através de uma hierarquia estruturada, a IA não apenas executa tarefas, mas planeja, contrata especialistas, realiza reuniões de alinhamento e entrega resultados complexos com supervisão humana mínima.

## 🚀 Visão Geral

Diferente de simples assistentes de chat, **A Fábrica** utiliza o conceito de **"Alma" (Alma.ts)** para dar personalidade e inteligência estratégica ao CEO e aos especialistas. O sistema é capaz de:

- **Análise Profunda de Ideias**: O CEO elabora pautas e mapas de desenvolvimento antes de iniciar a produção.
- **Hiring Dinâmico**: Contratação de especialistas sob demanda (Designer, Programador, Revisor, etc.).
- **Inteligência de Documentos**: Leitura e processamento de PDFs, DOCX e Imagens (Vision).
- **Comunicação Multicanal**: Interface via e-mail interno para interação direta com qualquer membro da equipe.
- **Painel Kanban**: Visualização em tempo real do progresso das tarefas.

---

## 🛠️ Instalação e Setup

Para rodar sua própria instância d'A Fábrica:

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/seu-usuario/a-fabrica.git
   cd a-fabrica
   ```

2. **Instale as dependências**:
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

3. **Configure as chaves**:
   Crie um arquivo `.env` na raiz:
   ```env
   BASE_URL=seu_endpoint_llm
   API_KEY=sua_chave_api
   ```

4. **Inicie o sistema**:
   Execute o script de automação:
   ```bash
   start.bat
   ```

---

## 🍴 Instruções para Fork

Ao realizar um fork deste projeto, você está entrando em um território de experimentação avançada em IA Agêntica. Siga estas diretrizes:

1. **Personalização da Alma**: Sinta-se à vontade para modificar o `systemPrompt` em `Colaborador.ts` para ajustar a cultura da sua empresa.
2. **Novos Especialistas**: Adicione novos papéis no módulo de RH para expandir as capacidades da sua fábrica.
3. **Contribuições**: Pull Requests são bem-vindos para melhorias no motor de processamento de arquivos e na estabilidade do loop de produção.

---

## ⚠️ Limitações e Ética (Intelligent Guardrails)

Este projeto foi construído para ser uma ferramenta de **produtividade e estratégia**. Ao utilizá-lo, esteja ciente das seguintes limitações:

- **Propriedade Intelectual**: A lógica de "Alma" e o fluxo estruturado de produção são o núcleo inovador d'A Fábrica. Use-os para construir, não apenas para replicar.
- **Responsabilidade do Operador**: A IA tem autonomia para criar arquivos e sugerir contratações. A "Diretoria" (Você) deve sempre revisar as decisões críticas, especialmente em `hiring_mode: manual`.
- **Uso de Tokens**: O loop de 15 iterações é potente. Monitore seu consumo de API para evitar custos inesperados.
- **Não para Fins Maliciosos**: É estritamente proibido o uso desta estrutura para automação de spam, phishing ou qualquer atividade ilegal.

---

## 📬 Contato

Desenvolvido para mentes que buscam a automação do futuro.
**A Fábrica - Onde ideias viram ativos.**
