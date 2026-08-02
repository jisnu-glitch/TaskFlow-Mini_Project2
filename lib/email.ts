import { IndiePitcher } from 'indiepitcher';

const indiePitcher = process.env.INDIEPITCHER_API_KEY
  ? new IndiePitcher(process.env.INDIEPITCHER_API_KEY)
  : null;

function isEmailAvailable() {
  return indiePitcher !== null;
}

export async function sendOTPEmail(to: string, otp: string) {
    try {
        if (!isEmailAvailable()) {
            console.warn('[Email] INDIEPITCHER_API_KEY not set; skipping OTP email.');
            return { success: false, skipped: true };
        }

        console.log(`[Email] Sending OTP ${otp} to ${to} via IndiePitcher...`);

        await indiePitcher!.sendEmail({
            to: to,
            subject: 'User Deletion Verification Code',
            body: `
### Verify User Deletion

You have requested to delete a user from TaskFlow. Please use the following One-Time Password (OTP) to verify this action:

## **${otp}**

This code will expire in 5 minutes. If you did not request this deletion, please ignore this email.

---
&copy; ${new Date().getFullYear()} TaskFlow. All rights reserved.
            `,
            bodyFormat: 'markdown',
        });

        console.log('[Email Success] OTP sent via IndiePitcher');
        return { success: true };
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw error;
    }
}

export async function sendProjectMemberAdded(to: string, projectName: string, addedBy?: string, projectLink?: string) {
    try {
        if (!isEmailAvailable()) {
            console.warn('[Email] INDIEPITCHER_API_KEY not set; skipping project-added email.');
            return { success: false, skipped: true };
        }

        await indiePitcher!.sendEmail({
            to,
            subject: `Added to project: ${projectName}`,
            body: `
### You've been added to a project

${addedBy ? `${addedBy} ` : ''}added you to the project **${projectName}**.

${projectLink ? `Open the project: ${projectLink}` : ''}

---
&copy; ${new Date().getFullYear()} TaskFlow
            `,
            bodyFormat: 'markdown'
        });
        return { success: true };
    } catch (err) {
        console.error('Error sending project added email:', err);
        throw err;
    }
}

export async function sendProjectMemberRemoved(to: string, projectName: string, removedBy?: string) {
    try {
        if (!isEmailAvailable()) {
            console.warn('[Email] INDIEPITCHER_API_KEY not set; skipping project-removed email.');
            return { success: false, skipped: true };
        }

        await indiePitcher!.sendEmail({
            to,
            subject: `Removed from project: ${projectName}`,
            body: `
### You've been removed from a project

${removedBy ? `${removedBy} ` : ''}removed you from the project **${projectName}**.

If you believe this was a mistake, please contact your workspace admin.

---
&copy; ${new Date().getFullYear()} TaskFlow
            `,
            bodyFormat: 'markdown'
        });
        return { success: true };
    } catch (err) {
        console.error('Error sending project removed email:', err);
        throw err;
    }
}

export async function sendTaskAssigned(
    to: string,
    taskTitle: string,
    projectName: string,
    assignedBy: string,
    taskLink: string
) {
    try {
        if (!isEmailAvailable()) {
            console.warn('[Email] INDIEPITCHER_API_KEY not set; skipping task-assigned email.');
            return { success: false, skipped: true };
        }

        await indiePitcher!.sendEmail({
            to,
            subject: `Task assigned to you: ${taskTitle}`,
            body: `
### New Task Assigned

**${assignedBy}** has assigned you to the following task in **${projectName}**:

## ${taskTitle}

[View Task](${taskLink})

---
&copy; ${new Date().getFullYear()} TaskFlow
            `,
            bodyFormat: 'markdown'
        });
        return { success: true };
    } catch (err) {
        console.error('Error sending task assigned email:', err);
        throw err;
    }
}

export async function sendTaskSwapped(
    to: string,
    taskTitle: string,
    projectName: string,
    fromUserName: string,
    toUserName: string,
    taskLink: string
) {
    try {
        if (!isEmailAvailable()) {
            console.warn('[Email] INDIEPITCHER_API_KEY not set; skipping task-swapped email.');
            return { success: false, skipped: true };
        }

        await indiePitcher!.sendEmail({
            to,
            subject: `Your task has been reassigned: ${taskTitle}`,
            body: `
### Task Reassigned

The task **${taskTitle}** in **${projectName}** has been moved from **${fromUserName}** to **${toUserName}** to balance workload.

[View Task](${taskLink})

If you have any questions, please contact your project manager.

---
&copy; ${new Date().getFullYear()} TaskFlow
            `,
            bodyFormat: 'markdown'
        });
        return { success: true };
    } catch (err) {
        console.error('Error sending task swapped email:', err);
        throw err;
    }
}

