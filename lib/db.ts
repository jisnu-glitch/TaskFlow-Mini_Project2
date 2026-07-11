// Helper functions to convert between snake_case DB and camelCase TS
function toUser(dbUser: DbUser): User {
    return {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        avatarUrl: dbUser.avatar_url,
        role: dbUser.role,
        createdAt: dbUser.created_at,
        dob: dbUser.dob,
        skillExperience: typeof dbUser.skill_experience === 'string' ? JSON.parse(dbUser.skill_experience) : dbUser.skill_experience,
        // Use actual skills from database
        skills: dbUser.skills || [],
        wellnessScore: dbUser.wellness_score ?? 85,
        maxWorkload: dbUser.max_workload ?? 5,
        burnoutRisk: 'Low',
        phone: dbUser.phone,
        officeAddress: dbUser.office_address,
        age: dbUser.age,
        // Settings
        quietHoursStart: dbUser.quiet_hours_start,
        quietHoursEnd: dbUser.quiet_hours_end,
        quietHoursWeekends: dbUser.quiet_hours_weekends,
        twoFactorEnabled: dbUser.two_factor_enabled,
        companySize: dbUser.company_size as any,
        // AI Settings
        burnoutSensitivity: dbUser.burnout_sensitivity,
        autoAssign: dbUser.auto_assign,
        skillMatchPriority: dbUser.skill_match_priority,
        aiDeadlines: dbUser.ai_deadlines,
        // Notification Settings
    } as User;
}

function toProject(dbProject: DbProject): Project {
    return {
        id: dbProject.id,
        name: dbProject.name,
        description: dbProject.description || '',
        key: dbProject.key,
        ownerId: dbProject.owner_id,
        createdAt: dbProject.created_at,
        updatedAt: dbProject.updated_at,
    };
}

function toTask(dbTask: DbTask): Task {
    return {
        id: dbTask.id,
        projectId: dbTask.project_id,
        title: dbTask.title,
        description: dbTask.description,
        status: dbTask.status,
        priority: dbTask.priority,
        assigneeId: dbTask.assignee_id,
        dueDate: dbTask.due_date,
        startDate: dbTask.start_date,
        createdAt: dbTask.created_at,
        updatedAt: dbTask.updated_at,
        tags: dbTask.tags || [],
        dependencies: dbTask.dependencies || [],
    };
}

function toActivityLog(dbLog: DbActivityLog): ActivityLog {
    return {
        id: dbLog.id,
        entityType: dbLog.entity_type,
        entityId: dbLog.entity_id,
        action: dbLog.action,
        details: dbLog.details || '',
        userId: dbLog.user_id,
        timestamp: dbLog.timestamp,
    };
}

function toMessage(dbMessage: DbMessage): Message {
    const parsed = parseLegacyMessageContent(dbMessage.content);
    return {
        id: dbMessage.id,
        projectId: dbMessage.project_id || undefined,
        userId: dbMessage.user_id,
        content: parsed.content,
        timestamp: dbMessage.timestamp,
        attachment: dbMessage.attachment 
            ? (typeof dbMessage.attachment === 'string' ? JSON.parse(dbMessage.attachment) : dbMessage.attachment) 
            : undefined,
        conversationType: dbMessage.conversation_type || parsed.metadata.conversationType || 'project',
        recipientId: dbMessage.recipient_id || parsed.metadata.recipientId || undefined,
        threadRootId: dbMessage.thread_root_id || parsed.metadata.threadRootId || null,
        reactions: dbMessage.reactions 
            ? (typeof dbMessage.reactions === 'string' ? JSON.parse(dbMessage.reactions) : dbMessage.reactions) 
            : (parsed.metadata.reactions || []),
        isPinned: dbMessage.is_pinned || parsed.metadata.isPinned || false,
    };
}

function isMissingMessageColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
    if (!error) return false;
    return error.code === 'PGRST204' || error.code === '42703' || /column/i.test(error.message || '');
}

type LegacyMessageMetadata = {
    conversationType?: 'project' | 'dm';
    recipientId?: string;
    threadRootId?: string | null;
    reactions?: Message['reactions'];
    isPinned?: boolean;
};

const LEGACY_MESSAGE_PREFIX = '[[TFMETA:';

function parseLegacyMessageContent(rawContent: string): { content: string; metadata: LegacyMessageMetadata } {
    if (!rawContent.startsWith(LEGACY_MESSAGE_PREFIX)) {
        return { content: rawContent, metadata: {} };
    }

    const closingIndex = rawContent.indexOf(']]');
    if (closingIndex === -1) {
        return { content: rawContent, metadata: {} };
    }

    try {
        const json = rawContent.slice(LEGACY_MESSAGE_PREFIX.length, closingIndex);
        const metadata = JSON.parse(json) as LegacyMessageMetadata;
        const content = rawContent.slice(closingIndex + 2);
        return { content, metadata };
    } catch {
        return { content: rawContent, metadata: {} };
    }
}

function serializeLegacyMessageContent(content: string, metadata: LegacyMessageMetadata): string {
    const normalized: LegacyMessageMetadata = {};
    if (metadata.conversationType && metadata.conversationType !== 'project') normalized.conversationType = metadata.conversationType;
    if (metadata.recipientId) normalized.recipientId = metadata.recipientId;
    if (metadata.threadRootId) normalized.threadRootId = metadata.threadRootId;
    if (metadata.reactions && metadata.reactions.length > 0) normalized.reactions = metadata.reactions;
    if (metadata.isPinned) normalized.isPinned = metadata.isPinned;

    if (Object.keys(normalized).length === 0) {
        return content;
    }

    return `${LEGACY_MESSAGE_PREFIX}${JSON.stringify(normalized)}]]${content}`;
}

