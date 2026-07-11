ML Folder — TaskFlow
=====================

This document explains the purpose, components, and runtime behavior of the legacy `ML/` folder. It describes the Python FastAPI service and the supporting models used for priority prediction, assignment, urgency scoring, wellness, and bottleneck detection.

Files
-----
- `main.py` — FastAPI server that exposes endpoints used by the UI or experiments:
  - `POST /analyze_task` — returns priority, urgency, detected skills, and suggested assignees for a given task payload.
  - `POST /analyze_wellness` — returns a wellness score and status for a user's workload inputs.
  - `POST /analyze_bottlenecks` — analyzes a list of tasks to detect process bottlenecks (WIP breaches, overdue, aging WIP) and computes an overall health score.
  - `GET /` — health check.

- `models.py` — core model classes and request schemas:
  - `get_device()` — checks GPU availability, falls back to CPU on failure.
  - `TaskPriorityModel` — SetFit-based classifier for predicting task priority (Low/Medium/High). Loads model from `my_setfit_model`.
  - `TaskAssigner` — semantic skill-matching and candidate ranking using sentence-transformers embeddings, combined with wellness scores and simple role-based multipliers.
  - `UrgencyModel` — deterministic urgency scoring by priority, due-date proximity, staleness, and status multipliers. Also provides a `label()` helper to map numeric score to descriptive label.
  - Pydantic request models: `FullTaskRequest`, `WellnessRequest`, `BottleneckRequest` + `BottleneckTask`.

- `wellness_model.py` — deterministic wellness calculator:
  - `WellnessModel.calculate(active_tasks, high_priority_count, critical_urgency_count)` returns 0–100 wellness score.
  - `get_status(score)` returns human label ("Healthy Balance", "Nearing Capacity", "Overworked", "Burnout Risk").
  - Tunable constants in the class define comfortable load and penalty weights.

- `requirements.txt` — Python dependencies used to run this service (SetFit, sentence-transformers, FastAPI, torch, etc.).

- `data.txt` — sample or archived data (inspect for training notes).

How the pieces fit
------------------
1. `main.py` initializes models on startup:
   - Loads `TaskPriorityModel` from `MODEL_PATH` (SetFit model directory).
   - Loads a `SentenceTransformer` model from `SKILL_MODEL_PATH` for semantic skill embeddings.
   - Instantiates `TaskAssigner`, `UrgencyModel`, and `WellnessModel`.
   - `get_device()` decides whether to use `cuda` or `cpu`.

2. `POST /analyze_task` flow:
   - Reads a `FullTaskRequest` including `description`, `status`, `days_until_due`, `days_since_update`, and `candidates` (list of users and skills + wellness data).
   - Calls `priority_ai.predict(task.description)` to get predicted priority and confidence (SetFit).
   - Uses `assigner_ai.find_best_match(...)` which:
     - Encodes candidate skill lists and the task description into embeddings.
     - Computes cosine similarity to rank skills and extract required skills.
     - Scores each candidate by skill overlap and their wellness score (if provided), applies role multipliers, produces `combined_ranking_score`.
   - Uses `urgency_ai.predict(...)` to compute a numeric urgency score and label.
   - Returns analysis + top suggested assignees (up to 5).

3. `POST /analyze_wellness` and `wellness_model.py`:
   - `WellnessModel.calculate` is deterministic and uses configurable penalties and a comfortable load constant.
   - Provides a reliable, explainable wellness score for a user given active/high/critical counts.

4. `POST /analyze_bottlenecks`:
   - This endpoint is rule-based and does not rely on heavy ML models.
   - Computes overdue tasks per project, WIP limit breaches for key statuses, and aging WIP (stale tasks). It returns a list of detected bottlenecks, a health score and summary. It is useful as a companion to the main assignment/priority flows.

Design notes & runtime behavior
-------------------------------
- Hybrid design: the folder runs an optional ML API server (Python) that uses SetFit and sentence-transformers when available. However the main Next.js app implements TypeScript fallbacks (`lib/ml-engine.ts` and `lib/ml-transformers.ts`) that reproduce similar heuristics so the web app does not strictly depend on this Python service.

- Device detection: `get_device()` attempts a GPU test and falls back to CPU to avoid startup errors on machines with misconfigured CUDA.

- Role weighting in assignment: the assigner intentionally boosts Members (1.1x) and reduces Manager/Admin combined scores to avoid assigning cross-role responsibilities by default.

- Explainability: Most scoring logic in `models.py` and `wellness_model.py` is explicit and deterministic, making it easy to tweak penalties and thresholds for team preferences.

Run locally (development)
-------------------------
1. Create a Python virtual environment and install deps:

```bash
python -m venv .venv
# PowerShell
.\.venv\Scripts\Activate.ps1
# or Bash
# source .venv/bin/activate
pip install -r ML/requirements.txt
```

2. Prepare models and assets:
- Place a SetFit model export under `ML/my_setfit_model/` (or update `MODEL_PATH` in `main.py`).
- Place a sentence-transformers model under `ML/skill_matcher_model/` (or update `SKILL_MODEL_PATH`).

If you do not have models locally, most endpoints that rely on them will fail; these modules are often used for offline experiments or higher-quality enrichment.

3. Start the FastAPI server (dev):

```bash
cd ML
python main.py
# or
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Endpoint examples
-----------------
- Analyze a task (JSON payload):

POST http://127.0.0.1:8000/analyze_task
Content-Type: application/json

{
  "description": "Improve DB query performance for invoice search",
  "status": "To Do",
  "days_until_due": 2,
  "days_since_update": 5,
  "candidates": [
    {"id":"u1","name":"Alex","role":"Member","skills":["sql","postgres"],"wellness_data":{"active_tasks":3,"high_priority_count":1,"critical_urgency_count":0}},
    {"id":"u2","name":"Jamie","role":"Member","skills":["frontend","react"],"wellness_data":{"active_tasks":1,"high_priority_count":0,"critical_urgency_count":0}}
  ]
}

Response includes `analysis` (priority, confidence, urgency) and `suggested_assignees`.

Maintenance notes
-----------------
- The Python `ML/` service is useful for experiments and can be deployed separately for heavier inference.
- The main Next.js app contains `lib/ml-transformers.ts` and `lib/ml-engine.ts` which implement TypeScript-based heuristics and optional HF calls; prefer updating those for runtime app behavior.
- The SetFit model format should be exported from the SetFit training workflow and placed under `my_setfit_model`.

Questions or follow-ups
----------------------
- Want a sequence diagram showing request -> Python ML server -> models -> response? I can generate it.
- Want me to add a short `health-check` script or a minimal `dockerfile` for this service?

