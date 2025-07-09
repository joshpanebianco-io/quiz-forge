from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import json
import httpx
import os
from fastapi import Request
from models import supabase  


load_dotenv()

from models import (
    init_db, save_quiz, get_all_quizzes, get_quiz_by_id,
    save_quiz_attempt, get_latest_attempts
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


init_db()


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


@app.post("/generate")
async def generate_quiz(data: dict):
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

${context}

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
                    "HTTP-Referer": "https://joshpanebianco-io.github.io/quiz-forge",  # change if needed
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

        # Strip triple backticks if present
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
async def upload_quiz(file: UploadFile = File(...)):
    try:
        content = await file.read()
        quiz = json.loads(content)
        quiz_id = save_quiz(quiz)
        return {"message": "Quiz uploaded", "quiz_id": quiz_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/quizzes")
def list_quizzes():
    return get_all_quizzes()

@app.get("/quiz/{quiz_id}")
def get_quiz(quiz_id: int):
    quiz = get_quiz_by_id(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz

@app.post("/quiz/{quiz_id}/attempt")
def record_attempt(quiz_id: int, data: dict):
    score = data.get("score")
    total = data.get("total")
    if score is None or total is None:
        raise HTTPException(status_code=400, detail="Missing score or total.")
    save_quiz_attempt(quiz_id, score, total)
    return {"message": "Attempt recorded"}

@app.get("/attempts")
def fetch_attempts():
    return get_latest_attempts()

@app.post("/mock-exam")
async def create_mock_exam(request: Request):
    data = await request.json() if await request.body() else {}
    num_questions = data.get("numQuestions", 30)  # default 30 if not provided

    # Fetch all questions
    question_res = supabase.table("questions").select("id").execute()
    all_ids = [q["id"] for q in question_res.data]

    import random
    selected_ids = random.sample(all_ids, min(num_questions, len(all_ids)))

    # Create a new quiz
    new_quiz_res = supabase.table("quizzes").insert({
        "name": "Mock Exam",
        "description": "Randomized mock exam from all topics"
    }).execute()
    quiz_id = new_quiz_res.data[0]["id"]

    # Link selected questions to the new quiz
    for qid in selected_ids:
        supabase.table("quiz_questions").insert({
            "quiz_id": quiz_id,
            "question_id": qid
        }).execute()

    return {"message": "Mock exam created", "quiz_id": quiz_id}



# @app.post("/mock-exam")
# async def create_mock_exam(request: Request):
#     data = await request.json() if await request.body() else {}
#     num_questions = data.get("numQuestions", 30)
#     min_per_quiz = 3

#     # Fetch all quizzes
#     quizzes_res = supabase.table("quizzes").select("id").execute()
#     quiz_ids = [q["id"] for q in quizzes_res.data]

#     selected_ids = []

#     # For each quiz, get at least min_per_quiz questions
#     for quiz_id in quiz_ids:
#         q_res = supabase.table("quiz_questions").select("question_id").eq("quiz_id", quiz_id).execute()
#         question_ids = [q["question_id"] for q in q_res.data]

#         # If quiz has fewer than min_per_quiz questions, take all
#         count_to_take = min(min_per_quiz, len(question_ids))

#         selected_ids.extend(random.sample(question_ids, count_to_take))

#     # If total selected < num_questions, fill the rest randomly from all questions excluding already selected
#     if len(selected_ids) < num_questions:
#         all_q_res = supabase.table("questions").select("id").execute()
#         all_question_ids = [q["id"] for q in all_q_res.data]
#         remaining_pool = list(set(all_question_ids) - set(selected_ids))
#         remaining_needed = num_questions - len(selected_ids)
#         if remaining_needed > 0 and len(remaining_pool) > 0:
#             selected_ids.extend(random.sample(remaining_pool, min(remaining_needed, len(remaining_pool))))

#     # Create new quiz
#     new_quiz_res = supabase.table("quizzes").insert({
#         "name": "Mock Exam",
#         "description": "Randomized mock exam from all topics with minimum questions per quiz"
#     }).execute()
#     quiz_id = new_quiz_res.data[0]["id"]

#     # Link questions to the new quiz
#     for qid in selected_ids:
#         supabase.table("quiz_questions").insert({
#             "quiz_id": quiz_id,
#             "question_id": qid
#         }).execute()

#     return {"message": "Mock exam created", "quiz_id": quiz_id}


# @app.delete("/quiz/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
# def delete_quiz(quiz_id: int):
#     conn = get_db()
#     c = conn.cursor()
#     c.execute("DELETE FROM questions WHERE quiz_id = ?", (quiz_id,))
#     c.execute("DELETE FROM quizzes WHERE id = ?", (quiz_id,))
#     conn.commit()
#     conn.close()
#     return

@app.delete("/quiz/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(quiz_id: int):
    supabase.table("quiz_questions").delete().eq("quiz_id", quiz_id).execute()
    supabase.table("quizzes").delete().eq("id", quiz_id).execute()
    return