function toComment(dbComment: DbComment): Comment {
    return {
        id: dbComment.id,
        taskId: dbComment.task_id,
        userId: dbComment.user_id,
        content: dbComment.content,
        createdAt: dbComment.created_at,
    };
}

function toForm(dbForm: DbForm): Form {
    return {
        id: dbForm.id,
        projectId: dbForm.project_id,
        title: dbForm.title,
        description: dbForm.description,
        fields: typeof dbForm.fields === 'string' ? JSON.parse(dbForm.fields) : (dbForm.fields || []),
        status: dbForm.status,
        createdBy: dbForm.created_by,
        createdAt: dbForm.created_at,
        updatedAt: dbForm.updated_at,
    };
}

function toFormResponse(dbResponse: DbFormResponse): FormResponse {
    return {
        id: dbResponse.id,
        formId: dbResponse.form_id,
        respondentId: dbResponse.respondent_id,
        answers: typeof dbResponse.answers === 'string' ? JSON.parse(dbResponse.answers) : (dbResponse.answers || {}),
        submittedAt: dbResponse.submitted_at,
    };
}

function toDocument(dbDoc: DbDocument): Document {
    return {
        id: dbDoc.id,
        projectId: dbDoc.project_id,
        title: dbDoc.title,
        type: dbDoc.type as 'page' | 'file',
        content: dbDoc.content,
        filePath: dbDoc.file_path,
        fileType: dbDoc.file_type,
        size: dbDoc.size,
        createdBy: dbDoc.created_by,
        createdAt: dbDoc.created_at,
        updatedAt: dbDoc.updated_at,
    };
}

function toNotification(dbNotif: DbNotification): Notification {
    return {
        id: dbNotif.id,
        userId: dbNotif.user_id,
        type: dbNotif.type,
        title: dbNotif.title,
        message: dbNotif.message,
        isRead: dbNotif.is_read,
        link: dbNotif.link,
        entityId: dbNotif.entity_id,
        projectId: dbNotif.project_id,
        createdAt: dbNotif.created_at,
    };
}

function toDeployment(dbDep: DbDeployment): Deployment {
    return {
        id: dbDep.id,
        projectId: dbDep.project_id,
        version: dbDep.version,
        environment: dbDep.environment,
        status: dbDep.status,
        releaseNotes: dbDep.release_notes || '',
        createdBy: dbDep.created_by,
        createdAt: dbDep.created_at,
        updatedAt: dbDep.updated_at,
    };
}

function toTimeEntry(dbEntry: DbTimeEntry): TimeEntry {
    return {
        id: dbEntry.id,
        taskId: dbEntry.task_id,
        userId: dbEntry.user_id,
        projectId: dbEntry.project_id,
        startTime: dbEntry.start_time,
        endTime: dbEntry.end_time,
        durationMinutes: dbEntry.duration_minutes,
        note: dbEntry.note,
        createdAt: dbEntry.created_at,
    };
}

import { getSupabase, DbUser, DbProject, DbTask, DbActivityLog, DbMessage, DbComment, DbForm, DbFormResponse, DbDocument, DbShortcut, DbRepoLink, DbNotification, DbDeployment, DbDeploymentTask, DbTimeEntry } from './supabase';
import { Project, Task, User, ActivityLog, Message, Comment, Form, FormResponse, Document, Notification, Deployment, DeploymentTask, TimeEntry } from '@/types';

import { isDemoMode, getDemoDb } from './demo-db';

