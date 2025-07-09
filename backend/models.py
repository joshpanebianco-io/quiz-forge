import os
import psycopg2
import json
from typing import Dict, Any

def get_db():
    return psycopg2.connect(
        host=os.getenv("SUPABASE_HOST"),
        dbname=os.getenv("SUPABASE_DB"),
        user=os.getenv("SUPABASE_USER"),
        password=os.getenv("SUPABASE_PASSWORD"),
        port=os.getenv("SUPABASE_PORT", 5432),
    )

def init_db():
    # Assume you ran migrations manually on Supabase, so no init here
    pass

def save_quiz(quiz: Dict[str, Any]):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO quizzes (name, description) VALUES (%s, %s) RETURNING id",
        (quiz["name"], quiz.get("description", ""))
    )
    quiz_id = cur.fetchone()[0]

    for q in quiz["questions"]:
        if q["type"] != "MultipleChoice":
            continue
        cur.execute(
            """INSERT INTO questions (quiz_id, question, correct_answer, options)
               VALUES (%s, %s, %s, %s)""",
            (quiz_id, q["question"], q["correctAnswer"], json.dumps(q["multiChoiceOptions"]))
        )
    conn.commit()
    cur.close()
    conn.close()
    return quiz_id

def get_all_quizzes():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, name, description FROM quizzes")
    data = [{"id": r[0], "name": r[1], "description": r[2]} for r in cur.fetchall()]
    cur.close()
    conn.close()
    return data

def get_quiz_by_id(quiz_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT name, description FROM quizzes WHERE id = %s", (quiz_id,))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return None

    quiz = {
        "id": quiz_id,
        "name": row[0],
        "description": row[1],
        "questions": []
    }

    cur.execute("SELECT question, correct_answer, options FROM questions WHERE quiz_id = %s", (quiz_id,))
    for q in cur.fetchall():
        quiz["questions"].append({
            "type": "MultipleChoice",
            "question": q[0],
            "correctAnswer": q[1],
            "multiChoiceOptions": json.loads(q[2])
        })
    cur.close()
    conn.close()
    return quiz

def save_quiz_attempt(quiz_id: int, score: int, total_questions: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO attempts (quiz_id, score, total_questions)
           VALUES (%s, %s, %s)""",
        (quiz_id, score, total_questions)
    )
    conn.commit()
    cur.close()
    conn.close()

def get_latest_attempts():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT quiz_id, score, total_questions
        FROM attempts
        WHERE id IN (
            SELECT MAX(id)
            FROM attempts
            GROUP BY quiz_id
        )
    """)
    result = {row[0]: {"score": row[1], "total": row[2]} for row in cur.fetchall()}
    cur.close()
    conn.close()
    return result
