import { Project, Task, User, ActivityLog, Message, Comment, Form, FormResponse, Document, Notification, Deployment, TimeEntry } from '@/types';

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem('taskflow_demo_mode') === 'true';
}

export function enableDemoMode(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('taskflow_demo_mode', 'true');
  initDemoData(true);
}

export function disableDemoMode(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('taskflow_demo_mode');
}

export const DEMO_ADMIN: User = {
  id: 'demo-admin-id',
  name: 'Alex Mercer (Demo Admin)',
  email: 'admin@demo.taskflow.com',
  avatarUrl: 'https://ui-avatars.com/api/?name=Alex+Mercer&background=2563eb&color=fff',
  role: 'Admin',
  createdAt: new Date().toISOString(),
  dob: '1990-05-15',
  skills: ['Management', 'Product Architecture', 'Go', 'React', 'Kubernetes'],
  wellnessScore: 92,
  maxWorkload: 5,
  burnoutRisk: 'Low',
  phone: '+1 (555) 019-2834',
  officeAddress: 'Headquarters, Suite 400, San Francisco, CA',
  timezone: 'America/Los_Angeles',
  autoAssign: true,
  skillMatchPriority: true,
  aiDeadlines: true,
};

const DEFAULT_USERS: User[] = [
  DEMO_ADMIN,
  {
    id: 'user-1',
    name: 'Sarah Chen',
    email: 'sarah.c@demo.taskflow.com',
    avatarUrl: 'https://ui-avatars.com/api/?name=Sarah+Chen&background=16a34a&color=fff',
    role: 'Manager',
    createdAt: new Date().toISOString(),
    skills: ['Machine Learning', 'Python', 'Data Engineering', 'Heuristics'],
    wellnessScore: 82,
    maxWorkload: 6,
    burnoutRisk: 'Low',
  },
  {
    id: 'user-2',
    name: 'Marcus Rodriguez',
    email: 'marcus.r@demo.taskflow.com',
    avatarUrl: 'https://ui-avatars.com/api/?name=Marcus+Rodriguez&background=ea580c&color=fff',
    role: 'Member',
    createdAt: new Date().toISOString(),
    skills: ['React', 'Next.js', 'TailwindCSS', 'TypeScript', 'UI Engineering'],
    wellnessScore: 54,
    maxWorkload: 8,
    burnoutRisk: 'High',
  },
  {
    id: 'user-3',
    name: 'Jane Doe',
    email: 'jane.d@demo.taskflow.com',
    avatarUrl: 'https://ui-avatars.com/api/?name=Jane+Doe&background=db2777&color=fff',
    role: 'Member',
    createdAt: new Date().toISOString(),
    skills: ['Figma', 'UI/UX Design', 'User Research', 'Wireframing'],
    wellnessScore: 89,
    maxWorkload: 4,
    burnoutRisk: 'Low',
  },
  {
    id: 'user-4',
    name: 'David Kim',
    email: 'david.k@demo.taskflow.com',
    avatarUrl: 'https://ui-avatars.com/api/?name=David+Kim&background=7c3aed&color=fff',
    role: 'Member',
    createdAt: new Date().toISOString(),
    skills: ['E2E Testing', 'Playwright', 'Jest', 'Automation', 'CI/CD'],
    wellnessScore: 78,
    maxWorkload: 5,
    burnoutRisk: 'Medium',
  }
];

const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'project-1',
    name: 'AI Recommendation Engine',
    description: 'Developing the core machine learning models for personalizing content delivery and matching algorithms.',
    key: 'AIRE',
    ownerId: 'demo-admin-id',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'project-2',
    name: 'Mobile App Redesign',
    description: 'Revamping the user interface of our iOS and Android client apps using modern component design libraries.',
    key: 'MOBR',
    ownerId: 'user-1',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

const DEFAULT_TASKS: Task[] = [
  {
    id: 'task-1',
    projectId: 'project-1',
    title: 'Train priority classification model',
    description: 'Fine-tune the classification pipeline using the new telemetry dataset. Target accuracy is above 95% on test splits.',
    status: 'Done',
    priority: 'Critical',
    assigneeId: 'user-1',
    startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Machine Learning', 'Python'],
    dependencies: [],
  },
  {
    id: 'task-2',
    projectId: 'project-2',
    title: 'Design new landing page layouts',
    description: 'Create high-fidelity mockups for landing screens focusing on onboarding flows. Incorporate the new color palette.',
    status: 'In Progress',
    priority: 'High',
    assigneeId: 'user-3',
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['UI/UX Design', 'Figma'],
    dependencies: [],
  },
  {
    id: 'task-3',
    projectId: 'project-2',
    title: 'Implement dark mode styles',
    description: 'Integrate theme provider and apply Tailwind color tokens to all primary and secondary components.',
    status: 'Review',
    priority: 'Medium',
    assigneeId: 'user-2',
    startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Frontend', 'TailwindCSS'],
    dependencies: ['task-2'],
  },
  {
    id: 'task-4',
    projectId: 'project-1',
    title: 'Add E2E tests for onboarding flow',
    description: 'Write comprehensive integration tests verifying client redirects and LocalStorage state consistency.',
    status: 'To Do',
    priority: 'Medium',
    assigneeId: 'user-4',
    startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['QA', 'Playwright'],
    dependencies: [],
  },
  {
    id: 'task-5',
    projectId: 'project-1',
    title: 'Burnout alert heuristic updates',
    description: 'Revise workload indicators to account for consecutive overtime work logged in time entry models.',
    status: 'To Do',
    priority: 'High',
    assigneeId: 'user-1',
    startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Machine Learning', 'Heuristics'],
    dependencies: ['task-1'],
  }
];

