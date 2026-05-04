import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Factory, Users, Send, Shield, Cpu, Mail,
  LayoutDashboard, Settings, Activity, 
  CheckCircle2, Clock, Play, FileCode, MessageSquare,
  ArrowRightLeft, Folder, Globe, Trash2,
  Forward, UserPlus, ShieldAlert, Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

const API_URL = 'http://localhost:3001';

// Types
interface Agent {
  id: number;
  name: string;
  role: string;
  expertise: string;
  personality: string;
}

interface Project {
  id: number;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'review' | 'completed';
}

interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

interface Log {
  id: number;
  project_id: number;
  agent_id: number;
  to_agent_id?: number;
  message: string;
  type: string;
  metadata?: string;
  is_read: number;
  created_at: string;
  sender_name?: string;
  sender_role?: string;
  receiver_name?: string;
  receiver_role?: string;
}

interface ProjectFile {
  name: string;
  content: string;
}

export default function App() {
  const [view, setView] = useState<'dashboard' | 'agents' | 'activity' | 'mailbox' | 'tasks'>('dashboard');
  const [step, setStep] = useState(0); 
  const [factory, setFactory] = useState<any>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allLogs, setAllLogs] = useState<Log[]>([]);
  const [emails, setEmails] = useState<Log[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newLogsCount, setNewLogsCount] = useState(0);
  const [newEmailsCount, setNewEmailsCount] = useState(0);
  const prevLogsCountRef = useRef(0);

  useEffect(() => {
    checkFactory();
  }, []);

  useEffect(() => {
    if (step === 2) {
      loadData();
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [step, view]);

  useEffect(() => {
    if (selectedProject) loadProjectDetails();
  }, [selectedProject]);

  const checkFactory = async () => {
    try {
      const res = await axios.get(`${API_URL}/factory`);
      if (res.data.length > 0) {
        setFactory(res.data[0]);
        setStep(2);
      } else {
        setStep(1);
      }
    } catch (e) { setStep(1); }
  };

  const loadData = async () => {
    try {
      const [pRes, aRes, fRes] = await Promise.all([
        axios.get(`${API_URL}/projects`),
        axios.get(`${API_URL}/agents`),
        axios.get(`${API_URL}/factory`)
      ]);

      const allLogsRes = await Promise.all(pRes.data.map((p: any) => axios.get(`${API_URL}/logs/${p.id}`)));
      const combinedLogs = allLogsRes.flatMap(r => r.data);
      
      const emailsRes = await axios.get(`${API_URL}/emails/all`);
      const combinedEmails = emailsRes.data;

      const tasksRes = await Promise.all(pRes.data.map((p: any) => axios.get(`${API_URL}/tasks/${p.id}`)));
      const combinedTasks = tasksRes.flatMap(r => r.data);

      if (prevLogsCountRef.current > 0 && combinedLogs.length > prevLogsCountRef.current && view !== 'activity') {
          setNewLogsCount(prev => prev + (combinedLogs.length - prevLogsCountRef.current));
      }
      prevLogsCountRef.current = combinedLogs.length;

      const unreadEmails = combinedEmails.filter((e: Log) => e.is_read === 0 && e.type === 'email_to_user');
      setNewEmailsCount(unreadEmails.length);

      setProjects(pRes.data);
      setAgents(aRes.data);
      setTasks(combinedTasks);
      setFactory(fRes.data[0]);
      setAllLogs(combinedLogs);
      setEmails(combinedEmails);
    } catch (e) {}
  };

  const loadProjectDetails = async () => {
    if (!selectedProject) return;
    try {
      const fRes = await axios.get(`${API_URL}/files/${selectedProject.id}`);
      setFiles(fRes.data);
    } catch (e) {}
  };

  if (step === 0) return (
    <div className="h-screen w-screen bg-[#0a0a0c] flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,242,255,0.1),_transparent)] animate-pulse" />
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 flex flex-col items-center">
        <Factory size={80} className="text-accent mb-8 animate-bounce" />
        <h1 className="text-7xl font-black text-white tracking-tighter italic uppercase mb-2">A FÁBRICA</h1>
      </motion.div>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-background text-gray-200 font-sans overflow-hidden flex">
      <aside className="w-16 bg-black/60 border-r border-white/5 flex flex-col items-center py-8 gap-10">
        <div className="text-accent hover:scale-110 transition cursor-pointer" onClick={() => setView('dashboard')}>
          <Factory size={24} />
        </div>
        <nav className="flex flex-col gap-8 text-gray-600">
          <SidebarIcon icon={<LayoutDashboard size={20} />} active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <SidebarIcon icon={<Users size={20} />} active={view === 'agents'} onClick={() => setView('agents')} />
          <SidebarIcon icon={<CheckCircle2 size={20} />} active={view === 'tasks'} onClick={() => setView('tasks')} />
          
          <SidebarIcon 
            icon={<Mail size={20} />} 
            active={view === 'mailbox'} 
            onClick={() => setView('mailbox')} 
            badge={newEmailsCount}
          />

          <SidebarIcon 
            icon={<Activity size={20} />} 
            active={view === 'activity'} 
            onClick={() => { setView('activity'); setNewLogsCount(0); }} 
            badge={newLogsCount}
          />

          <SidebarIcon icon={<Settings size={20} />} active={showSettings} onClick={() => setShowSettings(true)} />
        </nav>
      </aside>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <Onboarding key="onboarding" onComplete={() => setStep(2)} />
        ) : view === 'dashboard' ? (
          <KanbanDashboard 
            key="dashboard"
            factory={factory}
            projects={projects}
            agents={agents}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            allLogs={allLogs}
            files={files}
            onNewProject={() => loadData()}
          />
        ) : view === 'agents' ? (
          <AgentsRoster key="agents" agents={agents} factory={factory} />
        ) : view === 'mailbox' ? (
          <MailboxView key="mailbox" emails={emails} agents={agents} projects={projects} onRefresh={loadData} />
        ) : view === 'tasks' ? (
          <TasksView key="tasks" tasks={tasks} projects={projects} onRefresh={loadData} />
        ) : (
          <ActivityFeed key="activity" logs={allLogs} agents={agents} />
        )}
      </AnimatePresence>

      {showSettings && (
        <SettingsModal 
          factory={factory} 
          onClose={() => setShowSettings(false)} 
          onSave={() => loadData()} 
          onReset={() => { setStep(1); setFactory(null); setView('dashboard'); setShowSettings(false); }} 
        />
      )}
    </div>
  );
}