// Database class with async Supabase operations
class Database {
    // Users
    async getUsers(): Promise<User[]> {
        const { data, error } = await getSupabase()
            .from('users')
            .select('*');

        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }
        return (data || []).map(toUser);
    }

    async getUser(id: string): Promise<User | null> {
        const { data, error } = await getSupabase()
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error('Error fetching user:', error);
            return null;
        }
        return toUser(data);
    }

    async updateUserSettings(userId: string, settings: Partial<{
        phone: string;
        officeAddress: string;
        quietHoursStart: string;
        quietHoursEnd: string;
        quietHoursWeekends: boolean;
        twoFactorEnabled: boolean;
        companySize: string;
        maxWorkload: number;
        burnoutSensitivity: number;
        autoAssign: boolean;
        skillMatchPriority: boolean;
        aiDeadlines: boolean;
        dob: string;
    }>): Promise<User | null> {
        const { data, error } = await getSupabase()
            .from('users')
            .update({
                phone: settings.phone,
                office_address: settings.officeAddress,
                quiet_hours_start: settings.quietHoursStart,
                quiet_hours_end: settings.quietHoursEnd,
                quiet_hours_weekends: settings.quietHoursWeekends,
                two_factor_enabled: settings.twoFactorEnabled,
                company_size: settings.companySize,
                max_workload: settings.maxWorkload,
                burnout_sensitivity: settings.burnoutSensitivity,
                auto_assign: settings.autoAssign,
                skill_match_priority: settings.skillMatchPriority,
                ai_deadlines: settings.aiDeadlines,
                dob: settings.dob,
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error updating user settings:', error);
            return null;
        }
        return toUser(data);
    }

    async updateUserRole(userId: string, newRole: string): Promise<boolean> {
        const { error } = await getSupabase()
            .from('users')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) {
            console.error('Error updating user role:', error);
            return false;
        }
        return true;
    }

    async updateUserSkills(userId: string, skills: string[], skillExperience: Record<string, number>): Promise<{ success: boolean; error?: any }> {
        const { error } = await getSupabase()
            .from('users')
            .update({
                skills,
                skill_experience: skillExperience
            })
            .eq('id', userId);

        if (error) {
            console.error('Error updating user skills:', error);
            return { success: false, error };
        }
        return { success: true };
    }

    async addUser(userData: {
        email: string;
        password?: string;
        fullName: string;
        role: string;
        dob?: string;
        skillExperience?: Record<string, number>;
        maxWorkload: number;
    }): Promise<User | null> {
        const skillsArray = userData.skillExperience ? Object.keys(userData.skillExperience) : [];
        const payload = {
            p_email: userData.email,
            p_password: userData.password || 'TaskFlow@123',
            p_name: userData.fullName,
            p_user_role: userData.role,
            p_skills: skillsArray,
            p_dob: userData.dob || null,
            p_skill_experience: userData.skillExperience,
            p_max_workload: userData.maxWorkload
        };
        console.log('--- RPC PAYLOAD ---', payload);
        const { data: userId, error } = await getSupabase().rpc('admin_create_user_v2', payload);

        if (error) {
            console.error('Error creating user via RPC. Error object:', JSON.stringify(error, null, 2));
            throw new Error(error.message);
        }

        if (userId) {
            // Apply defaults
            const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.fullName)}&background=random`;
            const firstDigit = Math.floor(Math.random() * 4) + 6;
            const remainingDigits = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
            const defaultPhone = `+91 ${firstDigit}${remainingDigits.slice(0, 4)} ${remainingDigits.slice(4)}`;
            const defaultOfficeAddress = 'Level 1, TaskFlow Tech Park, Bangalore, India';
            const defaultDob = userData.dob || '1995-01-01';

            const { error: updateError } = await getSupabase()
                .from('users')
                .update({
                    avatar_url: defaultAvatarUrl,
                    phone: defaultPhone,
                    office_address: defaultOfficeAddress,
                    dob: defaultDob
                })
                .eq('id', userId);

            if (updateError) {
                console.error('Error applying defaults to new user:', updateError);
            }

            return await this.getUser(userId as string);
        }
        return null;
    }

    async getAutocompleteData(): Promise<{ skills: string[], tags: string[], titles: string[] }> {
        const { data, error } = await getSupabase().rpc('get_autocomplete_data');
        if (error) {
            console.error('Error fetching autocomplete data:', error);
            return { skills: [], tags: [], titles: [] };
        }
        return {
            skills: data.skills || [],
            tags: data.tags || [],
            titles: data.titles || []
        };
    }

    // Projects
    async getProjects(userId?: string): Promise<Project[]> {
        let user: User | null = null;
        if (userId) {
            user = await this.getUser(userId);
        }

        let query = getSupabase().from('projects').select('*');

        // Only filter if userId is provided and user is not an Admin
        if (userId) {
            if (!user) {
                console.warn(`User with ID ${userId} not found in getProjects. Returning empty list.`);
                return [];
            }

            if (user.role !== 'Admin') {
                const { data: membershipData, error: membershipError } = await getSupabase()
                    .from('project_members')
                    .select('project_id')
                    .eq('user_id', userId);

                if (membershipError) {
                    console.error('Error fetching project memberships:', membershipError);
                }

                const projectIds = membershipData ? membershipData.map((m: any) => m.project_id) : [];

                // Construct the or filter string
                const ownerFilter = `owner_id.eq.${userId}`;
                const membershipFilter = projectIds.length > 0 ? `,id.in.(${projectIds.join(',')})` : '';

                query = query.or(`${ownerFilter}${membershipFilter}`);
            }
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching projects:', error);
            return [];
        }
        return (data || []).map(toProject);
    }

    async getProject(id: string): Promise<Project | null> {
        const { data, error } = await getSupabase()
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code !== 'PGRST116') { // PGRST116 is 'no rows returned'
                console.error('Error fetching project:', error);
            }
            return null;
        }
        return toProject(data);
    }

    async updateMessageContent(messageId: string, content: string): Promise<Message | null> {
        const { data, error } = await getSupabase()
            .from('messages')
            .update({ content })
            .eq('id', messageId)
            .select('*')
            .single();

        if (error || !data) {
            console.error('Error updating message content:', error);
            return null;
        }
        return toMessage(data);
    }

    async toggleMessagePin(messageId: string, isPinned: boolean): Promise<void> {
        const supabase = getSupabase();
        const { error } = await supabase
            .from('messages')
            .update({ is_pinned: isPinned })
            .eq('id', messageId);
        if (error) {
            if (isMissingMessageColumnError(error)) {
                const existing = await this.getMessageById(messageId);
                if (!existing) throw error;

                const { error: fallbackError } = await supabase
                    .from('messages')
                    .update({
                        content: serializeLegacyMessageContent(existing.content, {
                            conversationType: existing.conversationType,
                            recipientId: existing.recipientId,
                            threadRootId: existing.threadRootId,
                            reactions: existing.reactions,
                            isPinned: isPinned,
                        }),
                    })
                    .eq('id', messageId);

                if (fallbackError) throw fallbackError;
                return;
            }
            throw error;
        }





    }

    async deleteMessage(id: string): Promise<boolean> {
        const { error } = await getSupabase()
            .from('messages')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting message:', error);
            return false;
        }
        return true;
    }

    async getProjectMembers(projectId: string): Promise<string[]> {
        const { data, error } = await getSupabase()
            .from('project_members')
            .select('user_id')
            .eq('project_id', projectId);

        if (error) {
            console.error('Error fetching project members:', error);
            return [];
        }
        return (data || []).map((m: any) => m.user_id);
    }

    async addProject(project: Project): Promise<void> {
        const { error } = await getSupabase()
            .from('projects')
            .insert({
                id: project.id,
                name: project.name,
                description: project.description,
                key: project.key,
                owner_id: project.ownerId,
                created_at: project.createdAt,
                updated_at: project.updatedAt,
            });

        if (error) {
            console.error('Error adding project:', error);
            return;
        }

        // Add creator as the first member (Owner)
        await this.addProjectMember(project.id, project.ownerId, 'Owner');
    }

    async addProjectMember(projectId: string, userId: string, role: string = 'Member'): Promise<boolean> {
        const { error } = await getSupabase()
            .from('project_members')
            .insert({
                project_id: projectId,
                user_id: userId,
                role: role
            });

        if (error) {
            console.error('Error adding project member:', error);
            return false;
        }
        return true;
    }

    async removeProjectMember(projectId: string, userId: string): Promise<boolean> {
        const { error } = await getSupabase()
            .from('project_members')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) {
            console.error('Error removing project member:', error);
            return false;
        }
        return true;
    }

    async unassignUserTasks(projectId: string, userId: string): Promise<number> {
        const { data, error, count } = await getSupabase()
            .from('tasks')
            .update({ assignee_id: null })
            .eq('project_id', projectId)
            .eq('assignee_id', userId)
            .select('*');

        if (error) {
            console.error('Error unassigning user tasks:', error);
            return 0;
        }
        return (data || []).length;
    }

    async getProjectAdminsAndManagers(projectId: string): Promise<User[]> {
        const { data: members, error: memError } = await getSupabase()
            .from('project_members')
            .select('user_id, role')
            .eq('project_id', projectId);

        if (memError || !members) return [];

        const adminManagerIds = members
            .filter((m: any) => m.role === 'Admin' || m.role === 'Manager' || m.role === 'Owner')
            .map((m: any) => m.user_id);

        if (adminManagerIds.length === 0) return [];

        const { data: users, error: userError } = await getSupabase()
            .from('users')
            .select('*')
            .in('id', adminManagerIds);

        if (userError) return [];
        return (users || []).map(toUser);
    }

    async deleteProject(id: string): Promise<boolean> {
        // Delete all tasks in this project first
        const { error: tasksError } = await getSupabase()
            .from('tasks')
            .delete()
            .eq('project_id', id);

        if (tasksError) {
            console.error('Error deleting project tasks:', tasksError);
        }

        // Delete the project
        const { error } = await getSupabase()
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting project:', error);
            return false;
        }
        return true;
    }

    // Tasks
    async getTasks(projectId?: string, assigneeId?: string): Promise<Task[]> {
        let query = getSupabase().from('tasks').select('*');

        if (projectId) {
            query = query.eq('project_id', projectId);
        }
        if (assigneeId) {
            query = query.eq('assignee_id', assigneeId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching tasks:', error);
            return [];
        }
        return (data || []).map(toTask);
    }

    async addTask(task: Task, userId: string = 'system'): Promise<void> {
        const { error } = await getSupabase()
            .from('tasks')
            .insert({
                id: task.id,
                project_id: task.projectId,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                assignee_id: task.assigneeId,
                due_date: task.dueDate,
                start_date: task.startDate,
                created_at: task.createdAt,
                updated_at: task.updatedAt,
                tags: task.tags,
                dependencies: task.dependencies || [],
            });

        if (error) {
            console.error('Error adding task:', error);
            return;
        }

        // Create activity log
        await this.createLog({
            id: crypto.randomUUID(),
            entityType: 'Task',
            entityId: task.id,
            action: 'Created',
            details: `Task "${task.title}" created.`,
            userId: userId,
            timestamp: new Date().toISOString()
        });
    }

    async updateTask(id: string, updates: Partial<Task>, userId: string = 'system'): Promise<Task | null> {
        // First get the current task to compare status
        const { data: currentTasks, error: fetchError } = await getSupabase()
            .from('tasks')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !currentTasks) {
            console.error('Error fetching task for update:', fetchError);
            return null;
        }

        const oldStatus = currentTasks.status;

        // Build update object in snake_case
        const dbUpdates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.description !== undefined) dbUpdates.description = updates.description;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
        if (updates.assigneeId !== undefined) dbUpdates.assignee_id = updates.assigneeId;
        if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
        if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
        if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
        if (updates.dependencies !== undefined) dbUpdates.dependencies = updates.dependencies;

        const { data, error } = await getSupabase()
            .from('tasks')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating task:', error);
            return null;
        }

        // Log status change
        if (updates.status && updates.status !== oldStatus) {
            await this.createLog({
                id: crypto.randomUUID(),
                entityType: 'Task',
                entityId: id,
                action: 'Moved',
                details: `Status changed from "${oldStatus}" to "${updates.status}".`,
                userId: userId,
                timestamp: new Date().toISOString()
            });
        }

        return toTask(data);
    }

    // Activity Logs
    async getActivityLogs(): Promise<ActivityLog[]> {
        const { data, error } = await getSupabase()
            .from('activity_logs')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Error fetching activity logs:', error);
            return [];
        }
        return (data || []).map(toActivityLog);
    }

    async getActivityLogsForUser(userId: string): Promise<ActivityLog[]> {
        const user = await this.getUser(userId);
        if (!user) return [];

        // Admins see everything
        if (user.role === 'Admin') {
            return this.getActivityLogs();
        }

        // Get projects user is part of
        const projects = await this.getProjects(userId);
        const projectIds = projects.map(p => p.id);

        if (projectIds.length === 0) return [];

        // Get tasks for those projects
        const { data: tasks, error: tasksError } = await getSupabase()
            .from('tasks')
            .select('id')
            .in('project_id', projectIds);

        const taskIds = (tasks || []).map(t => t.id);

        let orQueryParts = [];
        if (projectIds.length > 0) {
            orQueryParts.push(`and(entity_type.eq.Project,entity_id.in.(${projectIds.join(',')}))`);
        }
        if (taskIds.length > 0) {
            orQueryParts.push(`and(entity_type.eq.Task,entity_id.in.(${taskIds.join(',')}))`);
        }

        if (orQueryParts.length === 0) return [];

        const { data, error } = await getSupabase()
            .from('activity_logs')
            .select('*')
            .or(orQueryParts.join(','))
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Error fetching activity logs for user:', error);
            return [];
        }
        return (data || []).map(toActivityLog);
    }

    async getUserActivityLogs(userId: string): Promise<ActivityLog[]> {
        const { data, error } = await getSupabase()
            .from('activity_logs')
            .select('*')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Error fetching user activity logs:', error);
            return [];
        }
        return (data || []).map(toActivityLog);
    }

    async createLog(log: ActivityLog): Promise<void> {
        const { error } = await getSupabase()
            .from('activity_logs')
            .insert({
                id: log.id,
                entity_type: log.entityType,
                entity_id: log.entityId,
                action: log.action,
                details: log.details,
                user_id: log.userId,
                timestamp: log.timestamp,
            });

        if (error) {
            console.error('Error creating activity log:', error);
        }
    }

    // Messages
    async getMessages(projectId: string): Promise<Message[]> {
        const { data, error } = await getSupabase()
            .from('messages')
            .select('*')
            .eq('project_id', projectId)
            .eq('conversation_type', 'project')
            .order('timestamp', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
        return (data || []).map(toMessage);
    }

    async getDirectMessages(userId: string, recipientId: string, projectId?: string): Promise<Message[]> {
        let query = getSupabase()
            .from('messages')
            .select('*')
            .eq('conversation_type', 'dm')
            .or(`and(user_id.eq.${userId},recipient_id.eq.${recipientId}),and(user_id.eq.${recipientId},recipient_id.eq.${userId})`);

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { data, error } = await query.order('timestamp', { ascending: true });

        if (error) {
            if (isMissingMessageColumnError(error)) {
                const { data: fallbackData, error: fallbackError } = await getSupabase()
                    .from('messages')
                    .select('*')
                    .order('timestamp', { ascending: true });

                if (fallbackError) {
                    console.error('Error fetching fallback direct messages:', fallbackError);
                    return [];
                }

                  return (fallbackData || [])
                      .map(toMessage)
                      .filter(message =>
                          message.conversationType === 'dm' &&
                          (!projectId || message.projectId === projectId) &&
                          ((message.userId === userId && message.recipientId === recipientId) ||
                              (message.userId === recipientId && message.recipientId === userId))
                      );
            }
            console.error('Error fetching direct messages:', error);
            return [];
        }

        return (data || []).map(toMessage);
    }

    async getThreadMessages(rootMessageId: string): Promise<Message[]> {
        const { data, error } = await getSupabase()
            .from('messages')
            .select('*')
            .eq('thread_root_id', rootMessageId)
            .order('timestamp', { ascending: true });

        if (error) {
            if (isMissingMessageColumnError(error)) {
                const { data: fallbackData, error: fallbackError } = await getSupabase()
                    .from('messages')
                    .select('*')
                    .order('timestamp', { ascending: true });

                if (fallbackError) {
                    console.error('Error fetching fallback thread messages:', fallbackError);
                    return [];
                }

                return (fallbackData || [])
                    .map(toMessage)
                    .filter(message => message.threadRootId === rootMessageId);
            }
            console.error('Error fetching thread messages:', error);
            return [];
        }

        return (data || []).map(toMessage);
    }

    async addMessage(message: Message): Promise<void> {
        const supabase = getSupabase();
        const fullInsert = await supabase
            .from('messages')
            .insert({
                id: message.id,
                project_id: message.projectId || null,
                user_id: message.userId,
                content: message.content,
                timestamp: message.timestamp,
                attachment: message.attachment ? JSON.stringify(message.attachment) : null,
                conversation_type: message.conversationType || 'project',
                recipient_id: message.recipientId || null,
                thread_root_id: message.threadRootId || null,
                reactions: message.reactions || [],
            });

        if (!fullInsert.error) {
            return;
        }

        if (isMissingMessageColumnError(fullInsert.error)) {
            const fallback = await supabase
                .from('messages')
                .insert({
                    id: message.id,
                    project_id: message.projectId || null,
                    user_id: message.userId,
                    content: serializeLegacyMessageContent(message.content, {
                        conversationType: message.conversationType,
                        recipientId: message.recipientId,
                        threadRootId: message.threadRootId,
                        reactions: message.reactions,
                    }),
                    timestamp: message.timestamp,
                    attachment: message.attachment ? JSON.stringify(message.attachment) : null,
                });

            if (!fallback.error) {
                return;
            }

            console.error('Error adding message with legacy fallback:', fallback.error);
            throw new Error(`Failed to add message: ${fallback.error.message}`);
        }

        console.error('Error adding message:', fullInsert.error);
        throw new Error(`Failed to add message: ${fullInsert.error.message}`);
    }

    async getMessageById(id: string): Promise<Message | null> {
        const { data, error } = await getSupabase()
            .from('messages')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error('Error fetching message:', error);
            return null;
        }

        return toMessage(data);
    }

    async updateMessageReactions(id: string, reactions: Message['reactions']): Promise<Message | null> {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('messages')
            .update({
                reactions: JSON.stringify(reactions || []),
            })
            .eq('id', id)
            .select('*')
            .single();

        if (error || !data) {
            if (isMissingMessageColumnError(error)) {
                const existing = await this.getMessageById(id);
                if (!existing) {
                    return null;
                }

                const fallback = await supabase
                    .from('messages')
                    .update({
                        content: serializeLegacyMessageContent(existing.content, {
                            conversationType: existing.conversationType,
                            recipientId: existing.recipientId,
                            threadRootId: existing.threadRootId,
                            reactions: reactions || [],
                        }),
                    })
                    .eq('id', id)
                    .select('*')
                    .single();

                if (fallback.error || !fallback.data) {
                    console.error('Error updating message reactions with legacy fallback:', fallback.error);
                    return null;
                }

                return toMessage(fallback.data);
            }
            console.error('Error updating message reactions:', error);
            return null;
        }

        return toMessage(data);
    }

    // Time Entries
    async getTimeEntries(taskId: string): Promise<TimeEntry[]> {
        const { data, error } = await getSupabase()
            .from('time_entries')
            .select('*')
            .eq('task_id', taskId)
            .order('start_time', { ascending: false });

        if (error) {
            console.error('Error fetching time entries:', error);
            return [];
        }
        return (data || []).map(toTimeEntry);
    }

    async getActiveTimers(userId: string): Promise<TimeEntry[]> {
        const { data, error } = await getSupabase()
            .from('time_entries')
            .select('*')
            .eq('user_id', userId)
            .is('end_time', null)
            .order('start_time', { ascending: false });

        if (error) {
            console.error('Error fetching active timers:', error);
            return [];
        }
        return (data || []).map(toTimeEntry);
    }

    async getActiveTimer(userId: string): Promise<TimeEntry | null> {
        const activeTimers = await this.getActiveTimers(userId);
        return activeTimers.length > 0 ? activeTimers[0] : null;
    }

    async stopActiveTimersForUser(userId: string, taskId?: string, note?: string): Promise<TimeEntry[]> {
        let query = getSupabase()
            .from('time_entries')
            .select('*')
            .eq('user_id', userId)
            .is('end_time', null)
            .order('start_time', { ascending: false });

        if (taskId) {
            query = query.eq('task_id', taskId);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching active timers to stop:', error);
            return [];
        }

        const activeEntries = (data || []).map(toTimeEntry);
        if (activeEntries.length === 0) {
            return [];
        }

        const stoppedEntries = await Promise.all(
            activeEntries.map(entry => this.stopTimeEntry(entry.id, note))
        );

        return stoppedEntries.filter((entry): entry is TimeEntry => !!entry);
    }

    async startTimeEntry(taskId: string, userId: string, projectId?: string): Promise<TimeEntry | null> {
        // Ensure no other timer is active for this user, including duplicate stale rows.
        await this.stopActiveTimersForUser(userId, undefined, 'Auto-stopped when starting a new timer');

        const { data, error } = await getSupabase()
            .from('time_entries')
            .insert({
                task_id: taskId,
                user_id: userId,
                project_id: projectId,
                start_time: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('Error starting time entry:', error);
            return null;
        }
        return toTimeEntry(data);
    }

    async stopTimeEntry(id: string, note?: string): Promise<TimeEntry | null> {
        const { data: entry, error: fetchError } = await getSupabase()
            .from('time_entries')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !entry) return null;

        const endTime = new Date();
        const startTime = new Date(entry.start_time);
        const diffMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.max(1, Math.round(diffMs / 60000));

        const { data, error } = await getSupabase()
            .from('time_entries')
            .update({
                end_time: endTime.toISOString(),
                duration_minutes: durationMinutes,
                note: note
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error stopping time entry:', error);
            return null;
        }
        return toTimeEntry(data);
    }

    async addManualTimeEntry(taskId: string, userId: string, minutes: number, projectId?: string, note?: string): Promise<TimeEntry | null> {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - minutes * 60000);

        const { data, error } = await getSupabase()
            .from('time_entries')
            .insert({
                task_id: taskId,
                user_id: userId,
                project_id: projectId,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                duration_minutes: Math.max(1, Math.round(minutes)),
                note: note || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding manual time entry:', error);
            return null;
        }

        return toTimeEntry(data);
    }

    // Get single task by ID
    async getTaskById(id: string): Promise<Task | null> {
        const { data, error } = await getSupabase()
            .from('tasks')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error('Error fetching task:', error);
            return null;
        }
        return toTask(data);
    }

    // Delete task
    async deleteTask(id: string, userId: string): Promise<boolean> {
        // Get task title for activity log
        const task = await this.getTaskById(id);
        if (!task) return false;

        const { error } = await getSupabase()
            .from('tasks')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting task:', error);
            return false;
        }

        // Log deletion
        await this.createLog({
            id: crypto.randomUUID(),
            entityType: 'Task',
            entityId: id,
            action: 'Deleted',
            details: `Task "${task.title}" deleted.`,
            userId: userId,
            timestamp: new Date().toISOString()
        });

        return true;
    }

    // Comments
    async getComments(taskId: string): Promise<Comment[]> {
        const { data, error } = await getSupabase()
            .from('comments')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching comments:', error);
            return [];
        }
        return (data || []).map(toComment);
    }

    async addComment(comment: Comment): Promise<void> {
        const { error } = await getSupabase()
            .from('comments')
            .insert({
                id: comment.id,
                task_id: comment.taskId,
                user_id: comment.userId,
                content: comment.content,
                created_at: comment.createdAt,
            });

        if (error) {
            console.error('Error adding comment:', error);
            return;
        }

        // Log comment activity
        const task = await this.getTaskById(comment.taskId);
        await this.createLog({
            id: crypto.randomUUID(),
            entityType: 'Task',
            entityId: comment.taskId,
            action: 'Commented',
            details: `Comment added on "${task?.title || 'task'}".`,
            userId: comment.userId,
            timestamp: new Date().toISOString()
        });
    }

    // Forms
    async getForms(projectId: string): Promise<Form[]> {
        const { data, error } = await getSupabase()
            .from('forms')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching forms:', error);
            return [];
        }
        return (data || []).map(toForm);
    }

    async getFormById(id: string): Promise<Form | null> {
        const { data, error } = await getSupabase()
            .from('forms')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error('Error fetching form:', error);
            return null;
        }
        return toForm(data);
    }

    async addForm(form: Form): Promise<void> {
        const { error } = await getSupabase()
            .from('forms')
            .insert({
                id: form.id,
                project_id: form.projectId,
                title: form.title,
                description: form.description,
                fields: JSON.stringify(form.fields),
                status: form.status,
                created_by: form.createdBy,
                created_at: form.createdAt,
                updated_at: form.updatedAt,
            });

        if (error) {
            console.error('Error adding form:', error);
            throw new Error(error.message);
        }
    }

    async updateForm(id: string, updates: Partial<Form>): Promise<Form | null> {
        const dbUpdates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.description !== undefined) dbUpdates.description = updates.description;
        if (updates.fields !== undefined) dbUpdates.fields = JSON.stringify(updates.fields);
        if (updates.status !== undefined) dbUpdates.status = updates.status;

        const { data, error } = await getSupabase()
            .from('forms')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating form:', error);
            return null;
        }
        return toForm(data);
    }

    async deleteForm(id: string): Promise<boolean> {
        // Delete all responses first
        await getSupabase()
            .from('form_responses')
            .delete()
            .eq('form_id', id);

        const { error } = await getSupabase()
            .from('forms')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting form:', error);
            return false;
        }
        return true;
    }

    // Form Responses
    async getFormResponses(formId: string): Promise<FormResponse[]> {
        const { data, error } = await getSupabase()
            .from('form_responses')
            .select('*')
            .eq('form_id', formId)
            .order('submitted_at', { ascending: false });

        if (error) {
            console.error('Error fetching form responses:', error);
            return [];
        }
        return (data || []).map(toFormResponse);
    }

    async getFormResponsesByRespondent(projectId: string, respondentId: string): Promise<FormResponse[]> {
        // First get all forms in the project
        const forms = await this.getForms(projectId);
        if (forms.length === 0) return [];

        const formIds = forms.map(f => f.id);

        const { data, error } = await getSupabase()
            .from('form_responses')
            .select('*')
            .in('form_id', formIds)
            .eq('respondent_id', respondentId);

        if (error) {
            console.error('Error fetching respondent form responses:', error);
            return [];
        }
        return (data || []).map(toFormResponse);
    }

    async addFormResponse(response: FormResponse): Promise<void> {
        const { error } = await getSupabase()
            .from('form_responses')
            .insert({
                id: response.id,
                form_id: response.formId,
                respondent_id: response.respondentId,
                answers: JSON.stringify(response.answers),
                submitted_at: response.submittedAt,
            });

        if (error) {
            console.error('Error adding form response:', error);
            throw new Error(`Failed to add form response: ${error.message}`);
        }
    }

    async updateFormResponse(id: string, answers: any): Promise<FormResponse | null> {
        const { data, error } = await getSupabase()
            .from('form_responses')
            .update({
                answers: JSON.stringify(answers),
                submitted_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating form response:', error);
            return null;
        }
        return toFormResponse(data);
    }

    async upsertFormResponse(response: FormResponse): Promise<FormResponse | null> {
        // Check if response already exists for this form and respondent
        const { data: existing, error: existError } = await getSupabase()
            .from('form_responses')
            .select('*')
            .eq('form_id', response.formId)
            .eq('respondent_id', response.respondentId)
            .single();

        if (existError && existError.code !== 'PGRST116') {
            console.error('Error checking existing form response:', existError);
            return null;
        }

        if (existing) {
            return this.updateFormResponse(existing.id, response.answers);
        } else {
            await this.addFormResponse(response);
            return response;
        }
    }

    async getProjectFormsActivity(projectId: string): Promise<number> {
        const forms = await this.getForms(projectId);
        if (forms.length === 0) return 0;

        const formIds = forms.map(f => f.id);
        const { count, error } = await getSupabase()
            .from('form_responses')
            .select('*', { count: 'exact', head: true })
            .in('form_id', formIds);

        if (error) {
            console.error('Error fetching project forms activity:', error);
            return 0;
        }
        return count || 0;
    }

    // Documents
    async getDocuments(projectId: string): Promise<Document[]> {
        const { data, error } = await getSupabase()
            .from('documents')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching documents:', error);
            return [];
        }
        return (data || []).map(toDocument);
    }

    async createDocument(doc: Document): Promise<Document | null> {
        const { data, error } = await getSupabase()
            .from('documents')
            .insert({
                id: doc.id,
                project_id: doc.projectId,
                title: doc.title,
                type: doc.type,
                content: doc.content,
                file_path: doc.filePath,
                file_type: doc.fileType,
                size: doc.size,
                created_by: doc.createdBy,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating document:', error);
            return null;
        }
        return toDocument(data);
    }

    async deleteDocument(docId: string): Promise<boolean> {
        const { error } = await getSupabase()
            .from('documents')
            .delete()
            .eq('id', docId);

        if (error) {
            console.error('Error deleting document:', error);
            return false;
        }
        return true;
    }

    async updateDocument(docId: string, updates: { title?: string; content?: string }): Promise<boolean> {
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString()
        };

        if (updates.title !== undefined) {
            updateData.title = updates.title;
        }
        if (updates.content !== undefined) {
            updateData.content = updates.content;
        }

        const { error } = await getSupabase()
            .from('documents')
            .update(updateData)
            .eq('id', docId);

        if (error) {
            console.error('Error updating document:', error);
            return false;
        }
        return true;
    }

    // Shortcuts
    async getShortcuts(projectId: string): Promise<DbShortcut[]> {
        const { data, error } = await getSupabase()
            .from('shortcuts')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching shortcuts:', error);
            return [];
        }
        return data || [];
    }

    async addShortcut(shortcut: { id: string; project_id: string; name: string; url: string; type: 'link' | 'repository' }): Promise<DbShortcut | null> {
        const { data, error } = await getSupabase()
            .from('shortcuts')
            .insert({
                id: shortcut.id,
                project_id: shortcut.project_id,
                name: shortcut.name,
                url: shortcut.url,
                type: shortcut.type,
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding shortcut:', error);
            return null;
        }
        return data;
    }

    async deleteShortcut(id: string): Promise<boolean> {
        const { error } = await getSupabase()
            .from('shortcuts')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting shortcut:', error);
            return false;
        }
        return true;
    }

    async updateShortcut(id: string, updates: { name?: string; url?: string }): Promise<DbShortcut | null> {
        const { data, error } = await getSupabase()
            .from('shortcuts')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating shortcut:', error);
            return null;
        }
        return data;
    }

    // Repo Links
    async getRepoLinks(projectId: string): Promise<DbRepoLink[]> {
        const { data, error } = await getSupabase()
            .from('repo_links')
            .select('*')
            .eq('project_id', projectId)
            .order('added_at', { ascending: true });

        if (error) {
            console.error('Error fetching repo links:', error);
            return [];
        }
        return data || [];
    }

    async addRepoLink(repoLink: { id: string; project_id: string; name: string; url: string; owner: string; repo: string; description?: string }): Promise<DbRepoLink | null> {
        const { data, error } = await getSupabase()
            .from('repo_links')
            .insert({
                id: repoLink.id,
                project_id: repoLink.project_id,
                name: repoLink.name,
                url: repoLink.url,
                owner: repoLink.owner,
                repo: repoLink.repo,
                description: repoLink.description || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding repo link:', error);
            return null;
        }
        return data;
    }

    async deleteRepoLink(id: string): Promise<boolean> {
        const { error } = await getSupabase()
            .from('repo_links')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting repo link:', error);
            return false;
        }
        return true;
    }


    // Meeting URL
    async getMeetingUrl(projectId: string): Promise<string | null> {
        const { data, error } = await getSupabase()
            .from('projects')
            .select('meeting_url')
            .eq('id', projectId)
            .single();

        if (error || !data) return null;
        return data.meeting_url || null;
    }

    async setMeetingUrl(projectId: string, meetingUrl: string | null): Promise<boolean> {
        const { error } = await getSupabase()
            .from('projects')
            .update({ meeting_url: meetingUrl })
            .eq('id', projectId);

        if (error) {
            console.error('Error updating meeting URL:', error);
            return false;
        }
        return true;
    }

    // Notifications
    async getNotifications(userId: string): Promise<Notification[]> {
        const { data, error } = await getSupabase()
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
        return (data || []).map(toNotification);
    }

    async getUnreadNotificationCount(userId: string): Promise<number> {
        const { count, error } = await getSupabase()
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) {
            console.error('Error counting unread notifications:', error);
            return 0;
        }
        return count || 0;
    }

    async addNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Promise<void> {
        const { error } = await getSupabase()
            .from('notifications')
            .insert({
                user_id: notification.userId,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                link: notification.link,
                entity_id: notification.entityId,
                project_id: notification.projectId,
            });

        if (error) {
            console.error('Error adding notification:', error);
        }
    }

    async markNotificationRead(id: string): Promise<boolean> {
        const { error } = await getSupabase()
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (error) {
            console.error('Error marking notification read:', error);
            return false;
        }
        return true;
    }

    async markAllNotificationsRead(userId: string): Promise<boolean> {
        const { error } = await getSupabase()
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) {
            console.error('Error marking all notifications read:', error);
            return false;
        }
        return true;
    }

    // Deployments
    async getDeployments(projectId: string): Promise<Deployment[]> {
        const { data, error } = await getSupabase()
            .from('deployments')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching deployments:', error);
            return [];
        }
        return (data || []).map(toDeployment);
    }

    async createDeployment(deployment: Deployment, taskIds: string[]): Promise<boolean> {
        const { error } = await getSupabase()
            .from('deployments')
            .insert({
                id: deployment.id,
                project_id: deployment.projectId,
                version: deployment.version,
                environment: deployment.environment,
                status: deployment.status,
                release_notes: deployment.releaseNotes,
                created_by: deployment.createdBy,
                created_at: deployment.createdAt,
                updated_at: deployment.updatedAt,
            });

        if (error) {
            console.error('Error creating deployment:', error);
            return false;
        }

        // Add tasks mapping
        if (taskIds.length > 0) {
            const mappings = taskIds.map(taskId => ({
                deployment_id: deployment.id,
                task_id: taskId,
                linked_at: new Date().toISOString()
            }));

            const { error: mappingError } = await getSupabase()
                .from('deployment_tasks')
                .insert(mappings);

            if (mappingError) {
                console.error('Error adding deployment tasks mapping:', mappingError);
            }
        }

        // Add activity log
        await this.createLog({
            id: crypto.randomUUID(),
            entityType: 'Project',
            entityId: deployment.projectId,
            action: 'Updated',
            details: `Deployment ${deployment.version} created for environment ${deployment.environment}.`,
            userId: deployment.createdBy,
            timestamp: new Date().toISOString()
        });

        return true;
    }

    async getTaskDeployments(taskId: string): Promise<Deployment[]> {
        const { data: mappings, error: mapErr } = await getSupabase()
            .from('deployment_tasks')
            .select('deployment_id')
            .eq('task_id', taskId);

        if (mapErr || !mappings || mappings.length === 0) return [];

        const deploymentIds = mappings.map(m => m.deployment_id);

        const { data, error } = await getSupabase()
            .from('deployments')
            .select('*')
            .in('id', deploymentIds)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching deployments for task:', error);
            return [];
        }

        return (data || []).map(toDeployment);
    }
}

const realDb = new Database();
export const db = new Proxy(realDb, {
    get(target, prop, receiver) {
        if (isDemoMode()) {
            const demoDb = getDemoDb();
            if (prop in demoDb) {
                return Reflect.get(demoDb, prop, demoDb);
            }
        }
        return Reflect.get(target, prop, receiver);
    }
});
