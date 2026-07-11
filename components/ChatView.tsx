'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Attachment, Message, User } from '@/types';
import {
    Calendar,
    ChevronDown,
    Copy,
    Download,
    Edit,
    FileText,
    Hash,
    Forward,
    Image,
    MessageCircle,
    Paperclip,
    Pin,
    PlayCircle,
    Plus,
    Reply,
    Search,
    Send,
    SmilePlus,
    Trash,
    Users,
    X,
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { MiniCalendar } from '@/components/ui/MiniCalendar';
import { useAuth } from '@/contexts/AuthContext';
import { formatFileSize } from '@/lib/utils';
import { getSupabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import { apiFetch } from '@/lib/api/fetchWithSupabase';

interface ChatViewProps {
    projectId: string;
    projectMemberIds: string[];
}

type Conversation =
    | { type: 'project'; id: 'project-room'; title: string }
    | { type: 'dm'; id: string; title: string; user: User };

const QUICK_REACTIONS = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F64F}'];

export default function ChatView({ projectId, projectMemberIds }: ChatViewProps) {
    const { currentUser, users } = useAuth();
    const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string>('project-room');
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [jumpToDate, setJumpToDate] = useState('');
    const [viewingImage, setViewingImage] = useState<Attachment | null>(null);
    const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
    const [showEmojiPickerForMessage, setShowEmojiPickerForMessage] = useState<string | null>(null);
    const [showMessageOptions, setShowMessageOptions] = useState<string | null>(null);
    const [menuDirection, setMenuDirection] = useState<'up' | 'down'>('up');
    const [showQuickReactions, setShowQuickReactions] = useState<string | null>(null);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [showMentions, setShowMentions] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionCursorIndex, setMentionCursorIndex] = useState(-1);
    const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
    const [collapsedPinned, setCollapsedPinned] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLInputElement>(null);

    const projectUsers = useMemo(
        () =>
            projectMemberIds
                .map(memberId => users.find(user => user.id === memberId))
                .filter((user): user is User => Boolean(user)),
        [projectMemberIds, users]
    );

    const conversations = useMemo<Conversation[]>(() => {
        const projectConversation: Conversation = {
            type: 'project',
            id: 'project-room',
            title: 'Project Room',
        };

        const dmConversations = projectUsers
            .filter(user => currentUser && user.id !== currentUser.id)
            .map(user => ({
                type: 'dm' as const,
                id: user.id,
                title: user.name,
                user,
            }));

        return [projectConversation, ...dmConversations];
    }, [projectUsers, currentUser]);

    const pinnedMessages = useMemo(() => 
        messages.filter(m => m.isPinned).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [messages]);

    const activeConversation = conversations.find(conversation => conversation.id === activeConversationId) || conversations[0];

    const messageMap = useMemo(() => {
        const map = new Map<string, Message>();
        messages.forEach(message => map.set(message.id, message));
        return map;
    }, [messages]);

    const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
    const [showForwardModal, setShowForwardModal] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        const supabase = getSupabase();
        const channel = supabase.channel('online-users', {
            config: { presence: { key: currentUser.id } },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                setOnlineUserIds(Object.keys(state));
            })
            .subscribe(async status => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.message-options-menu') && !target.closest('.message-options-trigger')) {
                setShowMessageOptions(null);
            }
        };

        if (showMessageOptions) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMessageOptions]);

    const queueScrollToBottom = () => {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, 100);
    };

    const fetchConversationMessages = async (showLoading = true) => {
        if (!currentUser) return;

        if (showLoading) setLoading(true);

        try {
            const params = new URLSearchParams();

            if (activeConversation?.type === 'dm') {
                params.set('conversationType', 'dm');
                params.set('currentUserId', currentUser.id);
                params.set('recipientId', activeConversation.id);
                params.set('projectId', projectId);
            } else {
                params.set('conversationType', 'project');
                params.set('projectId', projectId);
            }

            const response = await apiFetch(`/api/messages?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch messages');

            const data = await response.json();
            setMessages(Array.isArray(data) ? data : []);
            if (showLoading) queueScrollToBottom();
        } catch (error) {
            console.error(error);
            setMessages([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setReplyingTo(null);
        void fetchConversationMessages(true);
    }, [activeConversationId, projectId, currentUser?.id]);

    useEffect(() => {
        const supabase = getSupabase();
        const channel = supabase
            .channel(`messages-${projectId}-${currentUser?.id || 'guest'}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
                void fetchConversationMessages(false);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [projectId, currentUser?.id, activeConversationId]);

    const formatTime = (dateStr: string) =>
        new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const formatChatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString();
    };

    const filteredMessages = useMemo(() => {
        if (!searchTerm.trim()) return messages;
        const term = searchTerm.toLowerCase();
        return messages.filter(m => m.content?.toLowerCase().includes(term));
    }, [messages, searchTerm]);

    const groupedMessages = useMemo(() => {
        const groups: { date: string; messages: Message[] }[] = [];
        let currentDate = '';

        filteredMessages.forEach(message => {
            const date = formatChatDate(message.timestamp);
            if (date !== currentDate) {
                currentDate = date;
                groups.push({ date, messages: [message] });
            } else {
                groups[groups.length - 1].messages.push(message);
            }
        });

        return groups;
    }, [filteredMessages]);

    const fileToBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });

    const handlePinMessage = async (message: Message) => {
        try {
            await db.toggleMessagePin(message.id, !message.isPinned);
            setShowMessageOptions(null);
            await fetchConversationMessages(false);
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
    };

    const handleForwardMessage = (message: Message) => {
        setForwardingMessage(message);
        setShowForwardModal(true);
        setShowMessageOptions(null);
    };

    const confirmForward = async (targetId: string, type: 'project' | 'dm') => {
        if (!forwardingMessage || !currentUser) return;

        const forwardData = {
            id: crypto.randomUUID(),
            userId: currentUser.id,
            content: forwardingMessage.content,
            attachment: forwardingMessage.attachment,
            timestamp: new Date().toISOString(),
            conversationType: type,
            projectId: type === 'project' ? targetId : projectId,
            recipientId: type === 'dm' ? targetId : undefined,
        };

        try {
            await db.addMessage(forwardData as Message);
            setShowForwardModal(false);
            setForwardingMessage(null);
        } catch (error) {
            console.error('Error forwarding message:', error);
        }
    };

    const handleFileSelect = (type: 'image' | 'video' | 'document') => {
        if (fileInputRef.current) {
            fileInputRef.current.accept =
                type === 'image'
                    ? 'image/*'
                    : type === 'video'
                        ? 'video/*'
                        : '.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx';
            fileInputRef.current.click();
        }
        setShowAttachMenu(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            setPreviewUrl(URL.createObjectURL(file));
        } else {
            setPreviewUrl(null);
        }
    };

    const clearSelectedFile = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const buildAttachment = async () => {
        if (!selectedFile) return undefined;

        const url = await fileToBase64(selectedFile);
        return {
            name: selectedFile.name,
            type: selectedFile.type.startsWith('image/')
                ? 'image'
                : selectedFile.type.startsWith('video/')
                    ? 'video'
                    : 'document',
            url,
            size: formatFileSize(selectedFile.size),
        } as Attachment;
    };

    const sendMessage = async () => {
        if (!currentUser || (!newMessage.trim() && !selectedFile)) return;

        if (editingMessage) {
            try {
                const updatedMessage = await db.updateMessageContent(editingMessage.id, newMessage.trim());
                if (updatedMessage) {
                    setNewMessage('');
                    setEditingMessage(null);
                    await fetchConversationMessages(false);
                }
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return;
        }

        const attachment = await buildAttachment();
        const payload: Record<string, unknown> = {
            userId: currentUser.id,
            content: newMessage.trim() || (attachment ? `Shared ${attachment.type}: ${attachment.name}` : ''),
            attachment,
            threadRootId: replyingTo?.id || null,
            conversationType: activeConversation?.type === 'dm' ? 'dm' : 'project',
        };

        if (activeConversation?.type === 'dm') {
            payload.recipientId = activeConversation.id;
            payload.projectId = projectId;
        } else {
            payload.projectId = projectId;
        }

        await db.addMessage({
            id: crypto.randomUUID(),
            userId: payload.userId as string,
            content: payload.content as string,
            attachment: payload.attachment as Attachment | undefined,
            timestamp: new Date().toISOString(),
            threadRootId: payload.threadRootId as string | null | undefined,
            conversationType: payload.conversationType as 'project' | 'dm',
            recipientId: payload.recipientId as string | undefined,
            projectId: payload.projectId as string | undefined,
        });

        clearSelectedFile();
        setNewMessage('');
        setReplyingTo(null);
        await fetchConversationMessages(false);
        queueScrollToBottom();
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await sendMessage();
        } catch (error) {
            console.error(error);
        }
    };

    const handleReaction = async (messageId: string, emoji: string) => {
        if (!currentUser) return;

        try {
            const message = await db.getMessageById(messageId);
            if (!message) return;

            const nextReactions = [...(message.reactions || [])];
            const existingReaction = nextReactions.find(reaction => reaction.emoji === emoji);
            if (existingReaction) {
                if (existingReaction.userIds.includes(currentUser.id)) {
                    existingReaction.userIds = existingReaction.userIds.filter(userId => userId !== currentUser.id);
                } else {
                    existingReaction.userIds = [...existingReaction.userIds, currentUser.id];
                }
            } else {
                nextReactions.push({ emoji, userIds: [currentUser.id] });
            }

            const filteredReactions = nextReactions.filter(reaction => reaction.userIds.length > 0);
            await db.updateMessageReactions(messageId, filteredReactions);
            await fetchConversationMessages(false);
        } catch (error) {
            console.error(error);
        }
    };

    const downloadAttachment = (attachment: Attachment) => {
        const link = document.createElement('a');
        link.href = attachment.url;
        link.download = attachment.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderAttachment = (attachment: Attachment) => {
        if (attachment.type === 'image') {
            return (
                <div className="mt-2 cursor-pointer overflow-hidden rounded-2xl" onClick={() => setViewingImage(attachment)}>
                    <img src={attachment.url} alt={attachment.name} className="max-w-[280px] rounded-2xl" />
                </div>
            );
        }

        if (attachment.type === 'video') {
            return (
                <div className="mt-2 max-w-[320px] overflow-hidden rounded-2xl">
                    <video src={attachment.url} controls className="w-full rounded-2xl" />
                </div>
            );
        }

        return (
            <div className="mt-2 flex items-center gap-2 rounded-2xl bg-slate-100 p-2 dark:bg-slate-700">
                <FileText size={18} className="text-blue-500" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{attachment.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{attachment.size}</p>
                </div>
                <button onClick={() => downloadAttachment(attachment)} className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-600">
                    <Download size={14} />
                </button>
            </div>
        );
    };

    const renderQuotedReply = (message: Message, isSender: boolean) => {
        if (!message.threadRootId) return null;

        const originalMessage = messageMap.get(message.threadRootId);
        if (!originalMessage) return null;

        const originalSender =
            projectUsers.find(user => user.id === originalMessage.userId) ||
            users.find(user => user.id === originalMessage.userId);

        return (
            <button
                type="button"
                onClick={() => {
                    const target = document.getElementById(`message-${originalMessage.id}`);
                    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className={`mb-2 w-full rounded-2xl border px-3 py-2 text-left ${
                    isSender
                        ? 'border-blue-300/40 bg-blue-500/20 text-blue-50'
                        : 'border-slate-200 bg-slate-100/90 text-slate-700 dark:border-slate-700 dark:bg-slate-700/60 dark:text-slate-200'
                }`}
            >
                <div className="truncate text-[11px] font-semibold">
                    {originalSender?.name || 'Unknown'}
                </div>
                <div className="truncate text-xs opacity-90">
                    {originalMessage.content || (originalMessage.attachment ? `Attachment: ${originalMessage.attachment.name}` : 'Message')}
                </div>
            </button>
        );
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!confirm('Are you sure you want to delete this message?')) return;
        try {
            const success = await db.deleteMessage(messageId);
            if (success) {
                setShowMessageOptions(null);
                await fetchConversationMessages(false);
            }
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    };

    const handleEditClick = (message: Message) => {
        setEditingMessage(message);
        setNewMessage(message.content || '');
        setShowMessageOptions(null);
        messageInputRef.current?.focus();
    };

    const toggleMessageOptions = (e: React.MouseEvent, messageId: string) => {
        if (showMessageOptions === messageId) {
            setShowMessageOptions(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            const containerRect = scrollRef.current?.getBoundingClientRect();
            if (containerRect) {
                const spaceAbove = rect.top - containerRect.top;
                // If less than 200px space above, open downward
                setMenuDirection(spaceAbove < 200 ? 'down' : 'up');
            }
            setShowMessageOptions(messageId);
        }
    };

    const renderMessageBubble = (message: Message) => {
        const isSender = message.userId === currentUser?.id;
        const sender =
            projectUsers.find(user => user.id === message.userId) ||
            users.find(user => user.id === message.userId);

        return (
            <div
                key={message.id}
                id={`message-${message.id}`}
                className={`group relative mb-3 flex ${isSender ? 'justify-end' : 'justify-start'} ${showMessageOptions === message.id ? 'z-50' : 'z-0'}`}
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
            >
                <div className={`max-w-[78%] ${isSender ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!isSender && (
                        <div className="mb-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            {sender?.name || 'Unknown'}
                        </div>
                    )}
                    <div className={`relative max-w-[90%] rounded-2xl p-3 shadow-sm ${isSender ? 'bg-blue-600 text-white self-end' : 'bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100 self-start'} ring-1 ring-black/5`}>
                        {message.isPinned && (
                            <div className={`absolute -top-1.5 ${isSender ? '-left-1.5' : '-right-1.5'} z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700`}>
                                <Pin size={10} className="text-blue-500 fill-blue-500" />
                            </div>
                        )}
                        <button
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const spaceBelow = window.innerHeight - rect.bottom;
                                setMenuDirection(spaceBelow < 250 ? 'up' : 'down');
                                setShowMessageOptions(showMessageOptions === message.id ? null : message.id);
                            }}
                            className={`message-options-trigger absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full ${isSender ? 'hover:bg-blue-500 text-blue-100' : 'hover:bg-slate-100 text-slate-400'}`}
                        >
                            <ChevronDown size={16} />
                        </button>
                        
                        {showMessageOptions === message.id && (
                            <div className={`message-options-menu absolute ${menuDirection === 'up' ? 'bottom-full mb-1' : 'top-8'} right-0 z-50 min-w-[180px] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-100`}>
                                <div className="py-1 text-slate-700 dark:text-slate-200">
                                        <button onClick={() => { setReplyingTo(message); setShowMessageOptions(null); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                            <Reply size={16} className="text-slate-400" /> Reply
                                        </button>
                                        <button onClick={() => { setForwardingMessage(message); setShowForwardModal(true); setShowMessageOptions(null); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                            <Forward size={16} className="text-slate-400" /> Forward
                                        </button>
                                        <button onClick={() => { handlePinMessage(message); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                            <Pin size={16} className={message.isPinned ? "text-blue-500" : "text-slate-400"} /> {message.isPinned ? "Unpin" : "Pin"}
                                        </button>
                                        <button onClick={() => { navigator.clipboard.writeText(message.content || ''); setShowMessageOptions(null); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                            <Copy size={16} className="text-slate-400" /> Copy
                                        </button>
                                        {isSender && (
                                            <>
                                                <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                                                <button onClick={() => { handleEditClick(message); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                                    <Edit size={16} className="text-slate-400" /> Edit
                                                </button>
                                                <button onClick={() => { handleDeleteMessage(message.id); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors">
                                                    <Trash size={16} /> Delete
                                                </button>
                                            </>
                                        )}
                                </div>
                            </div>
                        )}
                        {renderQuotedReply(message, isSender)}
                        {message.content && (
                            <p className="whitespace-pre-wrap text-sm">
                                {message.content.split(/(@\w+)/g).map((part, i) =>
                                    part.startsWith('@') ? (
                                        <span key={i} className={`font-semibold ${isSender ? 'text-sky-200' : 'text-blue-600 dark:text-blue-400'}`}>
                                            {part}
                                        </span>
                                    ) : (
                                        part
                                    )
                                )}
                            </p>
                        )}
                        {message.attachment && renderAttachment(message.attachment)}
                        <div className={`mt-2 text-[10px] ${isSender ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
                            {formatTime(message.timestamp)}
                        </div>
                    </div>

                    {message.reactions && message.reactions.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                            {message.reactions.map(reaction => (
                                <button
                                    key={`${message.id}-${reaction.emoji}`}
                                    onClick={() => handleReaction(message.id, reaction.emoji)}
                                    className={`rounded-full border px-2 py-0.5 text-xs ${
                                        (reaction.userIds || []).includes(currentUser?.id || '')
                                            ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                            : 'border-slate-200 bg-white/90 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                    }`}
                                >
                                    {reaction.emoji} {(reaction.userIds || []).length}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className={`mt-2 flex items-center justify-start gap-1.5 ${hoveredMessageId === message.id || showMessageOptions === message.id || showEmojiPickerForMessage === message.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'} transition-all duration-200`}>
                        <div className="flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/95">
                            {QUICK_REACTIONS.map(emoji => (
                                <button
                                    key={`${message.id}-${emoji}`}
                                    onClick={() => handleReaction(message.id, emoji)}
                                    className="text-base transition-transform hover:scale-125 active:scale-90"
                                >
                                    {emoji}
                                </button>
                            ))}
                            <div className="h-3 w-[1px] bg-slate-200 dark:bg-slate-700" />
                            <div className="relative">
                                <button
                                    onClick={() => setShowEmojiPickerForMessage(showEmojiPickerForMessage === message.id ? null : message.id)}
                                    className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                                >
                                    <Plus size={14} />
                                </button>
                                {showEmojiPickerForMessage === message.id && (
                                    <div className={`absolute bottom-full mb-2 z-50 ${isSender ? 'right-0' : 'left-0'}`}>
                                        <EmojiPicker
                                            onEmojiClick={(emoji) => {
                                                handleReaction(message.id, emoji.emoji);
                                                setShowEmojiPickerForMessage(null);
                                            }}
                                            width={280}
                                            height={350}
                                            previewConfig={{ showPreview: false }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <button
                            onClick={() => setReplyingTo(message)}
                            className="flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 text-slate-500 shadow-sm backdrop-blur-md hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                            <Reply size={12} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Reply</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const onlineCount = projectUsers.filter(user => onlineUserIds.includes(user.id)).length;

    const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewMessage(value);

        const cursorPosition = e.target.selectionStart || 0;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const match = textBeforeCursor.match(/(?:\s|^)@(\w*)$/);

        if (match) {
            setShowMentions(true);
            setMentionFilter(match[1].toLowerCase());
            setMentionCursorIndex(cursorPosition - match[1].length - 1);
            setMentionSelectedIndex(0);
        } else {
            setShowMentions(false);
        }
    };

    const filteredMentionUsers = useMemo(() => {
        return projectUsers.filter(u => u.name.toLowerCase().includes(mentionFilter) || u.name.replace(/\s+/g, '').toLowerCase().includes(mentionFilter));
    }, [projectUsers, mentionFilter]);

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showMentions) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setMentionSelectedIndex(prev => (prev < filteredMentionUsers.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setMentionSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const user = filteredMentionUsers[mentionSelectedIndex];
            if (user) {
                const beforeMention = newMessage.substring(0, mentionCursorIndex);
                const afterMention = newMessage.substring(messageInputRef.current?.selectionStart || 0);
                const mentionText = `@${user.name.replace(/\s+/g, '')} `;
                setNewMessage(beforeMention + mentionText + afterMention);
                setShowMentions(false);
                messageInputRef.current?.focus();
            }
        } else if (e.key === 'Escape') {
            setShowMentions(false);
        }
    };

    return (
        <div className="flex h-full overflow-hidden bg-white dark:bg-slate-900">
            {viewingImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setViewingImage(null)}>
                    <button className="absolute right-4 top-4 p-2 text-white" onClick={() => setViewingImage(null)}>
                        <X size={28} />
                    </button>
                    <img src={viewingImage.url} alt={viewingImage.name} className="max-h-[90vh] max-w-[90vw] object-contain" />
                </div>
            )}

            <aside className="flex w-72 min-h-0 flex-col border-r border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(241,245,255,0.9)_100%)] p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(17,24,39,0.92)_100%)]">
                <div className="flex min-h-0 flex-1 flex-col gap-5 mt-2">
                    <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Channels</div>
                        <button
                            onClick={() => setActiveConversationId('project-room')}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium ${
                                activeConversationId === 'project-room'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-gray-700 hover:bg-white/80 dark:text-gray-200 dark:hover:bg-slate-800/70'
                            }`}
                        >
                            <Hash size={16} />
                            Project Room
                        </button>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Direct Messages</div>
                        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                            {conversations
                                .filter(conversation => conversation.type === 'dm')
                                .map(conversation => {
                                    const isOnline = conversation.type === 'dm' && onlineUserIds.includes(conversation.user.id);
                                    return (
                                        <button
                                            key={conversation.id}
                                            onClick={() => setActiveConversationId(conversation.id)}
                                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                                                activeConversationId === conversation.id
                                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                                                    : 'text-gray-700 hover:bg-white/80 dark:text-gray-200 dark:hover:bg-slate-800/70'
                                            }`}
                                        >
                                            <div className="relative">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                                    {conversation.user.name.charAt(0)}
                                                </div>
                                                <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-gray-50 dark:border-gray-950 ${isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate font-medium">{conversation.title}</div>
                                                <div className={`truncate text-xs ${activeConversationId === conversation.id ? 'text-blue-100' : 'text-gray-400'}`}>
                                                    {isOnline ? 'Online' : 'Offline'}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            </aside>

            <section className="relative flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/70 px-5 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70">
                    <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                            {activeConversation?.type === 'dm' ? activeConversation.title : '# Project Room'}
                        </div>
                        <div className="text-xs text-gray-400">
                            {activeConversation?.type === 'dm'
                                ? 'Private conversation'
                                : `${projectUsers.length} members - shared workspace chat`}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {showSearch && (
                            <div className="relative mr-2 animate-in fade-in slide-in-from-right-4 duration-200">
                                <input
                                    type="text"
                                    placeholder="Search messages..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-48 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                                    autoFocus
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        )}
                        <button
                            onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchTerm(''); }}
                            className={`rounded-lg p-2 transition-colors ${showSearch ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                        >
                            <Search size={16} />
                        </button>
                        <button
                            onClick={() => setShowDatePicker(!showDatePicker)}
                            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                            <Calendar size={16} />
                        </button>
                    </div>
                </div>

                {showDatePicker && (
                    <div className="absolute right-5 top-16 z-20">
                        <MiniCalendar
                            currentDate={jumpToDate}
                            onSelect={dateStr => {
                                setJumpToDate(dateStr);
                                const target = scrollRef.current?.querySelector(`[data-date="${dateStr}"]`);
                                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                setShowDatePicker(false);
                            }}
                        />
                    </div>
                )}

                {pinnedMessages.length > 0 && (
                    <div className="group/pins mx-5 my-2">
                        {/* Primary pinned message - always visible */}
                        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white/80 shadow-sm backdrop-blur dark:border-blue-900/30 dark:bg-slate-900/80">
                            <div className="flex items-center gap-3 px-4 py-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                    <Pin size={16} className="fill-blue-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                                        {pinnedMessages[0].content || (pinnedMessages[0].attachment ? `Shared ${pinnedMessages[0].attachment.type}` : 'Message')}
                                    </p>
                                </div>
                                {pinnedMessages.length > 1 && (
                                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                                        {pinnedMessages.length}
                                    </span>
                                )}
                                <button 
                                    onClick={() => {
                                        const target = document.getElementById(`message-${pinnedMessages[0].id}`);
                                        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }}
                                    className="shrink-0 rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
                                >
                                    VIEW
                                </button>
                            </div>
                        </div>
                        {/* Expandable list of older pins - shown on hover */}
                        {pinnedMessages.length > 1 && (
                            <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-300 ease-in-out group-hover/pins:max-h-[300px] group-hover/pins:opacity-100 group-hover/pins:mt-1">
                                <div className="flex flex-col gap-1">
                                    {pinnedMessages.slice(1).map(pinned => (
                                        <div 
                                            key={pinned.id} 
                                            className="overflow-hidden rounded-2xl border border-blue-50 bg-white/60 shadow-sm backdrop-blur dark:border-blue-900/20 dark:bg-slate-900/60"
                                        >
                                            <div className="flex items-center gap-3 px-4 py-2">
                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50/60 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400">
                                                    <Pin size={14} className="fill-blue-500" />
                                                </div>
                                                <p className="min-w-0 flex-1 truncate text-sm text-slate-600 dark:text-slate-300">
                                                    {pinned.content || (pinned.attachment ? `Shared ${pinned.attachment.type}` : 'Message')}
                                                </p>
                                                <button 
                                                    onClick={() => {
                                                        const target = document.getElementById(`message-${pinned.id}`);
                                                        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                    }}
                                                    className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
                                                >
                                                    VIEW
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.09),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_24%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_52%,#f8fafc_100%)] px-5 py-4 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_22%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.14),transparent_20%),linear-gradient(180deg,#0f172a_0%,#111827_100%)]"
                >
                    {loading ? (
                        <div className="mt-20 text-center text-gray-500">Loading messages...</div>
                    ) : messages.length === 0 ? (
                        <div className="mt-20 text-center">
                            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                                <MessageCircle size={30} className="text-blue-500" />
                            </div>
                            <p className="font-medium text-gray-700 dark:text-gray-200">No messages yet</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {activeConversation?.type === 'dm' ? 'Start a direct conversation.' : 'Start the project discussion.'}
                            </p>
                        </div>
                    ) : (
                        groupedMessages.map(group => (
                            <div key={group.date}>
                                <div className="my-4 flex justify-center" data-date={messages.find(message => formatChatDate(message.timestamp) === group.date)?.timestamp.split('T')[0]}>
                                    <span className="rounded-full border border-white/60 bg-white/85 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
                                        {group.date}
                                    </span>
                                </div>
                                {group.messages.map(message => renderMessageBubble(message))}
                            </div>
                        ))
                    )}
                </div>

                {replyingTo && (
                    <div className="border-t border-slate-200/80 bg-white/70 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
                        <div className="flex items-start justify-between gap-3 rounded-2xl border-l-4 border-blue-500 bg-white/90 px-3 py-2 shadow-sm dark:bg-slate-900/90">
                            <div className="min-w-0">
                                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                    Replying to {projectUsers.find(user => user.id === replyingTo.userId)?.name || users.find(user => user.id === replyingTo.userId)?.name || 'Unknown'}
                                </div>
                                <div className="truncate text-sm text-gray-600 dark:text-gray-300">
                                    {replyingTo.content || (replyingTo.attachment ? `Attachment: ${replyingTo.attachment.name}` : 'Message')}
                                </div>
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {selectedFile && (
                    <div className="border-t border-slate-200/80 bg-white/70 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
                        <div className="flex items-center gap-3">
                            {previewUrl && selectedFile.type.startsWith('image/') ? (
                                <img src={previewUrl} alt="Preview" className="h-12 w-12 rounded-lg object-cover" />
                            ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                    <FileText size={18} className="text-blue-500" />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{selectedFile.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(selectedFile.size)}</p>
                            </div>
                            <button onClick={clearSelectedFile} className="rounded-lg p-1 hover:bg-gray-200 dark:hover:bg-gray-800">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}

                <div className="relative">
                    {showMentions && (
                        <div className="absolute bottom-full left-14 mb-2 z-20 min-w-[200px] max-w-[240px] rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                            <div className="max-h-48 overflow-y-auto py-1">
                                {filteredMentionUsers.map((user, idx) => (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => {
                                            const beforeMention = newMessage.substring(0, mentionCursorIndex);
                                            const afterMention = newMessage.substring(messageInputRef.current?.selectionStart || 0);
                                            const mentionText = `@${user.name.replace(/\s+/g, '')} `;
                                            setNewMessage(beforeMention + mentionText + afterMention);
                                            setShowMentions(false);
                                            messageInputRef.current?.focus();
                                        }}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${idx === mentionSelectedIndex ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                    >
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="truncate text-slate-700 dark:text-slate-200">{user.name}</span>
                                    </button>
                                ))}
                                {filteredMentionUsers.length === 0 && (
                                    <div className="px-3 py-2 text-sm text-slate-500">No users found</div>
                                )}
                            </div>
                        </div>
                    )}
                    {replyingTo || editingMessage ? (
                        <div className="border-t border-slate-200/80 bg-white/70 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
                            <div className="flex items-start justify-between gap-3 rounded-2xl border-l-4 border-blue-500 bg-white/90 px-3 py-2 shadow-sm dark:bg-slate-900/90">
                                <div className="min-w-0">
                                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                        {editingMessage ? 'Editing Message' : `Replying to ${projectUsers.find(user => user.id === replyingTo?.userId)?.name || users.find(user => user.id === replyingTo?.userId)?.name || 'Unknown'}`}
                                    </div>
                                    <div className="truncate text-sm text-gray-600 dark:text-gray-300">
                                        {editingMessage ? editingMessage.content : replyingTo?.content}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setReplyingTo(null);
                                        setEditingMessage(null);
                                        if (editingMessage) setNewMessage('');
                                    }}
                                    className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    ) : null}

                    <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-200/80 bg-white/80 px-3 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowAttachMenu(!showAttachMenu)}
                                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                            >
                                <Paperclip size={18} />
                            </button>
                            {showAttachMenu && (
                                <div className="absolute bottom-12 left-0 z-10 min-w-[160px] rounded-xl border border-slate-200 bg-white/95 py-2 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
                                    <button type="button" className="flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700" onClick={() => handleFileSelect('image')}>
                                        <Image size={16} /> Photos
                                    </button>
                                    <button type="button" className="flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700" onClick={() => handleFileSelect('video')}>
                                        <PlayCircle size={16} /> Videos
                                    </button>
                                    <button type="button" className="flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700" onClick={() => handleFileSelect('document')}>
                                        <FileText size={16} /> Documents
                                    </button>
                                </div>
                            )}
                        </div>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                        <input
                            ref={messageInputRef}
                            type="text"
                            className="flex-1 rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800/95 dark:text-white"
                            placeholder={editingMessage ? "Edit your message..." : (activeConversation?.type === 'dm' ? `Message ${activeConversation.title}` : 'Message project room')}
                            value={newMessage}
                            onChange={handleMessageChange}
                            onKeyDown={handleInputKeyDown}
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() && !selectedFile}
                            className={`flex items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 ${editingMessage ? 'px-4 py-2 h-auto w-auto min-w-[70px] text-xs font-bold' : 'h-10 w-10'}`}
                        >
                            {editingMessage ? 'SAVE' : <Send size={16} />}
                        </button>
                    </form>
                </div>
            </section>
            
            {/* Forward Modal */}
            {showForwardModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Forward Message</h3>
                            <button onClick={() => setShowForwardModal(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="mb-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-400 italic">
                                "{forwardingMessage?.content}"
                            </p>
                        </div>

                        <div className="max-h-[350px] overflow-y-auto pr-2 space-y-1">
                            <p className="px-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Conversation</p>
                            {conversations.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => confirmForward(conv.id, conv.type)}
                                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
                                >
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                                        {conv.type === 'project' ? <Hash size={20} /> : (conv.user?.name?.[0] || 'U')}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-bold text-slate-900 dark:text-white truncate">{conv.title}</p>
                                        <p className="text-xs text-slate-500 truncate">{conv.type === 'project' ? 'Project Channel' : 'Direct Message'}</p>
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                        <Send size={14} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
