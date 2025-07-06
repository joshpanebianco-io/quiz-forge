import sqlite3
import json
from typing import Dict, Any

DB_PATH = "quizforge.db"

def get_db():
    return sqlite3.connect(DB_PATH)

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id INTEGER,
            question TEXT,
            correct_answer TEXT,
            options TEXT,
            FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
        )
    """)
    conn.commit()
    conn.close()

def save_quiz(quiz: Dict[str, Any]):
    conn = get_db()
    c = conn.cursor()

    c.execute("INSERT INTO quizzes (name, description) VALUES (?, ?)", (
        quiz["name"],
        quiz.get("description", "")
    ))
    quiz_id = c.lastrowid

    for q in quiz["questions"]:
        if q["type"] != "MultipleChoice":
            continue
        c.execute("""
            INSERT INTO questions (quiz_id, question, correct_answer, options)
            VALUES (?, ?, ?, ?)
        """, (
            quiz_id,
            q["question"],
            q["correctAnswer"],
            json.dumps(q["multiChoiceOptions"])
        ))

    conn.commit()
    conn.close()
    return quiz_id

def get_all_quizzes():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, name, description FROM quizzes")
    data = [{"id": r[0], "name": r[1], "description": r[2]} for r in c.fetchall()]
    conn.close()
    return data

def get_quiz_by_id(quiz_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT name, description FROM quizzes WHERE id = ?", (quiz_id,))
    row = c.fetchone()
    if not row:
        return None

    quiz = {
        "name": row[0],
        "description": row[1],
        "questions": []
    }

    c.execute("SELECT question, correct_answer, options FROM questions WHERE quiz_id = ?", (quiz_id,))
    for q in c.fetchall():
        quiz["questions"].append({
            "type": "MultipleChoice",
            "question": q[0],
            "correctAnswer": q[1],
            "multiChoiceOptions": json.loads(q[2])
        })

    conn.close()
    return quiz
