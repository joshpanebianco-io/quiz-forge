import os
import json
import random
import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException, status, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from supabase import create_client, Client
from models import (
    save_quiz, get_all_quizzes, get_quiz_by_id,
    save_quiz_attempt, get_latest_attempts
)
import jwt  # PyJWT or python-jose; install with pip if needed

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL2")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY2")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    try:
        # WARNING: You should verify the token signature here using your secret/public key
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token: user_id missing")
        return user_id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

@app.post("/generate")
async def generate_quiz(data: dict, user_id: str = Depends(get_current_user)):
    context = data.get("context", "").strip()
    num_questions = data.get("numQuestions", 5)

    if not context:
        raise HTTPException(status_code=400, detail="Context is required")

    prompt = f"""
You are generating a JSON quiz object in English for a quiz app. The quiz object must have:

- "name" (string): The title of the quiz. (use an appropriate title based on the context)
- "description" (string): A brief summary of the quiz topic.
- "questions" (array): A list of multiple-choice questions.

Each question in the "questions" array must have the following fields:

- "type": always set to "MultipleChoice".
- "question": a clear and concise question based on the context.
- "correctAnswer": the correct answer string.
- "multiChoiceOptions": an array of exactly 4 answer choices including the correct answer. 

{context}

Make sure questions and answers are in English, are relevant to the context, and avoid overly technical jargon unless the context demands it.

Output the entire quiz as a valid JSON object exactly in this format without additional explanation or metadata.
"""

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    
                    "X-Title": "QuizForge",
                },
                json={
                    "model": "deepseek/deepseek-r1:free",
                    "messages": [{"role": "system", "content": prompt}],
                    "temperature": 0.7,
                },
                timeout=60.0,
            )

        raw = res.json()["choices"][0]["message"]["content"].strip()

        if raw.startswith("```"):
            raw = raw.replace("```json", "").replace("```", "").strip()

        quiz = json.loads(raw)
        return quiz

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {e}")

@app.get("/")
def read_root():
    return {"Hello": "QuizForge"}

@app.post("/upload")
async def upload_quiz(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    try:
        content = await file.read()
        quiz = json.loads(content)
        quiz_id = save_quiz(quiz, user_id)
        return {"message": "Quiz uploaded", "quiz_id": quiz_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/quizzes")
def list_quizzes(user_id: str = Depends(get_current_user)):
    return get_all_quizzes(user_id)

@app.get("/quiz/{quiz_id}")
def get_quiz(quiz_id: int, user_id: str = Depends(get_current_user)):
    quiz = get_quiz_by_id(quiz_id, user_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz

@app.post("/quiz/{quiz_id}/attempt")
def record_attempt(quiz_id: int, data: dict, user_id: str = Depends(get_current_user)):
    score = data.get("score")
    total = data.get("total")
    if score is None or total is None:
        raise HTTPException(status_code=400, detail="Missing score or total.")
    save_quiz_attempt(quiz_id, score, total, user_id)
    return {"message": "Attempt recorded"}

@app.get("/attempts")
def fetch_attempts(user_id: str = Depends(get_current_user)):
    return get_latest_attempts(user_id)

@app.post("/mock-exam")
async def create_mock_exam(request: Request, user_id: str = Depends(get_current_user)):
    data = await request.json() if await request.body() else {}
    num_questions = data.get("numQuestions", 30)

    # Get all valid quiz IDs for this user only
    quiz_res = supabase.table("quizzes").select("id").eq("user_id", user_id).execute()
    valid_quiz_ids = {q["id"] for q in quiz_res.data}

    # Get all question_ids linked to valid quizzes
    mapping_res = supabase.table("quiz_questions").select("quiz_id", "question_id").execute()
    linked_question_ids = [
        row["question_id"] for row in mapping_res.data if row["quiz_id"] in valid_quiz_ids
    ]

    if not linked_question_ids:
        raise HTTPException(status_code=400, detail="No available questions for mock exam.")

    selected_ids = random.sample(linked_question_ids, min(num_questions, len(linked_question_ids)))

    new_quiz_res = supabase.table("quizzes").insert({
        "name": "Mock Exam",
        "description": "Randomized mock exam from all topics",
        "user_id": user_id
    }).execute()
    quiz_id = new_quiz_res.data[0]["id"]

    for qid in selected_ids:
        supabase.table("quiz_questions").insert({
            "quiz_id": quiz_id,
            "question_id": qid
        }).execute()

    return {"message": "Mock exam created", "quiz_id": quiz_id}

@app.delete("/quiz/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(quiz_id: int, user_id: str = Depends(get_current_user)):
    # Check quiz belongs to user
    quiz_check = supabase.table("quizzes").select("user_id").eq("id", quiz_id).single().execute()
    if not quiz_check.data or quiz_check.data.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this quiz")

    # Delete all attempts related to this quiz
    supabase.table("attempts").delete().eq("quiz_id", quiz_id).execute()

    # Get all question_ids linked to this quiz
    mapping_res = supabase.table("quiz_questions").select("question_id").eq("quiz_id", quiz_id).execute()
    question_ids = [row["question_id"] for row in mapping_res.data]

    # Delete links between quiz and questions
    supabase.table("quiz_questions").delete().eq("quiz_id", quiz_id).execute()

    # Delete the quiz
    supabase.table("quizzes").delete().eq("id", quiz_id).execute()

    # Delete questions if they're no longer used by any other quiz
    for qid in question_ids:
        links_res = supabase.table("quiz_questions").select("quiz_id").eq("question_id", qid).execute()
        if not links_res.data:
            supabase.table("questions").delete().eq("id", qid).execute()

    return {"message": f"Quiz {quiz_id} and its related data deleted."}

