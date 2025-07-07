import React, { useState, useEffect } from "react";
import axios from "axios";


const API_BASE = "http://localhost:8000";
const PAGE_SIZE = 4; // Number of quizzes per page

// Fisher-Yates shuffle algorithm to randomize answer options
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function App() {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [attempts, setAttempts] = useState({});

  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [loadingAI, setLoadingAI] = useState(false);

  const generateQuizFromPrompt = async () => {
    if (!context.trim()) return alert("Please enter some context.");
    setLoadingAI(true);

    try {
      const systemPrompt = `
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
    `;

      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "deepseek/deepseek-r1:free",
          messages: [
            { role: "system", content: systemPrompt },
          ],
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173", // Change for prod
            "X-Title": "QuizForge",
          },
        }
      );

      let raw = res.data.choices[0].message.content.trim();

      // Strip code fencing like ```json ... ```
      if (raw.startsWith("```")) {
        raw = raw.replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
      }

      const quizJSON = JSON.parse(raw);

      const blob = new Blob([JSON.stringify(quizJSON, null, 2)], { type: "application/json" });
      const formData = new FormData();
      formData.append("file", blob, "quiz.json");

      await axios.post(`${API_BASE}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Quiz generated and uploaded!");
      setPrompt("");
      setContext("");
      fetchQuizzes();
    } catch (err) {
      console.error(err);

      let message = "Failed to generate quiz.";
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === "string") {
          message += " " + err.response.data.detail;
        } else {
          message += " " + JSON.stringify(err.response.data.detail);
        }
      } else if (err.message) {
        message += " " + err.message;
      }

      alert(message);
    }
    finally {
      setLoadingAI(false);
    }
  };




  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const res = await axios.get(`${API_BASE}/quizzes`);
      setQuizzes(res.data);
      setCurrentPage(1); // Reset to first page on fetch
    } catch {
      alert("Failed to fetch quizzes");
    }
  };

  const fetchAttempts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/attempts`);
      setAttempts(res.data);
    } catch {
      console.error("Failed to fetch attempts");
    }
  };

  useEffect(() => {
    fetchQuizzes();
    fetchAttempts();
  }, []);

  useEffect(() => {
    if (showResults && selectedQuiz) {
      axios.post(`${API_BASE}/quiz/${selectedQuiz.id}/attempt`, {
        score,
        total: selectedQuiz.questions.length
      }).then(fetchAttempts).catch(() => {
        console.error("Failed to record attempt");
      });
    }
  }, [showResults]);



  const handleFileUpload = async (e) => {
    if (!e.target.files.length) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${API_BASE}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Quiz uploaded!");
      fetchQuizzes();
      e.target.value = null;
    } catch (err) {
      alert("Upload failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const loadQuiz = async (quizId) => {
    try {
      const res = await axios.get(`${API_BASE}/quiz/${quizId}`);

      // Shuffle both the questions and their options
      const shuffledQuiz = {
        ...res.data,
        questions: shuffleArray(
          res.data.questions.map((q) => ({
            ...q,
            multiChoiceOptions: shuffleArray(q.multiChoiceOptions),
          }))
        ),
      };

      setSelectedQuiz(shuffledQuiz);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setShowResults(false);
    } catch {
      alert("Failed to load quiz");
    }
  };

  const deleteQuiz = async (quizId) => {
    if (!window.confirm("Are you sure you want to delete this quiz?")) return;
    try {
      await axios.delete(`${API_BASE}/quiz/${quizId}`);
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      if (selectedQuiz && selectedQuiz.id === quizId) {
        setSelectedQuiz(null);
        setShowResults(false);
      }
      // Adjust currentPage if necessary (optional)
      const newTotalPages = Math.ceil((quizzes.length - 1) / PAGE_SIZE);
      if (currentPage > newTotalPages) setCurrentPage(newTotalPages);
    } catch {
      alert("Failed to delete quiz");
    }
  };

  const answerQuestion = (choice) => {
    setAnswers({ ...answers, [currentQuestionIndex]: choice });
  };

  // Pagination logic
  const totalPages = Math.ceil(quizzes.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const currentQuizzes = quizzes.slice(startIndex, startIndex + PAGE_SIZE);

  const score = selectedQuiz
    ? selectedQuiz.questions.reduce(
      (acc, q, i) => (answers[i] === q.correctAnswer ? acc + 1 : acc),
      0
    )
    : 0;

  if (!selectedQuiz) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-4xl font-extrabold text-center text-indigo-600 mb-6">
          QuizForge
        </h1>
        <label className="block mb-6">
          <span className="sr-only">Upload Quiz JSON</span>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 file:text-indigo-700
              hover:file:bg-indigo-100
            "
          />
        </label>
        <div className="mb-6">
          <label className="block text-lg font-medium mb-2">Generate Quiz from AI</label>
          <textarea
            rows={2}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Enter context for the quiz..."
            className="w-full p-3 border rounded-md mb-3"
          />
          <div className="flex items-center mb-3 space-x-3">
            {/* <input
              type="number"
              min={1}
              max={50}
              value={numQuestions}
              onChange={(e) => setNumQuestions(parseInt(e.target.value))}
              className="w-20 px-3 py-2 border rounded-md"
            /> */}
            <button
              onClick={generateQuizFromPrompt}
              disabled={loadingAI}
              className={`px-5 py-2 rounded-md text-white ${loadingAI ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
            >
              {loadingAI ? "Generating..." : "Generate Quiz"}
            </button>
          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-4">Available Quizzes</h2>
        {quizzes.length === 0 && (
          <p className="text-gray-500">No quizzes uploaded yet.</p>
        )}
        <ul className="space-y-3">
          {currentQuizzes.map((q) => (
            <li key={q.id} className="flex justify-between items-center">
              <button
                onClick={() => loadQuiz(q.id)}
                className="flex-grow text-left px-4 py-3 bg-indigo-100 rounded-md hover:bg-indigo-200 transition"
              >
                <div>
                  <div>{q.name}</div>
                  <div className="text-sm text-gray-600">
                    {attempts[q.id]
                      ? `Last score: ${attempts[q.id].score}/${attempts[q.id].total}`
                      : "No attempts yet"}
                  </div>
                </div>

              </button>
              <button
                onClick={() => deleteQuiz(q.id)}
                className="ml-4 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                aria-label={`Delete quiz ${q.name}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6 space-x-3">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-md text-white ${currentPage === 1 ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
            >
              Prev
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-4 py-2 rounded-md text-white ${currentPage === i + 1 ? "bg-indigo-800" : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded-md text-white ${currentPage === totalPages ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h2 className="text-3xl font-bold mb-6 text-center">
          Results for: {selectedQuiz.name}
        </h2>
        <p className="text-lg mb-6 text-center">
          You scored{" "}
          <span className="font-semibold text-indigo-600">{score}</span> out of{" "}
          {selectedQuiz.questions.length}
        </p>
        <div className="space-y-6">
          {selectedQuiz.questions.map((q, i) => {
            const userAnswer = answers[i];
            const isCorrect = userAnswer === q.correctAnswer;
            return (
              <div
                key={i}
                className={`p-4 rounded border ${isCorrect
                    ? "border-green-400 bg-green-50"
                    : "border-red-400 bg-red-50"
                  }`}
              >
                <p className="font-semibold mb-1">
                  {i + 1}. {q.question}
                </p>
                <p>
                  Your answer:{" "}
                  <span
                    className={isCorrect ? "text-green-700" : "text-red-700 font-bold"}
                  >
                    {userAnswer || <em>No answer</em>}
                  </span>
                </p>
                {!isCorrect && (
                  <p>
                    Correct answer: <span className="font-semibold">{q.correctAnswer}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-center mt-8">
          <button
            onClick={() => {
              setSelectedQuiz(null);
              setShowResults(false);
            }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
          >
            Back to quizzes
          </button>
        </div>
      </div>
    );
  }

  const question = selectedQuiz.questions[currentQuestionIndex];
  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastQuestion = currentQuestionIndex === selectedQuiz.questions.length - 1;

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-2 text-indigo-700">{selectedQuiz.name}</h2>
      {selectedQuiz.description && (
        <p className="mb-4 text-gray-600">{selectedQuiz.description}</p>
      )}
      <hr className="mb-4" />
      <p className="mb-2 font-semibold">
        Question {currentQuestionIndex + 1} of {selectedQuiz.questions.length}
      </p>
      <h3 className="text-xl mb-6 font-semibold">{question.question}</h3>
      <ul className="space-y-3 mb-6">
        {question.multiChoiceOptions.map((opt, i) => (
          <li key={i}>
            <button
              onClick={() => answerQuestion(opt)}
              className={`w-full text-left px-5 py-3 border rounded-md transition ${answers[currentQuestionIndex] === opt
                  ? "border-indigo-600 bg-indigo-100"
                  : "border-indigo-400 hover:bg-indigo-100"
                }`}
            >
              {opt}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex justify-between">
        <button
          onClick={() => {
            if (!isFirstQuestion) setCurrentQuestionIndex(currentQuestionIndex - 1);
          }}
          disabled={isFirstQuestion}
          className={`px-6 py-3 rounded-md text-white ${isFirstQuestion ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
        >
          Back
        </button>

        {isLastQuestion ? (
          <button
            onClick={() => setShowResults(true)}
            disabled={answers[currentQuestionIndex] == null}
            className={`px-6 py-3 rounded-md text-white ${answers[currentQuestionIndex] == null
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
              }`}
          >
            Submit
          </button>
        ) : (
          <button
            onClick={() => {
              if (!isLastQuestion && answers[currentQuestionIndex] != null)
                setCurrentQuestionIndex(currentQuestionIndex + 1);
            }}
            disabled={answers[currentQuestionIndex] == null}
            className={`px-6 py-3 rounded-md text-white ${answers[currentQuestionIndex] == null
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
              }`}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
