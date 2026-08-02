'use client';

import React, { useState } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useSensor, useSensors, PointerSensor, defaultDropAnimationSideEffects, useDroppable } from '@dnd-kit/core';
import { Task, Status } from '@/types';
import { TaskCard } from './TaskCard';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';

type TaskBoardProps = {
    tasks: Task[];
    onTaskMove: (taskId: string, newStatus: Status) => void;
};

const COLUMNS: Status[] = ['To Do', 'In Progress', 'Review', 'Done'];

function Column({ id, title, tasks, currentUser }: { id: Status, title: string, tasks: Task[], currentUser: any }) {
    const { setNodeRef } = useDroppable({ id });

    const getColumnColor = () => {
        switch (id) {
            case 'To Do': return 'bg-gray-400';
            case 'In Progress': return 'bg-blue-500';
            case 'Review': return 'bg-purple-500';
            case 'Done': return 'bg-green-500';
            default: return 'bg-gray-400';
        }
    };

    return (
        <div ref={setNodeRef} className="flex-1 min-w-[280px] flex flex-col h-full bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/60 dark:border-gray-700/60 ml-3 first:ml-0">
            <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getColumnColor()}`} />
                    <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">{title}</h3>
                </div>
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{tasks.length}</span>
            </div>

            <div className="flex-1 p-3 overflow-y-auto min-h-[100px]">
                {tasks.map(task => (
                    <TaskCard
                        key={task.id}
                        task={task}
                    />
                ))}
                {tasks.length === 0 && (
                    <div className="h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm italic border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-lg">
                        Empty
                    </div>
                )}
            </div>
        </div>
    );
}

export function TaskBoard({ tasks, onTaskMove }: TaskBoardProps) {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const [activeId, setActiveId] = useState<string | null>(null);
    const activeTask = safeTasks.find(t => t.id === activeId);
    const { currentUser } = useAuth();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id && activeTask) {
            // Check if over.id is a known status
            if (COLUMNS.includes(over.id as any)) {
                const newStatus = over.id as Status;
                const oldStatus = activeTask.status;

                // Validate transition
                const validTransitions: Record<string, string[]> = {
                    'To Do': ['In Progress'],
                    'In Progress': ['Review'],
                    'Review': ['Done', 'In Progress'],
                    'Done': ['In Progress']
                };

                const allowedNextStates = validTransitions[oldStatus] || [];

                // Dependency validation
                if (newStatus === 'In Progress' || newStatus === 'Done') {
                    const taskDeps = activeTask.dependencies || [];
                    const incompleteDeps = safeTasks.filter(t => taskDeps.includes(t.id) && t.status !== 'Done');
                    
                    if (incompleteDeps.length > 0) {
                        alert(`Cannot move to ${newStatus}. This task is blocked by: ${incompleteDeps.map(t => t.title).join(', ')}`);
                        setActiveId(null);
                        return;
                    }
                }

                if (allowedNextStates.includes(newStatus) || currentUser?.role === 'Admin' || currentUser?.role === 'Manager') {
                    onTaskMove(active.id as string, newStatus);
                } else {
                    alert(`Invalid transition from ${oldStatus} to ${newStatus}`);
                }
            }
        }
        setActiveId(null);
    };

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    
                    opacity: '0.5',
                },
            },
        }),
    };

    const priorityOrder: Record<string, number> = {
        Critical: 4, High: 3, Medium: 2, Low: 1
    }

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-full overflow-x-auto">
                {COLUMNS.map(status => (
                    <Column
                        key={status}
                        id={status}
                        title={status}
                        tasks={safeTasks
                            .filter(t => t.status === status)
                            .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
                        }
                        currentUser={currentUser}
                    />
                ))}
            </div>

            {/* Drag Portal */}
            {typeof window !== 'undefined' && createPortal(
                <DragOverlay dropAnimation={dropAnimation}>
                    {activeTask ? (
                        <div className="transform rotate-3 cursor-grabbing">
                            <TaskCard task={activeTask} isOverlay />
                        </div>
                    ) : null}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    );
}
