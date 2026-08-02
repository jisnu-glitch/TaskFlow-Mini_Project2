'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Task, Comment, Priority, Status, Deployment } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTimer } from '@/contexts/TimerContext';
import { Trash2, Calendar, User as UserIcon, MessageSquare, Clock, Sparkles, ArrowRight, Edit, Play, Square, Rocket, Lock } from 'lucide-react';
import { CustomSelect, SelectOption } from './ui/CustomSelect';
import { PRIORITY_COLORS, STATUS_COLORS } from '@/lib/constants';
import { getUserName, getActionDisplay } from '@/lib/utils';
import { getSupabase } from '@/lib/supabase';
import { isDemoMode } from '@/lib/demo-db';
import { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { db } from '@/lib/db';

// Icon component to render Lucide icons by name
const ActionIcon = ({ iconName, size = 14 }: { iconName: string; size?: number }) => {
    switch (iconName.toLowerCase()) {
        case 'trash': return <Trash2 size={size} />;
        case 'trash2': return <Trash2 size={size} />;
        case 'calendar': return <Calendar size={size} />;
        case 'user': return <UserIcon size={size} />;
        case 'message': return <MessageSquare size={size} />;
        case 'messagesquare': return <MessageSquare size={size} />;
        case 'clock': return <Clock size={size} />;
        case 'sparkles': return <Sparkles size={size} />;
        case 'arrow-right': return <ArrowRight size={size} />;
        case 'arrowright': return <ArrowRight size={size} />;
        case 'edit': return <Edit size={size} />;
        case 'play': return <Play size={size} />;
        case 'square': return <Square size={size} />;
        default: return <Edit size={size} />;
    }
};

interface TaskDetailModalProps {
    task: Task | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (task: Task) => void;
    onDelete: (taskId: string) => void;
    projectMemberIds?: string[];
}

export function TaskDetailModal({ task, isOpen, onClose, onUpdate, onDelete, projectMemberIds = [] }: TaskDetailModalProps) {
    const { currentUser, users } = useAuth();
    const { activeTimer, startTimer, stopTimer, elapsedMinutes } = useTimer();
    const [isEditing, setIsEditing] = useState(false);
    const [editedTask, setEditedTask] = useState<Task | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [timeEntries, setTimeEntries] = useState<any[]>([]);
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [activeTab, setActiveTab] = useState<'comments' | 'history' | 'time' | 'deployments'>('comments');
    const [newComment, setNewComment] = useState('');
    const [timeLogMinutes, setTimeLogMinutes] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [loadingComments, setLoadingComments] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingDeployments, setLoadingDeployments] = useState(false);
    const [projectTasks, setProjectTasks] = useState<Task[]>([]);
    const [loadingProjectTasks, setLoadingProjectTasks] = useState(false);

    const isMember = currentUser?.role === 'Member';

    useEffect(() => {
        if (!task) return;

        setEditedTask(task);
        fetchComments(task.id);
        fetchHistory(task.id);
        fetchTimeEntries(task.id);
        fetchDeployments(task.id);
        fetchProjectTasks(task.projectId);

        // Skip realtime subscription in demo mode
        if (isDemoMode()) return;

        const supabase = getSupabase();
        const channel = supabase
            .channel(`public:comments:task_id=eq.${task.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'comments',
                    filter: `task_id=eq.${task.id}`
                },
                (payload: RealtimePostgresInsertPayload<any>) => {
                    setComments(prev => {
                        if (prev.some(c => c.id === payload.new.id)) return prev;
                        const newCommentObj: Comment = {
                            id: payload.new.id,
                            taskId: payload.new.task_id,
                            userId: payload.new.user_id,
                            content: payload.new.content,
                            createdAt: payload.new.created_at
                        };
                        return [...prev, newCommentObj];
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'comments',
                    filter: `task_id=eq.${task.id}`
                },
                (payload) => {
                    setComments(prev => prev.filter(c => c.id !== payload.old.id));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [task]);

    const fetchComments = async (taskId: string) => {
        setLoadingComments(true);
        try {
            const data = await db.getComments(taskId);
            setComments(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching comments:', error);
        } finally {
            setLoadingComments(false);
        }
    };

    const fetchTimeEntries = async (taskId: string) => {
        try {
            const data = await db.getTimeEntries(taskId);
            setTimeEntries(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching time entries:', error);
        }
    };

    const fetchHistory = async (taskId: string) => {
        if (!task) return;
        const taskTitle = task.title; // Capture before async
        setLoadingHistory(true);
        try {
            const data = await db.getActivityLogs();
            if (Array.isArray(data)) {
                const taskLogs = data.filter((log: any) =>
                    log.entityId === taskId || log.details.includes(taskTitle)
                );
                setHistory(taskLogs);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchDeployments = async (taskId: string) => {
        setLoadingDeployments(true);
        try {
            const data = await db.getTaskDeployments(taskId);
            setDeployments(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching deployments:', error);
        } finally {
            setLoadingDeployments(false);
        }
    };
    
    const fetchProjectTasks = async (projectId: string) => {
        setLoadingProjectTasks(true);
        try {
            const data = await db.getTasks(projectId);
            setProjectTasks(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching project tasks:', error);
        } finally {
            setLoadingProjectTasks(false);
        }
    };

    const handleSave = () => {
        if (editedTask) {
            // Check dependency validation if status is In Progress or Done
            if ((editedTask.status === 'In Progress' || editedTask.status === 'Done') && editedTask.status !== task?.status) {
                const incompleteDeps = projectTasks.filter(t => 
                    editedTask.dependencies?.includes(t.id) && t.status !== 'Done'
                );
                if (incompleteDeps.length > 0) {
                    alert(`Cannot update to ${editedTask.status}. This task is blocked by: ${incompleteDeps.map(t => t.title).join(', ')}`);
                    return;
                }
            }
            onUpdate(editedTask);
            setIsEditing(false);
        }
    };

    const handleDelete = async () => {
        if (task) {
            setIsDeleting(true);
            try {
                await onDelete(task.id);
                onClose();
            } catch (error) {
                console.error('Error deleting task:', error);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim() || !task || !currentUser) return;

        try {
            const comment: Comment = {
                id: crypto.randomUUID(),
                taskId: task.id,
                userId: currentUser.id,
                content: newComment,
                createdAt: new Date().toISOString(),
            };

            await db.addComment(comment);
            setComments(prev => prev.some(existing => existing.id === comment.id) ? prev : [...prev, comment]);
            setNewComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };

    const handleStartTimer = () => {
        if (!task) return;
        startTimer(task);
    };

    const handleStopTimer = async () => {
        await stopTimer();
    };

    const handleAddTimeLog = async () => {
        if (!timeLogMinutes || isNaN(Number(timeLogMinutes)) || Number(timeLogMinutes) <= 0 || !task || !currentUser) return;

        try {
            const createdEntry = await db.addManualTimeEntry(
                task.id,
                currentUser.id,
                Number(timeLogMinutes),
                task.projectId,
                'Manual log'
            );

            if (createdEntry) {
                await fetchTimeEntries(task.id);
                setTimeLogMinutes('');
            }
        } catch (error) {
            console.error('Error adding manual time log:', error);
        }
    };

    if (!task || !editedTask) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-4xl"
            title={
                <div className="flex items-center justify-between w-full pr-4">
                    <span>{isEditing ? 'Edit Task' : task.title}</span>

                    {/* Start/Stop Timer Controls in Header */}
                    {!isEditing && (
                        <div className="ml-4">
                            {activeTimer?.taskId === task.id ? (
                                <button
                                    onClick={handleStopTimer}
                                    className="flex items-center space-x-2 px-3 py-1.5 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 transition shadow-sm"
                                >
                                    <Square size={14} fill="currentColor" />
                                    <span className="text-sm font-medium animate-pulse">
                                        Stop ({elapsedMinutes}m)
                                    </span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleStartTimer}
                                    disabled={(task.assigneeId !== currentUser?.id && !!task.assigneeId) || (!!activeTimer && activeTimer.taskId !== task.id)}
                                    className="flex items-center space-x-2 px-3 py-1.5 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                                    title={!!activeTimer ? "Stop current timer before starting a new one" : ""}
                                >
                                    <Play size={14} fill="currentColor" />
                                    <span className="text-sm font-medium">Start Timer</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            }
        >
            <div className="p-4 space-y-6 max-h-[85vh] overflow-y-auto">
                {/* Header with badges */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[task.status]}`}>
                            {task.status}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                            {task.priority}
                        </span>
                        {task.isPrivate && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                <Lock size={12} /> Private
                            </span>
                        )}
                        {task.tags.map(tag => (
                            <span key={tag} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                {isEditing ? (
                    /* Edit Mode */
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                            <input
                                type="text"
                                disabled={isMember}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                value={editedTask.title}
                                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                            <textarea
                                disabled={isMember}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm min-h-[100px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                value={editedTask.description || ''}
                                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                <CustomSelect
                                    options={[
                                        { value: 'To Do', label: 'To Do' },
                                        { value: 'In Progress', label: 'In Progress' },
                                        { value: 'Review', label: 'Review' },
                                        { value: 'Done', label: 'Done' }
                                    ]}
                                    value={editedTask.status}
                                    onChange={(val) => setEditedTask({ ...editedTask, status: val as Status })}
                                    searchable={false}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                                <CustomSelect
                                    options={[
                                        { value: 'Low', label: 'Low' },
                                        { value: 'Medium', label: 'Medium' },
                                        { value: 'High', label: 'High' },
                                        { value: 'Critical', label: 'Critical' }
                                    ]}
                                    value={editedTask.priority}
                                    onChange={(val) => setEditedTask({ ...editedTask, priority: val as Priority })}
                                    disabled={isMember}
                                    searchable={false}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assignee</label>
                            <CustomSelect
                                options={[
                                    { value: '', label: 'Unassigned' },
                                    ...users.filter(u => projectMemberIds.length === 0 || projectMemberIds.includes(u.id)).map(u => ({
                                        value: u.id,
                                        label: u.name,
                                        group: projectMemberIds.length > 0 ? 'Project Members' : undefined,
                                        avatar: u.name.charAt(0).toUpperCase(),
                                        avatarUrl: u.avatarUrl
                                    })),
                                    ...users.filter(u => projectMemberIds.length > 0 && !projectMemberIds.includes(u.id)).map(u => ({
                                        value: u.id,
                                        label: u.name,
                                        group: 'Other Members',
                                        avatar: u.name.charAt(0).toUpperCase(),
                                        avatarUrl: u.avatarUrl
                                    }))
                                ]}
                                value={editedTask.assigneeId || ''}
                                onChange={(val) => setEditedTask({ ...editedTask, assigneeId: val || undefined })}
                                disabled={isMember}
                            />
                        </div>
                        
                        {!isMember && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Blocked By (Dependencies)</label>
                                <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded p-2 bg-gray-50 dark:bg-gray-800 space-y-1">
                                    {projectTasks.filter(t => t.id !== editedTask.id).map(t => (
                                        <label key={t.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded">
                                            <input 
                                                type="checkbox" 
                                                checked={(editedTask.dependencies || []).includes(t.id)}
                                                onChange={(e) => {
                                                    const currentDeps = editedTask.dependencies || [];
                                                    if (e.target.checked) {
                                                        setEditedTask({ ...editedTask, dependencies: [...currentDeps, t.id] });
                                                    } else {
                                                        setEditedTask({ ...editedTask, dependencies: currentDeps.filter(id => id !== t.id) });
                                                    }
                                                }}
                                                className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <span className="truncate">{t.title}</span>
                                        </label>
                                    ))}
                                    {projectTasks.length <= 1 && <p className="text-xs text-gray-400 italic">No other tasks to link</p>}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* View Mode */
                    <div className="space-y-4">
                        {task.description && (
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{task.description}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <UserIcon size={14} />
                                <span>Assignee: {task.assigneeId ? getUserName(users, task.assigneeId) : 'Unassigned'}</span>
                            </div>
                            {task.dueDate && (
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <Calendar size={14} />
                                    <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <Clock size={14} />
                                <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
                            </div>

                            {/* Total Time Spent (Calculated from separate table) */}
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
                                <Clock size={14} />
                                <span>
                                    Time Spent:{' '}
                                    {Math.floor(timeEntries.reduce((acc, entry) => acc + (entry.durationMinutes || 0), 0) / 60)}h{' '}
                                    {timeEntries.reduce((acc, entry) => acc + (entry.durationMinutes || 0), 0) % 60}m
                                </span>
                            </div>
                        </div>

                        {task.dependencies && task.dependencies.length > 0 && (
                            <div className="pt-2">
                                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Blocked By</h4>
                                <div className="flex flex-wrap gap-2">
                                    {task.dependencies.map(depId => {
                                        const depTask = projectTasks.find(t => t.id === depId);
                                        return (
                                            <div key={depId} className="flex items-center gap-2 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800 rounded-md text-[11px]">
                                                <span className={`w-2 h-2 rounded-full ${depTask?.status === 'Done' ? 'bg-green-500' : 'bg-amber-500'}`} />
                                                {depTask?.title || 'Unknown Task'}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tabs for Comments and History */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex gap-4 mb-3 border-b border-gray-100 dark:border-gray-700">
                        <button
                            className={`pb-2 text-sm font-medium ${activeTab === 'comments' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600' : 'text-gray-500 dark:text-gray-400'}`}
                            onClick={() => setActiveTab('comments')}
                        >
                            <span className="flex items-center gap-2">
                                <MessageSquare size={14} />
                                Comments ({comments.length})
                            </span>
                        </button>
                        <button
                            className={`pb-2 text-sm font-medium ${activeTab === 'time' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600' : 'text-gray-500 dark:text-gray-400'}`}
                            onClick={() => setActiveTab('time')}
                        >
                            <span className="flex items-center gap-2">
                                <Clock size={14} />
                                Time Logs ({timeEntries.length})
                            </span>
                        </button>
                        <button
                            className={`pb-2 text-sm font-medium ${activeTab === 'deployments' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600' : 'text-gray-500 dark:text-gray-400'}`}
                            onClick={() => setActiveTab('deployments')}
                        >
                            <span className="flex items-center gap-2">
                                <Rocket size={14} />
                                Deployments ({deployments.length})
                            </span>
                        </button>
                        <button
                            className={`pb-2 text-sm font-medium ${activeTab === 'history' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600' : 'text-gray-500 dark:text-gray-400'}`}
                            onClick={() => setActiveTab('history')}
                        >
                            <span className="flex items-center gap-2">
                                <Clock size={14} />
                                History
                            </span>
                        </button>
                    </div>

                    {activeTab === 'comments' ? (
                        <>
                            {loadingComments ? (
                                <div className="text-sm text-gray-400 dark:text-gray-500">Loading comments...</div>
                            ) : (
                                <div className="space-y-3 max-h-48 overflow-y-auto">
                                    {comments.map(comment => (
                                        <div key={comment.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                    {getUserName(users, comment.userId)}
                                                </span>
                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                    {new Date(comment.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">{comment.content}</p>
                                        </div>
                                    ))}
                                    {comments.length === 0 && (
                                        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No comments yet</p>
                                    )}
                                </div>
                            )}

                            {/* Add Comment */}
                            <div className="mt-3 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Add a comment..."
                                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                />
                                <button
                                    onClick={handleAddComment}
                                    disabled={!newComment.trim()}
                                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                                >
                                    Send
                                </button>
                            </div>
                        </>
                    ) : activeTab === 'time' ? (
                        <>
                            <div className="space-y-3 max-h-48 overflow-y-auto mt-4">
                                {timeEntries.map((entry) => (
                                    <div key={entry.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                {getUserName(users, entry.userId)}
                                            </span>
                                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                                {new Date(entry.startTime).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            {entry.endTime ? `Logged ${entry.durationMinutes} minutes` : 'Timer still active...'}
                                            {entry.note && <span className="block italic text-gray-400">&quot;{entry.note}&quot;</span>}
                                        </p>
                                    </div>
                                ))}
                                {timeEntries.length === 0 && (
                                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">No time logged yet</p>
                                )}
                            </div>

                            {/* Add Time Log */}
                            <div className="mt-3 flex gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    disabled={currentUser?.role !== 'Admin' && editedTask.assigneeId !== currentUser?.id}
                                    placeholder="Minutes spent..."
                                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    value={timeLogMinutes}
                                    onChange={(e) => setTimeLogMinutes(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTimeLog()}
                                />
                                <button
                                    onClick={handleAddTimeLog}
                                    disabled={!timeLogMinutes || isNaN(Number(timeLogMinutes)) || Number(timeLogMinutes) <= 0 || (currentUser?.role !== 'Admin' && editedTask.assigneeId !== currentUser?.id)}
                                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                                >
                                    Log Time
                                </button>
                            </div>
                        </>
                    ) : activeTab === 'deployments' ? (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {loadingDeployments ? (
                                <div className="text-sm text-gray-400 dark:text-gray-500">Loading deployments...</div>
                            ) : deployments.length === 0 ? (
                                <p className="text-sm text-gray-400 dark:text-gray-500 italic">No deployments linked to this task yet</p>
                            ) : (
                                deployments.map((deployment) => (
                                    <div key={deployment.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <Rocket size={14} className="text-indigo-500" />
                                                <span className="font-semibold text-gray-900 dark:text-white">{deployment.version}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${deployment.environment === 'Production' ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-400 dark:border-fuchsia-800' :
                                                    deployment.environment === 'Staging' ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' :
                                                        'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800'
                                                    }`}>
                                                    {deployment.environment}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                                {new Date(deployment.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${deployment.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                                                deployment.status === 'Failed' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                                    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                                                }`}>
                                                {deployment.status}
                                            </span>
                                        </div>
                                        {deployment.releaseNotes && (
                                            <p className="text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700">
                                                {deployment.releaseNotes}
                                            </p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {loadingHistory ? (
                                <div className="text-sm text-gray-400 dark:text-gray-500">Loading history...</div>
                            ) : history.length === 0 ? (
                                <p className="text-sm text-gray-400 dark:text-gray-500 italic">No history available</p>
                            ) : (
                                history.map((log: any) => (
                                    <div key={log.id} className="flex gap-3 text-sm">
                                        <div className={`mt-0.5 ${getActionDisplay(log.action).bgColor} w-6 h-6 rounded flex items-center justify-center`}>
                                            <ActionIcon iconName={getActionDisplay(log.action).iconName} size={12} />
                                        </div>
                                        <div>
                                            <p className="text-gray-900 dark:text-gray-100">
                                                <span className="font-medium">{getUserName(users, log.userId)}</span> {log.details.replace(`Task "${task.title}"`, 'Task').replace(task.title, 'this task')}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                    {!isMember ? (
                        <>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex items-center gap-1 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-sm"
                            >
                                <Trash2 size={14} />
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>

                            <div className="flex gap-2">
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={() => { setIsEditing(false); setEditedTask(task); }}
                                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                        >
                                            Save Changes
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={onClose}
                                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                                        >
                                            Close
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                        >
                                            Edit
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="ml-auto flex gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
