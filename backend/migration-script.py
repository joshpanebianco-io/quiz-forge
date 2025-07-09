import sqlite3
import psycopg2
import json


from dotenv import load_dotenv
import os

load_dotenv()

# Set your Supabase connection info as environment variables beforehand
def get_supabase_conn():
    return psycopg2.connect(
        host=os.getenv("SUPABASE_HOST"),
        dbname=os.getenv("SUPABASE_DB"),
        user=os.getenv("SUPABASE_USER"),
        password=os.getenv("SUPABASE_PASSWORD"),
        port=os.getenv("SUPABASE_PORT", 5432),
    )

def migrate():
    # Connect to your old SQLite DB
    sqlite_conn = sqlite3.connect("quizforge.db")
    sqlite_cur = sqlite_conn.cursor()

    # Connect to your Supabase PostgreSQL DB
    supabase_conn = get_supabase_conn()
    supabase_cur = supabase_conn.cursor()

    # Fetch all quizzes from SQLite
    sqlite_cur.execute("SELECT id, name, description FROM quizzes")
    quizzes = sqlite_cur.fetchall()

    for quiz_id, name, description in quizzes:
        # Insert quiz into Supabase, get new quiz_id
        supabase_cur.execute(
            "INSERT INTO quizzes (name, description) VALUES (%s, %s) RETURNING id",
            (name, description)
        )
        new_quiz_id = supabase_cur.fetchone()[0]

        # Fetch all questions for this quiz from SQLite
        sqlite_cur.execute("SELECT question, correct_answer, options FROM questions WHERE quiz_id = ?", (quiz_id,))
        questions = sqlite_cur.fetchall()

        # Insert questions into Supabase linked to new_quiz_id
        for question, correct_answer, options_json in questions:
            supabase_cur.execute(
                "INSERT INTO questions (quiz_id, question, correct_answer, options) VALUES (%s, %s, %s, %s)",
                (new_quiz_id, question, correct_answer, options_json)
            )

    # Commit all changes
    supabase_conn.commit()

    # Close all connections
    sqlite_cur.close()
    sqlite_conn.close()
    supabase_cur.close()
    supabase_conn.close()

    print(f"Migration complete! {len(quizzes)} quizzes migrated.")

if __name__ == "__main__":
    migrate()
