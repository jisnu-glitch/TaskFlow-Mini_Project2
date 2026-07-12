'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, MessageSquare, ArrowRightLeft, FileText, Sparkles, Check, BellOff } from 'lucide-react';
import { Notification } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { isDemoMode } from '@/lib/demo-db';
import { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { db } from '@/lib/db';

const NOTIFICATION_CONFIG: Record<string, {
    icon: React.ElementType;
    gradient: string;
    accentColor: string;
    label: string;
}> = {
    task_assigned: {
        icon: CheckCircle2,
        gradient: 'from-blue-500 to-indigo-600',
        accentColor: 'text-blue-400',
        label: 'Task',
    },
    task_status_changed: {
        icon: ArrowRightLeft,
        gradient: 'from-violet-500 to-purple-600',
        accentColor: 'text-violet-400',
        label: 'Status',
    },
    new_message: {
        icon: MessageSquare,
        gradient: 'from-emerald-500 to-teal-600',
        accentColor: 'text-emerald-400',
        label: 'Chat',
    },
    new_form: {
        icon: FileText,
        gradient: 'from-amber-500 to-orange-600',
        accentColor: 'text-amber-400',
        label: 'Form',
    },
    general: {
        icon: Sparkles,
        gradient: 'from-gray-500 to-slate-600',
        accentColor: 'text-gray-400',
        label: 'Info',
    },
};

export function NotificationBell() {
    const { currentUser } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [animateBell, setAnimateBell] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const prevUnreadRef = useRef(0);

    const fetchNotifications = async () => {
        if (!currentUser) return;
        try {
            const data = await db.getNotifications(currentUser.id);
            setNotifications(data);
            const newUnread = data.filter((n: Notification) => !n.isRead).length;
            // Animate bell if new notifications arrived
            if (newUnread > prevUnreadRef.current) {
                setAnimateBell(true);
                setTimeout(() => setAnimateBell(false), 1000);
            }
            prevUnreadRef.current = newUnread;
            setUnreadCount(newUnread);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    useEffect(() => {
        if (!currentUser) return;

        // Fetch initial notifications
        fetchNotifications();

        // Skip realtime subscription in demo mode
        if (isDemoMode()) return;

        // Subscribe to changes
        const supabase = getSupabase();
        const channel = supabase
            .channel(`public:notifications:user_id=eq.${currentUser.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${currentUser.id}`
                },
                (payload: RealtimePostgresInsertPayload<any>) => {
                    const newNotif = {
                        id: payload.new.id,
                        userId: payload.new.user_id,
                        type: payload.new.type,
                        title: payload.new.title,
                        message: payload.new.message,
                        isRead: payload.new.is_read,
                        link: payload.new.link,
                        entityId: payload.new.entity_id,
                        projectId: payload.new.project_id,
                        createdAt: payload.new.created_at,
                    };

                    setNotifications(prev => [newNotif as Notification, ...prev]);
                    setUnreadCount(prev => prev + 1);
                    setAnimateBell(true);
                    setTimeout(() => setAnimateBell(false), 1000);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            const success = await db.markNotificationRead(id);
            if (success) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const handleMarkAllAsRead = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser || unreadCount === 0) return;
        setIsLoading(true);
        try {
            const success = await db.markAllNotificationsRead(currentUser.id);
            if (success) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
            }
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.isRead) {
            handleMarkAsRead(notification.id);
        }
        setIsOpen(false);

        if (notification.link) {
            // Extract tab from link if it contains ?tab=
            const tabMatch = notification.link.match(/[?&]tab=([^&]+)/);
            if (tabMatch) {
                window.dispatchEvent(new CustomEvent('tab-change', { detail: { tab: tabMatch[1] } }));
            }
            router.push(notification.link);
        } else if (notification.projectId) {
            if (notification.type === 'task_assigned' || notification.type === 'task_status_changed') {
                router.push(`/projects/${notification.projectId}?task=${notification.entityId}`);
            } else if (notification.type === 'new_message') {
                window.dispatchEvent(new CustomEvent('tab-change', { detail: { tab: 'chat' } }));
                router.push(`/projects/${notification.projectId}?tab=chat`);
            } else if (notification.type === 'new_form') {
                window.dispatchEvent(new CustomEvent('tab-change', { detail: { tab: 'forms' } }));
                router.push(`/projects/${notification.projectId}?tab=forms`);
            } else {
                router.push(`/projects/${notification.projectId}`);
            }
        }
    };

    const config = (type: string) => NOTIFICATION_CONFIG[type] || NOTIFICATION_CONFIG.general;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    relative p-2 rounded-xl transition-all duration-300
                    hover:bg-gray-100/80 dark:hover:bg-white/[0.08]
                    focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-1 dark:focus:ring-offset-gray-900
                    ${isOpen ? 'bg-gray-100/80 dark:bg-white/[0.08]' : ''}
                    ${animateBell ? 'animate-[bellShake_0.6s_ease-in-out]' : ''}
                `}
                aria-label="Notifications"
            >
                <Bell size={19} className="text-gray-500 dark:text-gray-400 transition-colors" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-[10px] font-bold text-white shadow-lg shadow-red-500/30 ring-2 ring-white dark:ring-gray-900 animate-[popIn_0.3s_ease-out]">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-[360px] sm:w-[400px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/40 border border-gray-200/80 dark:border-gray-700/60 z-50 overflow-hidden animate-[slideDown_0.2s_ease-out]">
                    {/* Header */}
                    <div className="px-5 py-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2.5">
                            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white tracking-tight">
                                Notifications
                            </h3>
                            {unreadCount > 0 && (
                                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                                <Check size={13} strokeWidth={2.5} />
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[420px] overflow-y-auto overscroll-contain">
                        {notifications.length === 0 ? (
                            <div className="py-14 px-6 flex flex-col items-center justify-center">
                                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                    <BellOff size={24} className="text-gray-300 dark:text-gray-600" />
                                </div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No notifications yet</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">We&apos;ll let you know when something arrives</p>
                            </div>
                        ) : (
                            <div>
                                {notifications.map((notification, index) => {
                                    const cfg = config(notification.type);
                                    const Icon = cfg.icon;
                                    return (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`
                                                group relative flex gap-3.5 px-5 py-3.5 cursor-pointer transition-all duration-200
                                                hover:bg-gray-50 dark:hover:bg-white/[0.03]
                                                ${!notification.isRead
                                                    ? 'bg-blue-50/40 dark:bg-blue-500/[0.04]'
                                                    : ''
                                                }
                                                ${index !== notifications.length - 1 ? 'border-b border-gray-100/80 dark:border-gray-800/60' : ''}
                                            `}
                                        >
                                            {/* Unread indicator line */}
                                            {!notification.isRead && (
                                                <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b from-blue-500 to-indigo-500" />
                                            )}

                                            {/* Icon */}
                                            <div className="flex-shrink-0 mt-0.5">
                                                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shadow-sm`}>
                                                    <Icon size={16} className="text-white" strokeWidth={2.2} />
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-[13px] leading-snug ${!notification.isRead
                                                        ? 'font-semibold text-gray-900 dark:text-white'
                                                        : 'font-medium text-gray-700 dark:text-gray-300'
                                                        } line-clamp-1`}>
                                                        {notification.title}
                                                    </p>
                                                    <span className={`flex-shrink-0 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${!notification.isRead
                                                        ? 'bg-blue-100/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                                                        }`}>
                                                        {cfg.label}
                                                    </span>
                                                </div>
                                                <p className={`text-[12.5px] leading-relaxed mt-0.5 ${!notification.isRead
                                                    ? 'text-gray-600 dark:text-gray-400'
                                                    : 'text-gray-500 dark:text-gray-500'
                                                    } line-clamp-2`}>
                                                    {notification.message}
                                                </p>
                                                <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1.5 font-medium">
                                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                            <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center font-medium">
                                Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Animations */}
            <style jsx global>{`
                @keyframes bellShake {
                    0%, 100% { transform: rotate(0deg); }
                    15% { transform: rotate(14deg); }
                    30% { transform: rotate(-12deg); }
                    45% { transform: rotate(10deg); }
                    60% { transform: rotate(-8deg); }
                    75% { transform: rotate(4deg); }
                }
                @keyframes popIn {
                    0% { transform: scale(0); opacity: 0; }
                    70% { transform: scale(1.15); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes slideDown {
                    0% { opacity: 0; transform: translateY(-8px) scale(0.97); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
