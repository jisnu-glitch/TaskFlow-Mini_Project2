'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Project, Task, Status } from '@/types';
import { TaskBoard } from '@/components/TaskBoard';
import SummaryView from '@/components/SummaryView';
import BacklogView from '@/components/BacklogView';
import TimelineView from '@/components/TimelineView';
import ChatView from '@/components/ChatView';
import PagesView from '@/components/PagesView';
import DeploymentsView from '@/components/DeploymentsView';
import CalendarView from '@/components/CalendarView';
import ReportsView from '@/components/ReportsView';
import TimeTrackingView from '@/components/TimeTrackingView';
import ShortcutsView from '@/components/ShortcutsView';
import FormsView from '@/components/FormsView';
import CodeView from '@/components/CodeView';
import { CreateTaskDialog } from '@/components/forms/CreateTaskDialog';
import { Modal } from '@/components/ui/Modal';
import VideoRoom from '@/components/VideoRoom';
import { useAuth } from '@/contexts/AuthContext';
import { Video, Folder, FileText, BarChart3, Plus, UserPlus, Check, Rocket, Calendar, PieChart } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { isDemoMode } from '@/lib/demo-db';
import { db } from '@/lib/db';

// Nav Items definition
const NAV_ITEMS = ['Recommendations', 'Summary', 'Backlog', 'Board', 'Timeline', 'Code', 'Pages', 'Deployments', 'Calendar', 'Reports', 'Time Tracking', 'Chat', 'Forms', 'Shortcuts'] as const;
type Tab = typeof NAV_ITEMS[number];

import MLTaskRecommendations from '@/components/MLTaskRecommendations';
import { calculateAge } from '@/lib/utils';

