import { Task } from '@/types';
import { NextResponse } from 'next/server';
import { sendTaskAssigned, sendTaskSwapped } from '@/lib/email';
import { getSupabaseForRequest } from '@/lib/server-supabase-helper';
import { getSiteUrl } from '@/lib/site-url';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const userId = searchParams.get('userId'); // Needed for visibility checks

        if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 401 });

        const supabase = getSupabaseForRequest(request);
        const { data: userData, error: userErr } = await supabase.from('users').select('id, name, role, email').eq('id', userId).maybeSingle();
        if (userErr || !userData) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Visibility check: If user is not Admin, check project membership
        if (projectId && userData.role !== 'Admin') {
            const { data: membership } = await supabase.from('project_members').select('user_id').eq('project_id', projectId).eq('user_id', userId).maybeSingle();
            if (!membership) return NextResponse.json({ error: 'Access denied: You are not a member of this project' }, { status: 403 });
        }

        let tasks = [] as Task[];
        const q = projectId ? await supabase.from('tasks').select('*').eq('project_id', projectId) : await supabase.from('tasks').select('*');
        tasks = (q.data || []).map((t: any) => ({
                id: t.id,
                projectId: t.project_id,
                title: t.title,
                description: t.description,
                status: t.status,
                priority: t.priority,
                assigneeId: t.assignee_id,
                dueDate: t.due_date,
                startDate: t.start_date,
                createdAt: t.created_at,
                updatedAt: t.updated_at,
                tags: t.tags || [],
                isPrivate: t.is_private,
                dependencies: t.dependencies || [],
            } as Task));
        

        // RBAC: Members cannot see private tasks they aren't assigned to
        if (userData.role === 'Member') {
            tasks = tasks.filter((t: Task) => !t.isPrivate || t.assigneeId === userId);
        }

        return NextResponse.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch tasks' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { searchParams } = new URL(request.url);
        const requestUserId = searchParams.get('userId') || body.userId;

        if (!requestUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = getSupabaseForRequest(request);
        const { data: requestUserData } = await supabase.from('users').select('id, name, role, email').eq('id', requestUserId).maybeSingle();
        if (!requestUserData) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        if (!body.title || !body.projectId) {
            return NextResponse.json({ error: 'Title and Project ID are required' }, { status: 400 });
        }

        // RBAC: Members can only create tasks assigned to themselves or unassigned, and they cannot create private tasks
        if (requestUserData.role === 'Member') {
            if (body.assigneeId && body.assigneeId !== requestUserData.id) {
                return NextResponse.json({ error: 'Members can only assign tasks to themselves' }, { status: 403 });
            }
            if (body.isPrivate) {
                return NextResponse.json({ error: 'Members cannot create private tasks' }, { status: 403 });
            }
        }

        const newTask: Task = {
            id: crypto.randomUUID(),
            projectId: body.projectId,
            title: body.title,
            description: body.description || '',
            status: 'To Do',
            priority: body.priority || 'Medium',
            assigneeId: body.assigneeId,
            dueDate: body.dueDate,
            startDate: body.startDate,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: body.tags || [],
            isPrivate: body.isPrivate || false,
            dependencies: body.dependencies || [],
        };

        const { error: insertErr } = await supabase.from('tasks').insert({
            id: newTask.id,
            project_id: newTask.projectId,
            title: newTask.title,
            description: newTask.description,
            status: newTask.status,
            priority: newTask.priority,
            assignee_id: newTask.assigneeId || null,
            due_date: newTask.dueDate || null,
            start_date: newTask.startDate || null,
            created_at: newTask.createdAt,
            updated_at: newTask.updatedAt,
            tags: newTask.tags || [],
            is_private: newTask.isPrivate || false,
            dependencies: newTask.dependencies || []
        });
        if (insertErr) console.error('Error inserting task:', insertErr);

        // Auto-add assignee to project if not already a member
        if (body.assigneeId) {
            const { data: projectMembersData } = await supabase.from('project_members').select('user_id').eq('project_id', body.projectId);
            const projectMembers = (projectMembersData || []).map((m: any) => m.user_id);
            if (!projectMembers.includes(body.assigneeId)) {
                await supabase.from('project_members').insert({ project_id: body.projectId, user_id: body.assigneeId, role: 'Member' });
            }

            // Notify assignee if it's someone else
            if (body.assigneeId !== requestUserId) {
                const { data: project } = await supabase.from('projects').select('*').eq('id', body.projectId).maybeSingle();
                await supabase.from('notifications').insert({
                    user_id: body.assigneeId,
                    type: 'task_assigned',
                    title: 'New Task Assigned',
                    message: `You have been assigned to "${newTask.title}" in ${project?.name || 'a project'}`,
                    link: `/projects/${body.projectId}?task=${newTask.id}`,
                    entity_id: newTask.id,
                    project_id: body.projectId,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
                // Send email notification (fire-and-forget)
                const { data: assigneeUser } = await supabase.from('users').select('*').eq('id', body.assigneeId).maybeSingle();
                if (assigneeUser?.email) {
                    sendTaskAssigned(
                        assigneeUser.email,
                        newTask.title,
                        project?.name || 'a project',
                        requestUserData.name,
                        getSiteUrl(`/projects/${body.projectId}?task=${newTask.id}`)
                    ).catch(e => console.error('Task assigned email error:', e));
                }
            }
        }

        return NextResponse.json(newTask);
    } catch (error) {
        console.error('Error creating task:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create task' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, userId, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
        }
        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
        }

        const supabase2 = getSupabaseForRequest(request);
        const { data: requestUser } = await supabase2.from('users').select('id, role, name').eq('id', userId).maybeSingle();
        if (!requestUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const { data: existingTaskRaw } = await supabase2.from('tasks').select('*').eq('id', id).maybeSingle();
        if (!existingTaskRaw) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        const existingTask = {
            id: existingTaskRaw.id,
            projectId: existingTaskRaw.project_id,
            assigneeId: existingTaskRaw.assignee_id,
            dependencies: existingTaskRaw.dependencies || [],
            status: existingTaskRaw.status,
            title: existingTaskRaw.title
        } as any;

        if (requestUser.role === 'Member') {
            if (existingTask.assigneeId !== requestUser.id) {
                return NextResponse.json({ error: 'Members can only update their own tasks' }, { status: 403 });
            }
            const restrictedFields = ['title', 'description', 'priority', 'dueDate', 'isPrivate', 'dependencies', 'assigneeId'];
            const attemptRestrictedEdit = restrictedFields.some(field => field in updates);

            if (attemptRestrictedEdit) {
                return NextResponse.json({ error: 'Members cannot edit task metadata (title, priority, due date, etc.)' }, { status: 403 });
            }
        }

        // Validate state transitions
        if (updates.status && updates.status !== existingTask.status && requestUser.role !== 'Admin') {
            const validTransitions: Record<string, string[]> = {
                'To Do': ['In Progress'],
                'In Progress': ['Review', 'To Do'],
                'Review': ['Done', 'In Progress', 'To Do'],
                'Done': ['In Progress', 'To Do']
            };

            const allowedNextStates = validTransitions[existingTask.status] || [];
            if (!allowedNextStates.includes(updates.status)) {
                return NextResponse.json({ error: `Invalid transition from ${existingTask.status} to ${updates.status}` }, { status: 400 });
            }

            // Dependency checks when moving to Done or Review
            if (updates.status === 'Review' || updates.status === 'Done') {
                if (existingTask.dependencies && existingTask.dependencies.length > 0) {
                    const { data: tasks } = await supabase2.from('tasks').select('*').eq('project_id', existingTask.projectId);
                    const blockingTasks = (tasks || []).filter(t => existingTask.dependencies!.includes(t.id) && t.status !== 'Done');

                    if (blockingTasks.length > 0) {
                        return NextResponse.json({ error: 'Cannot transition task because dependencies are not Done' }, { status: 400 });
                    }
                }
            }
        }

        const { data: updatedTask } = await supabase2.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().maybeSingle();

        if (!updatedTask) {
            return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
        }

        // Auto-add assignee to project if updated to a non-member
        if (updates.assigneeId && updates.assigneeId !== existingTask.assigneeId) {
            const { data: pmData } = await supabase2.from('project_members').select('user_id').eq('project_id', existingTask.projectId);
            const projectMembers = (pmData || []).map((m: any) => m.user_id);
            if (!projectMembers.includes(updates.assigneeId)) {
                await supabase2.from('project_members').insert({ project_id: existingTask.projectId, user_id: updates.assigneeId, role: 'Member' });
            }

            // Notify new assignee if it's someone else
            if (updates.assigneeId !== userId) {
                const { data: project } = await supabase2.from('projects').select('*').eq('id', existingTask.projectId).maybeSingle();
                const taskLink = getSiteUrl(`/projects/${existingTask.projectId}?task=${updatedTask.id}`);
                await supabase2.from('notifications').insert({
                    user_id: updates.assigneeId,
                    type: 'task_assigned',
                    title: 'New Task Assigned',
                    message: `You have been assigned to "${updatedTask.title}" in ${project?.name || 'a project'}`,
                    link: `/projects/${existingTask.projectId}?task=${updatedTask.id}`,
                    entity_id: updatedTask.id,
                    project_id: existingTask.projectId,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
                // Send email to new assignee
                const { data: newAssigneeUser } = await supabase2.from('users').select('*').eq('id', updates.assigneeId).maybeSingle();
                if (newAssigneeUser?.email) {
                    sendTaskAssigned(
                        newAssigneeUser.email,
                        updatedTask.title,
                        project?.name || 'a project',
                        requestUser.name,
                        taskLink
                    ).catch(e => console.error('Task assigned email error:', e));
                }
                // If this is a swap, also notify the previous assignee
                if (updates.isSwap && existingTask.assigneeId) {
                        const { data: prevAssigneeUser } = await supabase2.from('users').select('*').eq('id', existingTask.assigneeId).maybeSingle();
                        if (prevAssigneeUser?.email) {
                        sendTaskSwapped(
                            prevAssigneeUser.email,
                            updatedTask.title,
                            project?.name || 'a project',
                            prevAssigneeUser.name,
                            newAssigneeUser?.name || 'another team member',
                            taskLink
                        ).catch(e => console.error('Task swapped email error:', e));
                    }
                }
            }
        }

        // Notify managers/admins & assignee if status changes
        if (updates.status && updates.status !== existingTask.status) {
            const { data: allUsers } = await supabase2.from('users').select('*');
            const membersToNotify = new Set<string>();

            // Find all admins/managers in this project or broadly
            const { data: pmData } = await supabase2.from('project_members').select('user_id').eq('project_id', existingTask.projectId);
            const projectMembers = (pmData || []).map((m: any) => m.user_id);
            (allUsers || []).forEach(u => {
                if ((u.role === 'Admin' || u.role === 'Manager') && projectMembers.includes(u.id)) {
                    membersToNotify.add(u.id);
                }
            });

            // Add assignee to the notification pool if they didn't make the change
            if (existingTask.assigneeId) {
                membersToNotify.add(existingTask.assigneeId);
            }

            // Don't notify the user who made the status change
            membersToNotify.delete(userId);

            const { data: project } = await supabase2.from('projects').select('*').eq('id', existingTask.projectId).maybeSingle();

            for (const notifyUserId of membersToNotify) {
                await supabase2.from('notifications').insert({
                    user_id: notifyUserId,
                    type: 'task_status_changed',
                    title: 'Task Status Updated',
                    message: `"${updatedTask.title}" status changed to ${updates.status} in ${project?.name || 'a project'}`,
                    link: `/projects/${existingTask.projectId}?task=${updatedTask.id}`,
                    entity_id: updatedTask.id,
                    project_id: existingTask.projectId,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            }
        }

        return NextResponse.json(updatedTask);
    } catch (error) {
        console.error('Error updating task:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update task' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const userId = searchParams.get('userId');

        if (!id || !userId) {
            return NextResponse.json({ error: 'Task ID and User ID are required' }, { status: 400 });
        }

        const supabase3 = getSupabaseForRequest(request);
        const { data: requestUser3 } = await supabase3.from('users').select('id, role').eq('id', userId).maybeSingle();
        if (!requestUser3 || requestUser3.role === 'Member') return NextResponse.json({ error: 'Only Admins and Managers can delete tasks' }, { status: 403 });

        const { error: delErr } = await supabase3.from('tasks').delete().eq('id', id);
        if (delErr) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting task:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete task' }, { status: 500 });
    }
}