const DEFAULT_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    projectId: 'project-1',
    userId: 'user-1',
    content: 'Finished training the ML models! Accuracy is 96.5% on the validation set. Ready to integrate.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    conversationType: 'project',
    reactions: [],
    isPinned: false
  },
  {
    id: 'msg-2',
    projectId: 'project-1',
    userId: 'user-2',
    content: 'Awesome job Sarah! I am finishing up dark mode implementation now, then I can help wire the APIs.',
    timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    conversationType: 'project',
    reactions: [{ emoji: '🎉', userIds: ['demo-admin-id', 'user-4'] }],
    isPinned: false
  },
  {
    id: 'msg-3',
    projectId: 'project-1',
    userId: 'demo-admin-id',
    content: 'Superb results team. Let\'s get together for a brief code review at 3 PM today.',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    conversationType: 'project',
    reactions: [],
    isPinned: true
  },
  // Direct messages
  {
    id: 'msg-dm-1',
    userId: 'user-1',
    content: 'Hey Alex, do you have a second to look over the burnout heuristics details?',
    timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    conversationType: 'dm',
    recipientId: 'demo-admin-id',
    reactions: [],
    isPinned: false
  },
  {
    id: 'msg-dm-2',
    userId: 'demo-admin-id',
    content: 'Sure Sarah, send them over! I can review them right now.',
    timestamp: new Date(Date.now() - 2.8 * 3600 * 1000).toISOString(),
    conversationType: 'dm',
    recipientId: 'user-1',
    reactions: [],
    isPinned: false
  }
];

const DEFAULT_LOGS: ActivityLog[] = [
  {
    id: 'log-1',
    entityType: 'Task',
    entityId: 'task-1',
    action: 'Moved',
    details: 'Status changed from "Review" to "Done".',
    userId: 'user-1',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'log-2',
    entityType: 'Task',
    entityId: 'task-3',
    action: 'Commented',
    details: 'Marcus Rodriguez commented on "Implement dark mode styles".',
    userId: 'user-2',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  }
];

const DEFAULT_COMMENTS: Comment[] = [
  {
    id: 'comment-1',
    taskId: 'task-3',
    userId: 'user-2',
    content: 'All styles have been tokenized. Still checking some contrast ratios in light/dark transitions.',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  }
];

const DEFAULT_DOCS: Document[] = [
  {
    id: 'doc-1',
    projectId: 'project-1',
    title: 'Machine Learning Engine Specifications',
    type: 'page',
    content: '# Core Engine Specifications\nThis document outlines the heuristic scoring algorithms used to predict burnout risk scores based on hours and workloads.',
    createdBy: 'user-1',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const DEFAULT_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1',
    userId: 'demo-admin-id',
    type: 'task_assigned',
    title: 'New Project Created',
    message: 'You have been added to Project Alpha.',
    isRead: false,
    projectId: 'project-1',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'notif-2',
    userId: 'demo-admin-id',
    type: 'task_status_changed',
    title: 'Task Completed',
    message: 'Sarah Chen completed "Train priority classification model".',
    isRead: false,
    projectId: 'project-1',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  }
];

