# 🧠 QuizForge

**QuizForge** is a simple lightweight web-based application that allows users to upload, generate, complete, and manage multiple-choice quizzes. It supports JSON file uploads and AI model prompts to generate quizzes, automatic scoring, and question-by-question navigation with immediate results.

🔗 **Live App**: [https://joshpanebianco-io.github.io/quiz-forge/](https://joshpanebianco-io.github.io/quiz-forge/)

> ⚠️ **Note**: Does not follow good react componentisation practices. Simple tool I made to help myself study for certification exams.

---

## ✨ Features

- 🔒 OAuth (Supabase) - sign in with email, google, github
- 📤 Upload JSON files to generate quizzes.
- 🤖 Enter prompt to generate quizzes with AI
- 🎓 Create mock exam - grabs random questions from every quiz/topic
- 📚 View a list of all uploaded quizzes.
- 📝 Take quizzes with a multiple-choice interface.
- ✅ Get immediate scoring feedback upon completion.
- 🗑️ Delete quizzes from the list.

---

## 🚀 Tech Stack

### 🧠 Backend

- **FastAPI** — modern and high-performance Python web framework
- **PostgreSQL (Supabase)** - managed backend database and realtime platform
- **OpenRouter** - API platform to access AI models

### 💻 Frontend

- **React.js** — modern UI with reactive state updates
- **Tailwind CSS** — utility-first styling
- **Axios** - promise-based HTTP client

---

**Example json output from LLM:**

```json
{
  "name": "Sample Quiz",
  "description": "A simple quiz example.",
  "questions": [
    {
      "type": "MultipleChoice",
      "question": "What is 2 + 2?",
      "correctAnswer": "4",
      "multiChoiceOptions": ["3", "4", "5", "6"]
    }
  ]
}
```

---

## 📸 Screenshots

A preview of the app in action:

<img src="misc/screenshots/quiz-forge-auth1.png" width="500"/>

---

<img src="misc/screenshots/quiz-forge-quizzes.png" width="500"/>

---

<img src="misc/screenshots/quiz-forge-quiz.png" width="500"/>

---

<img src="misc/screenshots/quiz-forge-results.png" width="500"/>

---

<img src="misc/screenshots/quiz-forge-results2.png" width="500"/>



  

