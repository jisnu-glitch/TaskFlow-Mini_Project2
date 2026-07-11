import torch
import logging
from sentence_transformers import SentenceTransformer, util
from setfit import SetFitModel
from pydantic import BaseModel

logger = logging.getLogger(__name__)

def get_device():
    """Returns 'cuda' if available and working, otherwise 'cpu'."""
    if torch.cuda.is_available():
        try:
            # Test CUDA with a small tensor operation
            torch.zeros(1).cuda()
            return "cuda"
        except Exception as e:
            logger.warning(f"CUDA available but failed test: {e}. Falling back to CPU.")
    return "cpu"

class TaskPriorityModel:
    """
    Model used to predict priority (Low, Medium, High) from task descriptions.
    Uses SetFit (Sentence Transformer Fine-Tuning) for few-shot text classification.
    """
    ID2LABEL = {0: "Low", 1: "Medium", 2: "High"}

    def __init__(self, path):
        # Load the pre-trained SetFit model, with CPU fallback
        device = get_device()
        logger.info(f"Loading TaskPriorityModel on device: {device}")
        self.model = SetFitModel.from_pretrained(path)
        if device == "cpu":
            self.model = self.model.to(device)

    def predict(self, text):
        """Predicts the priority of a given task description."""
        probs = self.model.predict_proba([text])[0]
        confidence, pred_id = torch.max(probs, dim=0)
        return self.ID2LABEL[pred_id.item()], confidence.item()

class TaskAssigner:
    """
    Matches tasks to candidates based on semantic skill matching and wellness capacity.
    """
    def __init__(self, sentence_model):
        self.model = sentence_model

    def find_best_match(self, task_text, candidates, wellness_model=None, max_skills=5, min_gap=0.10):
        """
        Ranks candidates by matching the task description against their known skills.
        Uses cosine similarity of sentence embeddings.
        """
        # Extract all unique skills from the provided candidates
        all_skills = list({s for p in candidates for s in p.get("skills", [])})
        if not all_skills:
            return [], []

        skill_embeddings = self.model.encode(all_skills, convert_to_tensor=True)

        scores = util.cos_sim(
            self.model.encode(task_text, convert_to_tensor=True),
            skill_embeddings,
        )[0]
        ranked = sorted(zip(all_skills, scores.tolist()), key=lambda x: x[1], reverse=True)

        # Find the biggest gap in the top candidates to separate signal from noise
        top = ranked[:max_skills * 2]
        best_cut, max_drop = len(top), 0
        for i in range(1, len(top)):
            drop = top[i - 1][1] - top[i][1]
            if drop > max_drop and drop >= min_gap:
                max_drop = drop
                best_cut = i
        required = [s for s, _ in top[:best_cut]][:max_skills]
        if not required:
            required = [s for s, _ in ranked[:3]]
        req_set = set(required)

        results = []
        for p in candidates:
            ps = set(p.get("skills", []))
            matched = list(ps & req_set)
            
            # Skill Match Score (0-100)
            skill_match = (len(matched) / len(req_set) * 100) if req_set else 0.0
            
            wellness_score = 100
            if wellness_model and "wellness_data" in p:
                wd = p["wellness_data"]
                wellness_score = wellness_model.calculate(
                    wd.get("active_tasks", 0),
                    wd.get("high_priority_count", 0),
                    wd.get("critical_urgency_count", 0)
                )

            # Combined Score: We prioritize skills (60%) but wellness is a strong factor (40%)
            # This ensures we don't assign to someone just because they are free if they lack skills,
            # but we also avoid burning out someone who is a perfect skill match.
            combined_score = (skill_match * 0.6) + (wellness_score * 0.4)

            # Apply Organizational Role Preferences
            # Members are preferred (1.1x boost)
            # Managers are discouraged (-10% penalty)
            # Admins are heavily discouraged (-20% penalty)
            role = p.get("role", "Member")
            if role == "Manager":
                combined_score *= 0.90
            elif role == "Admin":
                combined_score *= 0.80
            else:
                combined_score *= 1.10
            
            # Ensure the score never exceeds 100%
            combined_score = min(100.0, combined_score)

            results.append({
                "name": p["name"],
                "id": p.get("id"),
                "match_percentage": round(skill_match, 1),
                "wellness_score": round(wellness_score, 1),
                "combined_ranking_score": round(combined_score, 1),
                "matching_skills": matched,
                "missing_skills": list(req_set - ps),
                "wellness_status": wellness_model.get_status(wellness_score) if wellness_model else "N/A"
            })
        
        # Rank by combined score
        return sorted(results, key=lambda x: x["combined_ranking_score"], reverse=True), required

class UrgencyModel:
    """
    Calculates an urgency score based on task priority, status, due date, and staleness.
    Higher scores indicate higher urgency.
    """
    PRIORITY_SCORES = {"High": 40, "Medium": 20, "Low": 10}
    STATUS_MULTIPLIERS = {"To Do": 1.2, "In Progress": 1.0, "In Review": 0.5, "Done": 0.0}

    def predict(self, priority, status, days_until_due, days_since_update):
        # Base score from priority
        score = self.PRIORITY_SCORES.get(priority, 10)
        
        # Add urgency if the task is due soon or overdue
        if days_until_due <= 0:
            score += 50 + abs(days_until_due) * 10
        elif days_until_due <= 7:
            score += (7 - days_until_due) * 5
            
        # Add urgency if the task hasn't been updated recently (staleness)
        if days_since_update > 3:
            score += (days_since_update - 3) * 2
            
        # Apply status multiplier (e.g., Done tasks have 0 urgency)
        return round(score * self.STATUS_MULTIPLIERS.get(status, 1.0), 1)

    @staticmethod
    def label(score):
        if score == 0:   return "Completed"
        if score >= 80:   return "Critical"
        if score >= 50:   return "High"
        if score >= 30:   return "Moderate"
        return "Low"

class FullTaskRequest(BaseModel):
    description: str
    status: str
    days_until_due: int
    days_since_update: int
    candidates: list[dict] = []

class WellnessRequest(BaseModel):
    active_tasks: int
    high_priority_count: int
    critical_urgency_count: int


class BottleneckTask(BaseModel):
    id: str
    projectId: str | None = None
    description: str | None = None
    status: str
    priority: str | None = None
    dueDate: str | None = None
    updatedAt: str | None = None


class BottleneckRequest(BaseModel):
    tasks: list[BottleneckTask]