function SidebarIcon({ icon, active, onClick, badge }: any) {
  return (
    <div className="relative cursor-pointer group" onClick={onClick}>
      <div className={`${active ? 'text-accent' : 'hover:text-white'} transition`}>{icon}</div>
      {badge > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-bounce">
          {badge}
        </span>
      )}
    </div>
  );
}

// --- Mailbox View ---
function MailboxView({ emails, agents, projects, onRefresh }: any) {
  const [selectedEmail, setSelectedEmail] = useState<Log | null>(null);
  const [replyText, setReplyText] = useState('');
  const [forwardTo, setForwardTo] = useState<number | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);

  const isOrphanEmail = (email: Log) => {
    const isWelcome = email.type === 'email_to_user' && email.project_id == null;
    const isBroadcast = email.type === 'email_broadcast';
    return !isWelcome && !isBroadcast && email.project_id == null;
  };

  const markAsRead = async (logId: number) => {
    await axios.post(`${API_URL}/emails/read`, { logId });
    onRefresh();
  };

  const [attachments, setAttachments] = useState<any[]>([]);

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_URL}/upload`, formData);
    setAttachments([...attachments, res.data]);
  };

  const handleSendReply = async () => {
    if (!replyText && attachments.length === 0) return;

    const resolveReplyTarget = () => {
      if (forwardTo) return forwardTo;
      if (!selectedEmail) return null;
      if (selectedEmail.agent_id && selectedEmail.agent_id !== 0) return selectedEmail.agent_id;
      if (selectedEmail.to_agent_id && selectedEmail.to_agent_id !== 0) return selectedEmail.to_agent_id;
      if (selectedContactId) return selectedContactId;
      return null;
    };

    const targetAgentId = resolveReplyTarget();
    const isBroadcast = !selectedEmail && !forwardTo;

    if (selectedEmail && !isBroadcast && !targetAgentId) {
      alert('Nao foi possivel identificar o destinatario desta resposta. Use "Encaminhar".');
      return;
    }

    // Proteção extra para impedir envio órfão pela UI
    if (!isBroadcast) {
      const isWelcomeReply =
        !!selectedEmail &&
        selectedEmail.project_id == null &&
        selectedEmail.type === 'email_to_user';
      const hasProject =
        (selectedEmail && selectedEmail.project_id !== null && selectedEmail.project_id !== undefined) ||
        (projects.length > 0 && projects[0]?.id);
      if (!hasProject && !isWelcomeReply) {
        alert('Nao foi possivel identificar o projeto desta resposta. Abra uma missao ou selecione um e-mail vinculado.');
        return;
      }
    }

    await axios.post(`${API_URL}/emails`, {
      projectId: selectedEmail ? selectedEmail.project_id : (projects.length > 0 ? projects[0].id : null),
      agentId: 0, 
      toAgentId: targetAgentId,
      message: replyText,
      type: isBroadcast ? 'email_broadcast' : 'email_to_agent',
      metadata: attachments.length > 0 ? { files: attachments } : null
    });
    
    setReplyText('');
    setAttachments([]);
    setForwardTo(null);
    setSelectedContactId(null);
    setSelectedEmail(null);
    onRefresh();
  };

  const handleForward = (agentId: number) => {
    setForwardTo(agentId);
    setSelectedContactId(agentId);
    setReplyText(`[ENCAMINHADO DE ${selectedEmail?.sender_name}]\n---\n${selectedEmail?.message}\n---\nOBSERVAÇÕES DA DIRETORIA: `);
  };

  const handleDeleteEmail = async () => {
    if (!selectedEmail) return;
    await axios.delete(`${API_URL}/emails/${selectedEmail.id}`);
    setSelectedEmail(null);
    setForwardTo(null);
    setSelectedContactId(null);
    setReplyText('');
    setAttachments([]);
    onRefresh();
  };

  const handleApproveHire = async (recomendacao: string) => {
    if (!selectedEmail) return;
    await axios.post(`${API_URL}/hire/approve`, {
      projectId: selectedEmail.project_id,
      recomendacao
    });
    alert('Especialista contratado e a caminho!');
    onRefresh();
  };

  const sortedEmails = [...emails].reverse();

  return (
    <main className="flex-1 flex bg-[#0a0a0c] overflow-hidden">
      <div className="w-96 border-r border-white/5 flex flex-col">
        <header className="p-8 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Mailbox</h2>
          <button 
            onClick={() => { setSelectedEmail(null); setForwardTo(null); setSelectedContactId(null); setReplyText(''); }}
            className="p-2 bg-accent/10 text-accent rounded-lg hover:bg-accent hover:text-black transition"
            title="Nova Reunião / Broadcast"
          >
            <Users size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {sortedEmails.map(email => (
            <div 
              key={email.id} 
              onClick={() => { setSelectedEmail(email); setForwardTo(null); if(email.is_read === 0) markAsRead(email.id); }}
              className={`p-6 border-b border-white/5 cursor-pointer transition ${selectedEmail?.id === email.id ? 'bg-accent/5 border-l-4 border-l-accent' : 'hover:bg-white/[0.02]'} ${email.is_read === 0 ? 'bg-white/[0.03]' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[9px] font-black text-accent uppercase tracking-widest">
                  {email.type === 'email_broadcast' ? '📢 REUNIÃO GERAL' : `${email.sender_name || 'DIRETORIA'} @ ${email.sender_role || 'VOCÊ'}`}
                </span>
                {isOrphanEmail(email) && (
                  <span className="text-[7px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">
                    órfão
                  </span>
                )}
                {email.project_id && (
                  <span className="text-[7px] bg-white/5 px-2 py-0.5 rounded-full text-gray-500 font-black uppercase tracking-tighter">
                    {projects.find((p: any) => p.id === email.project_id)?.name || 'Projeto'}
                  </span>
                )}
                <span className="text-[8px] text-gray-500">{new Date(email.created_at).toLocaleTimeString()}</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1 line-clamp-1">
                {email.message.includes('|') ? email.message.split('|')[0].replace('Assunto:', '').trim() : (email.type === 'email_broadcast' ? 'Pauta de Alinhamento' : 'Informativo')}
              </h4>
              <p className="text-[10px] text-gray-500 line-clamp-2 italic">
                {email.message.includes('|') ? email.message.split('|')[1]?.trim().slice(0, 80) : email.message.slice(0, 80)}...
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {(selectedEmail || forwardTo !== null || (selectedEmail === null && replyText !== '')) ? (
          <>
            <header className="p-8 border-b border-white/5 flex justify-between items-center">
              <div>
                 {selectedEmail ? (
                   <>
                     <h3 className="text-xl font-black text-white uppercase italic">{selectedEmail.sender_name || 'DIRETORIA'} @ {selectedEmail.sender_role || 'VOCÊ'}</h3>
                     <p className="text-xs text-gray-500">Para: {selectedEmail.type === 'email_broadcast' ? 'TODOS OS AGENTES' : (selectedEmail.receiver_name || 'DIRETORIA') + ' @ ' + (selectedEmail.receiver_role || 'VOCÊ')}</p>
                   </>
                 ) : (
                   <>
                     <h3 className="text-xl font-black text-accent uppercase italic">Nova Reunião de Grupo</h3>
                     <p className="text-xs text-gray-500">Pauta geral para todos os colaboradores ativos.</p>
                   </>
                 )}
              </div>
              <div className="flex gap-4">
                {selectedEmail && (
                  <div className="relative group">
                    <button className="p-3 bg-white/5 rounded-xl hover:text-accent transition flex items-center gap-2 text-[10px] font-black">
                      <Forward size={18} /> ENCAMINHAR
                    </button>
                    <div className="absolute top-full right-0 mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl hidden group-hover:block z-50 w-48 shadow-2xl">
                      {agents.filter((a:any) => a.id !== selectedEmail.agent_id).map((a:any) => (
                        <button key={a.id} onClick={() => handleForward(a.id)} className="w-full p-4 text-left text-[10px] font-black hover:bg-accent hover:text-black transition border-b border-white/5 last:border-0 uppercase">{a.name} @ {a.role}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button className="p-3 bg-white/5 rounded-xl hover:text-red-500 transition" onClick={handleDeleteEmail}><Trash2 size={18} /></button>
              </div>
            </header>
            <div className="flex-1 p-10 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_center,_rgba(0,242,255,0.02),_transparent)]">
              {selectedEmail ? (
                <div className="bg-white/[0.03] border border-white/5 p-12 rounded-[40px] shadow-2xl prose prose-invert max-w-none prose-p:text-lg prose-p:leading-relaxed">
                  <ReactMarkdown>{selectedEmail.message}</ReactMarkdown>

                  {selectedEmail.metadata && (
                    <div className="mt-8 pt-8 border-t border-black/10">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-accent mb-4">Anexos / Metadados</h5>
                      <pre className="text-[10px] bg-black/20 p-4 rounded-xl overflow-x-auto">
                        {JSON.stringify(JSON.parse(selectedEmail.metadata), null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedEmail.message.includes('[HIRE:') && (
                    <div className="mt-12 p-8 bg-accent/10 border border-accent/20 rounded-3xl flex items-center justify-between">
                      <div>
                        <h4 className="text-accent font-black uppercase text-sm mb-1 flex items-center gap-2"><UserPlus size={16} /> Solicitação de Contratação</h4>
                        <p className="text-xs text-gray-400 italic">O CEO sugere a entrada de um novo especialista.</p>
                      </div>
                      <button 
                        onClick={() => handleApproveHire(selectedEmail.message.match(/\[HIRE:\s*([^\]]+)\]/)?.[1] || '')}
                        className="bg-accent text-black px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-105 transition"
                      >
                        Aprovar Agora
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-700">
                  <Users size={60} className="mb-4 opacity-20" />
                  <p className="text-xs uppercase font-black tracking-widest italic">Escreva sua pauta para a reunião geral abaixo</p>
                </div>
              )}
            </div>
            <footer className="p-8 border-t border-white/5 bg-black/20">
              <div className="mb-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Contato</label>
                <select
                  value={selectedContactId ?? ''}
                  onChange={(e) => setSelectedContactId(e.target.value ? Number(e.target.value) : null)}
                  disabled={!!selectedEmail && !forwardTo}
                  className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white text-sm outline-none focus:border-accent"
                >
                  <option value="">
                    {!!selectedEmail && !forwardTo ? 'Responder usa destinatário da conversa' : 'Selecionar agente (opcional)'}
                  </option>
                  {agents.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} @ {a.role}</option>
                  ))}
                </select>
              </div>
              {attachments.length > 0 && (
                <div className="flex gap-4 mb-4">
                  {attachments.map((at, i) => (
                    <div key={i} className="bg-accent/10 border border-accent/20 px-4 py-2 rounded-xl flex items-center gap-2">
                      <Paperclip size={12} className="text-accent" />
                      <span className="text-[10px] font-black text-white uppercase tracking-tighter truncate max-w-[100px]">{at.filename}</span>
                      <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-white transition">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative flex gap-4">
                <label className="p-4 bg-white/5 rounded-3xl cursor-pointer hover:bg-white/10 transition flex items-center justify-center">
                  <Paperclip size={20} className="text-gray-400" />
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
                <textarea 
                  className="flex-1 bg-black/40 border border-white/10 p-6 rounded-3xl text-white focus:border-accent transition outline-none h-32 text-sm italic resize-none" 
                  placeholder={forwardTo ? "Adicione seu comentário ao encaminhamento..." : "Mensagem para o time..."}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                />
                <button 
                  onClick={handleSendReply}
                  className="absolute bottom-6 right-6 bg-accent text-black p-4 rounded-2xl shadow-xl hover:scale-110 transition flex items-center gap-2 font-black text-xs uppercase"
                >
                  <Send size={20} /> {forwardTo ? 'Encaminhar' : 'Enviar'}
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
            <Mail size={80} className="mb-6 opacity-10" />
            <p className="text-xs uppercase font-black tracking-[0.4em]">Selecione uma mensagem ou inicie uma reunião</p>
          </div>
        )}
      </div>
    </main>
  );
}

// --- Tasks View ---
function TasksView({ tasks, projects, onRefresh }: any) {
  const updateTaskStatus = async (taskId: number, status: string) => {
    await axios.post(`${API_URL}/tasks/update`, { taskId, status });
    onRefresh();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500 bg-red-500/10';
      case 'medium': return 'text-orange-500 bg-orange-500/10';
      case 'low': return 'text-blue-500 bg-blue-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  return (
    <main className="flex-1 p-10 bg-[#0a0a0c] overflow-y-auto custom-scrollbar">
      <header className="mb-12">
        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-2">Painel de Tarefas</h2>
        <p className="text-gray-500 text-sm uppercase tracking-widest font-bold">Monitoramento granular da linha de produção</p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {projects.map((project: any) => {
          const projectTasks = tasks.filter((t: any) => t.project_id === project.id);
          if (projectTasks.length === 0) return null;

          return (
            <section key={project.id} className="bg-white/[0.02] border border-white/5 rounded-[32px] p-8">
              <h3 className="text-xl font-black text-accent uppercase italic mb-6 flex items-center gap-3">
                <Folder size={24} /> {project.name}
              </h3>
              
              <div className="space-y-4">
                {projectTasks.map((task: any) => (
                  <div key={task.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl flex items-center justify-between group hover:bg-white/[0.04] transition">
                    <div className="flex items-center gap-6">
                      <div 
                        onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                        className={`cursor-pointer transition ${task.status === 'completed' ? 'text-green-500' : 'text-gray-600 hover:text-accent'}`}
                      >
                        {task.status === 'completed' ? <CheckCircle2 size={28} /> : <Clock size={28} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className={`font-bold text-lg ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-white'}`}>{task.title}</h4>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 italic">{task.description}</p>
                      </div>
                    </div>
                    
                    <div className="text-[10px] text-gray-600 font-mono">
                      Criada em: {new Date(task.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {tasks.length === 0 && (
          <div className="h-96 flex flex-col items-center justify-center text-gray-700 opacity-20">
            <CheckCircle2 size={80} className="mb-4" />
            <p className="text-xl font-black uppercase tracking-widest">Nenhuma tarefa registrada</p>
          </div>
        )}
      </div>
    </main>
  );
}

// --- Dashboard Component ---
function KanbanDashboard({ factory, projects, agents, selectedProject, setSelectedProject, allLogs, files, onNewProject }: any) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState<{project: any, to: string} | null>(null);
  const [justification, setJustification] = useState('');
  const [rightTab, setRightTab] = useState<'chat' | 'code'>('chat');

  const columns = [
    { title: 'Planejamento', icon: <Clock size={16} />, status: 'pending', color: 'text-gray-500' },
    { title: 'Produção', icon: <Play size={16} />, status: 'in_progress', color: 'text-accent' },
    { title: 'Revisão e Controle', icon: <ShieldAlert size={16} />, status: 'review', color: 'text-orange-500' },
    { title: 'Armazém (Finalizado)', icon: <CheckCircle2 size={16} />, status: 'completed', color: 'text-green-500' },
  ];

  const handleMove = async () => {
    if (!showMoveModal) return;
    await axios.post(`${API_URL}/move-project`, { 
      projectId: showMoveModal.project.id, 
      status: showMoveModal.to,
      justification 
    });
    setShowMoveModal(null);
    setJustification('');
    onNewProject();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta missão? Todos os arquivos serão apagados.')) {
      await axios.delete(`${API_URL}/projects/${id}`);
      onNewProject();
    }
  };

  return (
    <main className="flex-1 flex flex-col p-6 bg-[radial-gradient(circle_at_top_right,_rgba(0,242,255,0.03),_transparent)] overflow-hidden">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-1 uppercase italic leading-none">{factory?.name || 'A FÁBRICA'}</h1>
          <p className="text-[9px] text-gray-500 font-bold tracking-[0.2em] uppercase">Unidade: {factory?.industry || 'Processamento'}</p>
        </div>
        <button className="bg-accent text-black px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-[0_0_30px_rgba(0,242,255,0.2)] hover:scale-105 transition" onClick={() => setShowNewModal(true)}>Lançar Missão</button>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-hidden">
        {columns.map(col => (
          <div key={col.status} className="flex flex-col gap-4 overflow-hidden bg-white/[0.01] p-3 rounded-3xl border border-white/5">
            <div className={`flex items-center gap-2 ${col.color} font-black text-[9px] uppercase tracking-[0.2em] px-2 mb-2`}>
              <span className="opacity-50">{col.icon}</span> {col.title}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              {projects.filter((p: any) => p.status === col.status).map((p: any) => {
                const projectLogs = allLogs.filter((l: any) => l.project_id === p.id);
                const latestLog = projectLogs[projectLogs.length - 1];
                const activeAgent = latestLog ? agents.find((a: any) => a.id === latestLog.agent_id) : null;
                const summary = latestLog ? latestLog.message.replace(/[#*`]/g, '').slice(0, 50) + (latestLog.message.length > 50 ? '...' : '') : 'Aguardando início...';

                return (
                  <motion.div 
                    layoutId={p.id} key={p.id} onClick={() => setSelectedProject(p)}
                    className={`group p-4 rounded-2xl border transition cursor-pointer relative overflow-hidden ${selectedProject?.id === p.id ? 'bg-accent/5 border-accent/40 shadow-[0_0_20px_rgba(0,242,255,0.05)]' : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-white text-lg group-hover:text-accent transition">{p.name}</h3>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={(e) => { e.stopPropagation(); setShowMoveModal({project: p, to: 'pending'})}} className="p-1.5 bg-white/5 rounded-lg hover:text-accent transition"><Clock size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setShowMoveModal({project: p, to: 'in_progress'})}} className="p-1.5 bg-white/5 rounded-lg hover:text-accent transition"><Play size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setShowMoveModal({project: p, to: 'completed'})}} className="p-1.5 bg-white/5 rounded-lg hover:text-accent transition"><CheckCircle2 size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id)}} className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    
                    {/* Activity Ticker */}
                    {p.status === 'in_progress' && activeAgent && (
                      <div className="mt-4 mb-4 p-3 bg-accent/10 border border-accent/20 rounded-2xl">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                          <span className="text-[8px] font-black text-accent uppercase tracking-wider">{activeAgent.name} ({activeAgent.role})</span>
                        </div>
                        <p className="text-[10px] text-gray-400 italic line-clamp-1">"{summary}"</p>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{p.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedProject && (
          <motion.aside initial={{ x: 600 }} animate={{ x: 0 }} exit={{ x: 600 }} className="fixed top-0 right-0 h-full w-[600px] bg-[#0d0d12] border-l border-white/5 flex flex-col shadow-2xl z-40">
            <div className="flex border-b border-white/5">
              <button className={`flex-1 p-6 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition ${rightTab === 'chat' ? 'text-accent bg-accent/5' : 'text-gray-500 hover:text-white'}`} onClick={() => setRightTab('chat')}><MessageSquare size={14} /> Diálogo</button>
              <button className={`flex-1 p-6 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition ${rightTab === 'code' ? 'text-accent bg-accent/5' : 'text-gray-500 hover:text-white'}`} onClick={() => setRightTab('code')}><FileCode size={14} /> Código</button>
              <button className="p-6 text-gray-500 hover:text-white" onClick={() => setSelectedProject(null)}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {rightTab === 'chat' ? (
                <div className="space-y-8">
                  {allLogs.filter((l: Log) => l.project_id === selectedProject.id && l.type !== 'email_to_user' && l.type !== 'email_to_agent' && l.type !== 'email_broadcast').map((log: any) => {
                    const agent = agents.find((a: any) => a.id === log.agent_id);
                    return (
                      <div key={log.id} className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-[10px] font-black text-accent uppercase">{agent?.name[0] || '?'}</div>
                          <div className="text-[10px] font-black text-white uppercase">{agent?.name} • {log.type}</div>
                        </div>
                        <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl text-sm text-gray-300 leading-relaxed italic prose prose-invert max-w-none">
                          <ReactMarkdown>{log.message}</ReactMarkdown>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-6 text-center py-20">
                   {files.length === 0 ? (
                     <div className="text-gray-500">
                        <FileCode size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-xs uppercase font-black tracking-widest">Aguardando geração...</p>
                     </div>
                   ) : (
                     <div className="space-y-6 text-left">
                       {files.map((file: any) => (
                         <div key={file.name} className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                           <div className="bg-white/5 px-4 py-2 text-[10px] font-black text-gray-400 border-b border-white/5">{file.name}</div>
                           <pre className="p-5 overflow-x-auto text-[11px] font-mono text-accent/80 leading-relaxed"><code>{file.content}</code></pre>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {showMoveModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 z-[100]">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0f0f13] border border-white/10 p-12 rounded-[40px] w-full max-w-xl">
            <h2 className="text-3xl font-black text-white mb-2 uppercase italic tracking-tighter flex items-center gap-3"><ArrowRightLeft className="text-accent" /> Justificar</h2>
            <textarea className="w-full bg-black/40 border border-white/10 p-6 rounded-3xl text-white focus:border-accent transition outline-none h-48 text-sm italic" placeholder="Instruções..." value={justification} onChange={e => setJustification(e.target.value)} />
            <div className="flex gap-4 mt-10">
              <button className="flex-1 bg-white/5 p-4 rounded-2xl font-black text-xs uppercase" onClick={() => setShowMoveModal(null)}>Cancelar</button>
              <button className="flex-1 bg-accent text-black p-4 rounded-2xl font-black text-xs uppercase" onClick={handleMove}>Confirmar</button>
            </div>
          </motion.div>
        </div>
      )}

      {showNewModal && <NewProjectModal onClose={() => setShowNewModal(false)} onCreated={onNewProject} />}
    </main>
  );
}

// --- Settings Modal ---
function SettingsModal({ factory, onClose, onSave, onReset }: any) {
  const [data, setData] = useState({ 
    factoryName: factory.name, 
    industry: factory.industry || '', 
    apiKey: factory.api_key || '', 
    baseUrl: factory.base_url || '', 
    model: factory.soul_model,
    productionPath: factory.production_path || '',
    hiringMode: factory.hiring_mode || 'auto'
  });
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (data.apiKey || data.baseUrl) fetchModels();
  }, []);

  const fetchModels = async () => {
    if (!data.apiKey && !data.baseUrl) return;
    setLoadingModels(true);
    try {
      const res = await axios.post(`${API_URL}/models`, { apiKey: data.apiKey, baseUrl: data.baseUrl });
      setModels(res.data);
    } catch (e) { 
      setModels(['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'local-model']); 
    }
    setLoadingModels(false);
  };

  const handleSave = async () => {
    await axios.post(`${API_URL}/setup`, data);
    onSave();
    onClose();
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    await axios.post(`${API_URL}/reset`);
    onReset();
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-10 z-[200]">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl bg-[#0f0f13] border border-white/10 p-16 rounded-[60px] shadow-2xl relative overflow-hidden">
        {confirmReset && <div className="absolute inset-0 bg-red-950/20 backdrop-blur-sm pointer-events-none" />}
        
        <div className="flex justify-between items-start mb-10">
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter flex items-center gap-4"><Settings className="text-accent" /> Configurações</h2>
          <button 
            onClick={handleReset}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${confirmReset ? 'bg-red-600 text-white animate-pulse' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'}`}
          >
            {confirmReset ? 'CONFIRMAR RESET TOTAL?' : 'Reset Nuclear'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <Input label="Nome da Fábrica" value={data.factoryName} onChange={(v:any) => setData({...data, factoryName: v})} />
          <Input label="Setor" value={data.industry} onChange={(v:any) => setData({...data, industry: v})} />
          <Input label="API Key" type="password" value={data.apiKey} onChange={(v:any) => setData({...data, apiKey: v})} onBlur={fetchModels} />
          <Input label="Base URL (Gateway)" value={data.baseUrl} onChange={(v:any) => setData({...data, baseUrl: v})} icon={<Globe size={14} />} onBlur={fetchModels} />
          
          <div className="w-full text-left">
             <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3 px-4 flex items-center gap-2"><Cpu size={14} /> Modelo {loadingModels && " (Buscando...)"}</label>
             <select className="w-full bg-black/40 border border-white/10 p-5 rounded-[24px] text-white focus:border-accent transition outline-none text-sm" value={data.model} onChange={e => setData({...data, model: e.target.value})}>
                {models.map(m => <option key={m} value={m} className="bg-[#0f0f13]">{m}</option>)}
                {models.length === 0 && <option value="gpt-4o">gpt-4o</option>}
             </select>
          </div>

          <div className="w-full text-left">
             <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3 px-4 flex items-center gap-2"><Shield size={14} /> Modo de Contratação</label>
             <select className="w-full bg-black/40 border border-white/10 p-5 rounded-[24px] text-white focus:border-accent transition outline-none text-sm" value={data.hiringMode} onChange={e => setData({...data, hiringMode: e.target.value})}>
                <option value="auto" className="bg-[#0f0f13]">Automático (CEO contrata)</option>
                <option value="manual" className="bg-[#0f0f13]">Manual (Você aprova)</option>
             </select>
          </div>

          <Input label="Produção Path" placeholder="C:/Fábrica/Projetos" value={data.productionPath} onChange={(v:any) => setData({...data, productionPath: v})} icon={<Folder size={14} />} />
        </div>
        <div className="flex gap-4">
          <button className="flex-1 bg-white/5 p-4 rounded-2xl font-black text-xs uppercase" onClick={() => confirmReset ? setConfirmReset(false) : onClose()}>Cancelar</button>
          <button className="flex-1 bg-accent text-black p-4 rounded-2xl font-black text-xs uppercase shadow-lg" onClick={handleSave}>Salvar</button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Agents Roster Component ---
function AgentsRoster({ agents }: any) {
  return (
    <main className="flex-1 p-12 bg-[#0d0d12] overflow-y-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-black tracking-tight text-white mb-2 uppercase italic leading-none">EQUIPE DE PRODUÇÃO</h1>
      </header>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
        {agents.map((agent: any) => (
          <motion.div key={agent.id} className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] hover:border-accent/40 transition">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-2xl font-black mb-6 uppercase">{agent.name[0]}</div>
            <h3 className="text-xl font-black text-white mb-1 uppercase italic tracking-tight">{agent.name}</h3>
            <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-6">{agent.role}</p>
            <div className="space-y-4">
              <div className="text-sm text-gray-400"><strong>Skills:</strong> {agent.expertise}</div>
              <div className="text-sm text-gray-400"><strong>Perfil:</strong> {agent.personality}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </main>
  );
}

// --- Activity Feed Component ---
function ActivityFeed({ logs, agents }: any) {
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);

  const getPostitColor = (role: string) => {
    const r = role.toUpperCase();
    if (r === 'CEO') return 'bg-[#FFEB3B] text-black border-yellow-400/50';
    if (r === 'CPO') return 'bg-[#E91E63] text-white border-pink-400/50';
    if (r === 'CTO') return 'bg-[#2196F3] text-white border-blue-400/50';
    if (r === 'PROGRAMMER') return 'bg-[#4CAF50] text-white border-green-400/50';
    if (r === 'TESTER') return 'bg-[#FF9800] text-black border-orange-400/50';
    if (r === 'REVIEWER') return 'bg-[#607D8B] text-white border-slate-400/50';
    return 'bg-[#9C27B0] text-white border-purple-400/50';
  };

  return (
    <main className="flex-1 p-12 bg-[#0d0d12] overflow-y-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-black tracking-tight text-white mb-2 uppercase italic leading-none">RADAR DE ATIVIDADE</h1>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
        {[...logs].reverse().filter(l => l.type !== 'email_to_user' && l.type !== 'email_to_agent' && l.type !== 'email_broadcast').map((log: any, idx: number) => {
          const agent = agents.find((a: any) => a.id === log.agent_id);
          const colorClass = getPostitColor(agent?.role || '');
          const rotation = (idx % 2 === 0 ? '-' : '') + (idx % 3 + 1) + 'deg';

          return (
            <motion.div 
              key={log.id} style={{ rotate: rotation }} onClick={() => setSelectedLog(log)}
              className={`p-6 h-64 w-full cursor-pointer shadow-2xl relative flex flex-col border-2 transition-all hover:scale-105 hover:rotate-0 hover:z-10 ${colorClass}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-60 flex justify-between border-b border-black/10 pb-2">
                <span>{agent?.role}</span>
                <span>{new Date(log.created_at).toLocaleTimeString()}</span>
              </div>
              <h4 className="font-black text-lg mb-4 leading-tight uppercase italic">{agent?.name}</h4>
              <div className="flex-1 text-sm font-medium line-clamp-5 overflow-hidden italic leading-relaxed">
                 <ReactMarkdown>{log.message}</ReactMarkdown>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-10 z-[400]" onClick={() => setSelectedLog(null)}>
            <motion.div 
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              className={`w-full max-w-4xl p-16 rounded-[40px] shadow-2xl border-4 max-h-[80vh] overflow-y-auto custom-scrollbar ${getPostitColor(agents.find((a:any)=>a.id===selectedLog.agent_id)?.role || '')}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-10 border-b border-black/10 pb-6">
                <div>
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">{agents.find((a:any)=>a.id===selectedLog.agent_id)?.name}</h2>
                  <p className="text-xs font-black uppercase tracking-widest opacity-60">{agents.find((a:any)=>a.id===selectedLog.agent_id)?.role} • {selectedLog.type}</p>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-4 bg-black/10 rounded-2xl font-black text-xs uppercase">Fechar</button>
              </div>
              <div className="text-lg leading-relaxed font-medium italic prose prose-lg max-w-none prose-p:my-2 prose-headings:mb-4">
                <ReactMarkdown>{selectedLog.message}</ReactMarkdown>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

function NewProjectModal({ onClose, onCreated }: any) {
  const [data, setData] = useState({ name: '', desc: '' });
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!data.name || !data.desc) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/start`, { name: data.name, description: data.desc });
      onCreated();
      onClose();
    } catch (e) {
      alert('Erro ao iniciar missão.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 z-[100]">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0f0f13] border border-white/10 p-12 rounded-[40px] w-full max-w-xl shadow-2xl">
        <h2 className="text-4xl font-black text-white mb-2 uppercase italic tracking-tighter">Nova Missão</h2>
        <div className="space-y-8 mt-10">
          <Input label="Título do Projeto" placeholder="Ex: App de Gestão" value={data.name} onChange={(v: string) => setData({...data, name: v})} />
          <textarea className="w-full bg-black/40 border border-white/10 p-6 rounded-3xl text-white focus:border-accent transition outline-none h-48 text-sm italic" placeholder="Descreva detalhadamente..." value={data.desc} onChange={e => setData({...data, desc: e.target.value})} />
        </div>
        <div className="flex gap-4 mt-12">
          <button className="flex-1 bg-white/5 p-4 rounded-2xl font-black text-xs uppercase" onClick={onClose} disabled={loading}>Abortar</button>
          <button className="flex-1 bg-accent text-black p-4 rounded-2xl font-black text-xs uppercase shadow-lg hover:scale-105 transition disabled:opacity-50" onClick={handleStart} disabled={loading}>
            {loading ? 'Iniciando...' : 'Ativar Linha'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [curStep, setCurStep] = useState(1);
  const [data, setData] = useState({ 
    factoryName: '', 
    industry: '', 
    apiKey: '', 
    baseUrl: '', 
    model: 'gpt-4o', 
    mission: '', 
    seo: '', 
    productionPath: '',
    hiringMode: 'auto'
  });
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const fetchModels = async () => {
    if (!data.apiKey && !data.baseUrl) return;
    setLoadingModels(true);
    try {
      const res = await axios.post(`${API_URL}/models`, { apiKey: data.apiKey, baseUrl: data.baseUrl });
      setModels(res.data);
      if (res.data.length > 0) setData({...data, model: res.data[0]});
    } catch (e) { setModels(['gpt-4o', 'gpt-4-turbo', 'local-model']); }
    setLoadingModels(false);
  };

  const handleFinish = async () => {
    try { await axios.post(`${API_URL}/setup`, data); onComplete(); } catch (e) { alert("Erro de Conexão"); }
  };
  return (
    <div className="h-full w-full flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_#1a1a2e,_#0a0a0c)]">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl bg-white/5 border border-white/10 p-16 rounded-[60px] backdrop-blur-3xl shadow-2xl text-center">
        {curStep === 1 && (
          <div>
            <div className="w-24 h-24 bg-accent/20 rounded-[32px] flex items-center justify-center text-accent mx-auto mb-10 shadow-[0_0_40px_rgba(0,242,255,0.2)]"><Factory size={48} /></div>
            <h1 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase italic">A FÁBRICA</h1>
            <div className="space-y-6">
              <Input label="Nome da Empresa" value={data.factoryName} onChange={(v: string) => setData({...data, factoryName: v})} />
              <Input label="Setor de Atuação" value={data.industry} onChange={(v: string) => setData({...data, industry: v})} />
              <button className="w-full bg-accent text-black font-black p-5 rounded-[24px] mt-6 hover:scale-105 transition text-xs uppercase tracking-widest" onClick={() => setCurStep(2)}>Próximo</button>
            </div>
          </div>
        )}
        {curStep === 2 && (
          <div className="text-left">
            <h2 className="text-3xl font-black text-white mb-2 uppercase italic tracking-tighter">A Alma</h2>
            <div className="space-y-6">
              <Input label="API Key" type="password" value={data.apiKey} onChange={(v: string) => setData({...data, apiKey: v})} onBlur={fetchModels} />
              <Input label="Base URL (Gateway)" placeholder="https://api.openai.com/v1" value={data.baseUrl} onChange={(v: string) => setData({...data, baseUrl: v})} icon={<Globe size={14} />} onBlur={fetchModels} />
              
              <div className="w-full text-left">
                 <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3 px-4 flex items-center gap-2"><Cpu size={14} /> Modelo {loadingModels && " (Sincronizando...)"}</label>
                 <select className="w-full bg-black/40 border border-white/10 p-5 rounded-[24px] text-white focus:border-accent transition outline-none text-sm" value={data.model} onChange={e => setData({...data, model: e.target.value})}>
                    {models.map(m => <option key={m} value={m} className="bg-[#1a1a2e]">{m}</option>)}
                    {models.length === 0 && <option value="gpt-4o">gpt-4o</option>}
                 </select>
              </div>

              <div className="w-full text-left">
                 <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3 px-4 flex items-center gap-2"><Shield size={14} /> Modo de Contratação</label>
                 <select className="w-full bg-black/40 border border-white/10 p-5 rounded-[24px] text-white focus:border-accent transition outline-none text-sm" value={data.hiringMode} onChange={e => setData({...data, hiringMode: e.target.value})}>
                    <option value="auto" className="bg-[#1a1a2e]">Automático (CEO decide)</option>
                    <option value="manual" className="bg-[#1a1a2e]">Manual (Você aprova)</option>
                 </select>
              </div>

              <Input label="Produção Path" placeholder="C:/Fábrica/Projetos" value={data.productionPath} onChange={(v: string) => setData({...data, productionPath: v})} icon={<Folder size={14} />} />
              <button className="w-full bg-accent text-black font-black p-5 rounded-[24px] mt-6 hover:scale-105 transition text-xs uppercase tracking-widest" onClick={() => setCurStep(3)}>Próximo</button>
            </div>
          </div>
        )}
        {curStep === 3 && (
          <div className="text-left space-y-8">
            <div>
              <h2 className="text-3xl font-black text-white mb-2 uppercase italic tracking-tighter">O Líder (CEO)</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-6">Defina o perfil do seu braço direito.</p>
              <div className="space-y-6">
                <Input label="Nome do CEO" placeholder="Ex: Nexus AI" value={data.seo} onChange={(v: string) => setData({...data, seo: v})} icon={<Users size={14} />} />
                <textarea 
                  className="w-full bg-black/40 border border-white/10 p-5 rounded-3xl text-white focus:border-accent transition outline-none h-32 text-sm italic placeholder:text-white/10" 
                  placeholder="Habilidades e personalidade do CEO..." 
                  value={data.mission} // Reuse mission or use bio?
                  onChange={e => setData({...data, mission: e.target.value})} 
                />
              </div>
            </div>
            <button className="w-full bg-accent text-black font-black p-5 rounded-[24px] hover:scale-105 transition text-xs uppercase tracking-widest shadow-lg" onClick={handleFinish}>Ativar Fábrica</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "", icon, onBlur }: any) {
  return (
    <div className="w-full text-left">
      <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3 px-4 flex items-center gap-2">{icon} {label}</label>
      <input type={type} placeholder={placeholder} onBlur={onBlur} className="w-full bg-black/40 border border-white/10 p-5 rounded-[24px] text-white focus:border-accent transition outline-none text-sm placeholder:text-white/20" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
