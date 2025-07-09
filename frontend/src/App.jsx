import React, { useState, useEffect } from "react";
import axios from "axios";

import Icon from '@mdi/react';
import { mdiTrashCan } from '@mdi/js';


const API_BASE = "https://quiz-forge.onrender.com";
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
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [loadingMock, setLoadingMock] = useState(false);



  const generateQuizFromPrompt = async () => {
    if (!context.trim()) return alert("Please enter some context.");
    setLoadingAI(true);

    try {
      const res = await axios.post(`${API_BASE}/generate`, {
        context,
        numQuestions,
      });

      const quizJSON = res.data;

      const blob = new Blob([JSON.stringify(quizJSON, null, 2)], {
        type: "application/json",
      });
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
        message += " " + err.response.data.detail;
      } else if (err.message) {
        message += " " + err.message;
      }

      alert(message);
    } finally {
      setLoadingAI(false);
    }
  };

  const generateMockExam = async () => {
    try {
      setLoadingMock(true);
      const res = await axios.post(`${API_BASE}/mock-exam`);
      alert("Mock exam created!");
      fetchQuizzes(); // Refresh list
    } catch (err) {
      alert("Failed to create mock exam");
      console.error(err);
    } finally {
      setLoadingMock(false);
    }
  };








  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    setLoadingQuizzes(true);
    try {
      const res = await axios.get(`${API_BASE}/quizzes`);
      setQuizzes(res.data);
      setCurrentPage(1); // Reset to first page on fetch
    } catch {
      alert("Failed to fetch quizzes");
    } finally {
      setLoadingQuizzes(false);
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
          <div className="flex justify-between items-center mb-3 space-x-3">
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
              className={`px-5 py-2 rounded-md text-white flex items-center justify-center space-x-2 ${loadingAI ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
            >
              {loadingAI && (
                <svg
                  className="w-5 h-5 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              )}
              <span>{loadingAI ? "Generating..." : "Generate Quiz"}</span>
            </button>

            <button
              onClick={generateMockExam}
              disabled={loadingMock}
              className={`px-5 py-2 rounded-md flex items-center justify-center space-x-2 text-white ${loadingMock ? "bg-gray-400" : "bg-gray-800 hover:bg-gray-900"
                }`}
            >
              {loadingMock && (
                <svg
                  className="w-5 h-5 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              )}
              <span>{loadingMock ? "Generating..." : "Create Mock Exam"}</span>
            </button>


          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-4">Available Quizzes</h2>
        {loadingQuizzes ? (
          <div className="flex justify-center items-center py-4">
            <div className="flex justify-center items-center space-x-2">
              <span className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce"></span>
            </div>

          </div>
        ) : quizzes.length === 0 ? (
          <p className="text-gray-500">No quizzes uploaded yet.</p>
        ) : (
          <ul className="space-y-3">
            {currentQuizzes.map((q) => (
              <li key={q.id}>
                <div className="flex items-center justify-between w-full bg-indigo-100 hover:bg-indigo-200 px-4 py-3 rounded-md transition group">
                  <button
                    onClick={() => loadQuiz(q.id)}
                    className="flex flex-col text-left w-full"
                  >
                    <span className="font-medium">{q.name}</span>
                    <span className="text-sm text-gray-600">
                      {attempts[q.id]
                        ? `Last score: ${attempts[q.id].score}/${attempts[q.id].total}`
                        : "No attempts yet"}
                    </span>
                  </button>
                  <button
                    onClick={() => deleteQuiz(q.id)}
                    className="ml-3 text-gray-400 hover:text-gray-600 transition-opacity opacity-0 group-hover:opacity-100"
                    aria-label={`Delete quiz ${q.name}`}
                  >
                    <Icon path={mdiTrashCan} size={1} />
                  </button>
                </div>
              </li>

            ))}
          </ul>
        )}


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
