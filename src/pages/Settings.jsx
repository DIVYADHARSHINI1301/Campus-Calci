import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase/config";

export default function Settings({ darkMode, setDarkMode }) {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState({ name: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [userData, setUserData] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          setUserRole(data.role);
        }
      }
    };
    fetchUserData();
  }, []);

  // Auto-populate email and name from user profile
  useEffect(() => {
    if (auth.currentUser?.email) {
      setFeedback(prev => ({ ...prev, email: auth.currentUser.email }));
    }
    if (userData?.name) {
      setFeedback(prev => ({ ...prev, name: userData.name }));
    }
  }, [userData]);

  const showToastMessage = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!feedback.name || !feedback.email || !feedback.message) {
      showToastMessage("Please fill all fields", "error");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "feedback"), {
        name: feedback.name,
        email: feedback.email,
        message: feedback.message,
        userId: auth.currentUser?.uid || null,
        timestamp: new Date().toISOString(),
        status: "pending"
      });
      showToastMessage("Feedback submitted successfully!", "success");
      setFeedback({ name: "", email: "", message: "" });
    } catch (error) {
      showToastMessage("Failed to submit feedback", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-slate-950 dark:via-gray-950 dark:to-slate-900 transition-colors duration-300">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(userRole === "admin" ? "/admin" : "/dashboard")}
            className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
          >
            <svg className="w-5 h-5 text-gray-700 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight">Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Customize your experience</p>
          </div>
        </div>

        {/* Settings Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Appearance Section */}
          <div className="p-6 md:p-8 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">Appearance</h2>
            <div className="flex gap-3">
              <button
                onClick={() => setDarkMode(false)}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  !darkMode
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">Light</span>
                </div>
              </button>
              <button
                onClick={() => setDarkMode(true)}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  darkMode
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">Dark</span>
                </div>
              </button>
            </div>
          </div>

          {/* About Section */}
          <div className="p-6 md:p-8 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">About</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">App Version</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">1.0.0</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Developer</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">Abishek B</span>
              </div>
            </div>
          </div>

          {/* Feedback Section */}
          <div className="p-6 md:p-8">
            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">Feedback / Contact</h2>
            <form onSubmit={handleSubmitFeedback} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={feedback.name}
                  readOnly
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-600 border-2 border-slate-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-sm font-semibold outline-none cursor-not-allowed"
                />
              </div>
              <div>
                <input
                  type="email"
                  placeholder="Your Email"
                  value={feedback.email}
                  readOnly
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-600 border-2 border-slate-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-sm font-semibold outline-none cursor-not-allowed"
                />
              </div>
              <div>
                <textarea
                  placeholder="Your Message"
                  value={feedback.message}
                  onChange={(e) => setFeedback({ ...feedback, message: e.target.value })}
                  rows="4"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-500 text-gray-900 dark:text-white text-sm font-semibold outline-none transition-all resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit Feedback"}
              </button>
            </form>
          </div>
        </div>

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-20 right-4 z-50 animate-slideIn">
            <div className={`rounded-2xl p-4 shadow-2xl border-2 backdrop-blur-sm flex items-center gap-3 min-w-[300px] ${
              toastType === "success"
                ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700"
                : "bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                toastType === "success" ? "bg-emerald-500" : "bg-red-500"
              }`}>
                {toastType === "success" ? (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <p className={`text-sm font-bold ${
                toastType === "success"
                  ? "text-emerald-800 dark:text-emerald-200"
                  : "text-red-800 dark:text-red-200"
              }`}>{toastMessage}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
