import os
import json
from typing import Dict, Any, Optional
from supabase import create_client, Client
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL2")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY2")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
def save_quiz(quiz: Dict[str, Any], user_id: str) -> int:
    res = supabase.table("quizzes").insert({
        "name": quiz["name"],
        "description": quiz.get("description", ""),
        "user_id": user_id
        
    }).execute()
    quiz_id = res.data[0]["id"]

    for q in quiz["questions"]:
        if q["type"] != "MultipleChoice":
            continue
        q_res = supabase.table("questions").insert({
            "question": q["question"],
            "correct_answer": q["correctAnswer"],
            "options": json.dumps(q["multiChoiceOptions"])
        }).execute()
        question_id = q_res.data[0]["id"]

        supabase.table("quiz_questions").insert({
            "quiz_id": quiz_id,
            "question_id": question_id
        }).execute()

    return quiz_id


def get_all_quizzes(user_id: str):
    
    res = supabase.table("quizzes").select("*").eq("user_id", user_id).execute()
    return res.data


def get_quiz_by_id(quiz_id: int, user_id: Optional[str] = None):
    query = supabase.table("quizzes").select("name, description").eq("id", quiz_id)
    if user_id:
        query = query.eq("user_id", user_id)
    quiz_res = query.single().execute()


    mapping_res = supabase.table("quiz_questions").select("question_id").eq("quiz_id", quiz_id).execute()

    question_ids = [row["question_id"] for row in mapping_res.data]

    if not question_ids:
        return {
            "id": quiz_id,
            "name": quiz_res.data["name"],
            "description": quiz_res.data["description"],
            "questions": []
        }

    questions_res = supabase.table("questions") \
        .select("id, question, correct_answer, options") \
        .in_("id", question_ids).execute()


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


def save_quiz_attempt(quiz_id: int, score: int, total_questions: int, user_id: str):
    res = supabase.table("attempts").insert({
        "quiz_id": quiz_id,
        "score": score,
        "total_questions": total_questions,
        "user_id": user_id
    }).execute()


def get_latest_attempts(user_id: Optional[str] = None):
    query = supabase.table("attempts").select("*").order("id", desc=True)
    if user_id:
        query = query.eq("user_id", user_id)
    res = query.execute()

    latest_attempts = {}
    for attempt in res.data:
        qid = attempt["quiz_id"]
        if qid not in latest_attempts:
            latest_attempts[qid] = {
                "score": attempt["score"],
                "total": attempt["total_questions"]
            }
    return latest_attempts