export default function ProjectPage() {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();
    const [tabLoaded, setTabLoaded] = React.useState(false);

    const [activeTab, setActiveTab] = useState<Tab>('Board');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
    const [isVideoOpen, setIsVideoOpen] = useState(false);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [isMembersListOpen, setIsMembersListOpen] = useState(false);
    const [projectMembers, setProjectMembers] = useState<string[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [lastSyncTime, setLastSyncTime] = useState(0);
    const { users, currentUser } = useAuth();
    // ... (rest of the component state and effects remain the same until the return statement)

    const searchParams = useSearchParams();
    const urlTab = searchParams.get('tab');

    // Load saved tab from localStorage on mount, but URL query param takes priority
    useEffect(() => {
        if (id && typeof window !== 'undefined') {
            if (urlTab) {
                // Case-insensitive match: URL uses 'chat' but NAV_ITEMS has 'Chat'
                const matchedTab = NAV_ITEMS.find(
                    item => item.toLowerCase() === urlTab.toLowerCase()
                );
                if (matchedTab) {
                    setActiveTab(matchedTab);
                }
            } else {
                const stored = localStorage.getItem(`project-${id}-activeTab`);
                if (stored && NAV_ITEMS.includes(stored as Tab)) {
                    setActiveTab(stored as Tab);
                }
            }
            setTabLoaded(true);
        }
    }, [id, urlTab]);

    // Custom handler to change tab and save to localStorage
    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        if (id && typeof window !== 'undefined') {
            localStorage.setItem(`project-${id}-activeTab`, tab);
        }
    };

    // Listen for tab-change events from notifications (handles same-page navigation)
    useEffect(() => {
        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<{ tab: string }>;
            const tabName = customEvent.detail?.tab;
            if (tabName) {
                const matchedTab = NAV_ITEMS.find(
                    item => item.toLowerCase() === tabName.toLowerCase()
                );
                if (matchedTab) {
                    setActiveTab(matchedTab);
                    if (id && typeof window !== 'undefined') {
                        localStorage.setItem(`project-${id}-activeTab`, matchedTab);
                    }
                }
            }
        };
        window.addEventListener('tab-change', handler);
        return () => window.removeEventListener('tab-change', handler);
    }, [id]);

    const fetchData = useCallback(async (silent = false) => {
        if (!id || !currentUser) return;
        try {
            if (!silent && !project) setLoading(true);
            const [tasksData, projectsData, membersData] = await Promise.all([
                db.getTasks(id),
                db.getProjects(currentUser.id),
                db.getProjectMembers(id),
            ]);

            let nextTasks = Array.isArray(tasksData) ? tasksData : [];
            if (currentUser.role === 'Member') {
                nextTasks = nextTasks.filter(t => !t.isPrivate || t.assigneeId === currentUser.id);
            }
            setTasks(nextTasks);

            if (Array.isArray(projectsData)) {
                const currentProject = projectsData.find((p: Project) => p.id === id);
                if (!currentProject) {
                    setProject(null);
                    setTimeout(() => router.push('/'), 3000);
                } else {
                    setProject(currentProject);
                }
            } else {
                setProject(null);
            }

            // If we recently updated members manually (within last 5 seconds), skip background sync
            if (!silent || Date.now() - lastSyncTime > 5000) {
                const nextMembers = Array.isArray(membersData) ? membersData : [];
                setProjectMembers(nextMembers);
                // Only sync selected members if modal is NOT open to avoid overwriting user selection
                if (!isInviteOpen) {
                    setSelectedMembers(nextMembers);
                } else if (silent) {
                    console.log("Background sync: Modal is open, skipping selectedMembers update to preserve user input.");
                }
            }


        } catch (err) {
            console.error("Error fetching project data:", err);
            setTasks([]);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [id, currentUser, isInviteOpen, lastSyncTime, project, router]);

    useEffect(() => {
        if (id && currentUser?.id) {
            fetchData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, currentUser?.id]);

    useEffect(() => {
        if (!id || !currentUser?.id || isDemoMode()) return;

        // Subscribe to tasks
        const supabase = getSupabase();
        const tasksChannel = supabase
            .channel(`public:tasks:project_id=eq.${id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks',
                    filter: `project_id=eq.${id}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newTask: Task = {
                            id: payload.new.id,
                            projectId: payload.new.project_id,
                            title: payload.new.title,
                            description: payload.new.description,
                            status: payload.new.status,
                            priority: payload.new.priority,
                            assigneeId: payload.new.assignee_id,
                            dueDate: payload.new.due_date,
                            startDate: payload.new.start_date,
                            createdAt: payload.new.created_at,
                            updatedAt: payload.new.updated_at,
                            tags: payload.new.tags || [],
                        };
                        setTasks(prev => {
                            if (prev.some(t => t.id === newTask.id)) return prev;
                            return [...prev, newTask];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setTasks(prev => prev.map(t => t.id === payload.new.id ? {
                            ...t,
                            title: payload.new.title,
                            description: payload.new.description,
                            status: payload.new.status,
                            priority: payload.new.priority,
                            assigneeId: payload.new.assignee_id,
                            dueDate: payload.new.due_date,
                            startDate: payload.new.start_date,
                            updatedAt: payload.new.updated_at,
                            tags: payload.new.tags || [],
                        } : t));
                    } else if (payload.eventType === 'DELETE') {
                        setTasks(prev => prev.filter(t => t.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        // Subscribe to project members
        const membersChannel = supabase
            .channel(`public:project_members:project_id=eq.${id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'project_members',
                    filter: `project_id=eq.${id}`
                },
                () => {
                    // Refetch members on any change to members table for this project
                    fetchData(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(tasksChannel);
            supabase.removeChannel(membersChannel);
        };
    }, [id, currentUser?.id, fetchData]);

    const handleTaskMove = async (taskId: string, newStatus: Status) => {
        // Optimistic update
        const oldTasks = [...tasks];
        setTasks(prev => prev.map(t => t.id == taskId ? { ...t, status: newStatus } : t));

        try {
            const updatedTask = await db.updateTask(taskId, { status: newStatus }, currentUser?.id);
            if (!updatedTask) {
                throw new Error('Failed to update task');
            }
            setTasks(prev => prev.map(t => t.id == taskId ? updatedTask : t));
        } catch (err: any) {
            console.error("Failed to update task", err);
            alert(err.message || "Failed to update task");
            setTasks(oldTasks); // Revert
        }
    };

    const handleTaskUpdate = async (updatedTask: Task) => {
        const previousTask = tasks.find(t => t.id === updatedTask.id);

        // Optimistic
        setTasks(prev => prev.map(t => t.id == updatedTask.id ? updatedTask : t));

        try {
            const realTask = await db.updateTask(updatedTask.id, updatedTask, currentUser?.id);
            if (!realTask) {
                throw new Error('Failed to update task');
            }

            if (updatedTask.assigneeId && !projectMembers.includes(updatedTask.assigneeId)) {
                await db.addProjectMember(id, updatedTask.assigneeId);
                setProjectMembers(prev => prev.includes(updatedTask.assigneeId!) ? prev : [...prev, updatedTask.assigneeId!]);
            }

            setTasks(prev => prev.map(t => t.id == realTask.id ? realTask : t));

            // Alert if new member was auto-added during update
            if (updatedTask.assigneeId && !projectMembers.includes(updatedTask.assigneeId)) {
                const addedUser = users.find(u => u.id === updatedTask.assigneeId);
                const userName = addedUser ? addedUser.name : 'The assigned user';
                alert(`${userName} was automatically added to the project members list!`);
                fetchData(true);
            }
        } catch (err: any) {
            console.error("Failed to update task", err);
            alert(err.message || "Failed to update task");
            if (previousTask) {
                setTasks(prev => prev.map(t => t.id == previousTask.id ? previousTask : t));
            }
            throw err;
        }
    };

    const handleTaskCreateSubmit = async (taskData: Partial<Task>) => {
        const newTask: Task = {
            id: crypto.randomUUID(),
            projectId: id,
            title: taskData.title || 'Untitled',
            description: taskData.description || '',
            status: taskData.status || 'To Do',
            priority: taskData.priority || 'Medium',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: [],
            assigneeId: taskData.assigneeId || undefined,
            startDate: taskData.startDate,
            dueDate: taskData.dueDate
        };

        const previousTasks = [...tasks];
        setTasks(prev => [...prev, newTask]);

        try {
            await db.addTask(newTask, currentUser?.id);
            const realTask = await db.getTaskById(newTask.id);
            if (!realTask) {
                throw new Error('Failed');
            }

            if (taskData.assigneeId && !projectMembers.includes(taskData.assigneeId)) {
                await db.addProjectMember(id, taskData.assigneeId);
                setProjectMembers(prev => prev.includes(taskData.assigneeId!) ? prev : [...prev, taskData.assigneeId!]);
            }

            setTasks(prev => prev.map(t => t.id === newTask.id ? realTask : t));

            // Alert if new member was auto-added
            if (taskData.assigneeId && !projectMembers.includes(taskData.assigneeId)) {
                const addedUser = users.find(u => u.id === taskData.assigneeId);
                const userName = addedUser ? addedUser.name : 'The assigned user';
                alert(`${userName} was automatically added to the project members list!`);
                // Trigger a sync of project members
                fetchData(true);
            }
        } catch (err) {
            console.error(err);
            setTasks(previousTasks);
        }
    };

    const handleTaskDelete = async (taskId: string) => {
        // Optimistic delete
        const previousTasks = [...tasks];
        setTasks(prev => prev.filter(t => t.id !== taskId));

        try {
            const success = await db.deleteTask(taskId, currentUser?.id || 'system');

            if (!success) {
                throw new Error('Failed to delete task');
            }
        } catch (err: any) {
            console.error("Failed to delete task", err);
            alert(err.message || "Failed to delete task");
            setTasks(previousTasks); // Revert
        }
    };

    const handleRemoveMember = async (userIdToRemove: string) => {
        if (!confirm('Are you sure you want to remove this member from the project?')) return;

        try {
            const unassignedCount = await db.unassignUserTasks(id, userIdToRemove);
            const success = await db.removeProjectMember(id, userIdToRemove);

            if (success) {
                setProjectMembers(prev => prev.filter(uid => uid !== userIdToRemove));
                setSelectedMembers(prev => prev.filter(uid => uid !== userIdToRemove));
                if (unassignedCount > 0) {
                    setTasks(prev => prev.map(task => task.assigneeId === userIdToRemove ? { ...task, assigneeId: undefined } : task));
                }
                setLastSyncTime(Date.now());
            } else {
                alert('Failed to remove member');
            }
        } catch (error) {
            console.error('Error removing member:', error);
            alert('Failed to remove member');
        }
    };

    if (loading && !project) return <div className="p-10 text-center text-gray-500 dark:text-gray-400">Loading Workspace...</div>;
    if (!project) return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] p-10 bg-gray-50 dark:bg-gray-900">
            <div className="text-red-500 mb-4 bg-red-50 dark:bg-red-900/20 p-4 rounded-full">
                <BarChart3 size={48} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied or Project Not Found</h1>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                You don&apos;t have permission to view this project, or it doesn&apos;t exist.
                You will be redirected to the dashboard in a few seconds...
            </p>
            <button
                onClick={() => router.push('/dashboard')}
                className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
            >
                Back to Dashboard
            </button>
        </div>
    );

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900">
            {isVideoOpen && <VideoRoom projectId={id} onLeave={() => setIsVideoOpen(false)} />}

            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center bg-white dark:bg-gray-800 z-10">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <span className="w-9 h-8 flex items-center justify-center bg-blue-600 text-white rounded text-sm">{project.key}</span>
                        {project.name}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsVideoOpen(true)}
                        className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                        <Video size={16} /> Join Meeting
                    </button>
                    <div className="flex items-center gap-1">
                        <div
                            className="flex -space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setIsMembersListOpen(true)}
                            title="View all project members"
                        >
                            {projectMembers.slice(0, 3).map((memberId, idx) => {
                                const member = users.find(u => u.id === memberId);
                                return (
                                    <div
                                        key={memberId}
                                        className="w-8 h-8 rounded-full border-2 border-white bg-indigo-500 text-white flex items-center justify-center text-xs font-medium"
                                        title={member?.name}
                                    >
                                        {member?.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                );
                            })}
                            {projectMembers.length > 3 && (
                                <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-500 text-white flex items-center justify-center text-xs">
                                    +{projectMembers.length - 3}
                                </div>
                            )}
                        </div>
                        {/* Add member button */}
                        {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager') && (
                            <button
                                onClick={() => {
                                    setSelectedMembers([...projectMembers]);
                                    setIsInviteOpen(true);
                                }}
                                className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-xs transition-colors"
                                title="Add team member"
                            >
                                <Plus size={14} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(window.location.href)
                                    .then(() => alert('Project link copied to clipboard!'))
                                    .catch(() => alert('Failed to copy link'));
                            } else {
                                // Fallback for environments without clipboard API
                                prompt('Copy this link:', window.location.href);
                            }
                        }}
                        className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                        Share
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 bg-gray-50/50 dark:bg-gray-800/50">
                <nav className="flex space-x-6 -mb-px">
                    <div className="flex space-x-6 overflow-x-auto no-scrollbar">
                        {NAV_ITEMS.map((item) => (
                            <button
                                key={item}
                                onClick={() => handleTabChange(item)}
                                className={`py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap relative ${activeTab === item
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                            >
                                <span className="flex items-center gap-1.5">
                                    {item}
                                </span>
                            </button>
                        ))}
                    </div>
                </nav>
            </div>

            {/* Main Content Area */}
            <div className={`flex-1 bg-gray-50/30 dark:bg-gray-900 ${activeTab === 'Chat' || activeTab === 'Forms' || activeTab === 'Pages' || activeTab === 'Calendar' || activeTab === 'Deployments' || activeTab === 'Timeline' ? 'overflow-hidden' : 'overflow-auto p-6'}`}>
                <CreateTaskDialog
                    isOpen={isCreateTaskOpen}
                    onClose={() => setIsCreateTaskOpen(false)}
                    currentProjectId={params.id as string}
                    onSubmit={handleTaskCreateSubmit}
                />

                {activeTab === 'Recommendations' && <MLTaskRecommendations tasks={tasks} projectId={id} users={users} currentUser={currentUser} onTaskUpdate={handleTaskUpdate} />}
                {activeTab === 'Summary' && <SummaryView tasks={tasks} projectId={id} currentUser={currentUser} />}
                {activeTab === 'Backlog' && <BacklogView tasks={tasks} onTaskCreate={() => setIsCreateTaskOpen(true)} onTaskUpdate={handleTaskUpdate} onTaskDelete={handleTaskDelete} projectMemberIds={projectMembers} />}

                {activeTab === 'Board' && <TaskBoard tasks={tasks} onTaskMove={handleTaskMove} />}
                {activeTab === 'Timeline' && <TimelineView tasks={tasks} projectMemberIds={projectMembers} />}
                <div className={activeTab === 'Chat' ? 'flex h-full min-h-0 flex-col' : 'hidden h-full min-h-0'}>
                    <ChatView projectId={id} projectMemberIds={projectMembers} />
                </div>

                {activeTab === 'Code' && (
                    <div className="h-[calc(100vh-220px)]">
                        <CodeView projectId={id} />
                    </div>
                )}

                {activeTab === 'Pages' && (
                    <PagesView projectId={id} />
                )}

                {activeTab === 'Deployments' && (
                    <DeploymentsView projectId={id} />
                )}

                {activeTab === 'Calendar' && (
                    <CalendarView projectId={id} tasks={tasks} />
                )}

                {activeTab === 'Reports' && (
                    <ReportsView projectId={id} tasks={tasks} />
                )}

                {activeTab === 'Time Tracking' && (
                    <TimeTrackingView projectId={id} tasks={tasks} />
                )}

                {activeTab === 'Forms' && (
                    <FormsView projectId={id} />
                )}

                {activeTab === 'Shortcuts' && (
                    <ShortcutsView projectId={id} />
                )}
            </div>

            {/* Invite Team Member Modal */}
            <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Add Team Members" maxWidth="max-w-2xl">
                <div className="p-4">
                    <div className="flex items-center mb-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">Select team members to add to this project:</p>
                        <button
                            onClick={async () => {
                                console.log("Done button clicked. Selected members:", selectedMembers);
                                try {
                                    const currentMembers = await db.getProjectMembers(id);
                                    const projectOwnerId = project?.ownerId;
                                    const desiredMembers = Array.from(new Set([
                                        ...selectedMembers,
                                        ...(projectOwnerId ? [projectOwnerId] : []),
                                    ]));
                                    const toAdd = desiredMembers.filter(memberId => !currentMembers.includes(memberId));
                                    const toRemove = currentMembers.filter(memberId => !desiredMembers.includes(memberId) && memberId !== projectOwnerId);

                                    for (const memberId of toAdd) {
                                        await db.addProjectMember(id, memberId);
                                    }

                                    for (const memberId of toRemove) {
                                        await db.removeProjectMember(id, memberId);
                                    }

                                    const updatedMembers = await db.getProjectMembers(id);
                                    console.log("Member update successful. Updated members:", updatedMembers);
                                    setProjectMembers(updatedMembers);
                                    setSelectedMembers(updatedMembers);
                                    setLastSyncTime(Date.now());
                                    setIsInviteOpen(false);
                                    setTimeout(() => alert(`Project members updated!`), 100);
                                } catch (err) {
                                    console.error("Connection error in member update:", err);
                                    alert('Failed to update members - check console for details');
                                }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors shadow-sm cursor-pointer ml-auto"
                        >
                            Done
                        </button>
                    </div>
                    <div className="space-y-2 pr-2">
                        {users.filter(u => u.role !== 'Admin').map(user => {
                            const isSelected = selectedMembers.includes(user.id);
                            return (
                                <div
                                    key={user.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                        }`}
                                    onClick={() => {
                                        if (isSelected) {
                                            setSelectedMembers(prev => prev.filter(id => id !== user.id));
                                        } else {
                                            setSelectedMembers(prev => [...prev, user.id]);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-medium overflow-hidden">
                                            {user.avatarUrl ? (
                                                <img 
                                                    src={user.avatarUrl} 
                                                    alt={user.name} 
                                                    className="w-full h-full object-cover" 
                                                    onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`; }}
                                                />
                                            ) : (
                                                user.name.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                            <Check size={14} className="text-white" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {/* Done and Cancel buttons moved to the top header area of this modal */}
                </div>
            </Modal>

            {/* Project Members List Modal */}
            <Modal isOpen={isMembersListOpen} onClose={() => setIsMembersListOpen(false)} title="Project Members">
                <div className="p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">All members on this project, organized by role seniority and join date.</p>
                    <div className="space-y-3 pr-2 no-scrollbar">
                        {projectMembers
                            .map(id => users.find(u => u.id === id))
                            .filter(Boolean)
                            .sort((a, b) => {
                                // 1. Sort by role (Admin > Manager > Member)
                                const roleWeight = { 'Admin': 3, 'Manager': 2, 'Member': 1 };
                                if (roleWeight[a!.role] !== roleWeight[b!.role]) {
                                    return roleWeight[b!.role] - roleWeight[a!.role];
                                }
                                // 2. Sort by createdAt ascending (older is more senior)
                                if (a!.createdAt && b!.createdAt && a!.createdAt !== b!.createdAt) {
                                    return new Date(a!.createdAt).getTime() - new Date(b!.createdAt).getTime();
                                }
                                // 3. Fallback to name alphabetic
                                return (a!.name || '').localeCompare(b!.name || '');
                            })
                            .map((user, idx) => (
                                <div key={user!.id} className="flex items-start gap-4 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg border border-indigo-200 dark:border-indigo-800 relative overflow-hidden">
                                        {user!.avatarUrl ? (
                                            <img 
                                                src={user!.avatarUrl} 
                                                alt={user!.name} 
                                                className="w-full h-full object-cover" 
                                                onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user!.name)}&background=random`; }}
                                            />
                                        ) : (
                                            user!.name.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 max-w-full">
                                                <p className="font-semibold text-gray-900 dark:text-white truncate" title={user!.name}>{user!.name}</p>
                                            </div>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${user!.role === 'Admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                user!.role === 'Manager' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}>
                                                {user!.role}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{user!.email}</p>
                                    </div>

                                    {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager') && user!.id !== currentUser?.id && (
                                        <button
                                            onClick={() => handleRemoveMember(user!.id)}
                                            className="ml-2 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-white border border-red-200 hover:bg-red-600 dark:hover:bg-red-700 dark:border-red-900/50 rounded-md transition-colors flex-shrink-0"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}

                        {projectMembers.length === 0 && (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                No members found in this project.
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
