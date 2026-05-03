import { useState, useRef, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import cgpaLogo from "../assets/CGPA_logo.png";
import ElectiveSelector from "./ElectiveSelector";

export default function Navbar({ user, userData, collegeName }) {
  const [open, setOpen] = useState(false);
  const [showElectiveModal, setShowElectiveModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [hasElectiveAccess, setHasElectiveAccess] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [collegeLogo, setCollegeLogo] = useState("");
  const [formData, setFormData] = useState({
    name: '',
    regNo: '',
    dept: '',
    academicYear: ''
  });
  const [availableDepts, setAvailableDepts] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [regNoError, setRegNoError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef();
  const ref = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCollegeLogo = async () => {
      if (userData?.collegeId) {
        try {
          const collegeDoc = await getDoc(doc(db, 'colleges', userData.collegeId));
          if (collegeDoc.exists()) {
            const collegeData = collegeDoc.data();
            setCollegeLogo(collegeData.logo || "");
          }
        } catch (error) {
          console.error('Error fetching college logo:', error);
        }
      }
    };
    
    fetchCollegeLogo();
  }, [userData]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (userData) {
      setFormData({
        name: userData.name || '',
        regNo: userData.regNo || '',
        dept: userData.dept || '',
        academicYear: userData.academicYear || ''
      });
      setProfileImage(userData.profileImage || null);
      
      // Fetch available departments and years from college data
      if (userData.collegeId) {
        fetchCollegeOptions(userData.collegeId);
      }
    }
  }, [userData]);

  const fetchCollegeOptions = async (collegeId) => {
    try {
      const collegeDoc = await getDoc(doc(db, 'colleges', collegeId));
      if (collegeDoc.exists()) {
        const collegeData = collegeDoc.data();
        const departments = collegeData.departments || {};
        
        // Get all department names
        const deptNames = Object.keys(departments);
        setAvailableDepts(deptNames);
        
        // Get all unique academic years from all departments
        const allYears = new Set();
        deptNames.forEach(deptName => {
          const dept = departments[deptName];
          const years = Object.keys(dept.academicYears || {});
          years.forEach(year => allYears.add(year));
        });
        
        // Convert Set to Array and sort
        const sortedYears = Array.from(allYears).sort();
        setAvailableYears(sortedYears);
      }
    } catch (error) {
      console.error('Error fetching college options:', error);
    }
  };

  useEffect(() => {
    // Always allow elective access - removed Semester 4 check
    setHasElectiveAccess(true);
  }, [user, showProfileModal]);

  // Prevent background scroll when modals are open
  useEffect(() => {
    if (showProfileModal || showElectiveModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showProfileModal, showElectiveModal]);

  const checkRegNoExists = async (regNo) => {
    if (!regNo || regNo === userData?.regNo) {
      setRegNoError('');
      return false;
    }
    
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('regNo', '==', regNo));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setRegNoError('Registration number already exists');
        return true;
      } else {
        setRegNoError('');
        return false;
      }
    } catch (error) {
      console.error('Error checking registration number:', error);
      return false;
    }
  };

  const showToastMessage = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToastMessage('Please select an image file', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToastMessage('Image size should be less than 5MB', 'error');
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'CampusCalci');

      const response = await fetch('https://api.cloudinary.com/v1_1/denkbc0ls/image/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.secure_url) {
        setProfileImage(data.secure_url);
        showToastMessage('Image uploaded successfully!', 'success');
      } else {
        throw new Error('No URL returned');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      showToastMessage('Failed to upload image. Please try again.', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async () => {
    // Validation
    if (!formData.name || !formData.regNo || !formData.dept || !formData.academicYear) {
      showToastMessage('Please fill all fields', 'error');
      return;
    }
    
    // Check if regNo already exists
    const regNoExists = await checkRegNoExists(formData.regNo);
    if (regNoExists) {
      showToastMessage('Registration number already exists', 'error');
      return;
    }
    
    // Check if department or academic year changed
    const deptChanged = formData.dept !== userData?.dept;
    const yearChanged = formData.academicYear !== userData?.academicYear;
    
    if (deptChanged || yearChanged) {
      setShowWarningModal(true);
      return;
    }
    
    // Save without warning
    await saveProfile(false);
  };

  const saveProfile = async (clearData) => {
    try {
      // Update user profile
      await setDoc(doc(db, 'users', user.uid), {
        ...userData,
        name: formData.name,
        regNo: formData.regNo,
        dept: formData.dept,
        academicYear: formData.academicYear,
        profileImage: profileImage,
        updatedAt: new Date().toISOString()
      });
      
      // If dept or year changed, clear all grades and electives
      if (clearData) {
        // Clear grades
        await setDoc(doc(db, 'grades', user.uid), {});
        
        // Clear electives
        await setDoc(doc(db, 'studentElectives', user.uid), {});
        
        // Clear local storage
        localStorage.removeItem(`gradesMap_${user.uid}`);
        
        showToastMessage('Profile updated! All grades cleared', 'success');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        showToastMessage('Profile updated successfully!', 'success');
      }
      
      setEditMode(false);
      setShowWarningModal(false);
    } catch (error) {
      showToastMessage('Error updating profile', 'error');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const initial = userData?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";

  return (
    <nav className="flex items-center justify-between px-8 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-gray-900 dark:to-gray-800 text-gray-800 dark:text-white border-b border-blue-200 dark:border-gray-800 shadow-sm">
      <img src={collegeLogo || cgpaLogo} alt="College Logo" className="h-9 w-auto object-contain filter drop-shadow-md" style={{ imageRendering: 'crisp-edges' }} />
      <span style={{ fontFamily: "'Cormorant Garamond', serif" }} className="text-lg font-bold tracking-[0.25em] uppercase text-black dark:text-white">CalcByAbi</span>
      <div className="flex items-center gap-2">
        <div className="relative" ref={ref}>
          <button onClick={() => setOpen(!open)}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg transition hover:opacity-90 overflow-hidden ring-2 ring-white/20">
            {userData?.profileImage ? (
              <img src={userData.profileImage} alt="Profile" className="w-full h-full object-cover" style={{ imageRendering: 'auto' }} />
            ) : (
              initial
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
              <div className="p-3 space-y-2">
                <button
                  onClick={() => {
                    setShowProfileModal(true);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  View Profile
                </button>
                {hasElectiveAccess && (
                  <button
                    onClick={() => {
                      setShowElectiveModal(true);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Electives
                  </button>
                )}
                <button
                  onClick={() => {
                    navigate("/settings");
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-20 right-4 z-[60] animate-slideIn">
          <div className={`rounded-2xl p-4 shadow-2xl border-2 backdrop-blur-sm flex items-center gap-3 min-w-[300px] ${
            toastType === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700' 
              : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              toastType === 'success' 
                ? 'bg-emerald-500' 
                : 'bg-red-500'
            }`}>
              {toastType === 'success' ? (
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
              toastType === 'success' 
                ? 'text-emerald-800 dark:text-emerald-200' 
                : 'text-red-800 dark:text-red-200'
            }`}>{toastMessage}</p>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[60] flex items-center justify-center p-4" onClick={() => setShowWarningModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full shadow-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="relative bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 p-6 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl border-2 border-white/30">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Warning!</h3>
                  <p className="text-sm text-orange-100 mt-0.5 font-medium">Data will be deleted</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-6">
                Changing your <span className="font-bold text-red-600 dark:text-red-400">Department</span> or <span className="font-bold text-red-600 dark:text-red-400">Academic Year</span> will <span className="font-bold">DELETE</span> all your saved grades, SGPA, and CGPA data.
                <br/><br/>
                You will need to re-enter all your grades from scratch.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowWarningModal(false)}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-sm font-bold py-3 rounded-xl transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveProfile(true)}
                  className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-sm font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-3" onClick={() => { setShowProfileModal(false); setEditMode(false); }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl max-w-md w-full shadow-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-blue-700 p-5 md:p-8 flex-shrink-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
              <button 
                onClick={() => { setShowProfileModal(false); setEditMode(false); }} 
                className="absolute top-3 right-3 w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all font-bold text-base md:text-lg z-10"
              >
                ✕
              </button>
              <div className="relative flex flex-col items-center">
                <div className="relative">
                  {editMode && (
                    <>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white shadow-lg border-2 border-white z-10 transition-all disabled:opacity-50"
                      >
                        {uploadingImage ? (
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <span className="text-lg font-bold">+</span>
                        )}
                      </button>
                    </>
                  )}
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt="Profile"
                      className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover shadow-xl border-4 md:border-4 border-white/30"
                      style={{ imageRendering: 'auto' }}
                    />
                  ) : (
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white text-3xl md:text-4xl font-black shadow-xl border-4 md:border-4 border-white/30">
                      {initial}
                    </div>
                  )}
                </div>
                <h2 className="text-lg md:text-xl font-black text-white text-center mt-3">{userData?.name || "User Profile"}</h2>
                <p className="text-blue-100 text-xs md:text-sm mt-1 font-medium">{user?.email}</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto flex-1">
              {!editMode ? (
                <>
                  <div className="space-y-2 md:space-y-3">
                    <div className="px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600">
                      <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Name</span>
                      <span className="font-bold text-slate-800 dark:text-white text-sm block">{userData?.name || "—"}</span>
                    </div>
                    <div className="px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600">
                      <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Registration</span>
                      <span className="font-bold text-slate-800 dark:text-white text-sm block">{userData?.regNo || "—"}</span>
                    </div>
                    <div className="px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600">
                      <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Department</span>
                      <span className="font-bold text-slate-800 dark:text-white text-sm block">{userData?.dept || "—"}</span>
                    </div>
                    <div className="px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600">
                      <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Batch</span>
                      <span className="font-bold text-slate-800 dark:text-white text-sm block">{userData?.academicYear ? `${userData.academicYear} - ${parseInt(userData.academicYear) + 4}` : "—"}</span>
                    </div>
                    <div className="px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600">
                      <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">College</span>
                      <span className="font-bold text-slate-800 dark:text-white text-sm block">{collegeName || "—"}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setEditMode(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white text-xs md:text-sm font-bold py-2.5 md:py-3 rounded-lg md:rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 mt-4 md:mt-6"
                  >
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profile
                  </button>
                </>
              ) : (
                <>
                  <div className="space-y-2 md:space-y-3">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-500 text-slate-800 dark:text-white text-sm font-semibold outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Registration Number</label>
                      <input
                        type="text"
                        value={formData.regNo}
                        onChange={(e) => setFormData({ ...formData, regNo: e.target.value })}
                        onBlur={(e) => checkRegNoExists(e.target.value)}
                        className={`w-full px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl bg-slate-50 dark:bg-slate-700 border-2 ${regNoError ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} focus:border-blue-500 dark:focus:border-blue-500 text-slate-800 dark:text-white text-sm font-semibold outline-none transition-all`}
                      />
                      {regNoError && (
                        <p className="text-red-500 text-xs mt-1 font-semibold">{regNoError}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Department</label>
                      <select
                        value={formData.dept}
                        onChange={(e) => setFormData({ ...formData, dept: e.target.value })}
                        className="w-full px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-500 text-slate-800 dark:text-white text-sm font-semibold outline-none transition-all"
                      >
                        <option value="">Select Department</option>
                        {availableDepts.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Academic Year (Start)</label>
                      <select
                        value={formData.academicYear}
                        onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                        className="w-full px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-500 text-slate-800 dark:text-white text-sm font-semibold outline-none transition-all"
                      >
                        <option value="">Select Academic Year</option>
                        {availableYears.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 md:gap-3 mt-4 md:mt-6">
                    <button
                      onClick={() => { setEditMode(false); setFormData({ name: userData?.name || '', regNo: userData?.regNo || '', dept: userData?.dept || '', academicYear: userData?.academicYear || '' }); }}
                      className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-xs md:text-sm font-bold py-2.5 md:py-3 rounded-lg md:rounded-xl transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white text-xs md:text-sm font-bold py-2.5 md:py-3 rounded-lg md:rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Elective Modal */}
      {showElectiveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowElectiveModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border-2 border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            {/* Fixed Header */}
            <div className="flex-shrink-0 relative bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-6 rounded-t-3xl overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-xl border-2 border-white/20">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Professional Electives</h3>
                    <p className="text-sm text-slate-300 mt-0.5 font-medium">Choose your specialization stream</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowElectiveModal(false)} 
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all font-bold text-lg flex-shrink-0 shadow-lg border border-white/20"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <ElectiveSelector 
                studentId={user?.uid}
                department={userData?.dept}
                academicYear={userData?.academicYear}
                isModal={true}
              />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
