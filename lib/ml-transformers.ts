/**
 * ML Transformers Service — real HuggingFace models via Inference API.
 *
 * Skill matching:   sentence-transformers/all-MiniLM-L6-v2 (sentence-similarity)
 * Priority:         facebook/bart-large-mnli               (zero-shot classification)
 *
 * Falls back to deterministic TF-IDF engine when HF API is unreachable.
 * Requires HUGGINGFACE_API_KEY or HF_API_KEY env var.
 */

const HF_BASE = 'https://router.huggingface.co/hf-inference/models';
const HF_CLASSIFIER_MODEL = 'facebook/bart-large-mnli';

function getApiKey(): string | undefined {
    return process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY;
}

/* ---------- generic HF inference ---------- */
async function hfInfer<T>(model: string, body: unknown): Promise<T | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    try {
        const url = `${HF_BASE}/${model}?wait_for_model=true`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            console.error(`[HF] ${res.status} on ${model}: ${text.slice(0, 300)}`);
            return null;
        }

        const data: T = await res.json();
        return data;
    } catch (err) {
        console.error(`[HF] fetch failed for ${model}:`, err);
        return null;
    }
}

/* ---------- deterministic fallback helpers ---------- */
const SKILL_SYNONYMS: Record<string, string[]> = {
    html5:        ['html', 'html5', 'markup', 'web', 'frontend'],
    react:        ['react', 'reactjs', 'frontend', 'ui', 'jsx', 'component', 'hook'],
    'next.js':    ['next', 'nextjs', 'react', 'ssr', 'vercel', 'frontend'],
    vue:          ['vue', 'vuejs', 'frontend', 'component'],
    angular:      ['angular', 'frontend', 'typescript'],
    javascript:   ['javascript', 'js', 'ecmascript', 'es6', 'frontend'],
    typescript:   ['typescript', 'ts', 'typed'],
    css:          ['css', 'stylesheet', 'style', 'layout', 'responsive', 'frontend'],
    'tailwind css': ['tailwind', 'tailwindcss', 'css', 'utility', 'styling'],
    figma:        ['figma', 'design', 'ui', 'ux', 'prototype', 'wireframe'],
    'framer motion': ['framer', 'framer motion', 'animation', 'react', 'motion'],
    mongodb:      ['mongodb', 'mongo', 'nosql', 'database', 'document'],
    postgresql:   ['postgresql', 'postgres', 'sql', 'database', 'relational'],
    sql:          ['sql', 'query', 'database', 'relational', 'postgresql'],
    prisma:       ['prisma', 'orm', 'database', 'query', 'postgresql'],
    mongoose:     ['mongoose', 'mongodb', 'orm', 'database'],
    supabase:     ['supabase', 'postgresql', 'realtime', 'auth', 'database', 'storage'],
    firebase:     ['firebase', 'auth', 'database', 'realtime', 'google'],
    'next-auth':  ['nextauth', 'next-auth', 'auth', 'authentication', 'oauth', 'jwt'],
    jwt:          ['jwt', 'json web token', 'auth', 'token', 'authentication'],
    python:       ['python', 'py', 'django', 'flask', 'script', 'backend'],
    node:         ['node', 'nodejs', 'backend', 'server', 'runtime', 'javascript'],
    api:          ['api', 'rest', 'graphql', 'endpoint', 'backend', 'service', 'microservice'],
    docker:       ['docker', 'container', 'devops', 'deployment'],
    git:          ['git', 'github', 'version control', 'vcs', 'repository'],
    aws:          ['aws', 'amazon', 'cloud', 'ec2', 'lambda', 's3', 'serverless'],
    testing:      ['testing', 'test', 'jest', 'vitest', 'unit test', 'integration', 'qa'],
    deployment:   ['deploy', 'deployment', 'ci', 'cd', 'release', 'pipeline', 'devops'],
};

function expandSkill(name: string): string {
    const lower = name.toLowerCase();
    const syns = SKILL_SYNONYMS[lower];
    if (syns) return `${name} — ${syns.join(', ')}`;
    return name;
}

