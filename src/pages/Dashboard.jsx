import { useEffect, useState, useRef } from "react";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import jsPDF from "jspdf";
import Confetti from "react-confetti";
import Navbar from "../components/Navbar";
import GradeTable from "../components/GradeTable";
import ElectiveSelector from "../components/ElectiveSelector";
import { calculateSGPA } from "../utils/calculateSGPA";
import { calculateCGPA } from "../utils/calculateCGPA";

const GRADE_MAP = { O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, U: 0, CO: 0 };

const cgpaColor = (v) => {
  if (v >= 9) return "from-green-500 to-emerald-600";
  if (v >= 8) return "from-blue-500 to-indigo-600";
  if (v >= 7) return "from-cyan-500 to-blue-600";
  if (v >= 6) return "from-emerald-500 to-teal-600";
  return "from-amber-500 to-orange-600";
};

export default function Dashboard({ darkMode, setDarkMode }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [collegeName, setCollegeName] = useState("");
  const [collegeLogo, setCollegeLogo] = useState("");
  const [semesters, setSemesters] = useState([]);
  const [gradesMap, setGradesMap] = useState({});
  const [savedData, setSavedData] = useState({});
  const [saving, setSaving] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const reportRef = useRef();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showGradeStats, setShowGradeStats] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const cgpaBarRef = useRef(null);
  const [confettiShown, setConfettiShown] = useState(false);
  const [cgpaMessage, setCgpaMessage] = useState("");
  const [showCgpaDetails, setShowCgpaDetails] = useState(false);
  const [electiveSubjects, setElectiveSubjects] = useState([]);

  useEffect(() => {
    let unsubCollege = null;
    let unsubGrades = null;
    let unsubElectives = null;
    let unsubElectiveStream = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) { setAuthReady(true); return; }
      setUser(u);

      const userSnap = await getDoc(doc(db, "users", u.uid));
      const uData = userSnap.data();
      setUserData(uData);

      // Use Promise.all to load all data simultaneously
      const gradesPromise = new Promise((resolve) => {
        unsubGrades = onSnapshot(doc(db, "grades", u.uid), (snap) => {
          const saved = snap.exists() ? snap.data() : {};
          setSavedData(saved);
          resolve();
        });
      });

      const electivesPromise = new Promise(async (resolve) => {
        unsubElectives = onSnapshot(doc(db, "studentElectives", u.uid), async (snap) => {
          if (snap.exists()) {
            const electiveData = snap.data();
            const streamNumber = electiveData.streamNumber;
            
            // Fetch the LATEST stream data from electiveStreams collection in real-time
            if (uData?.dept && uData?.academicYear && streamNumber) {
              const q = query(
                collection(db, "electiveStreams"),
                where("department", "==", uData.dept),
                where("academicYear", "==", uData.academicYear),
                where("streamNumber", "==", streamNumber)
              );
              
              // Set up real-time listener for elective stream changes
              unsubElectiveStream = onSnapshot(q, (streamSnapshot) => {
                if (!streamSnapshot.empty) {
                  const latestStreamData = streamSnapshot.docs[0].data();
                  setElectiveSubjects(latestStreamData.subjects || []);
                } else {
                  setElectiveSubjects(electiveData.subjects || []);
                }
              });
            } else {
              setElectiveSubjects(electiveData.subjects || []);
            }
          } else {
            setElectiveSubjects([]);
          }
          resolve();
        });
      });

      if (!uData?.collegeId) { 
        await Promise.all([gradesPromise, electivesPromise]);
        setAuthReady(true);
        return; 
      }

      const collegePromise = new Promise((resolve) => {
        unsubCollege = onSnapshot(doc(db, "colleges", uData.collegeId), (colSnap) => {
          if (!colSnap.exists()) {
            resolve();
            return;
          }
          const colData = colSnap.data();
          setCollegeName(colData.name);
          setCollegeLogo(colData.logo || "");

          const semObj = colData.departments?.[uData.dept]?.academicYears?.[uData.academicYear]?.semesters || {};
          const semList = Object.keys(semObj).sort().map((key) => ({ semKey: key, subjects: semObj[key].subjects || [] }));
          setSemesters(semList);

          const cached = JSON.parse(localStorage.getItem(`gradesMap_${u.uid}`) || "null");
          setSavedData((saved) => {
            const initialGrades = {};
            semList.forEach(({ semKey, subjects }) => {
              const savedSubs = saved?.[semKey]?.subjects || [];
              initialGrades[semKey] = subjects.map((sub, i) => {
                if (cached?.[semKey]?.[i]) return cached[semKey][i];
                const match = savedSubs.find((s) => s.name === sub.name);
                return match ? (match.grade || Object.keys(GRADE_MAP).find((k) => GRADE_MAP[k] === match.gradePoint) || "") : "";
              });
            });
            setGradesMap(initialGrades);
            return saved;
          });
          resolve();
        });
      });

      // Wait for all data to load before showing dashboard
      await Promise.all([gradesPromise, electivesPromise, collegePromise]);
      setAuthReady(true);
    });

    return () => { 
      unsubAuth(); 
      if (unsubCollege) unsubCollege(); 
      if (unsubGrades) unsubGrades(); 
      if (unsubElectives) unsubElectives();
      if (unsubElectiveStream) unsubElectiveStream();
    };
  }, []);

  const handleGradeChange = (semKey, idx, val) => {
    setGradesMap((prev) => {
      const updated = [...(prev[semKey] || [])];
      updated[idx] = val;
      const next = { ...prev, [semKey]: updated };
      if (user) localStorage.setItem(`gradesMap_${user.uid}`, JSON.stringify(next));
      return next;
    });
  };

  const handleSave = async (semKey, subjects) => {
    const grades = gradesMap[semKey] || [];
    
    // Validation checks - ensure all subjects have grades
    if (grades.length !== subjects.length || grades.some((g) => !g)) { 
      alert("⚠️ Please fill all grades before saving."); 
      return; 
    }
    
    // Validate all grades are valid
    const invalidGrades = grades.filter(g => !GRADE_MAP.hasOwnProperty(g));
    if (invalidGrades.length > 0) {
      alert("⚠️ Invalid grade detected. Please select valid grades only.");
      return;
    }
    
    setSaving(semKey);
    
    // Get semester number to check for electives
    const semNumber = parseInt(semKey.replace(/\D/g, ''));
    
    // For Semester 5+, get elective subjects to preserve their course codes
    let electiveSubjectsForSem = [];
    if (semNumber >= 5 && electiveSubjects.length >= 2) {
      const electiveStartIndex = (semNumber - 5) * 2;
      electiveSubjectsForSem = electiveSubjects.slice(electiveStartIndex, electiveStartIndex + 2);
    }
    
    const subjectsWithGrades = subjects.map((s, i) => {
      // Check if this subject is an elective
      const electiveSub = electiveSubjectsForSem.find(elec => elec.name === s.name);
      
      return { 
        name: s.name, 
        credits: s.credits, 
        // Prioritize elective course code, then regular course code
        courseCode: electiveSub?.courseCode || s.courseCode || "",
        grade: grades[i], 
        gradePoint: GRADE_MAP[grades[i]] 
      };
    });
    
    const sgpa = parseFloat(calculateSGPA(subjectsWithGrades));
    
    // Validate SGPA is in valid range
    if (isNaN(sgpa) || sgpa < 0 || sgpa > 10) {
      alert("⚠️ Calculated SGPA is invalid. Please check your grades.");
      setSaving(null);
      return;
    }
    
    const updated = { ...savedData, [semKey]: { subjects: subjectsWithGrades, sgpa } };
    await setDoc(doc(db, "grades", user.uid), updated);
    setSavedData(updated);
    localStorage.removeItem(`gradesMap_${user.uid}`);
    
    // Calculate new CGPA after saving
    const newSgpaList = semesters
      .filter(({ semKey: sk }) => updated?.[sk]?.sgpa !== undefined)
      .map(({ semKey: sk }) => {
        const semSaved = updated[sk];
        const subs = semSaved.subjects || [];
        const totalCredits = subs.reduce((sum, s) => sum + (s.credits || 0), 0);
        const totalWeighted = subs.reduce((sum, s) => sum + (s.credits || 0) * (s.gradePoint || 0), 0);
        return { sem: sk, sgpa: parseFloat(semSaved.sgpa), totalCredits, totalWeighted };
      });
    
    const newCgpa = parseFloat(calculateCGPA(newSgpaList));
    
    // Show confetti and message based on CGPA - triggers every time
    if (newCgpa > 0) {
      if (newCgpa >= 7.5) {
        setShowConfetti(true);
        if (newCgpa > 8) {
          setCgpaMessage("🎉 Outstanding Performance! Keep it up!");
        } else {
          setCgpaMessage("💪 Great job! Keep pushing for excellence!");
        }
        setTimeout(() => setShowConfetti(false), 6000);
      } else {
        setCgpaMessage("⚠️ You are in danger! Focus and improve your grades!");
      }
      
      // Clear message after 5 seconds
      setTimeout(() => setCgpaMessage(""), 5000);
    }
    
    setSaving(null);
  };

  const handleDeleteSemester = async (semKey) => {
    const grades = gradesMap[semKey] || [];
    const emptyGrades = grades.map(() => "");
    setGradesMap(prev => ({ ...prev, [semKey]: emptyGrades }));
    
    const updated = { ...savedData };
    delete updated[semKey];
    await setDoc(doc(db, "grades", user.uid), updated);
    setSavedData(updated);
    setShowDeleteConfirm(null);
  };

  const getGradeDistribution = (semKey) => {
    const semData = savedData[semKey];
    if (!semData) return {};
    const distribution = {};
    const gradeOrder = ['O', 'A+', 'A', 'B+', 'B', 'C', 'U', 'CO'];
    
    semData.subjects.forEach(sub => {
      const grade = sub.grade || Object.keys(GRADE_MAP).find(k => GRADE_MAP[k] === sub.gradePoint);
      if (grade) distribution[grade] = (distribution[grade] || 0) + 1;
    });
    
    const orderedDistribution = {};
    gradeOrder.forEach(grade => {
      if (distribution[grade]) {
        orderedDistribution[grade] = distribution[grade];
      }
    });
    
    return orderedDistribution;
  };

  const sgpaList = semesters
    .filter(({ semKey }) => savedData?.[semKey]?.sgpa !== undefined)
    .map(({ semKey }) => {
      const semSaved = savedData[semKey];
      const subs = semSaved.subjects || [];
      const totalCredits = subs.reduce((sum, s) => sum + (s.credits || 0), 0);
      const totalWeighted = subs.reduce((sum, s) => sum + (s.credits || 0) * (s.gradePoint || 0), 0);
      return { sem: semKey, sgpa: parseFloat(semSaved.sgpa), totalCredits, totalWeighted };
    });

  const cgpa = calculateCGPA(sgpaList);

  // Check if student has any arrears
  const hasArrears = () => {
    return Object.values(savedData).some(semData => 
      semData.subjects?.some(sub => sub.grade === "U")
    );
  };

  // Get all subjects grouped by grade
  const getAllSubjectsByGrade = () => {
    const subjectsByGrade = {};
    
    Object.entries(savedData).forEach(([semKey, semData]) => {
      semData.subjects?.forEach(sub => {
        const grade = sub.grade || Object.keys(GRADE_MAP).find(k => GRADE_MAP[k] === sub.gradePoint) || "—";
        if (!subjectsByGrade[grade]) {
          subjectsByGrade[grade] = [];
        }
        subjectsByGrade[grade].push({
          name: sub.name,
          semester: semKey,
          credits: sub.credits,
          gradePoint: sub.gradePoint
        });
      });
    });
    
    return subjectsByGrade;
  };

  const getCgpaBarColor = () => {
    if (hasArrears()) return "from-red-600 to-red-700";
    if (cgpa < 7.5) return "from-orange-600 to-orange-700";
    if (cgpa > 8) return cgpaColor(cgpa);
    return "from-blue-500 to-indigo-600";
  };

  useEffect(() => {
    // Removed auto-confetti on page load
  }, [cgpa, confettiShown]);

  const getChartDomain = () => {
    if (sgpaList.length === 0) return [0, 10];
    const values = sgpaList.map(d => d.sgpa);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.3 || 0.5;
    return [Math.max(0, min - padding), Math.min(10, max + padding)];
  };

  const exportPDF = async () => {
    // Fetch LATEST elective stream data before generating PDF
    let latestElectiveSubjects = [...electiveSubjects];
    
    if (userData?.dept && userData?.academicYear) {
      try {
        const studentElectiveDoc = await getDoc(doc(db, "studentElectives", user.uid));
        if (studentElectiveDoc.exists()) {
          const studentElectiveData = studentElectiveDoc.data();
          const streamNumber = studentElectiveData.streamNumber;
          
          // Fetch the LATEST stream data from electiveStreams collection
          const q = query(
            collection(db, "electiveStreams"),
            where("department", "==", userData.dept),
            where("academicYear", "==", userData.academicYear),
            where("streamNumber", "==", streamNumber)
          );
          const streamSnapshot = await getDocs(q);
          
          if (!streamSnapshot.empty) {
            const latestStreamData = streamSnapshot.docs[0].data();
            latestElectiveSubjects = latestStreamData.subjects || [];
          }
        }
      } catch (error) {
        console.error("Error fetching latest elective data:", error);
      }
    }
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210;
    const margin = 14;
    const col = W - margin * 2;
    let y = 0;

    pdf.setFillColor(37, 99, 235);
    pdf.rect(0, 0, W, 28, "F");
    
    // Add college logo as circle on the right side if available
    if (collegeLogo) {
      try {
        const logoSize = 20;
        const logoX = W - margin - logoSize;
        const logoY = 4;
        
        // Draw white circle background
        pdf.setFillColor(255, 255, 255);
        pdf.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2, "F");
        
        // Add logo image
        pdf.addImage(collegeLogo, "PNG", logoX, logoY, logoSize, logoSize, undefined, "NONE", 0);
      } catch (error) {
        console.error("Error adding logo to PDF:", error);
      }
    }
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("Academic Performance Report", margin, 12);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`, margin, 20);
    pdf.text(`${collegeName || ""}`, collegeLogo ? W - margin - 25 : W - margin, 20, { align: "right" });
    y = 36;

    pdf.setFillColor(241, 245, 255);
    pdf.roundedRect(margin, y, col, 22, 3, 3, "F");
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(userData?.name || "", margin + 4, y + 8);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Reg No: ${userData?.regNo || "-"}   |   Dept: ${userData?.dept || "-"}   |   Batch: ${userData?.academicYear ? `${userData.academicYear} - ${parseInt(userData.academicYear) + 4}` : "-"}`, margin + 4, y + 16);
    y += 30;

    pdf.setFillColor(37, 99, 235);
    pdf.roundedRect(margin, y, col, 18, 3, 3, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("CUMULATIVE GPA (CGPA)", margin + 4, y + 7);
    pdf.setFontSize(14);
    pdf.text(`${cgpa}  / 10.0`, W - margin - 4, y + 11, { align: "right" });
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Total Credits: ${sgpaList.reduce((s, r) => s + r.totalCredits, 0)}   |   Total Points: ${sgpaList.reduce((s, r) => s + r.totalWeighted, 0)}`, margin + 4, y + 14);
    y += 26;

    sgpaList.forEach(({ sem, sgpa, totalCredits }, idx) => {
      const semSaved = savedData[sem];
      const subjects = semSaved?.subjects || [];
      
      // Get original semester data to retrieve course codes
      const originalSemester = semesters.find(s => s.semKey === sem);
      const originalSubjects = originalSemester?.subjects || [];
      
      // Get semester number to check for electives
      const semNumber = parseInt(sem.replace(/\D/g, ''));
      
      // For Semester 5+, get elective subjects with LATEST course codes from fetched data
      let electiveSubjectsForSem = [];
      if (semNumber >= 5 && latestElectiveSubjects.length >= 2) {
        const electiveStartIndex = (semNumber - 5) * 2;
        electiveSubjectsForSem = latestElectiveSubjects.slice(electiveStartIndex, electiveStartIndex + 2);
      }
      
      // Merge course codes from original subjects into saved subjects
      const subjectsWithCodes = subjects.map(savedSub => {
        // First try to find in original core subjects
        let originalSub = originalSubjects.find(orig => orig.name === savedSub.name);
        let courseCode = originalSub?.courseCode || "";
        
        // If not found in core, check if it's an elective and get LATEST code
        if (!originalSub && electiveSubjectsForSem.length > 0) {
          const electiveSub = electiveSubjectsForSem.find(elec => elec.name === savedSub.name);
          if (electiveSub) {
            // Use the LATEST course code from electiveSubjects state
            courseCode = electiveSub.courseCode || "";
          }
        }
        
        // Fallback to saved course code if nothing found
        if (!courseCode) {
          courseCode = savedSub.courseCode || "";
        }
        
        return {
          ...savedSub,
          courseCode: courseCode
        };
      });

      if (y > 240) { pdf.addPage(); y = 14; }

      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, y, col, 10, 2, 2, "F");
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, y, col, 10, 2, 2, "S");
      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text(sem.toUpperCase(), margin + 4, y + 6.5);
      pdf.setTextColor(37, 99, 235);
      pdf.text(`SGPA: ${sgpa}`, W - margin - 4, y + 6.5, { align: "right" });
      y += 13;

      pdf.setFillColor(37, 99, 235);
      pdf.rect(margin, y, col, 7, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(7.5);
      pdf.setFont("helvetica", "bold");
      pdf.text("#", margin + 3, y + 5);
      pdf.text("Code", margin + 10, y + 5);
      pdf.text("Subject", margin + 32, y + 5);
      pdf.text("Credits", margin + col - 42, y + 5);
      pdf.text("Grade", margin + col - 26, y + 5);
      pdf.text("GP", margin + col - 16, y + 5);
      pdf.text("Wtd", margin + col - 4, y + 5, { align: "right" });
      y += 7;

      subjectsWithCodes.forEach((sub, i) => {
        if (y > 270) { pdf.addPage(); y = 14; }
        
        const maxWidth = col - 74;
        const lines = pdf.splitTextToSize(sub.name, maxWidth);
        const rowHeight = Math.max(6.5, lines.length * 4);
        
        const bg = i % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
        pdf.setFillColor(...bg);
        pdf.rect(margin, y, col, rowHeight, "F");
        pdf.setTextColor(51, 65, 85);
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "normal");
        pdf.text(String(i + 1), margin + 3, y + 4.5);
        pdf.setFontSize(6.5);
        pdf.text(sub.courseCode || "-", margin + 10, y + 4.5);
        pdf.setFontSize(7.5);
        pdf.text(lines, margin + 32, y + 4.5);
        pdf.text(String(sub.credits), margin + col - 40, y + 4.5);
        pdf.setFont("helvetica", "bold");
        const gradeKey = sub.grade || Object.keys(GRADE_MAP).find(k => GRADE_MAP[k] === sub.gradePoint) || "-";
        pdf.text(gradeKey, margin + col - 24, y + 4.5);
        pdf.setFont("helvetica", "normal");
        pdf.text(String(sub.gradePoint), margin + col - 15, y + 4.5);
        pdf.text(String(sub.credits * sub.gradePoint), margin + col - 2, y + 4.5, { align: "right" });
        y += rowHeight;
      });

      pdf.setFillColor(239, 246, 255);
      pdf.rect(margin, y, col, 6.5, "F");
      pdf.setTextColor(37, 99, 235);
      pdf.setFontSize(7.5);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Total Credits: ${totalCredits}`, margin + 4, y + 4.5);
      pdf.text(`SGPA: ${sgpa}`, W - margin - 4, y + 4.5, { align: "right" });
      y += 12;
    });

    pdf.setFillColor(241, 245, 255);
    pdf.rect(0, 285, W, 12, "F");
    pdf.setTextColor(148, 163, 184);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text("Generated by CGPA Calculator App", margin, 292);
    pdf.text(`CGPA: ${cgpa}`, W - margin, 292, { align: "right" });

    pdf.save(`${userData?.regNo || "Student"}_CGPA_Report.pdf`);
  };

  

  return (
    <div className={`min-h-screen bg-[#F0F4FF] dark:bg-[#0A0F1E] dark:text-slate-200 transition-colors duration-300 ${(showCgpaDetails || showGradeStats) ? 'overflow-hidden' : ''}`}>
      <Navbar user={user} darkMode={darkMode} setDarkMode={setDarkMode} userData={userData} collegeName={collegeName} />

      <div 
        ref={cgpaBarRef} 
        onClick={() => sgpaList.length > 0 && setShowCgpaDetails(true)}
        className={`sticky top-4 z-30 mx-3 md:mx-auto md:max-w-2xl overflow-hidden bg-gradient-to-br ${cgpa > 0 ? getCgpaBarColor() : "from-blue-500 to-indigo-600"} rounded-2xl px-5 py-3 shadow-2xl shadow-slate-400/50 dark:shadow-slate-900/50 mt-4 ${sgpaList.length > 0 ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}
      >
        {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={500} style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none' }} />}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em]">Cumulative GPA</p>
              <p className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">{cgpa > 0 ? cgpa : "—"}</p>
              <p className="text-white/60 text-[10px] mt-0.5 font-medium">out of 10.0</p>
            </div>
            <div className="flex gap-3">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
                <p className="text-white/60 text-[9px] font-black uppercase tracking-wider">Semesters</p>
                <p className="text-2xl font-black text-white">{sgpaList.length || "—"}</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
                <p className="text-white/60 text-[9px] font-black uppercase tracking-wider">Credits</p>
                <p className="text-2xl font-black text-white">{sgpaList.reduce((s, r) => s + r.totalCredits, 0) || "—"}</p>
              </div>
            </div>
          </div>
          {cgpaMessage && (
            <div className="cgpa-message mt-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/30 animate-bounce transition-opacity duration-500">
              <p className="text-white text-sm font-bold text-center animate-pulse">{cgpaMessage}</p>
            </div>
          )}
        </div>
      </div>

      {showCgpaDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCgpaDetails(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl border-2 border-slate-200 dark:border-slate-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex-shrink-0 relative bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700 p-6 rounded-t-3xl overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl border-2 border-white/30">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Grade Breakdown</h3>
                    <p className="text-sm text-purple-100 mt-0.5 font-medium">Complete academic performance overview</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCgpaDetails(false)} 
                  className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-all font-bold text-lg flex-shrink-0 shadow-lg border border-white/30"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-6 flex-1 overscroll-contain">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl p-4 text-center bg-gradient-to-br from-slate-900 to-black text-white shadow-lg">
                <p className="text-xs font-bold uppercase tracking-wider text-white/80">CGPA</p>
                <p className="text-4xl font-black mt-1">{cgpa}</p>
                <p className="text-xs text-white/70 mt-1">out of 10.0</p>
              </div>
              <div className="rounded-2xl p-4 text-center bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-lg">
                <p className="text-xs font-bold uppercase tracking-wider text-white/80">Total Subjects</p>
                <p className="text-4xl font-black mt-1">{Object.values(savedData).reduce((sum, sem) => sum + (sem.subjects?.length || 0), 0)}</p>
                <p className="text-xs text-white/70 mt-1">{sgpaList.length} semesters</p>
              </div>
              <div className="rounded-2xl p-4 text-center bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-lg">
                <p className="text-xs font-bold uppercase tracking-wider text-white/80">Total Credits</p>
                <p className="text-4xl font-black mt-1">{sgpaList.reduce((s, r) => s + r.totalCredits, 0)}</p>
                <p className="text-xs text-white/70 mt-1">completed</p>
              </div>
            </div>

            {hasArrears() && (
              <div className="mb-6 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40 border-2 border-red-300 dark:border-red-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-red-700 dark:text-red-400 uppercase tracking-wide">⚠️ Arrears Detected</h4>
                    <p className="text-sm text-red-600 dark:text-red-300 font-medium">You have failed subjects that need attention</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {getAllSubjectsByGrade()["U"]?.map((sub, idx) => (
                    <div key={idx} className="bg-white dark:bg-red-900/30 rounded-xl p-3 border-2 border-red-200 dark:border-red-800 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-red-800 dark:text-red-300">{sub.name}</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{sub.semester} • {sub.credits} credits</p>
                      </div>
                      <div className="bg-red-600 text-white px-3 py-1.5 rounded-lg font-black text-sm shadow-md">
                        U
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h4 className="text-lg font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">All Subjects by Grade</h4>
              
              {['O', 'A+', 'A', 'B+', 'B', 'C', 'CO'].map(grade => {
                const subjects = getAllSubjectsByGrade()[grade];
                if (!subjects || subjects.length === 0) return null;
                
                const gradeColors = {
                  'O': { bg: 'from-slate-700 to-slate-800', light: 'from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30', border: 'border-slate-300 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300' },
                  'A+': { bg: 'from-slate-600 to-slate-700', light: 'from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30', border: 'border-slate-300 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300' },
                  'A': { bg: 'from-slate-600 to-slate-700', light: 'from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30', border: 'border-slate-300 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300' },
                  'B+': { bg: 'from-slate-500 to-slate-600', light: 'from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30', border: 'border-slate-300 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300' },
                  'B': { bg: 'from-slate-500 to-slate-600', light: 'from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30', border: 'border-slate-300 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300' },
                  'C': { bg: 'from-slate-500 to-slate-600', light: 'from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30', border: 'border-slate-300 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300' },
                  'CO': { bg: 'from-slate-400 to-slate-500', light: 'from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30', border: 'border-slate-300 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300' }
                };
                
                return (
                  <div key={grade} className={`bg-gradient-to-r ${gradeColors[grade].light} border ${gradeColors[grade].border} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradeColors[grade].bg} flex items-center justify-center shadow-lg`}>
                        <span className="text-xl font-black text-white">{grade}</span>
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${gradeColors[grade].text} uppercase tracking-wide`}>Grade {grade}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{subjects.length} subject{subjects.length > 1 ? 's' : ''} • GP: {GRADE_MAP[grade]}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {subjects.map((sub, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-700/50 rounded-lg p-2.5 border-2 border-slate-200 dark:border-slate-600 flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{sub.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub.semester} • {sub.credits} credits</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-3 py-5 md:px-6 md:py-8 space-y-6" ref={reportRef}>

        

        <div className="space-y-5">
          {semesters.map(({ semKey, subjects }, semIdx) => {
            // Get semester number from semKey (e.g., "Semester 5" -> 5)
            const semNumber = parseInt(semKey.replace(/\D/g, ''));
            
            // For Semester 5 onwards, ADD 2 elective subjects to the core subjects
            let finalSubjects = [...subjects];
            if (semNumber >= 5 && electiveSubjects.length >= 2) {
              // Calculate which 2 electives to use based on semester
              // Sem 5: subjects 0,1 | Sem 6: subjects 2,3 | Sem 7: subjects 4,5
              const electiveStartIndex = (semNumber - 5) * 2;
              const electivesToUse = electiveSubjects.slice(electiveStartIndex, electiveStartIndex + 2);
              
              if (electivesToUse.length === 2) {
                // ADD electives to the end of core subjects
                finalSubjects = [...subjects, ...electivesToUse];
              }
            }
            
            const grades = gradesMap[semKey] || [];
            const isSaved = savedData?.[semKey]?.sgpa !== undefined;
            const allFilled = grades.length === finalSubjects.length && grades.every((g) => g);
            const liveSGPA = allFilled
              ? calculateSGPA(finalSubjects.map((s, i) => ({ credits: s.credits, gradePoint: GRADE_MAP[grades[i]] })))
              : null;
            const prevSemKey = semIdx > 0 ? semesters[semIdx - 1].semKey : null;
            const prevHasData = prevSemKey && (savedData?.[prevSemKey]?.sgpa !== undefined || (gradesMap[prevSemKey] && gradesMap[prevSemKey].length > 0));
            const isUnlocked = semIdx === 0 || prevHasData;
            if (!isUnlocked) return null;

            return (
              <div key={semKey} className="bg-white dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-lg shadow-slate-200/60 dark:shadow-none border-2 border-slate-800 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-slate-700">
                  <h3 className="font-black text-base text-slate-800 dark:text-white uppercase tracking-wide">{semKey}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{finalSubjects.length} subjects</p>
                </div>

                <div className="p-4 md:p-5">
                  {finalSubjects.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-sm border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl">
                      No subjects found for this semester.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {semNumber >= 5 && electiveSubjects.length < 2 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-3 text-amber-700 dark:text-amber-300 text-sm font-medium flex items-center gap-2">
                          <span className="text-lg">⚠️</span>
                          <span>Please select your elective stream from your profile to unlock professional elective subjects.</span>
                        </div>
                      )}
                      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                        <GradeTable subjects={finalSubjects} grades={grades} onChange={(i, val) => handleGradeChange(semKey, i, val)} />
                      </div>

                      {allFilled && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-2xl p-4 text-center bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 text-blue-900 dark:text-blue-100 shadow-md border border-blue-200 dark:border-blue-700">
                            <p className="text-2xl font-black leading-tight">{finalSubjects.reduce((sum, s) => sum + s.credits, 0)}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 mt-1">Total Credits</p>
                          </div>
                          <div className="rounded-2xl p-4 text-center bg-gradient-to-br from-blue-200 to-blue-300 dark:from-blue-800/40 dark:to-blue-700/40 text-blue-900 dark:text-blue-100 shadow-md border border-blue-300 dark:border-blue-600">
                            <p className="text-2xl font-black leading-tight">{finalSubjects.reduce((sum, s, i) => sum + s.credits * (GRADE_MAP[grades[i]] ?? 0), 0)}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 mt-1">Total Points</p>
                          </div>
                          <div className="rounded-2xl p-4 text-center bg-gradient-to-br from-blue-300 to-blue-400 dark:from-blue-700/40 dark:to-blue-600/40 text-blue-900 dark:text-blue-100 shadow-md border border-blue-400 dark:border-blue-500">
                            <p className="text-2xl font-black leading-tight">{liveSGPA}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-200 mt-1">SGPA</p>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => handleSave(semKey, finalSubjects)}
                        disabled={saving === semKey || !allFilled}
                        className="w-full bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white py-3.5 rounded-2xl text-sm font-black shadow-md transition-all active:scale-95 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                      >
                        {saving === semKey ? "Saving..." : isSaved ? "Update SGPA" : "Finalize SGPA"}
                      </button>
                      
                      {isSaved && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowGradeStats(semKey)}
                            className="flex-1 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white py-2.5 rounded-xl text-xs font-bold hover:border-blue-500 transition-all"
                          >
                            Grade Stats
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(semKey)}
                            className="flex-1 bg-white dark:bg-slate-700 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 py-2.5 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                          >
                            Clear Data
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {sgpaList.length > 0 && (
          <div className="space-y-5">
            <div className="bg-slate-900 dark:bg-slate-800 rounded-3xl p-5 md:p-7 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">Performance Trend</h3>
                  <p className="text-slate-400 text-xs mt-0.5">CGPA progression across semesters</p>
                </div>
                <div className="bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-xl text-xs font-black border border-blue-500/30">
                  {sgpaList.length} sem{sgpaList.length > 1 ? "s" : ""}
                </div>
              </div>
              <div className="w-full min-h-[300px] h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sgpaList.map((item, idx) => {
                    const semestersUpToThis = sgpaList.slice(0, idx + 1);
                    return { ...item, cgpa: parseFloat(calculateCGPA(semestersUpToThis)) };
                  })} margin={{ top: 15, right: 15, bottom: 15, left: 0 }}>
                    <defs>
                      <linearGradient id="colorCgpa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={true} />
                    <XAxis dataKey="sem" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                      domain={(() => {
                        const cgpaValues = sgpaList.map((item, idx) => {
                          const semestersUpToThis = sgpaList.slice(0, idx + 1);
                          return parseFloat(calculateCGPA(semestersUpToThis));
                        });
                        const min = Math.min(...cgpaValues);
                        const max = Math.max(...cgpaValues);
                        const padding = (max - min) * 0.3 || 0.5;
                        return [Math.max(0, min - padding), Math.min(10, max + padding)];
                      })()}
                      stroke="#94a3b8" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => value.toFixed(2)}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#1e293b", border: "2px solid #a78bfa", borderRadius: "12px", color: "#fff", fontSize: "13px", padding: "12px" }} 
                      itemStyle={{ color: "#e9d5ff" }}
                      formatter={(value) => [value.toFixed(2), "CGPA"]}
                      labelStyle={{ color: "#cbd5e1" }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cgpa" 
                      stroke="#a78bfa" 
                      strokeWidth={4}
                      dot={{ fill: "#a78bfa", r: 6, strokeWidth: 2, stroke: "#8b5cf6" }}
                      activeDot={{ r: 8, fill: "#e9d5ff", stroke: "#a78bfa", strokeWidth: 2 }}
                      isAnimationActive={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-lg shadow-slate-200/60 dark:shadow-none border border-white dark:border-slate-700">
              <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-4">Semester Performance</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {sgpaList.map(({ sem, sgpa, totalCredits }, idx) => {
                  const semestersUpToThis = sgpaList.slice(0, idx + 1);
                  const cgpaAtThisSem = calculateCGPA(semestersUpToThis);
                  const prevCgpa = idx > 0 ? calculateCGPA(sgpaList.slice(0, idx)) : null;
                  const cgpaChange = prevCgpa ? (cgpaAtThisSem - prevCgpa).toFixed(2) : null;
                  const isImproved = cgpaChange > 0;
                  
                  return (
                    <div key={sem} className="bg-white dark:bg-slate-700 rounded-2xl p-3 border-2 border-slate-200 dark:border-slate-600 hover:border-blue-200 dark:hover:border-blue-600 transition-all">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">{sem}</p>
                      
                      <div className="bg-blue-100 dark:bg-blue-900/40 rounded-xl p-2.5 mb-2">
                        <p className="text-[9px] font-bold text-blue-600 dark:text-blue-300 uppercase tracking-wide">SGPA</p>
                        <p className="text-2xl font-black text-blue-700 dark:text-blue-200 mt-0.5">{parseFloat(sgpa).toFixed(2)}</p>
                      </div>
                      
                      <div className="bg-indigo-100 dark:bg-indigo-900/40 rounded-xl p-2.5 mb-2">
                        <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide">CGPA</p>
                        <p className="text-2xl font-black text-indigo-700 dark:text-indigo-200 mt-0.5">{parseFloat(cgpaAtThisSem).toFixed(2)}</p>
                      </div>
                      
                      {cgpaChange && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                          <p className={`text-xs font-bold ${isImproved ? "text-teal-600 dark:text-teal-400" : "text-orange-600 dark:text-orange-400"}`}>
                            {isImproved ? "+" : ""}{cgpaChange} from prev
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={exportPDF}
              className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 py-4 rounded-2xl font-black text-sm transition-all shadow-lg hover:shadow-xl active:scale-95">
              Download Academic Report (PDF)
            </button>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-black mb-3">Clear Semester Data?</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">This will clear all grades for {showDeleteConfirm} and reset the table to blank. You can re-enter grades later.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 bg-slate-100 dark:bg-slate-700 py-3 rounded-xl font-bold">Cancel</button>
                <button onClick={() => handleDeleteSemester(showDeleteConfirm)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold">Clear Data</button>
              </div>
            </div>
          </div>
        )}

        {showGradeStats && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowGradeStats(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="relative bg-gradient-to-br from-blue-600 to-indigo-600 p-4 overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">Grade Stats</h3>
                      <p className="text-[10px] text-blue-100 font-medium">{showGradeStats}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowGradeStats(null)} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all font-bold">
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto">
              
              <div className="space-y-2 mb-4">
                {Object.entries(getGradeDistribution(showGradeStats)).map(([grade, count]) => {
                  const percentage = ((count / savedData[showGradeStats].subjects.length) * 100).toFixed(1);
                  const gradeColors = {
                    'O': 'from-violet-500 to-purple-600',
                    'A+': 'from-blue-500 to-indigo-600',
                    'A': 'from-cyan-500 to-blue-600',
                    'B+': 'from-emerald-500 to-teal-600',
                    'B': 'from-green-500 to-emerald-600',
                    'C': 'from-amber-500 to-orange-600',
                    'U': 'from-red-500 to-rose-600',
                    'CO': 'from-slate-500 to-slate-600'
                  };
                  
                  return (
                    <div key={grade} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2.5 border border-slate-200 dark:border-slate-600">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradeColors[grade]} flex items-center justify-center shadow-sm`}>
                            <span className="text-sm font-black text-white">{grade}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">GP: {GRADE_MAP[grade]}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-800 dark:text-white leading-none">{count}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{percentage}%</p>
                        </div>
                      </div>
                      
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${gradeColors[grade]} transition-all duration-700 ease-out`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-600 rounded-lg p-3 border border-blue-100 dark:border-slate-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wide">Total Subjects</p>
                    <p className="text-xl font-black text-slate-800 dark:text-white">{savedData[showGradeStats].subjects.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wide">SGPA</p>
                    <p className="text-xl font-black text-blue-600 dark:text-blue-400">{savedData[showGradeStats].sgpa}</p>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}


      </main>
    </div>
  );
}
