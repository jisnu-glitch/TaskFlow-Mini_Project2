'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Loader2, Minimize2, Maximize2, Database } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api/fetchWithSupabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface OllamaMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export default function OllamaChatBubble() {
    const [isOllamaRunning, setIsOllamaRunning] = useState(false);
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [isOpen, setIsOpen] = useState(false);
    const [showContextViewer, setShowContextViewer] = useState(false);
    
    const { currentUser: user, users } = useAuth();
    const [systemContext, setSystemContext] = useState<string>('');
    const [messages, setMessages] = useState<OllamaMessage[]>([
        { role: 'assistant', content: 'Hello! I am your local AI assistant running on Ollama. I have access to your dashboard context. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch dashboard context when chat opens
    useEffect(() => {
        if (isOpen && user) {
            const fetchContext = async () => {
                try {
                    console.log('[Ollama Context] Fetching projects and tasks for user:', user.id);
                    const [projRes, tasksRes] = await Promise.all([
                                                apiFetch(`/api/projects?userId=${user.id}`),
                                                apiFetch(`/api/tasks?userId=${user.id}`)
                                            ]);
                                            
                                            console.log('[Ollama Context] projRes ok:', projRes.ok, 'status:', projRes.status);
                                            console.log('[Ollama Context] tasksRes ok:', tasksRes.ok, 'status:', tasksRes.status);
                                            
                                            if (projRes.ok && tasksRes.ok) {
                                                const projects = await projRes.json();
                                                const tasks = await tasksRes.json();
                                                console.log('[Ollama Context] Loaded projects:', projects.length, 'tasks:', tasks.length);
                                                
                                                // Filter tasks relevant to these projects
                                                const projIds = projects.map((p: any) => p.id);
                                                const relevantTasks = tasks.filter((t: any) => projIds.includes(t.projectId));
                                                
                                                let ctx = `You are a helpful AI assistant built into TaskFlow, a project management dashboard. You have direct context of the user's data.\n\n`;
                                                ctx += `Current User: ${user.name} (Role: ${user.role}, Email: ${user.email}).\n\n`;
                                                ctx += `### Projects and Tasks Overview\n`;
                                                
                                                if (projects.length === 0) {
                                                    ctx += `No active projects found.\n`;
                                                } else {
                                                    projects.forEach((proj: any) => {
                                                        ctx += `\n**Project: ${proj.name}** (Key: ${proj.key})\n`;
                                                        if (proj.description) ctx += `Description: ${proj.description}\n`;
                                                        
                                                        const projTasks = relevantTasks.filter((t: any) => t.projectId === proj.id);
                                                        ctx += `Tasks (${projTasks.length}):\n`;
                                                        if (projTasks.length === 0) {
                                                            ctx += `- No tasks found.\n`;
                                                        } else {
                                                            projTasks.forEach((t: any) => {
                                                                const assignee = users.find((u: any) => u.id === t.assigneeId)?.name || 'Unassigned';
                                                                ctx += `- [${t.status}] ${t.title} (Priority: ${t.priority}, Assignee: ${assignee})\n`;
                                                            });
                                                        }
                                                    });
                                                }
                                                
                                                // Fetch recent messages
                                                let recentMessagesContext = '';
                                                try {
                                                    const supabase = getSupabase();
                                                    const { data: recentMsgs } = await supabase
                                                        .from('messages')
                                                        .select('*')
                                                        .or(`user_id.eq.${user.id},recipient_id.eq.${user.id}`)
                                                        .order('timestamp', { ascending: false })
                                                        .limit(15);
                                                        
                                                    if (recentMsgs && recentMsgs.length > 0) {
                                                        recentMessagesContext += `\n### Dashboard Messages History (Conversations between team members)\n`;
                                                        recentMsgs.forEach((msg: any) => {
                                                            const sender = users.find((u: any) => u.id === msg.user_id)?.name || 'Unknown User';
                                                            const timeStr = new Date(msg.timestamp).toLocaleString();
                                                            if (msg.conversation_type === 'dm') {
                                                                const recipient = users.find((u: any) => u.id === msg.recipient_id)?.name || 'Unknown User';
                                                                recentMessagesContext += `- [${timeStr}] (Direct Message) ${sender} to ${recipient}: "${msg.content}"\n`;
                                                            } else {
                                                                const projName = projects.find((p: any) => p.id === msg.project_id)?.name || 'Project Chat';
                                                                recentMessagesContext += `- [${timeStr}] (Channel: ${projName}) ${sender}: "${msg.content}"\n`;
                                                            }
                                                        });
                                                    } else {
                                                        recentMessagesContext += `\n### Recent Chat Messages\nNo recent messages found.\n`;
                                                    }
                                                } catch (msgErr) {
                                                    console.error('[Ollama Context] Failed to fetch recent messages context:', msgErr);
                                                }
                                                
                                                ctx += recentMessagesContext;
                                                
                                                ctx += `\n**Instructions for Citations:** When answering questions about projects, tasks, or dashboard messages, please append a final section titled '**Sources & Citations:**' listing the specific database entities (e.g. project key, task title, or message sender and timestamp) you used to retrieve the information. Make sure your answers strictly align with the database records provided above. Note that the 'Dashboard Messages History' contains actual messages sent between users on the platform; always read the text inside the double quotes and output it as the content of the message. Never say that you do not have the content of the message, as it is provided directly in the records.\n`;
                                                
                                                setSystemContext(ctx);
                    }
                } catch (e) {
                    console.error('Failed to fetch AI context', e);
                }
            };
            fetchContext();
        }
    }, [isOpen, user, users]);

    // Check if Ollama is running and get models
    useEffect(() => {
        async function checkOllama() {
            try {
                const res = await fetch('/api/ollama/tags');
                if (res.ok) {
                    const data = await res.json();
                    if (data.models && data.models.length > 0) {
                        const modelNames = data.models.map((m: any) => m.name);
                        setModels(modelNames);
                        const targetModel = 'llama3.2:3b';
                        setSelectedModel(modelNames.includes(targetModel) ? targetModel : modelNames[0]);
                        setIsOllamaRunning(true);
                    }
                }
            } catch (error) {
                console.log('Ollama is not running locally.');
            }
        }
        checkOllama();
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSendMessage = async () => {
        if (!input.trim() || !selectedModel || isLoading) return;
        
        const userMsg: OllamaMessage = { role: 'user', content: input.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const apiMessages = [...messages, userMsg];
            if (systemContext) {
                apiMessages.unshift({ role: 'system', content: systemContext });
            }

            const res = await fetch('/api/ollama/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: apiMessages,
                    stream: true
                })
            });

            if (!res.ok) throw new Error('Failed to get response');

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let isFirstChunk = true;
            let buffer = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
                    
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.message?.content) {
                                const newContent = parsed.message.content;
                                if (isFirstChunk) {
                                    setMessages(prev => [...prev, { role: 'assistant', content: newContent }]);
                                    isFirstChunk = false;
                                } else {
                                    setMessages(prev => {
                                        const newMessages = [...prev];
                                        const lastIndex = newMessages.length - 1;
                                        if (newMessages[lastIndex].role === 'assistant') {
                                            newMessages[lastIndex] = {
                                                ...newMessages[lastIndex],
                                                content: newMessages[lastIndex].content + newContent
                                            };
                                        }
                                        return newMessages;
                                    });
                                }
                            }
                        } catch (e) {
                            // Incomplete JSON chunk, skip and wait for next chunk
                        }
                    }
                }
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error communicating with Ollama.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOllamaRunning) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-[350px] sm:w-[400px] h-[500px] max-h-[70vh] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all duration-300 origin-bottom-right">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
                                <Bot size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Local AI</h3>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    {selectedModel}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setShowContextViewer(!showContextViewer)}
                                title="View AI Context Sources"
                                className={`p-1.5 rounded-lg transition-colors ${
                                    showContextViewer 
                                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                }`}
                            >
                                <Database size={16} />
                            </button>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
                            >
                                <Minimize2 size={16} />
                            </button>
                        </div>
                    </div>
                    {/* Context Viewer Panel */}
                    {showContextViewer && (
                        <div className="bg-gray-50 dark:bg-gray-900 p-3 border-b border-gray-200 dark:border-gray-700 text-[10px] max-h-[160px] overflow-y-auto font-mono text-gray-600 dark:text-gray-400 select-text">
                            <div className="flex items-center justify-between mb-1.5 font-bold uppercase tracking-wider text-[9px] text-gray-400">
                                <span>Active Prompt Context</span>
                                <span className="text-emerald-500 flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping"></span>
                                    Injected
                                </span>
                            </div>
                            <pre className="whitespace-pre-wrap leading-normal font-mono select-all">
                                {systemContext || 'Loading context...'}
                            </pre>
                        </div>
                    )}

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${
                                    msg.role === 'user' 
                                        ? 'bg-blue-600 text-white rounded-br-sm' 
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                                }`}>
                                    {msg.role === 'user' ? (
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    ) : (
                                        <div className="leading-relaxed text-sm">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: ({node, ...props}: any) => <p className="mb-2 last:mb-0" {...props} />,
                                                    ul: ({node, ...props}: any) => <ul className="list-disc pl-4 mb-2 last:mb-0" {...props} />,
                                                    ol: ({node, ...props}: any) => <ol className="list-decimal pl-4 mb-2 last:mb-0" {...props} />,
                                                    li: ({node, ...props}: any) => <li className="mb-1" {...props} />,
                                                    h1: ({node, ...props}: any) => <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0" {...props} />,
                                                    h2: ({node, ...props}: any) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0" {...props} />,
                                                    h3: ({node, ...props}: any) => <h3 className="text-md font-bold mb-1 mt-2 first:mt-0" {...props} />,
                                                    code: ({node, inline, className, children, ...props}: any) => {
                                                        const match = /language-(\w+)/.exec(className || '')
                                                        return !inline ? (
                                                            <div className="bg-gray-800 dark:bg-gray-900 rounded-md overflow-hidden my-2 border border-gray-700">
                                                                <div className="bg-gray-900 px-3 py-1 text-xs text-gray-400 font-mono flex justify-between items-center border-b border-gray-700">
                                                                    <span>{match?.[1] || 'code'}</span>
                                                                </div>
                                                                <pre className="p-3 text-sm overflow-x-auto text-gray-100">
                                                                    <code className={className} {...props}>
                                                                        {children}
                                                                    </code>
                                                                </pre>
                                                            </div>
                                                        ) : (
                                                            <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[0.9em]" {...props}>
                                                                {children}
                                                            </code>
                                                        )
                                                    },
                                                    a: ({node, ...props}: any) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                                    strong: ({node, ...props}: any) => <strong className="font-semibold" {...props} />
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && messages[messages.length - 1]?.role === 'user' && (
                            <div className="flex justify-start">
                                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-bl-sm flex items-center gap-2">
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <div className="relative flex items-center">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder="Message local AI..."
                                className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                                rows={1}
                            />
                            <button 
                                onClick={handleSendMessage}
                                disabled={!input.trim() || isLoading}
                                className="absolute right-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Action Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="group flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 p-3.5 rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
                >
                    <Bot size={24} className="group-hover:animate-pulse" />
                </button>
            )}
        </div>
    );
}
