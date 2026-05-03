import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase/config";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { getAllRegNos } from "../utils/testRegNo";

export default function Register() {
  const location = useLocation();
  const prefill = location.state || {};
  const isGoogle = !!prefill.fromGoogle;

  const [colleges, setColleges] = useState([]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: prefill.name || "",
    regNo: "",
    collegeId: "",
    dept: "",
    academicYear: "",
    username: "",
    password: "",
  });
  const [departments, setDepartments] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: "", color: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingRegNo, setIsCheckingRegNo] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const navigate = useNavigate();

  // Force light mode on register page
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    return () => {
      // Restore dark mode preference when leaving register page
      const savedDarkMode = localStorage.getItem('darkMode');
      if (savedDarkMode === 'true') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  const validateName = (name) => {
    const nameRegex = /^[a-zA-Z\s.]+$/;
    return nameRegex.test(name) && name.trim().length >= 2;
  };

  const validateRegNo = (regNo) => {
    const regNoRegex = /^[A-Z0-9]+$/i;
    return regNoRegex.test(regNo) && regNo.length === 13;
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkPasswordStrength = (password) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 1) return { score, text: "Weak", color: "text-red-500" };
    if (score <= 3) return { score, text: "Medium", color: "text-yellow-500" };
    return { score, text: "Strong", color: "text-green-500" };
  };

  const handleNameBlur = () => {
    if (!form.name.trim()) {
      setValidationErrors(prev => ({...prev, name: "Name is required"}));
    } else if (!validateName(form.name)) {
      setValidationErrors(prev => ({...prev, name: "Name should only contain letters and spaces"}));
    } else {
      setValidationErrors(prev => ({...prev, name: ""}));
    }
  };

  const handleRegNoBlur = async () => {
    if (!form.regNo.trim()) {
      setValidationErrors(prev => ({...prev, regNo: "Registration number is required"}));
      return;
    }
    
    if (!validateRegNo(form.regNo)) {
      setValidationErrors(prev => ({...prev, regNo: "Registration number must be exactly 13 characters"}));
      return;
    }
    
    setIsCheckingRegNo(true);
    try {
      const isDuplicate = await checkDuplicateRegNo(form.regNo);
      if (isDuplicate) {
        setValidationErrors(prev => ({...prev, regNo: `Registration number ${form.regNo.toUpperCase()} is already registered`}));
      } else {
        setValidationErrors(prev => ({...prev, regNo: ""}));
      }
    } catch (error) {
      console.error("Error checking regNo:", error);
    } finally {
      setIsCheckingRegNo(false);
    }
  };

  const handleEmailBlur = async () => {
    if (!form.username.trim()) {
      setValidationErrors(prev => ({...prev, username: "Email is required"}));
      return;
    }
    
    if (!validateEmail(form.username)) {
      setValidationErrors(prev => ({...prev, username: "Please enter a valid email address"}));
      return;
    }
    
    setIsCheckingEmail(true);
    try {
      const isDuplicate = await checkDuplicateEmail(form.username);
      if (isDuplicate) {
        setValidationErrors(prev => ({...prev, username: "Email is already registered. Try logging in."}));
      } else {
        setValidationErrors(prev => ({...prev, username: ""}));
      }
    } catch (error) {
      console.error("Error checking email:", error);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const checkDuplicateRegNo = async (regNo) => {
    try {
      const allRegNos = await getAllRegNos();
      const normalizedInput = regNo.trim().toUpperCase();
      const duplicate = allRegNos.find(u => u.regNo.trim().toUpperCase() === normalizedInput);
      return !!duplicate;
    } catch (error) {
      console.error("Error checking duplicate regNo:", error);
      return false;
    }
  };

  const checkDuplicateEmail = async (email) => {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email.trim().toLowerCase()));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error("Error checking duplicate email:", error);
      return false;
    }
  };

  const validateStep1 = async () => {
    const errors = {};
    
    if (!form.name.trim()) {
      errors.name = "Name is required";
    } else if (!validateName(form.name)) {
      errors.name = "Name should only contain letters and spaces";
    }
    
    if (!form.regNo.trim()) {
      errors.regNo = "Registration number is required";
    } else if (!validateRegNo(form.regNo)) {
      errors.regNo = "Registration number must be exactly 13 characters";
    } else {
      // Check for duplicate registration number
      try {
        const isDuplicate = await checkDuplicateRegNo(form.regNo);
        if (isDuplicate) {
          errors.regNo = `Registration number ${form.regNo.toUpperCase()} is already registered`;
        }
      } catch (error) {
        console.error("Error during duplicate check:", error);
        errors.regNo = "Unable to verify registration number. Please try again.";
      }
    }
    
    if (!form.collegeId) {
      errors.collegeId = "Please select a college";
    }
    
    if (!form.dept) {
      errors.dept = "Please select a department";
    }
    
    if (!form.academicYear) {
      errors.academicYear = "Please select an academic year";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = async () => {
    const errors = {};
    
    if (!form.username.trim()) {
      errors.username = "Email is required";
    } else if (!validateEmail(form.username)) {
      errors.username = "Please enter a valid email address";
    } else {
      const isDuplicate = await checkDuplicateEmail(form.username);
      if (isDuplicate) {
        errors.username = "Email is already registered. Try logging in.";
      }
    }
    
    if (!form.password) {
      errors.password = "Password is required";
    } else if (form.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    } else if (passwordStrength.score < 2) {
      errors.password = "Password is too weak. Add numbers or special characters";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    getDocs(collection(db, "colleges")).then((snap) =>
      setColleges(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, []);

  useEffect(() => {
    if (!form.collegeId) { setDepartments([]); setAcademicYears([]); return; }
    const col = colleges.find((c) => c.id === form.collegeId);
    const depts = Object.keys(col?.departments || {}).sort();
    setDepartments(depts);
    setForm((f) => ({ ...f, dept: "", academicYear: "" }));
  }, [form.collegeId, colleges]);

  useEffect(() => {
    if (!form.collegeId || !form.dept) { setAcademicYears([]); return; }
    const col = colleges.find((c) => c.id === form.collegeId);
    const yearMap = col?.departments?.[form.dept]?.academicYears || {};
    const years = Object.keys(yearMap).sort();
    setAcademicYears(years);
    setForm((f) => ({ ...f, academicYear: years[0] || "" }));
  }, [form.collegeId, form.dept, colleges]);

  const set = (k) => (e) => {
    const value = e.target.value;
    setForm({ ...form, [k]: value });
    setValidationErrors(prev => ({...prev, [k]: ""}));
    
    if (k === "password") {
      setPasswordStrength(checkPasswordStrength(value));
    }
  };

  const saveUserDoc = async (uid, email, extra = {}) => {
    await setDoc(doc(db, "users", uid), {
      name: form.name,
      regNo: form.regNo.toUpperCase(),
      collegeId: form.collegeId,
      dept: form.dept,
      academicYear: form.academicYear,
      email,
      role: "student",
      ...extra,
    });
    navigate("/dashboard");
  };

  const handleStep1 = async (e) => {
    e.preventDefault();
    setError("");
    setValidationErrors({});
    
    setLoading(true);
    const isValid = await validateStep1();
    setLoading(false);
    
    if (!isValid) {
      return;
    }
    
    if (isGoogle) handleGoogleSave();
    else setStep(2);
  };

  const handleGoogleSave = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      const uid = user?.uid || prefill.uid;
      const email = user?.email || prefill.email;
      if (!uid) { setError("Session expired. Please go back and try again."); setLoading(false); return; }
      
      // Check for duplicate registration number before saving
      const isDuplicate = await checkDuplicateRegNo(form.regNo);
      if (isDuplicate) {
        setValidationErrors({ regNo: `Registration number ${form.regNo.toUpperCase()} is already registered` });
        setLoading(false);
        return;
      }
      
      await saveUserDoc(uid, email);
    } catch {
      setError("Google signup failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualRegister = async (e) => {
    e.preventDefault();
    setError("");
    setValidationErrors({});
    
    setLoading(true);
    const isValid = await validateStep2();
    setLoading(false);
    
    if (!isValid) {
      return;
    }
    
    setLoading(true);
    try {
      // Double-check for duplicate registration number before creating account
      const isDuplicate = await checkDuplicateRegNo(form.regNo);
      if (isDuplicate) {
        setStep(1);
        setValidationErrors({ regNo: `Registration number ${form.regNo.toUpperCase()} is already registered` });
        setLoading(false);
        return;
      }
      
      const { user } = await createUserWithEmailAndPassword(auth, form.username.trim(), form.password);
      await saveUserDoc(user.uid, user.email);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") setError("Email already registered. Try logging in.");
      else if (err.code === "auth/weak-password") setError("Password must be at least 6 characters.");
      else if (err.code === "auth/invalid-email") setError("Enter a valid email address.");
      else setError("Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full border-2 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3.5 text-sm sm:text-base dark:bg-gray-700/50 dark:text-white focus:outline-none focus:ring-4 transition-all font-medium";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 py-8 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>
      
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-6 sm:p-12 w-full max-w-md relative z-10">
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl sm:rounded-3xl mb-3 sm:mb-5 shadow-2xl shadow-blue-500/40 transform hover:scale-105 transition-transform duration-300">
            <svg className="w-7 h-7 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent mb-2 sm:mb-3">
            Create Account
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm font-medium">Join us to track your academic progress</p>
        </div>

        {!isGoogle && (
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-10">
            <div className={`flex items-center gap-1.5 sm:gap-2.5 transition-all duration-300 ${
              step === 1 ? "text-blue-600 dark:text-blue-400 scale-105" : "text-green-600 dark:text-green-400"
            }`}>
              <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center text-xs sm:text-sm font-bold shadow-xl transition-all duration-300 ${
                step === 1 ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white" : "bg-gradient-to-br from-green-500 to-green-600 text-white"
              }`}>
                {step > 1 ? (
                  <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : "1"}
              </div>
              <span className="text-[10px] sm:text-xs font-bold">Details</span>
            </div>
            <div className={`h-1 sm:h-1.5 w-12 sm:w-20 rounded-full transition-all duration-500 ${
              step === 2 ? "bg-gradient-to-r from-blue-500 to-blue-600" : "bg-gray-200 dark:bg-gray-700"
            }`} />
            <div className={`flex items-center gap-1.5 sm:gap-2.5 transition-all duration-300 ${
              step === 2 ? "text-blue-600 dark:text-blue-400 scale-105" : "text-gray-400 dark:text-gray-500"
            }`}>
              <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center text-xs sm:text-sm font-bold shadow-xl transition-all duration-300 ${
                step === 2 ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500"
              }`}>
                2
              </div>
              <span className="text-[10px] sm:text-xs font-bold">Account</span>
            </div>
          </div>
        )}

        {isGoogle && (
          <div className="flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700/50 dark:to-gray-600/50 border-2 border-blue-200 dark:border-gray-600 rounded-xl sm:rounded-2xl px-3 sm:px-5 py-3 sm:py-4 mb-5 sm:mb-8 text-xs sm:text-sm text-gray-700 dark:text-gray-300 shadow-lg">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 sm:w-6 sm:h-6" alt="Google" />
            <span>Signing up with <strong className="text-gray-900 dark:text-white font-bold">{prefill.email}</strong></span>
          </div>
        )}

        {error && (
          <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-l-4 border-red-500 rounded-xl p-3 sm:p-4 text-red-700 dark:text-red-300 text-xs sm:text-sm mb-4 sm:mb-6 flex items-start gap-2 sm:gap-3 shadow-lg">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-3 sm:space-y-5">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
              <input 
                type="text" 
                placeholder="Enter your full name" 
                value={form.name} 
                onChange={set("name")}
                onBlur={handleNameBlur}
                className={`${inputCls} ${
                  validationErrors.name 
                    ? "border-red-400 focus:ring-red-200 dark:focus:ring-red-900/50" 
                    : "border-gray-200 dark:border-gray-600 focus:ring-blue-100 dark:focus:ring-blue-900/50 focus:border-blue-500"
                }`}
              />
              {validationErrors.name && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-2 ml-1 flex items-center gap-1.5 font-medium">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.name}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Registration Number</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="e.g., 727824TUIT004" 
                  value={form.regNo} 
                  onChange={set("regNo")}
                  onBlur={handleRegNoBlur}
                  className={`${inputCls} uppercase ${
                    validationErrors.regNo 
                      ? "border-red-400 focus:ring-red-200 dark:focus:ring-red-900/50" 
                      : "border-gray-200 dark:border-gray-600 focus:ring-blue-100 dark:focus:ring-blue-900/50 focus:border-blue-500"
                  }`}
                />
                {isCheckingRegNo && (
                  <div className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center">
                    <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
              {validationErrors.regNo && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-2 ml-1 flex items-center gap-1.5 font-medium">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.regNo}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">College</label>
              <select 
                value={form.collegeId} 
                onChange={set("collegeId")} 
                className={`${inputCls} ${
                  validationErrors.collegeId 
                    ? "border-red-400 focus:ring-red-200 dark:focus:ring-red-900/50" 
                    : "border-gray-200 dark:border-gray-600 focus:ring-blue-100 dark:focus:ring-blue-900/50 focus:border-blue-500"
                }`}
              >
                <option value="">Select your college</option>
                {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {validationErrors.collegeId && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-2 ml-1 flex items-center gap-1.5 font-medium">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.collegeId}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Department</label>
              <select 
                value={form.dept} 
                onChange={set("dept")} 
                disabled={!departments.length}
                className={`${inputCls} ${
                  validationErrors.dept 
                    ? "border-red-400 focus:ring-red-200 dark:focus:ring-red-900/50" 
                    : "border-gray-200 dark:border-gray-600 focus:ring-blue-100 dark:focus:ring-blue-900/50 focus:border-blue-500"
                }`}
              >
                <option value="">Select your department</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {validationErrors.dept && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-2 ml-1 flex items-center gap-1.5 font-medium">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.dept}
                </p>
              )}
            </div>
            
            {academicYears.length > 0 && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2.5">Academic Year</label>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {academicYears.map((y) => (
                    <button type="button" key={y}
                      onClick={() => { setForm((f) => ({ ...f, academicYear: y })); setValidationErrors(prev => ({...prev, academicYear: ""})); }}
                      className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold border-2 transition-all duration-300 shadow-md ${
                        form.academicYear === y
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600 shadow-blue-500/40 transform scale-105"
                          : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 hover:scale-105"
                      }`}>
                      {y} - {parseInt(y) + 4}
                    </button>
                  ))}
                </div>
                {validationErrors.academicYear && (
                  <p className="text-red-600 dark:text-red-400 text-xs mt-2 ml-1 flex items-center gap-1.5 font-medium">
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {validationErrors.academicYear}
                  </p>
                )}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800 text-white font-bold py-3 sm:py-4 text-sm sm:text-base rounded-xl transition-all duration-300 shadow-xl shadow-blue-500/40 hover:shadow-2xl hover:shadow-blue-600/50 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] mt-4 sm:mt-6">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Validating...
                </span>
              ) : (isGoogle ? "Complete Registration" : "Continue")}
            </button>
          </form>
        )}

        {step === 2 && !isGoogle && (
          <form onSubmit={handleManualRegister} className="space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3 sm:mb-4 text-center">Create your login credentials</p>
            
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
              <div className="relative">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  value={form.username} 
                  onChange={set("username")}
                  onBlur={handleEmailBlur}
                  className={`${inputCls} ${
                    validationErrors.username 
                      ? "border-red-500 focus:ring-red-400" 
                      : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  }`}
                />
                {isCheckingEmail && (
                  <div className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center">
                    <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
              {validationErrors.username && (
                <p className="text-red-500 text-xs mt-2 ml-1 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.username}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password" 
                  value={form.password} 
                  onChange={set("password")} 
                  className={`${inputCls} pr-10 sm:pr-12 ${
                    validationErrors.password 
                      ? "border-red-500 focus:ring-red-400" 
                      : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {form.password && (
                <div className="mt-2.5 sm:mt-3">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Password Strength</span>
                    <span className={`text-xs font-bold ${passwordStrength.color}`}>{passwordStrength.text}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        passwordStrength.score <= 1 ? "bg-red-500" : 
                        passwordStrength.score <= 3 ? "bg-yellow-500" : "bg-green-500"
                      }`}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1.5 sm:mt-2">
                    Use 8+ characters with uppercase, numbers and symbols
                  </p>
                </div>
              )}
              {validationErrors.password && (
                <p className="text-red-500 text-xs mt-2 ml-1 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.password}
                </p>
              )}
            </div>
            <div className="flex gap-2 sm:gap-3 pt-2">
              <button type="button" onClick={() => { setStep(1); setError(""); setValidationErrors({}); }}
                className="flex-1 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2.5 sm:py-3 text-sm sm:text-base rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-medium">
                Back
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 sm:py-3 text-sm sm:text-base rounded-xl transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? "Creating..." : "Create Account"}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-xs sm:text-sm mt-4 sm:mt-6 text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
