import React, { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = "http://localhost:8000";

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

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const res = await axios.get(`${API_BASE}/quizzes`);
      setQuizzes(res.data);
    } catch {
      alert("Failed to fetch quizzes");
    }
  };

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

      // Shuffle answer options for each question here
      const shuffledQuiz = {
        ...res.data,
        questions: res.data.questions.map((q) => ({
          ...q,
          multiChoiceOptions: shuffleArray(q.multiChoiceOptions),
        })),
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
    } catch {
      alert("Failed to delete quiz");
    }
  };

  // Just store the answer, don't auto-advance
  const answerQuestion = (choice) => {
    setAnswers({ ...answers, [currentQuestionIndex]: choice });
  };

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
        <h2 className="text-2xl font-semibold mb-4">Available Quizzes</h2>
        {quizzes.length === 0 && (
          <p className="text-gray-500">No quizzes uploaded yet.</p>
        )}
        <ul className="space-y-3">
          {quizzes.map((q) => (
            <li key={q.id} className="flex justify-between items-center">
              <button
                onClick={() => loadQuiz(q.id)}
                className="flex-grow text-left px-4 py-3 bg-indigo-100 rounded-md hover:bg-indigo-200 transition"
              >
                {q.name}
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
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h2 className="text-3xl font-bold mb-6 text-center">Results for: {selectedQuiz.name}</h2>
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
                className={`p-4 rounded border ${
                  isCorrect ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"
                }`}
              >
                <p className="font-semibold mb-1">
                  {i + 1}. {q.question}
                </p>
                <p>
                  Your answer:{" "}
                  <span className={isCorrect ? "text-green-700" : "text-red-700 font-bold"}>
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
              className={`w-full text-left px-5 py-3 border rounded-md transition ${
                answers[currentQuestionIndex] === opt
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
          className={`px-6 py-3 rounded-md text-white ${
            isFirstQuestion ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          Back
        </button>

        {isLastQuestion ? (
          <button
            onClick={() => setShowResults(true)}
            disabled={answers[currentQuestionIndex] == null}
            className={`px-6 py-3 rounded-md text-white ${
              answers[currentQuestionIndex] == null
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
            className={`px-6 py-3 rounded-md text-white ${
              answers[currentQuestionIndex] == null
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
