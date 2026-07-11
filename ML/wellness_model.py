class WellnessModel:
    """
    Models a team member's capacity to handle work based on cognitive load and stress factors.
    Uses Agile/Kanban principles like WIP limits and prioritizes balanced workloads.
    """
    def __init__(self):
        # CONFIGURATION: Tweak these based on your team's capacity
        
        # How many standard tasks can a person comfortably hold at once? (WIP Limit)
        self.COMFORTABLE_LOAD = 4 
        
        # Penalties (Points deducted from 100)
        self.PENALTY_PER_EXTRA_TASK = 5      # For every task over the comfortable load (Volume Penalty)
        self.PENALTY_HIGH_PRIORITY = 8       # Extra stress for High Priority tasks (Stress Penalty)
        self.PENALTY_CRITICAL_URGENCY = 15   # Massive stress for Overdue/Critical tasks (Firefighting Penalty)
        self.PENALTY_CONTEXT_SWITCH = 2      # Penalty for having too many different active tasks (Cognitive Load Penalty)

    def calculate(self, active_tasks, high_priority_count, critical_urgency_count):
        """
        Calculates a Wellness/Health score (0-100).
        100 = Perfect balance. < 30 = Burnout risk.
        """
        score = 100
        
        # 1. Volume Penalty (Raw number of tasks)
        if active_tasks > self.COMFORTABLE_LOAD:
            extra_tasks = active_tasks - self.COMFORTABLE_LOAD
            score -= (extra_tasks * self.PENALTY_PER_EXTRA_TASK)
            
            # Context switching penalty (Mental drain from juggling too much)
            score -= (extra_tasks * self.PENALTY_CONTEXT_SWITCH)
            
        # 2. Stress Penalty (Priority and Urgency)
        score -= (high_priority_count * self.PENALTY_HIGH_PRIORITY)
        score -= (critical_urgency_count * self.PENALTY_CRITICAL_URGENCY)
        
        # 3. Ensure score stays within 0-100 bounds
        final_score = max(0, min(100, score))
        
        return final_score

    def get_status(self, score):
        """Returns a human-readable wellness status."""
        if score >= 80: return "Healthy Balance"
        if score >= 60: return "Nearing Capacity"
        if score >= 35: return "Overworked"
        return "Burnout Risk"

# =========================================
# TEST CASES
# =========================================
if __name__ == "__main__":
    model = WellnessModel()

    # Format: [Total Active, High Priority, Critical/Overdue]
    scenarios = [
        {"name": "Alice", "tasks": 3, "high": 0, "critical": 0, "desc": "Light workload"},
        {"name": "Bob",   "tasks": 5, "high": 1, "critical": 0, "desc": "Standard workload"},
        {"name": "Dave",  "tasks": 8, "high": 0, "critical": 0, "desc": "Juggling many minor tasks"},
        {"name": "Eve",   "tasks": 4, "high": 3, "critical": 2, "desc": "Low volume, but everything is on fire"},
        {"name": "Frank", "tasks": 10, "high": 5, "critical": 3, "desc": "Completely overwhelmed"}
    ]

    print(f"{'NAME':<6} | {'ACTIVE':<6} | {'HIGH':<4} | {'CRIT':<4} || {'SCORE':<5} | {'STATUS'}")
    print("-" * 65)

    for s in scenarios:
        score = model.calculate(s['tasks'], s['high'], s['critical'])
        status = model.get_status(score)
        print(f"{s['name']:<6} | {s['tasks']:<6} | {s['high']:<4} | {s['critical']:<4} || {score:<5} | {status}")