const DEFAULT_DEPLOYMENTS: Deployment[] = [
  {
    id: 'deploy-1',
    projectId: 'project-1',
    version: 'v1.2.0-beta',
    environment: 'Production',
    status: 'Completed',
    releaseNotes: 'Integrated first version of neural model recommendations pipeline.',
    createdBy: 'demo-admin-id',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'deploy-2',
    projectId: 'project-2',
    version: 'v2.0.0-rc1',
    environment: 'Staging',
    status: 'In Progress',
    releaseNotes: 'Dark theme styles and layouts revamp testing.',
    createdBy: 'user-1',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const DEFAULT_TIME_ENTRIES: TimeEntry[] = [
  {
    id: 'entry-1',
    taskId: 'task-1',
    userId: 'user-1',
    projectId: 'project-1',
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 240,
    note: 'Model training iteration 4',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }
];

const DEFAULT_SHORTCUTS = [
  {
    id: 'shortcut-1',
    project_id: 'project-1',
    name: 'Project Figma Design Board',
    url: 'https://figma.com/file/demo-project-design-board',
    type: 'link',
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'shortcut-2',
    project_id: 'project-1',
    name: 'GitHub Repository',
    url: 'https://github.com/AndrewJerryV/TaskFlow-Mini_Project',
    type: 'repository',
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
  }
];

const DEFAULT_REPO_LINKS = [
  {
    id: 'repo-1',
    project_id: 'project-1',
    name: 'TaskFlow Main Repo',
    url: 'https://github.com/AndrewJerryV/TaskFlow-Mini_Project',
    owner: 'AndrewJerryV',
    repo: 'TaskFlow-Mini_Project',
    description: 'Main Next.js frontend and ML scoring model repository.',
    added_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
  }
];

const DEFAULT_FORMS = [
  {
    id: 'form-1',
    project_id: 'project-1',
    title: 'Bi-Weekly Team Wellness Survey',
    description: 'Please answer these quick questions about your current workload and stress levels. It takes less than 60 seconds.',
    fields: JSON.stringify([
      { id: 'q1', type: 'rating', label: 'How would you rate your current stress level? (1-5)', required: true },
      { id: 'q2', type: 'text', label: 'Any specific bottlenecks or blocks you are facing?', required: false }
    ]),
    status: 'active',
    created_by: 'demo-admin-id',
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  }
];

const DEFAULT_FORM_RESPONSES = [
  {
    id: 'resp-1',
    form_id: 'form-1',
    respondent_id: 'user-2',
    answers: JSON.stringify({ q1: '4', q2: 'Contrast ratios on dark mode are taking longer to resolve.' }),
    submitted_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  }
];

function getStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  const val = window.localStorage.getItem(key);
  if (!val) return defaultValue;
  try {
    return JSON.parse(val) as T;
  } catch {
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function initDemoData(force = false): void {
  if (typeof window === 'undefined') return;
  if (!force && window.localStorage.getItem('taskflow_demo_initialized_v3') === 'true') return;

  setStorage('taskflow_demo_users', DEFAULT_USERS);
  setStorage('taskflow_demo_projects', DEFAULT_PROJECTS);
  setStorage('taskflow_demo_tasks', DEFAULT_TASKS);
  setStorage('taskflow_demo_messages', DEFAULT_MESSAGES);
  setStorage('taskflow_demo_logs', DEFAULT_LOGS);
  setStorage('taskflow_demo_comments', DEFAULT_COMMENTS);
  setStorage('taskflow_demo_docs', DEFAULT_DOCS);
  setStorage('taskflow_demo_notifications', DEFAULT_NOTIFICATIONS);
  setStorage('taskflow_demo_deployments', DEFAULT_DEPLOYMENTS);
  setStorage('taskflow_demo_time_entries', DEFAULT_TIME_ENTRIES);
  setStorage('taskflow_demo_shortcuts', DEFAULT_SHORTCUTS);
  setStorage('taskflow_demo_repo_links', DEFAULT_REPO_LINKS);
  setStorage('taskflow_demo_forms', DEFAULT_FORMS);
  setStorage('taskflow_demo_form_responses', DEFAULT_FORM_RESPONSES);

  window.localStorage.setItem('taskflow_demo_initialized_v3', 'true');
}

export class DemoDatabase {
  constructor() {
    initDemoData();
  }

  // Users
  async getUsers(): Promise<User[]> {
    return getStorage<User[]>('taskflow_demo_users', DEFAULT_USERS);
  }

  async getUser(id: string): Promise<User | null> {
    const users = await this.getUsers();
    return users.find(u => u.id === id) || null;
  }

  async updateUserSettings(userId: string, settings: Partial<any>): Promise<User | null> {
    const users = await this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    const updated = { ...users[idx], ...settings };
    users[idx] = updated;
    setStorage('taskflow_demo_users', users);
    return updated;
  }

  async updateUserRole(userId: string, newRole: string): Promise<boolean> {
    const users = await this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return false;
    users[idx].role = newRole as any;
    setStorage('taskflow_demo_users', users);
    return true;
  }

  async updateUserSkills(userId: string, skills: string[], skillExperience: Record<string, number>): Promise<{ success: boolean }> {
    const users = await this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return { success: false };
    users[idx].skills = skills;
    users[idx].skillExperience = skillExperience;
    setStorage('taskflow_demo_users', users);
    return { success: true };
  }

  async addUser(userData: any): Promise<User | null> {
    const users = await this.getUsers();
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: userData.fullName,
      email: userData.email,
      role: userData.role,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.fullName)}&background=random`,
      skills: userData.skills || [],
      wellnessScore: 85,
      maxWorkload: userData.maxWorkload || 5,
      burnoutRisk: 'Low',
      createdAt: new Date().toISOString(),
      dob: userData.dob || null
    };
    users.push(newUser);
    setStorage('taskflow_demo_users', users);
    return newUser;
  }

  // Projects
  async getProjects(userId?: string): Promise<Project[]> {
    return getStorage<Project[]>('taskflow_demo_projects', DEFAULT_PROJECTS);
  }

  async getProject(id: string): Promise<Project | null> {
    const projects = await this.getProjects();
    return projects.find(p => p.id === id) || null;
  }

  async addProject(project: Project): Promise<void> {
    const projects = await this.getProjects();
    projects.push(project);
    setStorage('taskflow_demo_projects', projects);
  }

  async deleteProject(id: string): Promise<boolean> {
    let projects = await this.getProjects();
    projects = projects.filter(p => p.id !== id);
    setStorage('taskflow_demo_projects', projects);
    return true;
  }

  // Tasks
  async getTasks(projectId?: string, assigneeId?: string): Promise<Task[]> {
    let tasks = getStorage<Task[]>('taskflow_demo_tasks', DEFAULT_TASKS);
    if (projectId) tasks = tasks.filter(t => t.projectId === projectId);
    if (assigneeId) tasks = tasks.filter(t => t.assigneeId === assigneeId);
    return tasks;
  }

  async getTaskById(id: string): Promise<Task | null> {
    const tasks = getStorage<Task[]>('taskflow_demo_tasks', DEFAULT_TASKS);
    return tasks.find(t => t.id === id) || null;
  }

  async addTask(task: Task, userId = 'system'): Promise<void> {
    const tasks = getStorage<Task[]>('taskflow_demo_tasks', DEFAULT_TASKS);
    tasks.push(task);
    setStorage('taskflow_demo_tasks', tasks);

    await this.createLog({
      id: `log-${Date.now()}`,
      entityType: 'Task',
      entityId: task.id,
      action: 'Created',
      details: `Task "${task.title}" created.`,
      userId: userId,
      timestamp: new Date().toISOString()
    });
  }

  async updateTask(id: string, updates: Partial<Task>, userId = 'system'): Promise<Task | null> {
    const tasks = getStorage<Task[]>('taskflow_demo_tasks', DEFAULT_TASKS);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const oldStatus = tasks[idx].status;
    const updated = { ...tasks[idx], ...updates, updatedAt: new Date().toISOString() };
    tasks[idx] = updated;
    setStorage('taskflow_demo_tasks', tasks);

    if (updates.status && updates.status !== oldStatus) {
      await this.createLog({
        id: `log-${Date.now()}`,
        entityType: 'Task',
        entityId: id,
        action: 'Moved',
        details: `Status changed from "${oldStatus}" to "${updates.status}".`,
        userId: userId,
        timestamp: new Date().toISOString()
      });
    }

    return updated;
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    let tasks = getStorage<Task[]>('taskflow_demo_tasks', DEFAULT_TASKS);
    tasks = tasks.filter(t => t.id !== id);
    setStorage('taskflow_demo_tasks', tasks);
    return true;
  }

  // Logs
  async getActivityLogs(): Promise<ActivityLog[]> {
    return getStorage<ActivityLog[]>('taskflow_demo_logs', DEFAULT_LOGS);
  }

  async createLog(log: ActivityLog): Promise<void> {
    const logs = await this.getActivityLogs();
    logs.unshift(log);
    setStorage('taskflow_demo_logs', logs.slice(0, 100)); // cap at 100
  }

  // Messages
  async getMessages(projectId: string): Promise<Message[]> {
    const msgs = getStorage<Message[]>('taskflow_demo_messages', DEFAULT_MESSAGES);
    return msgs.filter(m => m.projectId === projectId && m.conversationType === 'project');
  }

  async getDirectMessages(userId: string, recipientId: string, projectId?: string): Promise<Message[]> {
    const msgs = getStorage<Message[]>('taskflow_demo_messages', DEFAULT_MESSAGES);
    return msgs.filter(m => 
      m.conversationType === 'dm' &&
      ((m.userId === userId && m.recipientId === recipientId) || 
       (m.userId === recipientId && m.recipientId === userId))
    );
  }

  async addMessage(message: Message): Promise<void> {
    const msgs = getStorage<Message[]>('taskflow_demo_messages', DEFAULT_MESSAGES);
    msgs.push(message);
    setStorage('taskflow_demo_messages', msgs);
  }

  async updateMessageContent(messageId: string, content: string): Promise<Message | null> {
    const msgs = getStorage<Message[]>('taskflow_demo_messages', DEFAULT_MESSAGES);
    const idx = msgs.findIndex(m => m.id === messageId);
    if (idx === -1) return null;
    msgs[idx].content = content;
    setStorage('taskflow_demo_messages', msgs);
    return msgs[idx];
  }

  async toggleMessagePin(messageId: string, isPinned: boolean): Promise<void> {
    const msgs = getStorage<Message[]>('taskflow_demo_messages', DEFAULT_MESSAGES);
    const idx = msgs.findIndex(m => m.id === messageId);
    if (idx !== -1) {
      msgs[idx].isPinned = isPinned;
      setStorage('taskflow_demo_messages', msgs);
    }
  }

  async deleteMessage(id: string): Promise<boolean> {
    let msgs = getStorage<Message[]>('taskflow_demo_messages', DEFAULT_MESSAGES);
    msgs = msgs.filter(m => m.id !== id);
    setStorage('taskflow_demo_messages', msgs);
    return true;
  }

  // Comments
  async getComments(taskId: string): Promise<Comment[]> {
    const comments = getStorage<Comment[]>('taskflow_demo_comments', DEFAULT_COMMENTS);
    return comments.filter(c => c.taskId === taskId);
  }

  async addComment(comment: Comment): Promise<void> {
    const comments = getStorage<Comment[]>('taskflow_demo_comments', DEFAULT_COMMENTS);
    comments.push(comment);
    setStorage('taskflow_demo_comments', comments);
  }

  // Docs
  async getDocuments(projectId: string): Promise<Document[]> {
    const docs = getStorage<Document[]>('taskflow_demo_docs', DEFAULT_DOCS);
    return docs.filter(d => d.projectId === projectId);
  }

  // Time Entries
  async getTimeEntries(taskId: string): Promise<TimeEntry[]> {
    const entries = getStorage<TimeEntry[]>('taskflow_demo_time_entries', DEFAULT_TIME_ENTRIES);
    return entries.filter(e => e.taskId === taskId);
  }

  async startTimeEntry(taskId: string, userId: string, projectId?: string): Promise<TimeEntry | null> {
    const entries = getStorage<TimeEntry[]>('taskflow_demo_time_entries', DEFAULT_TIME_ENTRIES);
    const newEntry: TimeEntry = {
      id: `time-${Date.now()}`,
      taskId,
      userId,
      projectId,
      startTime: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    entries.push(newEntry);
    setStorage('taskflow_demo_time_entries', entries);
    return newEntry;
  }

  async stopTimeEntry(id: string, note?: string): Promise<TimeEntry | null> {
    const entries = getStorage<TimeEntry[]>('taskflow_demo_time_entries', DEFAULT_TIME_ENTRIES);
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const start = new Date(entries[idx].startTime).getTime();
    const end = Date.now();
    const durationMinutes = Math.max(1, Math.round((end - start) / 60000));
    entries[idx].endTime = new Date().toISOString();
    entries[idx].durationMinutes = durationMinutes;
    entries[idx].note = note;
    setStorage('taskflow_demo_time_entries', entries);
    return entries[idx];
  }

  async getActiveTimers(userId: string): Promise<TimeEntry[]> {
    const entries = getStorage<TimeEntry[]>('taskflow_demo_time_entries', DEFAULT_TIME_ENTRIES);
    return entries.filter(e => e.userId === userId && !e.endTime);
  }

  async getActiveTimer(userId: string): Promise<TimeEntry | null> {
    const active = await this.getActiveTimers(userId);
    return active[0] || null;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return getStorage<Notification[]>('taskflow_demo_notifications', DEFAULT_NOTIFICATIONS);
  }

  async markNotificationAsRead(id: string): Promise<void> {
    const notifs = getStorage<Notification[]>('taskflow_demo_notifications', DEFAULT_NOTIFICATIONS);
    const idx = notifs.findIndex(n => n.id === id);
    if (idx !== -1) {
      notifs[idx].isRead = true;
      setStorage('taskflow_demo_notifications', notifs);
    }
  }

  // Deployments
  async getDeployments(projectId: string): Promise<Deployment[]> {
    const deploys = getStorage<Deployment[]>('taskflow_demo_deployments', DEFAULT_DEPLOYMENTS);
    return deploys.filter(d => d.projectId === projectId);
  }

  async addDeployment(deployment: Deployment): Promise<boolean> {
    const deploys = getStorage<Deployment[]>('taskflow_demo_deployments', DEFAULT_DEPLOYMENTS);
    deploys.push(deployment);
    setStorage('taskflow_demo_deployments', deploys);
    return true;
  }

  // Shortcuts
  async getShortcuts(projectId: string): Promise<any[]> {
    const list = getStorage<any[]>('taskflow_demo_shortcuts', DEFAULT_SHORTCUTS);
    return list.filter(s => s.project_id === projectId);
  }

  async addShortcut(shortcut: any): Promise<any> {
    const list = getStorage<any[]>('taskflow_demo_shortcuts', DEFAULT_SHORTCUTS);
    const item = { ...shortcut, created_at: new Date().toISOString() };
    list.push(item);
    setStorage('taskflow_demo_shortcuts', list);
    return item;
  }

  async deleteShortcut(id: string): Promise<boolean> {
    let list = getStorage<any[]>('taskflow_demo_shortcuts', DEFAULT_SHORTCUTS);
    list = list.filter(s => s.id !== id);
    setStorage('taskflow_demo_shortcuts', list);
    return true;
  }

  // Repo Links
  async getRepoLinks(projectId: string): Promise<any[]> {
    const list = getStorage<any[]>('taskflow_demo_repo_links', DEFAULT_REPO_LINKS);
    return list.filter(s => s.project_id === projectId);
  }

  async addRepoLink(link: any): Promise<any> {
    const list = getStorage<any[]>('taskflow_demo_repo_links', DEFAULT_REPO_LINKS);
    const item = { ...link, added_at: new Date().toISOString() };
    list.push(item);
    setStorage('taskflow_demo_repo_links', list);
    return item;
  }

  // Forms
  async getForms(projectId: string): Promise<Form[]> {
    const list = getStorage<any[]>('taskflow_demo_forms', DEFAULT_FORMS);
    return list.filter(f => f.project_id === projectId).map(f => ({
      id: f.id,
      projectId: f.project_id,
      title: f.title,
      description: f.description,
      fields: typeof f.fields === 'string' ? JSON.parse(f.fields) : f.fields,
      status: f.status,
      createdBy: f.created_by,
      createdAt: f.created_at,
      updatedAt: f.updated_at
    }));
  }

  async getFormResponses(formId: string): Promise<FormResponse[]> {
    const list = getStorage<any[]>('taskflow_demo_form_responses', DEFAULT_FORM_RESPONSES);
    return list.filter(r => r.form_id === formId).map(r => ({
      id: r.id,
      formId: r.form_id,
      respondentId: r.respondent_id,
      answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers,
      submittedAt: r.submitted_at
    }));
  }

  async getFormResponsesByRespondent(projectId: string, respondentId: string): Promise<FormResponse[]> {
    const forms = await this.getForms(projectId);
    const formIds = new Set(forms.map(f => f.id));
    const list = getStorage<any[]>('taskflow_demo_form_responses', DEFAULT_FORM_RESPONSES);
    return list.filter(r => r.respondent_id === respondentId && formIds.has(r.form_id)).map(r => ({
      id: r.id,
      formId: r.form_id,
      respondentId: r.respondent_id,
      answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers,
      submittedAt: r.submitted_at
    }));
  }

  async getProjectMembers(projectId: string): Promise<string[]> {
    const users = await this.getUsers();
    return users.map(u => u.id);
  }

  async getProjectAdminsAndManagers(projectId: string): Promise<User[]> {
    const users = await this.getUsers();
    return users.filter(u => u.role === 'Admin' || u.role === 'Manager');
  }

  async getAutocompleteData(): Promise<{ skills: string[], tags: string[], titles: string[] }> {
    const users = await this.getUsers();
    const tasks = getStorage<Task[]>('taskflow_demo_tasks', DEFAULT_TASKS);
    const skills = Array.from(new Set(users.flatMap(u => u.skills || [])));
    const tags = Array.from(new Set(tasks.flatMap(t => t.tags || [])));
    const titles = Array.from(new Set(tasks.map(t => t.title)));
    return { skills, tags, titles };
  }

  async updateMessageReactions(id: string, reactions: Message['reactions']): Promise<Message | null> {
    const msgs = getStorage<Message[]>('taskflow_demo_messages', DEFAULT_MESSAGES);
    const idx = msgs.findIndex(m => m.id === id);
    if (idx === -1) return null;
    msgs[idx].reactions = reactions;
    setStorage('taskflow_demo_messages', msgs);
    return msgs[idx];
  }

  async getFormById(id: string): Promise<Form | null> {
    const forms = await getStorage<any[]>('taskflow_demo_forms', DEFAULT_FORMS);
    const f = forms.find(form => form.id === id);
    if (!f) return null;
    return {
      id: f.id,
      projectId: f.project_id,
      title: f.title,
      description: f.description,
      fields: typeof f.fields === 'string' ? JSON.parse(f.fields) : f.fields,
      status: f.status,
      createdBy: f.created_by,
      createdAt: f.created_at,
      updatedAt: f.updated_at
    };
  }

  async addForm(form: Form): Promise<void> {
    const list = getStorage<any[]>('taskflow_demo_forms', DEFAULT_FORMS);
    list.push({
      id: form.id,
      project_id: form.projectId,
      title: form.title,
      description: form.description,
      fields: JSON.stringify(form.fields),
      status: form.status,
      created_by: form.createdBy,
      created_at: form.createdAt,
      updated_at: form.updatedAt
    });
    setStorage('taskflow_demo_forms', list);
  }

  async updateForm(id: string, updates: Partial<Form>): Promise<Form | null> {
    const list = getStorage<any[]>('taskflow_demo_forms', DEFAULT_FORMS);
    const idx = list.findIndex(f => f.id === id);
    if (idx === -1) return null;
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.fields !== undefined) dbUpdates.fields = JSON.stringify(updates.fields);
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    dbUpdates.updated_at = new Date().toISOString();
    list[idx] = { ...list[idx], ...dbUpdates };
    setStorage('taskflow_demo_forms', list);
    return this.getFormById(id);
  }

  async deleteForm(id: string): Promise<boolean> {
    let list = getStorage<any[]>('taskflow_demo_forms', DEFAULT_FORMS);
    list = list.filter(f => f.id !== id);
    setStorage('taskflow_demo_forms', list);
    return true;
  }

  async getActivityLogsForUser(userId: string): Promise<ActivityLog[]> {
    return this.getActivityLogs();
  }

  async getUserActivityLogs(userId: string): Promise<ActivityLog[]> {
    return this.getActivityLogs();
  }

  async getThreadMessages(rootMessageId: string): Promise<Message[]> {
    const msgs = getStorage<Message[]>('taskflow_demo_messages', DEFAULT_MESSAGES);
    return msgs.filter(m => m.threadRootId === rootMessageId);
  }

  async addProjectMember(projectId: string, userId: string, role = 'Member'): Promise<boolean> {
    return true;
  }

  async removeProjectMember(projectId: string, userId: string): Promise<boolean> {
    return true;
  }

  async getTaskDeployments(taskId: string): Promise<Deployment[]> {
    const deploys = getStorage<Deployment[]>('taskflow_demo_deployments', DEFAULT_DEPLOYMENTS);
    return deploys;
  }

  async updateShortcut(id: string, updates: { name?: string; url?: string }): Promise<any | null> {
    const list = getStorage<any[]>('taskflow_demo_shortcuts', DEFAULT_SHORTCUTS);
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    setStorage('taskflow_demo_shortcuts', list);
    return list[idx];
  }
}

function getDemoTimeTrackingStats(projectId: string, userId: string) {
  const entries = getStorage<TimeEntry[]>('taskflow_demo_time_entries', DEFAULT_TIME_ENTRIES);
  const users = getStorage<User[]>('taskflow_demo_users', DEFAULT_USERS);
  const projects = getStorage<Project[]>('taskflow_demo_projects', DEFAULT_PROJECTS);
  const tasks = getStorage<Task[]>('taskflow_demo_tasks', DEFAULT_TASKS);

  const filteredEntries = entries.filter(e => {
    if (projectId && e.projectId !== projectId) return false;
    if (userId && e.userId !== userId) return false;
    return true;
  });

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const userMap = new Map(users.map(u => [u.id, u]));
  const projectMap = new Map(projects.map(p => [p.id, p]));

  const allEntries: any[] = [];
  const activeTimers: any[] = [];
  let activeTimerCount = 0;

  for (const entry of filteredEntries) {
    const task = taskMap.get(entry.taskId);
    const project = projectMap.get(entry.projectId || task?.projectId || '');
    const user = userMap.get(entry.userId);

    if (entry.endTime) {
      allEntries.push({
        taskId: entry.taskId,
        taskTitle: task?.title || 'Unknown Task',
        projectId: entry.projectId || task?.projectId || '',
        projectName: project?.name || 'Unknown Project',
        assigneeId: task?.assigneeId || '',
        userId: entry.userId,
        userName: user?.name || 'Unknown User',
        minutes: entry.durationMinutes || 0,
        date: entry.startTime,
        isManual: entry.note === 'Manual log'
      });
    } else {
      activeTimerCount++;
      activeTimers.push({
        id: entry.id,
        taskId: entry.taskId,
        taskTitle: task?.title || 'Unknown Task',
        userId: entry.userId,
        userName: user?.name || 'Unknown User',
        startedAt: entry.startTime,
      });
    }
  }

  // Aggregate stats
  const totalMinutes = allEntries.reduce((sum, e) => sum + e.minutes, 0);
  const uniqueTasks = new Set(allEntries.map(e => e.taskId));

  const perUser: Record<string, any> = {};
  for (const e of allEntries) {
    if (!perUser[e.userId]) {
      perUser[e.userId] = { userId: e.userId, userName: e.userName, totalMinutes: 0, taskCount: 0, taskIds: new Set() };
    }
    perUser[e.userId].totalMinutes += e.minutes;
    perUser[e.userId].taskIds.add(e.taskId);
  }
  const perUserArray = Object.values(perUser).map((u: any) => ({
    ...u,
    taskCount: u.taskIds.size,
    taskIds: undefined
  }));

  const perTask: Record<string, any> = {};
  for (const e of allEntries) {
    if (!perTask[e.taskId]) {
      perTask[e.taskId] = {
        taskId: e.taskId,
        taskTitle: e.taskTitle,
        projectId: e.projectId,
        projectName: e.projectName,
        assigneeId: e.assigneeId,
        assigneeName: userMap.get(e.assigneeId)?.name || 'Unassigned',
        totalMinutes: 0,
        lastEntry: e.date
      };
    }
    perTask[e.taskId].totalMinutes += e.minutes;
    if (e.date > perTask[e.taskId].lastEntry) perTask[e.taskId].lastEntry = e.date;
  }

  const perProject: Record<string, any> = {};
  for (const e of allEntries) {
    if (!perProject[e.projectId]) {
      perProject[e.projectId] = { projectId: e.projectId, projectName: e.projectName, totalMinutes: 0, taskCount: 0, taskIds: new Set() };
    }
    perProject[e.projectId].totalMinutes += e.minutes;
    perProject[e.projectId].taskIds.add(e.taskId);
  }
  const perProjectArray = Object.values(perProject).map((p: any) => ({
    ...p,
    taskCount: p.taskIds.size,
    taskIds: undefined
  }));

  const daily: Record<string, number> = {};
  for (const e of allEntries) {
    const day = e.date.split('T')[0];
    daily[day] = (daily[day] || 0) + e.minutes;
  }
  const dailySorted = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, minutes]) => ({ date, minutes }));

  return {
    summary: {
      totalMinutes,
      totalHours: parseFloat((totalMinutes / 60).toFixed(1)),
      avgMinutesPerTask: uniqueTasks.size > 0 ? Math.round(totalMinutes / uniqueTasks.size) : 0,
      avgHoursPerTask: uniqueTasks.size > 0 ? parseFloat((totalMinutes / 60 / uniqueTasks.size).toFixed(1)) : 0,
      tasksWithTimeLogs: uniqueTasks.size,
      activeTimerCount,
    },
    perUser: perUserArray.sort((a, b) => b.totalMinutes - a.totalMinutes),
    perTask: Object.values(perTask).sort((a, b) => b.totalMinutes - a.totalMinutes),
    perProject: perProjectArray.sort((a, b) => b.totalMinutes - a.totalMinutes),
    dailyTrend: dailySorted,
    activeTimers,
    users: users.map(u => ({ id: u.id, name: u.name })),
    projects: projects.map(p => ({ id: p.id, name: p.name })),
  };
}

function getDemoRecommendations(projectId: string) {
  return {
    recommendations: [
      {
        id: 'rec-task-2',
        taskId: 'task-2',
        type: 'focus',
        title: 'Design new landing page layouts',
        description: 'Priority: High • Status: In Progress',
        score: 85,
        reason: 'Due in 4 days • High Priority',
        suggestedAction: 'Continue',
        aiInsight: 'AI predicts this should be Critical priority (92% confidence)'
      },
      {
        id: 'rec-task-3',
        taskId: 'task-3',
        type: 'focus',
        title: 'Implement dark mode styles',
        description: 'Priority: Medium • Status: Review',
        score: 75,
        reason: 'Due in 1 day • Overdue Risk',
        suggestedAction: 'Continue',
        aiInsight: 'AI suggests this may be over-prioritized (predicts Low)'
      },
      {
        id: 'rec-task-5',
        taskId: 'task-5',
        type: 'quick_win',
        title: 'Burnout alert heuristic updates',
        description: 'Priority: High • Status: To Do',
        score: 60,
        reason: 'High Priority • Involves ML heuristics',
        suggestedAction: 'Start'
      }
    ],
    mlPowered: true,
    taskClusters: [
      {
        taskIds: ['task-1', 'task-5'],
        tasks: [
          { id: 'task-1', title: 'Train priority classification model', similarity: 0.88 },
          { id: 'task-5', title: 'Burnout alert heuristic updates', similarity: 0.82 }
        ],
        size: 2
      }
    ]
  };
}

function getDemoTaskOfTheDay(userId: string) {
  return {
    taskOfTheDay: {
      id: 'task-2',
      projectId: 'project-2',
      title: 'Design new landing page layouts',
      description: 'Create high-fidelity mockups for landing screens focusing on onboarding flows.',
      status: 'In Progress',
      priority: 'High',
      assigneeId: 'user-3',
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['UI/UX Design', 'Figma']
    },
    reason: 'Recommended because: due in 4 days, high priority, and already in progress.',
    score: 85,
    totalOpenTasks: 3
  };
}

function getDemoBottlenecks() {
  return {
    bottlenecks: [
      {
        type: 'process',
        location: 'Review',
        taskCount: 1,
        avgDaysStuck: 3,
        severity: 'medium',
        recommendation: '"Review" column has tasks piling up.'
      },
      {
        type: 'person',
        location: 'Marcus Rodriguez',
        taskCount: 3,
        avgDaysStuck: 5,
        severity: 'high',
        recommendation: 'Marcus Rodriguez has 3 stale tasks (5+ days idle).'
      }
    ],
    summary: {
      processBottlenecks: 1,
      personBottlenecks: 1,
      total: 2
    },
    overallHealthScore: 78,
    healthSummary: '2 bottlenecks detected impacting 4 tasks.',
    mlPowered: true,
    rebalanceSuggestions: [
      {
        taskId: 'task-3',
        taskTitle: 'Implement dark mode styles',
        taskPriority: 'Medium',
        fromUser: { id: 'user-2', name: 'Marcus Rodriguez', wellness: 54 },
        toUser: {
          id: 'demo-admin-id',
          name: 'Alex Mercer (Demo Admin)',
          skillMatch: 95,
          wellness: 92,
          wellnessStatus: 'Healthy',
          matchingSkills: ['React', 'TypeScript']
        },
        requiredSkills: ['React', 'CSS']
      }
    ],
    projects: [
      {
        projectId: 'project-2',
        projectName: 'Mobile App Redesign',
        bottlenecks: [
          {
            type: 'process',
            location: 'Review',
            taskCount: 1,
            avgDaysStuck: 3,
            severity: 'medium',
            recommendation: '"Review" column has tasks piling up.'
          }
        ],
        overdueTasks: []
      }
    ]
  };
}

export async function handleDemoApiRequest(url: string, init?: RequestInit): Promise<any> {
  const urlObj = new URL(url, 'http://localhost:3000');
  const path = urlObj.pathname;
  const db = getDemoDb();

  if (path.startsWith('/api/documents')) {
    const projectId = urlObj.searchParams.get('projectId');
    return db.getDocuments(projectId || '');
  }

  if (path.startsWith('/api/time-tracking')) {
    const projectId = urlObj.searchParams.get('projectId');
    const userId = urlObj.searchParams.get('userId');
    return getDemoTimeTrackingStats(projectId || '', userId || '');
  }

  if (path.startsWith('/api/shortcuts')) {
    const projectId = urlObj.searchParams.get('projectId');
    return db.getShortcuts(projectId || '');
  }

  if (path.startsWith('/api/repo-links')) {
    const projectId = urlObj.searchParams.get('projectId');
    return db.getRepoLinks(projectId || '');
  }

  if (path.startsWith('/api/ml/recommendations')) {
    const mode = urlObj.searchParams.get('mode');
    if (mode === 'task-of-the-day') {
      const userId = urlObj.searchParams.get('userId');
      return getDemoTaskOfTheDay(userId || 'demo-admin-id');
    }
    const projectId = urlObj.searchParams.get('projectId');
    return getDemoRecommendations(projectId || '');
  }

  if (path.startsWith('/api/messages')) {
    const projectId = urlObj.searchParams.get('projectId');
    const recipientId = urlObj.searchParams.get('recipientId');
    const conversationType = urlObj.searchParams.get('conversationType');
    if (conversationType === 'dm') {
      const userId = 'demo-admin-id'; // assume Demo Admin
      return db.getDirectMessages(userId, recipientId || '');
    }
    return db.getMessages(projectId || '');
  }

  if (path.startsWith('/api/analytics/bottlenecks')) {
    return getDemoBottlenecks();
  }

  if (path.startsWith('/api/forms/responses')) {
    const formId = urlObj.searchParams.get('formId');
    if (formId) {
      return db.getFormResponses(formId);
    }
    const projectId = urlObj.searchParams.get('projectId');
    const respondentId = urlObj.searchParams.get('respondentId');
    return db.getFormResponsesByRespondent(projectId || '', respondentId || '');
  }

  if (path.startsWith('/api/forms')) {
    const projectId = urlObj.searchParams.get('projectId');
    return db.getForms(projectId || '');
  }

  return null;
}

let demoDbInstance: DemoDatabase | null = null;
export function getDemoDb(): DemoDatabase {
  if (!demoDbInstance) {
    demoDbInstance = new DemoDatabase();
  }
  return demoDbInstance;
}
