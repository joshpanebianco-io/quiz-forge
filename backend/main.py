from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import json
from models import (
    init_db, save_quiz, get_all_quizzes, get_quiz_by_id,
    save_quiz_attempt, get_latest_attempts, get_db
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

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

@app.delete("/quiz/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(quiz_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM questions WHERE quiz_id = ?", (quiz_id,))
    c.execute("DELETE FROM quizzes WHERE id = ?", (quiz_id,))
    conn.commit()
    conn.close()
    return
