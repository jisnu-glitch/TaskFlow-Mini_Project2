'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef, ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { LogOut, Search, Folder, CheckSquare, X, Users } from 'lucide-react';
import { getRoleColor } from '@/lib/utils';
import { Project, Task, User } from '@/types';
import { db } from '@/lib/db';
import { TimerRunningIndicator } from '@/components/TimerRunningIndicator';
import { TimerProvider } from '@/contexts/TimerContext';
import { hasClientSupabaseConfig } from '@/lib/browser-supabase-config';
import { isDemoMode } from '@/lib/demo-db';

interface AuthenticatedLayoutProps {
    children: ReactNode;
}

interface SearchResult {
    type: 'project' | 'task' | 'user';
    id: string;
    title: string;
    subtitle?: string;
    projectId?: string;
}

const PUBLIC_PATHS = ['/login', '/', '/setup', '/landing'];
const ALWAYS_PUBLIC_PATHS = ['/', '/setup', '/landing'];

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
    const { currentUser, users, isLoading, logout, authError, setAuthError, isLoggingOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const requiresSupabaseConfig = pathname !== '/' && pathname !== '/setup' && pathname !== '/landing';
    const hasSupabaseConfig = hasClientSupabaseConfig() || isDemoMode();

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (pathname !== '/login' && requiresSupabaseConfig && !hasSupabaseConfig) {
            const query = typeof window !== 'undefined' ? window.location.search.slice(1) : '';
            const nextPath = query ? `${pathname}?${query}` : pathname;
            router.replace(`/login?issue=supabase&next=${encodeURIComponent(nextPath)}`);
            return;
        }

        if (!isLoading && !currentUser && !PUBLIC_PATHS.includes(pathname)) {
            router.push('/login?issue=auth');
        }
    }, [currentUser, hasSupabaseConfig, isLoading, pathname, requiresSupabaseConfig, router]);

    // Close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search when query changes
    useEffect(() => {
        const searchData = async () => {
            if (searchQuery.trim().length < 2) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const query = searchQuery.toLowerCase();
                const results: SearchResult[] = [];

                const [projectData, taskData, userData] = await Promise.all([
                    db.getProjects(currentUser?.id),
                    db.getTasks(),
                    users.length ? Promise.resolve(users) : db.getUsers(),
                ]);

                const projects = Array.isArray(projectData) ? projectData : [];
                projects
                    .filter(p => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query))
                    .slice(0, 5)
                    .forEach(p => {
                        results.push({
                            type: 'project',
                            id: p.id,
                            title: p.name,
                            subtitle: p.description
                        });
                    });

                const resolvedUsers = Array.isArray(userData) ? userData : [];
                resolvedUsers
                    .filter(u =>
                        u.name.toLowerCase().includes(query) ||
                        u.email.toLowerCase().includes(query) ||
                        u.role.toLowerCase().includes(query) ||
                        (u.skills && u.skills.some((s: string) => s.toLowerCase().includes(query)))
                    )
                    .slice(0, 5)
                    .forEach(u => {
                        results.push({
                            type: 'user',
                            id: u.id,
                            title: u.name,
                            subtitle: `${u.role} • ${u.skills?.slice(0, 2).join(', ')}${u.skills?.length > 2 ? '...' : ''}`
                        });
                    });

                const allTasks = Array.isArray(taskData) ? taskData : [];
                const filteredTasks = currentUser?.role === 'Member'
                    ? allTasks.filter(t => !t.isPrivate || t.assigneeId === currentUser.id)
                    : allTasks;

                filteredTasks
                    .filter(t =>
                        t.title.toLowerCase().includes(query) ||
                        t.description?.toLowerCase().includes(query) ||
                        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(query)))
                    )
                    .slice(0, 5)
                    .forEach(t => {
                        results.push({
                            type: 'task',
                            id: t.id,
                            title: t.title,
                            subtitle: `${t.status} • ${t.priority}${t.tags?.length ? ` • ${t.tags.join(', ')}` : ''}`,
                            projectId: t.projectId
                        });
                    });

                setSearchResults(results);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        };

        const debounce = setTimeout(searchData, 300);
        return () => clearTimeout(debounce);
    }, [currentUser?.id, currentUser?.role, searchQuery, users]);

    const handleResultClick = (result: SearchResult) => {
        if (result.type === 'project') {
            router.push(`/projects/${result.id}`);
        } else if (result.type === 'task' && result.projectId) {
            router.push(`/projects/${result.projectId}?task=${result.id}`);
        } else if (result.type === 'user') {
            router.push(`/team?user=${result.id}`);
        }
        setSearchQuery('');
        setShowResults(false);
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
    };

    // Public pages must remain reachable while auth initialization is resolving.
    if (ALWAYS_PUBLIC_PATHS.includes(pathname)) {
        return <>{children}</>;
    }

    if (requiresSupabaseConfig && !hasSupabaseConfig) {
        return null;
    }

    if (pathname === '/login') {
        return <>{children}</>;
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
        );
    }

    if (!currentUser) {
        return null; // Will redirect to login
    }

    const handleLogout = async () => {
        await logout();
        router.replace('/login');
    };

    return (
        <TimerProvider>
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {/* Logout Loading Overlay */}
                    {isLoggingOut && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                            <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded shadow text-lg font-semibold text-gray-700 dark:text-gray-200">
                                Logging out...
                            </div>
                        </div>
                    )}
                    {/* Error Banner */}
                    {authError && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 text-center relative">
                            <span>{authError}</span>
                            <button
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-red-700 hover:text-red-900"
                                onClick={() => setAuthError('')}
                                aria-label="Dismiss error"
                            >
                                &times;
                            </button>
                        </div>
                    )}
                    {/* Top Navbar */}
                    <div className="h-12 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between px-4 flex-shrink-0">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center gap-2">
                                <img src="/icon.svg" alt="TaskFlow" className="h-4 w-auto" />
                                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">TaskFlow</h1>
                            </div>
                            <div className="relative" ref={searchRef}>
                                <input
                                    type="text"
                                    placeholder="Search . . ."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setShowResults(true);
                                    }}
                                    onFocus={() => setShowResults(true)}
                                    className="w-full max-w-md p-1.5 pl-8 pr-8 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                                />
                                <Search className="absolute w-4 h-4 text-gray-400 left-2.5 top-1/2 transform -translate-y-1/2" />
                                {searchQuery && (
                                    <button
                                        onClick={clearSearch}
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    >
                                        <X size={14} />
                                    </button>
                                )}

                                {/* Search Results Dropdown */}
                                {showResults && searchQuery.length >= 2 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                                        {isSearching ? (
                                            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                                                Searching...
                                            </div>
                                        ) : searchResults.length === 0 ? (
                                            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                                                No results found for "{searchQuery}"
                                            </div>
                                        ) : (
                                            <div className="py-1">
                                                {searchResults.map((result) => (
                                                    <button
                                                        key={`${result.type}-${result.id}`}
                                                        onClick={() => handleResultClick(result)}
                                                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                                                    >
                                                        <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${result.type === 'project'
                                                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                                                            : result.type === 'user'
                                                                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                                                                : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                                                            }`}>
                                                            {result.type === 'project' ? <Folder size={16} /> : result.type === 'user' ? <Users size={16} /> : <CheckSquare size={16} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {result.title}
                                                            </p>
                                                            {result.subtitle && (
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                                    {result.subtitle}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-gray-400 dark:text-gray-500 uppercase">
                                                            {result.type}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            <TimerRunningIndicator />
                            <NotificationBell />
                            <div className="flex items-center gap-3">
                                <span className={`hidden sm:inline-block px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(currentUser.role)}`}>
                                    {currentUser.role}
                                </span>
                                <span className="hidden sm:inline-block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {currentUser.name}
                                </span>
                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center font-semibold overflow-hidden">
                                    {currentUser.avatarUrl ? (
                                        <img 
                                            src={currentUser.avatarUrl} 
                                            alt={currentUser.name} 
                                            className="w-full h-full object-cover" 
                                            onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random`; }}
                                        />
                                    ) : (
                                        currentUser.name.charAt(0)
                                    )}
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                    title="Logout"
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        <Sidebar />
                        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                            {children}
                        </main>
                    </div>
                </div>
            </div>
        </TimerProvider>
    );
}
