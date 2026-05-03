import { useEffect, useState } from "react";
import { collection, getDocs, doc, setDoc, updateDoc, getDoc, deleteField, deleteDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/config";
import Navbar from "../components/Navbar";
import AdminNavbar from "../components/AdminNavbar";
import ElectiveStreamsManager from "../components/ElectiveStreamsManager";

// Enhanced Toast with Backdrop and Animation
function Toast({ msg, onConfirm, onCancel }) {
  if (!msg) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity" onClick={onCancel} />
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-1 pl-6 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[340px] animate-in fade-in slide-in-from-bottom-4 duration-300">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1">{msg}</span>
        <div className="flex gap-1 p-1">
          <button onClick={onCancel} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-white transition">Cancel</button>
          <button onClick={onConfirm} className="bg-red-500 hover:bg-red-600 text-white text-xs px-4 py-2 rounded-xl font-bold shadow-lg shadow-red-500/30 transition">Delete</button>
        </div>
      </div>
    </>
  );
}

export default function Admin() {
  // ... (Keep all your existing state hooks exactly as they are) ...
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState(() => JSON.parse(localStorage.getItem("admin_selectedCollege") || "null"));
  const [selectedDept, setSelectedDept] = useState(() => localStorage.getItem("admin_selectedDept") || null);
  const [selectedYear, setSelectedYear] = useState(() => localStorage.getItem("admin_selectedYear") || null);
  const [selectedSem, setSelectedSem] = useState(() => localStorage.getItem("admin_selectedSem") || null);
  const [newCollege, setNewCollege] = useState("");
  const [newCollegeLogo, setNewCollegeLogo] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [newDept, setNewDept] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newSem, setNewSem] = useState("");
  const [newSubject, setNewSubject] = useState({ name: "", credits: "", courseCode: "" });
  const [editCollege, setEditCollege] = useState(null);
  const [editCollegeLogo, setEditCollegeLogo] = useState(null);
  const [uploadingEditLogo, setUploadingEditLogo] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [editDeptVal, setEditDeptVal] = useState("");
  const [editSem, setEditSem] = useState(null);
  const [editSemVal, setEditSemVal] = useState("");
  const [editSubject, setEditSubject] = useState(null);
  const [msg, setMsg] = useState({ text: "", type: "success" });
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyFromDept, setCopyFromDept] = useState("");
  const [copyFromYear, setCopyFromYear] = useState("");
  const [copyFromSem, setCopyFromSem] = useState("");
  const [feedbacks, setFeedbacks] = useState([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // ... (Keep all your useEffect and logic functions exactly as they are) ...
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { if (u) setUser(u); });
    return unsub;
  }, []);
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);
  const setCollege = (c) => { setSelectedCollege(c); localStorage.setItem("admin_selectedCollege", JSON.stringify(c)); };
  const setDept = (d) => { setSelectedDept(d); localStorage.setItem("admin_selectedDept", d || ""); };
  const setYear = (y) => { setSelectedYear(y); localStorage.setItem("admin_selectedYear", y || ""); };
  const setSem = (s) => { setSelectedSem(s); localStorage.setItem("admin_selectedSem", s || ""); };

  const fetchColleges = async () => {
    const snap = await getDocs(collection(db, "colleges"));
    setColleges(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { fetchColleges(); }, []);
  
  const fetchFeedbacks = async () => {
    const snap = await getDocs(collection(db, "feedback"));
    const feedbackData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    feedbackData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setFeedbacks(feedbackData);
  };
  
  useEffect(() => { fetchFeedbacks(); }, []);
  
  useEffect(() => {
    if (!selectedCollege) return;
    const unsubscribe = onSnapshot(doc(db, "colleges", selectedCollege.id), (snap) => {
      if (snap.exists()) {
        const updatedCollege = { id: snap.id, ...snap.data() };
        setColleges(prev => prev.map(c => c.id === updatedCollege.id ? updatedCollege : c));
      }
    });
    return () => unsubscribe();
  }, [selectedCollege]);
  const flash = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "success" }), 3000);
  };
  const confirmDelete = (message, type, payload) => setToast({ message, type, payload });
  const executeDelete = async () => {
    if (!toast) return;
    const { type, payload } = toast;
    setToast(null);
    setLoading(true);
    const ref = doc(db, "colleges", payload.collegeId);
    if (type === "college") {
      await deleteDoc(ref);
      if (selectedCollege?.id === payload.collegeId) { setCollege(null); setDept(null); setYear(null); setSem(null); }
      flash("🗑️ College deleted!");
    } else if (type === "dept") {
      await updateDoc(ref, { [`departments.${payload.dept}`]: deleteField() });
      if (selectedDept === payload.dept) { setDept(null); setYear(null); setSem(null); }
      flash("🗑️ Department deleted!");
    } else if (type === "year") {
      await updateDoc(ref, { [`departments.${payload.dept}.academicYears.${payload.year}`]: deleteField() });
      if (selectedYear === payload.year) { setYear(null); setSem(null); }
      flash("🗑️ Year deleted!");
    } else if (type === "sem") {
      await updateDoc(ref, { [`departments.${payload.dept}.academicYears.${payload.year}.semesters.${payload.sem}`]: deleteField() });
      if (selectedSem === payload.sem) setSem(null);
      flash("🗑️ Semester deleted!");
    } else if (type === "subject") {
      const snap = await getDoc(ref);
      const data = snap.data();
      const subs = data.departments[payload.dept].academicYears[payload.year].semesters[payload.sem].subjects.filter((s) => s.name !== payload.subName);
      await updateDoc(ref, { [`departments.${payload.dept}.academicYears.${payload.year}.semesters.${payload.sem}.subjects`]: subs });
      flash("🗑️ Subject deleted!");
    }
    await fetchColleges();
    setLoading(false);
  };

  const uploadToCloudinary = async (file) => {
    const CLOUD_NAME = 'denkbc0ls';
    const UPLOAD_PRESET = 'CampusCalci';
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw error;
    }
  };

  const addCollege = async (e) => {
    e.preventDefault();
    if (!newCollege.trim()) return;
    setLoading(true);
    
    try {
      const id = newCollege.trim().toLowerCase().replace(/\s+/g, "_");
      const existing = await getDoc(doc(db, "colleges", id));
      if (existing.exists()) { 
        flash("College already exists!", "error"); 
        setLoading(false); 
        return; 
      }
      
      let logoUrl = "";
      if (newCollegeLogo) {
        setUploadingLogo(true);
        logoUrl = await uploadToCloudinary(newCollegeLogo);
        setUploadingLogo(false);
      }
      
      await setDoc(doc(db, "colleges", id), { 
        name: newCollege.trim(), 
        logo: logoUrl,
        departments: {} 
      });
      
      setNewCollege("");
      setNewCollegeLogo(null);
      flash("✅ College added!");
      await fetchColleges();
    } catch (error) {
      flash("Error adding college: " + error.message, "error");
    }
    
    setLoading(false);
  };
  const saveEditCollege = async () => {
    if (!editCollege?.name.trim()) return;
    setLoading(true);
    
    try {
      let logoUrl = editCollege.logo || "";
      
      if (editCollegeLogo) {
        setUploadingEditLogo(true);
        logoUrl = await uploadToCloudinary(editCollegeLogo);
        setUploadingEditLogo(false);
      }
      
      await updateDoc(doc(db, "colleges", editCollege.id), { 
        name: editCollege.name.trim(),
        logo: logoUrl
      });
      
      flash("✅ College updated!");
      setEditCollege(null);
      setEditCollegeLogo(null);
      await fetchColleges();
    } catch (error) {
      flash("Error updating college: " + error.message, "error");
    }
    
    setLoading(false);
  };
  const deleteCollege = (c) => confirmDelete(`Delete college "${c.name}"? This removes all its data.`, "college", { collegeId: c.id });

  const addDept = async (e) => {
    e.preventDefault();
    if (!selectedCollege || !newDept.trim()) return;
    setLoading(true);
    const ref = doc(db, "colleges", selectedCollege.id);
    const snap = await getDoc(ref);
    const data = snap.data();
    if (data.departments[newDept.trim()]) { flash("Department already exists!", "error"); setLoading(false); return; }
    await updateDoc(ref, { [`departments.${newDept.trim()}`]: { academicYears: {} } });
    setNewDept("");
    flash("✅ Department added!");
    await fetchColleges();
    setLoading(false);
  };
  const saveEditDept = async () => {
    if (!editDeptVal.trim() || editDeptVal.trim() === editDept) { setEditDept(null); return; }
    setLoading(true);
    const ref = doc(db, "colleges", selectedCollege.id);
    const snap = await getDoc(ref);
    const data = snap.data();
    const deptData = data.departments[editDept];
    await updateDoc(ref, {
      [`departments.${editDeptVal.trim()}`]: deptData,
      [`departments.${editDept}`]: deleteField(),
    });
    if (selectedDept === editDept) setDept(editDeptVal.trim());
    setEditDept(null);
    flash("✅ Department renamed!");
    await fetchColleges();
    setLoading(false);
  };
  const addYear = async (e) => {
    e.preventDefault();
    if (!selectedCollege || !selectedDept || !newYear.trim()) return;
    setLoading(true);
    const ref = doc(db, "colleges", selectedCollege.id);
    const snap = await getDoc(ref);
    const data = snap.data();
    const yearMap = data.departments[selectedDept]?.academicYears || {};
    if (yearMap[newYear.trim()]) { flash("Year already exists!", "error"); setLoading(false); return; }
    await updateDoc(ref, {
      [`departments.${selectedDept}.academicYears.${newYear.trim()}`]: { semesters: {} }
    });
    setNewYear("");
    flash("✅ Academic year added!");
    await fetchColleges();
    setLoading(false);
  };
  const deleteYear = (y) => confirmDelete(`Delete academic year "${y} - ${parseInt(y) + 4}"?`, "year", { collegeId: selectedCollege.id, dept: selectedDept, year: y });
  const deleteDept = (d) => confirmDelete(`Delete department "${d}"?`, "dept", { collegeId: selectedCollege.id, dept: d });

  const addSem = async (e) => {
    e.preventDefault();
    if (!selectedCollege || !selectedDept || !selectedYear || !newSem.trim()) return;
    setLoading(true);
    const ref = doc(db, "colleges", selectedCollege.id);
    const snap = await getDoc(ref);
    const data = snap.data();
    const semObj = data.departments[selectedDept]?.academicYears?.[selectedYear]?.semesters || {};
    if (semObj[newSem.trim()]) { flash("Semester already exists!", "error"); setLoading(false); return; }
    await updateDoc(ref, {
      [`departments.${selectedDept}.academicYears.${selectedYear}.semesters.${newSem.trim()}`]: { subjects: [] }
    });
    setNewSem("");
    flash("✅ Semester added!");
    await fetchColleges();
    setLoading(false);
  };
  const saveEditSem = async () => {
    if (!editSemVal.trim() || editSemVal.trim() === editSem) { setEditSem(null); return; }
    setLoading(true);
    const ref = doc(db, "colleges", selectedCollege.id);
    const snap = await getDoc(ref);
    const data = snap.data();
    const semData = data.departments[selectedDept].academicYears[selectedYear].semesters[editSem];
    await updateDoc(ref, {
      [`departments.${selectedDept}.academicYears.${selectedYear}.semesters.${editSemVal.trim()}`]: semData,
      [`departments.${selectedDept}.academicYears.${selectedYear}.semesters.${editSem}`]: deleteField(),
    });
    if (selectedSem === editSem) setSem(editSemVal.trim());
    setEditSem(null);
    flash("✅ Semester renamed!");
    await fetchColleges();
    setLoading(false);
  };
  const deleteSem = (s) => confirmDelete(`Delete semester "${s}"?`, "sem", { collegeId: selectedCollege.id, dept: selectedDept, year: selectedYear, sem: s });

  const addSubject = async (e) => {
    e.preventDefault();
    if (!selectedCollege || !selectedDept || !selectedYear || !selectedSem || !newSubject.name || !newSubject.credits) return;
    setLoading(true);
    const ref = doc(db, "colleges", selectedCollege.id);
    const snap = await getDoc(ref);
    const data = snap.data();
    const subs = data.departments[selectedDept].academicYears[selectedYear].semesters[selectedSem].subjects || [];
    if (subs.find((s) => s.name.toLowerCase() === newSubject.name.trim().toLowerCase())) {
      flash("Subject already exists!", "error"); setLoading(false); return;
    }
    subs.push({ name: newSubject.name.trim(), credits: parseInt(newSubject.credits), courseCode: newSubject.courseCode.trim() || "" });
    await updateDoc(ref, {
      [`departments.${selectedDept}.academicYears.${selectedYear}.semesters.${selectedSem}.subjects`]: subs
    });
    setNewSubject({ name: "", credits: "", courseCode: "" });
    flash("✅ Subject added!");
    await fetchColleges();
    setLoading(false);
  };
  const saveEditSubject = async () => {
    if (!editSubject.name.trim() || !editSubject.credits) return;
    setLoading(true);
    const ref = doc(db, "colleges", selectedCollege.id);
    const snap = await getDoc(ref);
    const data = snap.data();
    const subs = [...data.departments[selectedDept].academicYears[selectedYear].semesters[selectedSem].subjects];
    subs[editSubject.index] = { name: editSubject.name.trim(), credits: parseInt(editSubject.credits), courseCode: editSubject.courseCode?.trim() || "" };
    await updateDoc(ref, {
      [`departments.${selectedDept}.academicYears.${selectedYear}.semesters.${selectedSem}.subjects`]: subs
    });
    setEditSubject(null);
    flash("✅ Subject updated!");
    await fetchColleges();
    setLoading(false);
  };
  const deleteSubject = (subName) => confirmDelete(`Delete subject "${subName}"?`, "subject", { collegeId: selectedCollege.id, dept: selectedDept, year: selectedYear, sem: selectedSem, subName });

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newSubjects = [...subjects];
    const draggedItem = newSubjects[draggedIndex];
    newSubjects.splice(draggedIndex, 1);
    newSubjects.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    updateSubjectsOrder(newSubjects);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const updateSubjectsOrder = async (newSubjects) => {
    const ref = doc(db, "colleges", selectedCollege.id);
    await updateDoc(ref, {
      [`departments.${selectedDept}.academicYears.${selectedYear}.semesters.${selectedSem}.subjects`]: newSubjects
    });
  };

  const copySubjectsFromDept = async () => {
    if (!copyFromDept || !copyFromYear || !copyFromSem) {
      flash("Please select source department, year, and semester", "error");
      return;
    }
    
    setLoading(true);
    try {
      const ref = doc(db, "colleges", selectedCollege.id);
      const snap = await getDoc(ref);
      const data = snap.data();
      
      const sourceSubjects = data.departments[copyFromDept]?.academicYears?.[copyFromYear]?.semesters?.[copyFromSem]?.subjects || [];
      
      if (sourceSubjects.length === 0) {
        flash("No subjects found in source semester", "error");
        setLoading(false);
        return;
      }
      
      await updateDoc(ref, {
        [`departments.${selectedDept}.academicYears.${selectedYear}.semesters.${selectedSem}.subjects`]: sourceSubjects
      });
      
      flash(`✅ Copied ${sourceSubjects.length} subjects from ${copyFromDept}!`);
      setShowCopyModal(false);
      setCopyFromDept("");
      setCopyFromYear("");
      setCopyFromSem("");
      await fetchColleges();
    } catch (error) {
      flash("Error copying subjects: " + error.message, "error");
    }
    setLoading(false);
  };

  const college = colleges.find((c) => c.id === selectedCollege?.id);
  const depts = college ? Object.keys(college.departments || {}) : [];
  const academicYearMap = college && selectedDept ? (college.departments[selectedDept]?.academicYears || {}) : {};
  const academicYearKeys = Object.keys(academicYearMap).sort();
  const sems = selectedYear ? Object.keys(academicYearMap[selectedYear]?.semesters || {}).sort() : [];
  const subjects = selectedYear && selectedSem
    ? academicYearMap[selectedYear]?.semesters[selectedSem]?.subjects || []
    : [];

  // For copy modal - get available years and sems from selected dept
  const copyYearMap = college && copyFromDept ? (college.departments[copyFromDept]?.academicYears || {}) : {};
  const copyYearKeys = Object.keys(copyYearMap).sort();
  const copySems = copyFromYear ? Object.keys(copyYearMap[copyFromYear]?.semesters || {}).sort() : [];

  // --- UI Helpers ---
  const inputCls = "flex-1 bg-gray-50 border-none ring-1 ring-gray-200 dark:ring-gray-700 rounded-xl px-4 py-2.5 text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all";
  const btnPrimary = "bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50";
  const chipCls = (active) => `px-4 py-1.5 rounded-xl text-sm font-medium border transition-all cursor-pointer shadow-sm ${active ? "bg-blue-600 text-white border-blue-600 scale-105" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500"}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] dark:text-white pb-20">
      <AdminNavbar user={user} darkMode={darkMode} setDarkMode={setDarkMode} />
      
      <div className="max-w-4xl mx-auto p-6 space-y-8 mt-4">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Admin Console</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage institutional data and curriculum.</p>
          </div>
          {loading && <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </header>

        {msg.text && (
          <div className={`px-4 py-3 rounded-2xl text-sm font-bold shadow-sm animate-in slide-in-from-top-2 ${msg.type === "error" ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"}`}>
             {msg.text}
          </div>
        )}

        {/* Step 1: College */}
        <section className="bg-white dark:bg-gray-900/50 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-[2rem] shadow-xl shadow-gray-200/50 dark:shadow-none p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold">1</span>
            <h3 className="font-bold text-lg">Institutions</h3>
          </div>
          <form onSubmit={addCollege} className="space-y-3">
            <div className="flex gap-3">
              <input value={newCollege} onChange={(e) => setNewCollege(e.target.value)} placeholder="College Name (e.g. SKCT)" className={inputCls} />
              <button type="submit" disabled={loading || uploadingLogo} className={btnPrimary}>
                {uploadingLogo ? "Uploading..." : "+ New College"}
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">College Logo (Optional)</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setNewCollegeLogo(e.target.files[0])}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
              />
              {newCollegeLogo && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={URL.createObjectURL(newCollegeLogo)} alt="Preview" className="w-12 h-12 object-contain rounded-lg border-2 border-gray-200 dark:border-gray-700" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">{newCollegeLogo.name}</span>
                  <button type="button" onClick={() => setNewCollegeLogo(null)} className="text-red-500 hover:text-red-700 text-xs font-bold">Remove</button>
                </div>
              )}
            </div>
          </form>
          
          <div className="flex flex-wrap gap-3 mt-4">
            {colleges.map((c) => (
              <div key={c.id} className="group relative">
                {editCollege?.id === c.id ? (
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl ring-2 ring-blue-500 space-y-3">
                    <div className="flex items-center gap-2">
                      <input 
                        value={editCollege.name} 
                        onChange={(e) => setEditCollege({ ...editCollege, name: e.target.value })}
                        className="flex-1 bg-white dark:bg-gray-700 px-3 py-2 text-sm outline-none rounded-lg border-2 border-gray-200 dark:border-gray-600 font-medium" 
                        placeholder="College Name"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">College Logo</label>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => setEditCollegeLogo(e.target.files[0])}
                        className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
                      />
                      {(editCollegeLogo || editCollege.logo) && (
                        <div className="mt-2 flex items-center gap-2">
                          <img 
                            src={editCollegeLogo ? URL.createObjectURL(editCollegeLogo) : editCollege.logo} 
                            alt="Preview" 
                            className="w-12 h-12 object-contain rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white" 
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {editCollegeLogo ? editCollegeLogo.name : "Current Logo"}
                          </span>
                          {editCollegeLogo && (
                            <button 
                              type="button" 
                              onClick={() => setEditCollegeLogo(null)} 
                              className="text-red-500 hover:text-red-700 text-xs font-bold"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={saveEditCollege} 
                        disabled={uploadingEditLogo}
                        className="flex-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition py-2 text-sm font-bold disabled:opacity-50"
                      >
                        {uploadingEditLogo ? "Uploading..." : "Save"}
                      </button>
                      <button 
                        onClick={() => { setEditCollege(null); setEditCollegeLogo(null); }} 
                        className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition py-2 text-sm font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setCollege(c); setDept(null); setSem(null); }} className={`${chipCls(selectedCollege?.id === c.id)} flex items-center gap-2`}>
                      {c.logo && <img src={c.logo} alt={c.name} className="w-5 h-5 object-contain" />}
                      {c.name}
                    </button>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                      <button onClick={() => setEditCollege({ id: c.id, name: c.name, logo: c.logo || "" })} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-[10px]">✏️</button>
                      <button onClick={() => deleteCollege(c)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-[10px]">🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Step 2: Department */}
        {selectedCollege && (
          <section className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-[2rem] shadow-xl shadow-gray-200/50 dark:shadow-none p-6 space-y-5 animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center font-bold">2</span>
                <h3 className="font-bold text-lg">Departments <span className="text-gray-400 font-normal text-sm">at {selectedCollege.name}</span></h3>
              </div>
            </div>
            <form onSubmit={addDept} className="flex gap-3">
              <input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Dept Code (e.g. IT, CSE)" className={inputCls} />
              <button type="submit" disabled={loading} className={btnPrimary}>+ Add Dept</button>
            </form>
            <div className="flex flex-wrap gap-3">
              {depts.map((d) => (
                <div key={d} className="group flex items-center gap-2">
                  {editDept === d ? (
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-1 rounded-xl ring-1 ring-blue-500">
                      <input value={editDeptVal} onChange={(e) => setEditDeptVal(e.target.value)} className="bg-transparent px-2 py-1 text-sm outline-none w-24 font-medium" />
                      <button onClick={saveEditDept} className="p-1 text-[10px] bg-emerald-500 text-white rounded">Save</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => { setDept(d); setYear(null); setSem(null); }} className={chipCls(selectedDept === d)}>{d}</button>
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => { setEditDept(d); setEditDeptVal(d); }} className="text-[10px]">✏️</button>
                         <button onClick={() => deleteDept(d)} className="text-[10px]">🗑️</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Step 2.5: Academic Years */}
        {selectedDept && (
          <section className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-[2rem] p-6 space-y-5 animate-in slide-in-from-bottom-4">
             <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center font-bold">2.5</span>
                <h3 className="font-bold text-lg">Regulation / Academic Years</h3>
             </div>
             <form onSubmit={addYear} className="flex gap-3">
                <input value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="Starting Year (e.g. 2024)" className={inputCls} type="number" />
                <button type="submit" disabled={loading} className={btnPrimary}>+ Set Year</button>
             </form>
             <div className="flex flex-wrap gap-3">
               {academicYearKeys.map((y) => (
                 <div key={y} className="group flex items-center gap-2">
                    <button onClick={() => { setYear(y); setSem(null); }} className={chipCls(selectedYear === y)}>
                       {y} - {parseInt(y) + 4}
                    </button>
                    <button onClick={() => deleteYear(y)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600">🗑️</button>
                 </div>
               ))}
             </div>
          </section>
        )}

        {/* Step 3: Semester */}
        {selectedYear && (
          <section className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-[2rem] p-6 space-y-5 animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center font-bold">3</span>
              <h3 className="font-bold text-lg">Curriculum Structure</h3>
            </div>
            <form onSubmit={addSem} className="flex gap-3">
              <input value={newSem} onChange={(e) => setNewSem(e.target.value)} placeholder="e.g. Semester 1" className={inputCls} />
              <button type="submit" disabled={loading} className={btnPrimary}>+ Add Sem</button>
            </form>
            <div className="flex flex-wrap gap-3">
              {sems.map((s) => (
                <div key={s} className="group flex items-center gap-2">
                   {editSem === s ? (
                     <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-1 rounded-xl ring-1 ring-blue-500">
                       <input value={editSemVal} onChange={(e) => setEditSemVal(e.target.value)} className="bg-transparent px-2 py-1 text-sm outline-none w-24 font-medium" />
                       <button onClick={saveEditSem} className="p-1 text-[10px] bg-emerald-500 text-white rounded">Save</button>
                     </div>
                   ) : (
                     <>
                       <button onClick={() => setSem(s)} className={chipCls(selectedSem === s)}>{s}</button>
                       <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => { setEditSem(s); setEditSemVal(s); }} className="text-[10px]">✏️</button>
                         <button onClick={() => deleteSem(s)} className="text-[10px]">🗑️</button>
                       </div>
                     </>
                   )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Step 4: Subjects - Using a cleaner Data Table style */}
        {selectedSem && (
          <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[2rem] overflow-hidden animate-in slide-in-from-bottom-4 shadow-2xl">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-500/40">4</span>
                  Course Catalog
                </h3>
                <button
                  onClick={() => setShowCopyModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy from Dept
                </button>
              </div>
              <form onSubmit={addSubject} className="flex gap-3 flex-wrap">
                <input value={newSubject.courseCode} onChange={(e) => setNewSubject({ ...newSubject, courseCode: e.target.value })}
                  placeholder="Course Code" className="w-32 bg-gray-50 border-none ring-1 ring-gray-200 dark:ring-gray-700 rounded-xl px-4 py-2.5 text-sm dark:bg-gray-800" />
                <input value={newSubject.name} onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                  placeholder="Course Name" className={inputCls} />
                <input value={newSubject.credits} onChange={(e) => setNewSubject({ ...newSubject, credits: e.target.value })}
                  placeholder="Credits" type="number" min="0" className="w-24 bg-gray-50 border-none ring-1 ring-gray-200 dark:ring-gray-700 rounded-xl px-4 py-2.5 text-sm dark:bg-gray-800" />
                <button type="submit" disabled={loading} className={btnPrimary}>+ Add Subject</button>
              </form>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 font-medium border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-3 text-left w-12 font-bold">#</th>
                    <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Course Code</th>
                    <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Subject Title</th>
                    <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Credits</th>
                    <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {subjects.map((s, i) => (
                    <tr 
                      key={i} 
                      draggable={!editSubject}
                      onDragStart={(e) => handleDragStart(e, i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDragEnd={handleDragEnd}
                      className={`group hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${draggedIndex === i ? 'opacity-50' : ''} ${!editSubject ? 'cursor-move' : ''}`}
                    >
                      <td className="px-4 py-4 text-gray-400 font-medium">{i + 1}</td>
                      {editSubject?.index === i ? (
                        <>
                          <td className="px-4 py-4">
                            <input value={editSubject.courseCode || ""} onChange={(e) => setEditSubject({ ...editSubject, courseCode: e.target.value })}
                              className="w-full bg-white dark:bg-gray-700 border border-blue-500 rounded-lg px-2 py-1 outline-none" placeholder="Course Code" />
                          </td>
                          <td className="px-4 py-4">
                            <input value={editSubject.name} onChange={(e) => setEditSubject({ ...editSubject, name: e.target.value })}
                              className="w-full bg-white dark:bg-gray-700 border border-blue-500 rounded-lg px-2 py-1 outline-none" />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <input value={editSubject.credits} type="number" min="0"
                              onChange={(e) => setEditSubject({ ...editSubject, credits: e.target.value })}
                              className="w-16 bg-white dark:bg-gray-700 border border-blue-500 rounded-lg px-2 py-1 text-center outline-none" />
                          </td>
                          <td className="px-4 py-4 text-right">
                             <div className="flex justify-end gap-2">
                               <button onClick={saveEditSubject} className="text-xs font-bold text-emerald-500 hover:bg-emerald-50 px-2 py-1 rounded">Save</button>
                               <button onClick={() => setEditSubject(null)} className="text-xs font-bold text-gray-400 hover:bg-gray-50 px-2 py-1 rounded">✕</button>
                             </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-4 text-gray-500 dark:text-gray-400 text-sm font-mono">{s.courseCode || "—"}</td>
                          <td className="px-4 py-4 font-semibold text-gray-700 dark:text-gray-200">{s.name}</td>
                          <td className="px-4 py-4 text-center">
                            <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg font-bold">{s.credits}</span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditSubject({ index: i, name: s.name, credits: s.credits, courseCode: s.courseCode || "" })}
                                className="text-blue-500 hover:text-blue-700 text-xs font-bold uppercase tracking-tight">Edit</button>
                              <button onClick={() => deleteSubject(s.name)}
                                className="text-red-500 hover:text-red-700 text-xs font-bold uppercase tracking-tight">Delete</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {subjects.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No subjects defined for this semester.</div>}
              {subjects.length > 0 && <div className="text-center py-2 text-xs text-gray-400">💡 Drag rows to reorder subjects</div>}
            </div>
          </section>
        )}

        {/* Step 5: Elective Streams Management */}
        <section className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-[2rem] p-6 space-y-5 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center font-bold">5</span>
            <h3 className="font-bold text-lg">Elective & Honors Streams</h3>
          </div>
          <ElectiveStreamsManager />
        </section>

        {/* Step 6: Feedback Management */}
        <section className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-[2rem] p-6 space-y-5 animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 text-pink-600 flex items-center justify-center font-bold">6</span>
              <h3 className="font-bold text-lg">User Feedback</h3>
            </div>
            <button
              onClick={() => setShowFeedbackModal(true)}
              className="bg-pink-600 hover:bg-pink-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-pink-500/20 transition-all active:scale-95"
            >
              View All ({feedbacks.length})
            </button>
          </div>
          <div className="grid gap-3">
            {feedbacks.slice(0, 3).map((fb) => (
              <div key={fb.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white">{fb.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{fb.email}</p>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(fb.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{fb.message}</p>
              </div>
            ))}
            {feedbacks.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">No feedback received yet.</div>
            )}
          </div>
        </section>
      </div>

      <Toast
        msg={toast?.message}
        onConfirm={executeDelete}
        onCancel={() => setToast(null)}
      />

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowFeedbackModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] shadow-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="relative bg-gradient-to-br from-pink-600 via-rose-600 to-red-600 p-6 flex-shrink-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg border-2 border-white/30">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">User Feedback</h3>
                    <p className="text-sm text-pink-100 mt-0.5 font-medium">{feedbacks.length} total submissions</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowFeedbackModal(false)} 
                  className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-all font-bold text-lg shadow-lg border border-white/30"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {feedbacks.map((fb) => (
                <div key={fb.id} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-base text-gray-900 dark:text-white">{fb.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{fb.email}</p>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg font-semibold">
                      {new Date(fb.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{fb.message}</p>
                </div>
              ))}
              {feedbacks.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No feedback received yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Copy Subjects Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowCopyModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full shadow-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="relative bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 p-6 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg border-2 border-white/30">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">Copy Subjects</h3>
                    <p className="text-sm text-purple-100 mt-0.5 font-medium">From another department</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCopyModal(false)} 
                  className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-all font-bold text-lg shadow-lg border border-white/30"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Source Department</label>
                <select
                  value={copyFromDept}
                  onChange={(e) => { setCopyFromDept(e.target.value); setCopyFromYear(""); setCopyFromSem(""); }}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 focus:border-purple-500 dark:focus:border-purple-500 text-slate-800 dark:text-white text-sm font-semibold outline-none transition-all"
                >
                  <option value="">Select Department</option>
                  {depts.filter(d => d !== selectedDept).map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              
              {copyFromDept && (
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Academic Year</label>
                  <select
                    value={copyFromYear}
                    onChange={(e) => { setCopyFromYear(e.target.value); setCopyFromSem(""); }}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 focus:border-purple-500 dark:focus:border-purple-500 text-slate-800 dark:text-white text-sm font-semibold outline-none transition-all"
                  >
                    <option value="">Select Year</option>
                    {copyYearKeys.map(year => (
                      <option key={year} value={year}>{year} - {parseInt(year) + 4}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {copyFromYear && (
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Semester</label>
                  <select
                    value={copyFromSem}
                    onChange={(e) => setCopyFromSem(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 focus:border-purple-500 dark:focus:border-purple-500 text-slate-800 dark:text-white text-sm font-semibold outline-none transition-all"
                  >
                    <option value="">Select Semester</option>
                    {copySems.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-3 text-amber-700 dark:text-amber-300 text-xs font-medium">
                <span className="font-bold">⚠️ Warning:</span> This will replace all existing subjects in the current semester.
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-sm font-bold py-3 rounded-xl transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={copySubjectsFromDept}
                  disabled={!copyFromDept || !copyFromYear || !copyFromSem || loading}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-sm font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Copying..." : "Copy Subjects"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}