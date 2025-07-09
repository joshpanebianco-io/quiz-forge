import os
import json
from typing import Dict, Any
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def init_db():
    # No longer needed with Supabase
    pass

def save_quiz(quiz: Dict[str, Any]):
    res = supabase.table("quizzes").insert({
        "name": quiz["name"],
        "description": quiz.get("description", "")
    }).execute()
    quiz_id = res.data[0]["id"]

    for q in quiz["questions"]:
        if q["type"] != "MultipleChoice":
            continue
        supabase.table("questions").insert({
            "quiz_id": quiz_id,
            "question": q["question"],
            "correct_answer": q["correctAnswer"],
            "options": json.dumps(q["multiChoiceOptions"])
        }).execute()

    return quiz_id

def get_all_quizzes():
    res = supabase.table("quizzes").select("id, name, description").execute()
    return res.data

def get_quiz_by_id(quiz_id: int):
    quiz_res = supabase.table("quizzes").select("name, description").eq("id", quiz_id).single().execute()
    if not quiz_res.data:
        return None

    questions_res = supabase.table("questions").select("question, correct_answer, options").eq("quiz_id", quiz_id).execute()
    
    return {
        "id": quiz_id,
        "name": quiz_res.data["name"],
        "description": quiz_res.data["description"],
        "questions": [
            {
                "type": "MultipleChoice",
                "question": q["question"],
                "correctAnswer": q["correct_answer"],
                "multiChoiceOptions": json.loads(q["options"])
            }
            for q in questions_res.data
        ]
    }

def save_quiz_attempt(quiz_id: int, score: int, total_questions: int):
    supabase.table("attempts").insert({
        "quiz_id": quiz_id,
        "score": score,
        "total_questions": total_questions
    }).execute()

def get_latest_attempts():
    # You can’t use GROUP BY MAX(id) in Supabase directly, so here's a simplified version:
    res = supabase.table("attempts").select("*").order("id", desc=True).execute()
    latest_attempts = {}
    for attempt in res.data:
        qid = attempt["quiz_id"]
        if qid not in latest_attempts:
            latest_attempts[qid] = {
                "score": attempt["score"],
                "total": attempt["total_questions"]
            }
    return latest_attempts