function tokenize(text: string): string[] {
    return text.toLowerCase()
        .replace(/[^a-z0-9\s#+.-]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 1);
}

function termVec(text: string): Map<string, number> {
    const tokens = tokenize(text);
    const m = new Map<string, number>();
    for (const t of tokens) m.set(t, (m.get(t) || 0) + 1);
    return m;
}

function mapCosine(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0, nA = 0, nB = 0;
    for (const [k, v] of a) { dot += v * (b.get(k) || 0); nA += v * v; }
    for (const v of b.values()) nB += v * v;
    return dot / (Math.sqrt(nA) * Math.sqrt(nB) || 1);
}

/* ────────────────────────────────────────────────────────────────
   1. Semantic Skill Matching
   ──────────────────────────────────────────────────────────────── */
export interface SkillScore {
    skill: string;
    score: number;
}

/** Direct sentence-similarity via all-MiniLM-L6-v2 */
async function hfSkillSimilarity(
    taskText: string,
    allSkills: string[],
): Promise<number[] | null> {
    const expanded = allSkills.map(s => expandSkill(s));
    const body = {
        inputs: {
            source_sentence: taskText,
            sentences: expanded,
        },
    };

    const model = 'sentence-transformers/all-MiniLM-L6-v2';
    const result = await hfInfer<number[]>(model, body);
    return result; // null or array of scores matching sentences order
}

function deterministicSkillMatch(
    taskText: string,
    allSkills: string[],
    maxSkills: number,
    minGap: number,
): { requiredSkills: string[]; scores: SkillScore[] } {
    const tVec = termVec(taskText);

    const scores = allSkills.map(skill => {
        const expanded = expandSkill(skill);
        const sVec = termVec(expanded);

        let score = mapCosine(tVec, sVec);

        const lower = skill.toLowerCase();
        if (taskText.toLowerCase().includes(lower)) score += 0.3;

        const parts = lower.split(/[\s_-]+/).filter(t => t.length > 2);
        const matched = parts.filter(p => taskText.toLowerCase().includes(p));
        if (parts.length > 0) score += (matched.length / parts.length) * 0.2;

        return { skill, score: Math.min(1.5, score) };
    });

    scores.sort((a, b) => b.score - a.score);

    const top = scores.slice(0, maxSkills * 2);
    let bestCut = top.length, maxDrop = 0;
    for (let i = 1; i < top.length; i++) {
        const drop = top[i - 1].score - top[i].score;
        if (drop > maxDrop && drop >= minGap) { maxDrop = drop; bestCut = i; }
    }

    let requiredSkills = top.slice(0, bestCut).map(t => t.skill).slice(0, maxSkills);
    if (requiredSkills.length === 0) requiredSkills = scores.slice(0, 3).map(t => t.skill);

    return { requiredSkills, scores };
}

export async function semanticSkillMatch(
    taskText: string,
    allSkills: string[],
    maxSkills = 5,
    minGap = 0.10,
): Promise<{ requiredSkills: string[]; scores: SkillScore[] }> {
    if (allSkills.length === 0) return { requiredSkills: [], scores: [] };

    // Try HF sentence-similarity
    const hfScores = await hfSkillSimilarity(taskText, allSkills);

    if (hfScores && hfScores.length === allSkills.length) {
        // Keyword boost on top of semantic scores
        const boosted: SkillScore[] = allSkills.map((skill, i) => {
            let score = hfScores[i];

            const lower = skill.toLowerCase();
            const taskLower = taskText.toLowerCase();

            if (taskLower.includes(lower)) score += 0.2;
            const parts = lower.split(/[\s_-]+/).filter(t => t.length > 2);
            const matched = parts.filter(p => taskLower.includes(p));
            if (parts.length > 0) score += (matched.length / parts.length) * 0.15;

            return { skill, score: Math.min(1.5, score) };
        });

        boosted.sort((a, b) => b.score - a.score);

        const top = boosted.slice(0, maxSkills * 2);
        let bestCut = top.length, maxDrop = 0;
        for (let i = 1; i < top.length; i++) {
            const drop = top[i - 1].score - top[i].score;
            if (drop > maxDrop && drop >= minGap) { maxDrop = drop; bestCut = i; }
        }

        let requiredSkills = top.slice(0, bestCut).map(t => t.skill).slice(0, maxSkills);
        if (requiredSkills.length === 0) requiredSkills = boosted.slice(0, 3).map(t => t.skill);

        return { requiredSkills, scores: boosted };
    }

    return deterministicSkillMatch(taskText, allSkills, maxSkills, minGap);
}

/* ────────────────────────────────────────────────────────────────
   2. Priority Prediction — HF zero-shot with deterministic fallback
   ──────────────────────────────────────────────────────────────── */
export async function predictPriorityML(
    taskText: string,
): Promise<{ priority: string; confidence: number }> {
    const result = await hfInfer<{ label: string; score: number }[]>(HF_CLASSIFIER_MODEL, {
        inputs: taskText,
        parameters: {
            candidate_labels: [
                'critical urgent priority task',
                'high priority important task',
                'medium priority normal task',
                'low priority minor task',
            ],
        },
    });

    if (result && result.length > 0) {
        const labelMap: Record<string, string> = {
            'critical urgent priority task': 'Critical',
            'high priority important task': 'High',
            'medium priority normal task': 'Medium',
            'low priority minor task': 'Low',
        };
        return {
            priority: labelMap[result[0].label] || 'Medium',
            confidence: result[0].score,
        };
    }

    // Fallback
    const lower = taskText.toLowerCase();
    const tokens = tokenize(taskText);
    const URGENT = ['urgent', 'critical', 'immediately', 'asap', 'emergency', 'blocker', 'deadline', 'overdue', 'today', 'tomorrow', 'production', 'outage', 'down', 'broken', 'crash', 'security', 'bug', 'fix', 'hotfix'];
    const IMPORT = ['important', 'high priority', 'key', 'major', 'significant', 'required', 'blocking', 'essential', 'crucial', 'vital', 'mandatory'];
    const MINOR = ['minor', 'low priority', 'cosmetic', 'nice to have', 'optional', 'trivial', 'small', 'enhancement', 'suggestion', 'polish'];
    let uS = 0, iS = 0, mS = 0;
    for (const w of URGENT) { if (lower.includes(w)) uS += 0.25; }
    for (const w of IMPORT) { if (lower.includes(w)) iS += 0.2; }
    for (const w of MINOR) { if (lower.includes(w)) mS += 0.2; }
    uS += (taskText.match(/!/g) || []).length * 0.1;
    if (tokens.length < 8 && uS > 0) uS += 0.15;

    let priority: string, confidence: number;
    if (uS > iS && uS > mS && uS >= 0.2) {
        priority = uS >= 0.5 ? 'Critical' : 'High';
        confidence = Math.min(1, uS);
    } else if (iS > mS && iS >= 0.15) {
        priority = 'High';
        confidence = Math.min(1, iS + 0.2);
    } else if (mS >= 0.15) {
        priority = 'Low';
        confidence = Math.min(1, mS + 0.3);
    } else {
        priority = 'Medium';
        confidence = 0.5 + (tokens.length > 5 ? 0.2 : 0);
    }
    return { priority, confidence };
}

/* ────────────────────────────────────────────────────────────────
   3. Wellness Model
   ──────────────────────────────────────────────────────────────── */
const COMFORTABLE_LOAD = 4;
const PENALTY_PER_EXTRA_TASK = 5;
const PENALTY_HIGH_PRIORITY = 8;
const PENALTY_CRITICAL_URGENCY = 15;
const PENALTY_CONTEXT_SWITCH = 2;

export function calculateWellness(
    activeTasks: number,
    highPriorityCount: number,
    criticalUrgencyCount: number,
): number {
    let score = 100;
    if (activeTasks > COMFORTABLE_LOAD) {
        const extra = activeTasks - COMFORTABLE_LOAD;
        score -= extra * PENALTY_PER_EXTRA_TASK;
        score -= extra * PENALTY_CONTEXT_SWITCH;
    }
    score -= highPriorityCount * PENALTY_HIGH_PRIORITY;
    score -= criticalUrgencyCount * PENALTY_CRITICAL_URGENCY;
    return Math.max(0, Math.min(100, score));
}

export function wellnessStatus(score: number): string {
    if (score >= 80) return 'Healthy Balance';
    if (score >= 60) return 'Nearing Capacity';
    if (score >= 35) return 'Overworked';
    return 'Burnout Risk';
}

/* ────────────────────────────────────────────────────────────────
   4. Full Assignment Pipeline
   ──────────────────────────────────────────────────────────────── */
export interface CandidateInput {
    id: string;
    name: string;
    role: string;
    skills: string[];
    wellness_data?: {
        active_tasks: number;
        high_priority_count: number;
        critical_urgency_count: number;
    };
}

export interface RankedCandidate {
    id: string;
    name: string;
    match_percentage: number;
    combined_ranking_score: number;
    wellness_score: number;
    wellness_status: string;
    matching_skills: string[];
    missing_skills: string[];
}

export interface AssignmentResult {
    analysis: {
        predicted_priority: string;
        confidence_score: string;
        urgency_score: number;
        urgency_label: string;
        detected_skills: string[];
    };
    suggested_assignees: RankedCandidate[];
}

export async function analyzeAndAssignTask(
    taskText: string,
    status: string,
    daysUntilDue: number,
    daysSinceUpdate: number,
    candidates: CandidateInput[],
): Promise<AssignmentResult> {
    const { priority, confidence } = await predictPriorityML(taskText);

    const PRIORITY_SCORES: Record<string, number> = { High: 40, Medium: 20, Low: 10, Critical: 55 };
    const STATUS_MULTIPLIERS: Record<string, number> = { 'To Do': 1.2, 'In Progress': 1.0, 'In Review': 0.5, Done: 0.0 };
    let urgencyScore = PRIORITY_SCORES[priority] ?? 10;
    if (daysUntilDue <= 0) urgencyScore += 50 + Math.abs(daysUntilDue) * 10;
    else if (daysUntilDue <= 7) urgencyScore += (7 - daysUntilDue) * 5;
    if (daysSinceUpdate > 3) urgencyScore += (daysSinceUpdate - 3) * 2;
    urgencyScore = Math.round(urgencyScore * (STATUS_MULTIPLIERS[status] ?? 1.0));

    const urgencyLabel = urgencyScore === 0 ? 'Completed'
        : urgencyScore >= 80 ? 'Critical'
        : urgencyScore >= 50 ? 'High'
        : urgencyScore >= 30 ? 'Moderate'
        : 'Low';

    const allSkills = [...new Set(candidates.flatMap(c => c.skills))];
    const { requiredSkills } = await semanticSkillMatch(taskText, allSkills);
    const reqSet = new Set(requiredSkills);

    const results: RankedCandidate[] = candidates.map(p => {
        const ps = new Set(p.skills);
        const matched = [...ps].filter(s => reqSet.has(s));
        const skillMatch = reqSet.size > 0 ? (matched.length / reqSet.size) * 100 : 0;

        const wd = p.wellness_data || { active_tasks: 0, high_priority_count: 0, critical_urgency_count: 0 };
        const wScore = calculateWellness(wd.active_tasks, wd.high_priority_count, wd.critical_urgency_count);

        let combined = skillMatch * 0.6 + wScore * 0.4;
        if (reqSet.size > 0 && matched.length === 0) combined *= 0.10;

        if (p.role === 'Manager') combined *= 0.90;
        else if (p.role === 'Admin') combined *= 0.80;
        else combined *= 1.10;

        combined = Math.min(100, combined);

        return {
            id: p.id,
            name: p.name,
            match_percentage: Math.round(skillMatch * 10) / 10,
            combined_ranking_score: Math.round(combined * 10) / 10,
            wellness_score: Math.round(wScore * 10) / 10,
            wellness_status: wellnessStatus(wScore),
            matching_skills: matched,
            missing_skills: [...reqSet].filter(s => !ps.has(s)),
        };
    });

    results.sort((a, b) => b.combined_ranking_score - a.combined_ranking_score);

    return {
        analysis: {
            predicted_priority: priority,
            confidence_score: `${Math.round(confidence * 100)}%`,
            urgency_score: urgencyScore,
            urgency_label: urgencyLabel,
            detected_skills: requiredSkills,
        },
        suggested_assignees: results.slice(0, 5),
    };
}
