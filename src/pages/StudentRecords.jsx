import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../components/AdminNavbar";

export default function StudentRecords({ darkMode, setDarkMode }) {
  const [students, setStudents] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentGrades, setStudentGrades] = useState(null);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [collegeData, setCollegeData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "users"));
    const studentData = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter(user => user.role !== "admin")
      .sort((a, b) => {
        if (a.dept !== b.dept) {
          return (a.dept || "").localeCompare(b.dept || "");
        }
        return (a.regNo || "").localeCompare(b.regNo || "");
      });
    setStudents(studentData);
    setLoading(false);
  };

  const filteredStudents = students.filter(student => {
    const matchesDept = !selectedDept || student.dept === selectedDept;
    const matchesSearch = !searchQuery || 
      student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.regNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const departments = [...new Set(students.map(s => s.dept).filter(Boolean))].sort();

  const fetchStudentGrades = async (studentId, student) => {
    setLoadingGrades(true);
    try {
      const gradesDoc = await getDoc(doc(db, "grades", studentId));
      
      if (gradesDoc.exists()) {
        const gradesData = gradesDoc.data();
        
        // Fetch college curriculum to get course codes
        if (student.collegeId && student.dept && student.academicYear) {
          const collegeDoc = await getDoc(doc(db, "colleges", student.collegeId));
          if (collegeDoc.exists()) {
            const colData = collegeDoc.data();
            const semObj = colData.departments?.[student.dept]?.academicYears?.[student.academicYear]?.semesters || {};
            
            // Merge course codes into saved grades
            const updatedGrades = {};
            Object.keys(gradesData).forEach(semKey => {
              const semData = gradesData[semKey];
              const curriculumSubjects = semObj[semKey]?.subjects || [];
              
              const subjectsWithCodes = semData.subjects.map(savedSub => {
                // Find matching subject in curriculum
                const curriculumSub = curriculumSubjects.find(s => s.name === savedSub.name);
                return {
                  ...savedSub,
                  courseCode: savedSub.courseCode || curriculumSub?.courseCode || ""
                };
              });
              
              updatedGrades[semKey] = {
                ...semData,
                subjects: subjectsWithCodes
              };
            });
            
            setStudentGrades(updatedGrades);
          } else {
            setStudentGrades(gradesData);
          }
        } else {
          setStudentGrades(gradesData);
        }
      } else {
        setStudentGrades({});
      }
    } catch (error) {
      console.error("Error fetching grades:", error);
      setStudentGrades({});
    }
    setLoadingGrades(false);
  };

  const handleStudentClick = async (student) => {
    setSelectedStudent(student);
    await fetchStudentGrades(student.id, student);
  };

  const closeModal = () => {
    setSelectedStudent(null);
    setStudentGrades(null);
  };

  const GRADE_MAP = { O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, U: 0, CO: 0 };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] dark:text-white pb-20">
      <AdminNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
      
      <div className="max-w-7xl mx-auto p-6 space-y-6 mt-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/admin")}
                className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
              >
                <svg className="w-5 h-5 text-gray-700 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Student Records</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  {filteredStudents.length} of {students.length} students
                </p>
              </div>
            </div>
          </div>
          {loading && <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </header>

        <div className="bg-white dark:bg-gray-900/50 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-3xl shadow-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                Search Students
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, reg no, or email..."
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500 text-gray-900 dark:text-white text-sm font-semibold outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                Filter by Department
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500 text-gray-900 dark:text-white text-sm font-semibold outline-none transition-all"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedDept && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Filtered by:</span>
              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg font-bold text-sm">
                {selectedDept}
              </span>
              <button
                onClick={() => setSelectedDept("")}
                className="text-red-500 hover:text-red-700 text-xs font-bold"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-left w-16 font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">#</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Reg No</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Batch</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredStudents.map((student, i) => (
                  <tr 
                    key={student.id} 
                    onClick={() => handleStudentClick(student)}
                    className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 text-gray-400 font-medium">{i + 1}</td>
                    <td className="px-6 py-4 font-mono text-sm font-bold text-gray-700 dark:text-gray-300">
                      {student.regNo || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {student.profileImage ? (
                          <img src={student.profileImage} alt={student.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                            {student.name?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                        <span className="font-semibold text-gray-900 dark:text-white">{student.name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg font-bold text-xs">
                        {student.dept || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-medium">
                      {student.academicYear ? `${student.academicYear} - ${parseInt(student.academicYear) + 4}` : "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">
                      {student.email || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudents.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-lg font-bold">No students found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </div>

        {filteredStudents.length > 0 && (
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Showing <span className="font-bold text-gray-900 dark:text-white">{filteredStudents.length}</span> student{filteredStudents.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={fetchStudents}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Student Grades Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-6xl w-full max-h-[90vh] shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-6 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {selectedStudent.profileImage ? (
                    <img src={selectedStudent.profileImage} alt={selectedStudent.name} className="w-14 h-14 rounded-full object-cover border-2 border-gray-200 dark:border-slate-700" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900 text-xl font-black">
                      {selectedStudent.name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">{selectedStudent.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-mono font-semibold">{selectedStudent.regNo}</span>
                      <span>•</span>
                      <span className="font-semibold">{selectedStudent.dept}</span>
                      <span>•</span>
                      <span className="font-semibold">
                        {selectedStudent.academicYear ? `${selectedStudent.academicYear} - ${parseInt(selectedStudent.academicYear) + 4}` : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={closeModal} 
                  className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center text-gray-700 dark:text-gray-300 transition-colors font-bold text-lg border border-gray-200 dark:border-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-slate-950">
              {loadingGrades ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-12 h-12 border-4 border-gray-900 dark:border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : studentGrades && Object.keys(studentGrades).length > 0 ? (
                <div className="space-y-6">
                  {/* CGPA Summary */}
                  {(() => {
                    const semesters = Object.keys(studentGrades).sort();
                    const sgpaList = semesters.map(sem => {
                      const semData = studentGrades[sem];
                      const subjects = semData.subjects || [];
                      const totalCredits = subjects.reduce((sum, s) => sum + (s.credits || 0), 0);
                      const totalWeighted = subjects.reduce((sum, s) => sum + (s.credits || 0) * (s.gradePoint || 0), 0);
                      return { sem, sgpa: semData.sgpa, totalCredits, totalWeighted };
                    });
                    const totalCredits = sgpaList.reduce((sum, s) => sum + s.totalCredits, 0);
                    const totalWeighted = sgpaList.reduce((sum, s) => sum + s.totalWeighted, 0);
                    const cgpa = totalCredits > 0 ? (totalWeighted / totalCredits).toFixed(2) : "0.00";

                    return (
                      <div className="bg-white dark:bg-slate-900 border-2 border-gray-900 dark:border-white rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">Cumulative GPA</p>
                            <p className="text-5xl font-black mt-2 text-gray-900 dark:text-white">{cgpa}</p>
                            <p className="text-gray-500 dark:text-gray-500 text-xs mt-1 font-semibold">out of 10.0</p>
                          </div>
                          <div className="flex gap-4">
                            <div className="bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-6 py-3 text-center">
                              <p className="text-gray-600 dark:text-gray-400 text-xs font-bold uppercase">Semesters</p>
                              <p className="text-2xl font-black text-gray-900 dark:text-white">{semesters.length}</p>
                            </div>
                            <div className="bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-6 py-3 text-center">
                              <p className="text-gray-600 dark:text-gray-400 text-xs font-bold uppercase">Credits</p>
                              <p className="text-2xl font-black text-gray-900 dark:text-white">{totalCredits}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Semester Cards */}
                  {Object.keys(studentGrades).sort().map((semKey) => {
                    const semData = studentGrades[semKey];
                    const subjects = semData.subjects || [];
                    const sgpa = semData.sgpa || "0.00";

                    return (
                      <div key={semKey} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-md">
                        <div className="bg-gray-50 dark:bg-slate-800 px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                          <h4 className="font-black text-lg text-gray-900 dark:text-white uppercase tracking-wide">{semKey}</h4>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600 dark:text-gray-400 font-semibold">
                              {subjects.length} subjects
                            </span>
                            <span className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-1.5 rounded-lg font-black text-sm">
                              SGPA: {sgpa}
                            </span>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                                <th className="px-4 py-3 text-left w-12 font-bold text-gray-700 dark:text-gray-300 text-xs uppercase">#</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Code</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Subject</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Credits</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Grade</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">GP</th>
                                <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Weighted</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                              {subjects.map((subject, idx) => {
                                const gradeKey = subject.grade || Object.keys(GRADE_MAP).find(k => GRADE_MAP[k] === subject.gradePoint) || "—";
                                const isArrear = gradeKey === "U";
                                
                                return (
                                  <tr key={idx} className={`${isArrear ? 'bg-red-50 dark:bg-red-950/30' : ''} hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors`}>
                                    <td className="px-4 py-3 text-gray-500 dark:text-gray-500 font-medium">{idx + 1}</td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs font-semibold">{subject.courseCode || "—"}</td>
                                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{subject.name}</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white px-2 py-1 rounded font-bold text-xs border border-gray-200 dark:border-slate-700">
                                        {subject.credits}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`px-3 py-1 rounded-lg font-black text-sm border-2 ${
                                        isArrear 
                                          ? 'bg-red-600 text-white border-red-700' 
                                          : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                                      }`}>
                                        {gradeKey}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white">{subject.gradePoint}</td>
                                    <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                                      {(subject.credits * subject.gradePoint).toFixed(1)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-100 dark:bg-slate-800 border-t-2 border-gray-300 dark:border-slate-700">
                                <td colSpan="3" className="px-4 py-3 font-black text-gray-900 dark:text-white uppercase">Total</td>
                                <td className="px-4 py-3 text-center font-black text-gray-900 dark:text-white">
                                  {subjects.reduce((sum, s) => sum + s.credits, 0)}
                                </td>
                                <td colSpan="2" className="px-4 py-3 text-center font-black text-gray-900 dark:text-white uppercase">SGPA</td>
                                <td className="px-4 py-3 text-center font-black text-gray-900 dark:text-white text-lg">{sgpa}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20">
                  <svg className="w-20 h-20 mx-auto mb-4 text-gray-300 dark:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-xl font-bold text-gray-400">No Grades Available</p>
                  <p className="text-sm text-gray-500 mt-2">This student hasn't entered any grades yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
