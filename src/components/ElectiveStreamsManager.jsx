import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';

export default function ElectiveStreamsManager() {
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [streams, setStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [newStreamNumber, setNewStreamNumber] = useState('');
  const [newStreamName, setNewStreamName] = useState('');
  const [editingStream, setEditingStream] = useState(null);
  const [editStreamData, setEditStreamData] = useState({ streamNumber: '', streamName: '' });
  const [newSubject, setNewSubject] = useState({ name: '', credits: 3, courseCode: '' });
  const [editingSubject, setEditingSubject] = useState(null);
  const [editSubjectData, setEditSubjectData] = useState({ name: '', credits: 3, courseCode: '' });
  const [overlappingStreams, setOverlappingStreams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyFromDept, setCopyFromDept] = useState('');
  const [copyFromYear, setCopyFromYear] = useState('');
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    fetchColleges();
  }, []);

  useEffect(() => {
    if (selectedDept && selectedYear) {
      fetchStreams();
    }
  }, [selectedDept, selectedYear]);

  const fetchColleges = async () => {
    const snapshot = await getDocs(collection(db, 'colleges'));
    setColleges(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchStreams = async () => {
    if (!selectedDept || !selectedYear) return;
    const q = query(
      collection(db, 'electiveStreams'),
      where('department', '==', selectedDept),
      where('academicYear', '==', selectedYear)
    );
    const snapshot = await getDocs(q);
    const streamsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort by stream number in ascending order
    streamsData.sort((a, b) => a.streamNumber - b.streamNumber);
    setStreams(streamsData);
  };

  const addStream = async (e) => {
    e.preventDefault();
    if (!selectedDept || !selectedYear || !newStreamNumber || !newStreamName) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'electiveStreams'), {
        department: selectedDept,
        academicYear: selectedYear,
        streamNumber: parseInt(newStreamNumber),
        streamName: newStreamName.trim(),
        subjects: [],
        overlappingStreams: [],
        createdAt: new Date().toISOString()
      });
      setNewStreamNumber('');
      setNewStreamName('');
      await fetchStreams();
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const addSubjectToStream = async (e) => {
    e.preventDefault();
    if (!selectedStream || !newSubject.name || !newSubject.credits) return;
    
    setLoading(true);
    try {
      const streamDoc = streams.find(s => s.id === selectedStream);
      const updatedSubjects = [...(streamDoc.subjects || []), { 
        name: newSubject.name.trim(), 
        credits: parseInt(newSubject.credits),
        courseCode: newSubject.courseCode.trim() || ''
      }];
      
      await updateDoc(doc(db, 'electiveStreams', selectedStream), {
        subjects: updatedSubjects
      });
      
      setNewSubject({ name: '', credits: 3, courseCode: '' });
      await fetchStreams();
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const updateOverlappingStreams = async () => {
    if (!selectedStream) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'electiveStreams', selectedStream), {
        overlappingStreams: overlappingStreams
      });
      await fetchStreams();
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const deleteStream = async (streamId) => {
    if (!confirm('Delete this stream and all its subjects?')) return;
    
    setLoading(true);
    await deleteDoc(doc(db, 'electiveStreams', streamId));
    if (selectedStream === streamId) setSelectedStream(null);
    await fetchStreams();
    setLoading(false);
  };

  const startEditStream = (stream) => {
    setEditingStream(stream.id);
    setEditStreamData({ streamNumber: stream.streamNumber, streamName: stream.streamName });
  };

  const saveEditStream = async (streamId) => {
    if (!editStreamData.streamNumber || !editStreamData.streamName) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'electiveStreams', streamId), {
        streamNumber: parseInt(editStreamData.streamNumber),
        streamName: editStreamData.streamName.trim()
      });
      setEditingStream(null);
      await fetchStreams();
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const cancelEditStream = () => {
    setEditingStream(null);
    setEditStreamData({ streamNumber: '', streamName: '' });
  };

  const deleteSubject = async (streamId, subjectName) => {
    if (!confirm(`Delete subject "${subjectName}"?`)) return;
    
    setLoading(true);
    const streamDoc = streams.find(s => s.id === streamId);
    const updatedSubjects = streamDoc.subjects.filter(s => s.name !== subjectName);
    
    await updateDoc(doc(db, 'electiveStreams', streamId), {
      subjects: updatedSubjects
    });
    await fetchStreams();
    setLoading(false);
  };

  const startEditSubject = (idx, subject) => {
    setEditingSubject(idx);
    setEditSubjectData({ name: subject.name, credits: subject.credits, courseCode: subject.courseCode || '' });
  };

  const saveEditSubject = async () => {
    if (!editSubjectData.name || !editSubjectData.credits) return;
    
    setLoading(true);
    try {
      const streamDoc = streams.find(s => s.id === selectedStream);
      const updatedSubjects = [...streamDoc.subjects];
      updatedSubjects[editingSubject] = { 
        name: editSubjectData.name.trim(), 
        credits: parseInt(editSubjectData.credits),
        courseCode: editSubjectData.courseCode?.trim() || ''
      };
      
      await updateDoc(doc(db, 'electiveStreams', selectedStream), {
        subjects: updatedSubjects
      });
      
      setEditingSubject(null);
      await fetchStreams();
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const cancelEditSubject = () => {
    setEditingSubject(null);
    setEditSubjectData({ name: '', credits: 3, courseCode: '' });
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const streamDoc = streams.find(s => s.id === selectedStream);
    const newSubjects = [...streamDoc.subjects];
    const draggedItem = newSubjects[draggedIndex];
    newSubjects.splice(draggedIndex, 1);
    newSubjects.splice(index, 0, draggedItem);
    
    // Update local state immediately for smooth UI
    const updatedStreams = streams.map(s => 
      s.id === selectedStream ? { ...s, subjects: newSubjects } : s
    );
    setStreams(updatedStreams);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex !== null) {
      // Save to database only when drag ends
      const streamDoc = streams.find(s => s.id === selectedStream);
      await updateDoc(doc(db, 'electiveStreams', selectedStream), {
        subjects: streamDoc.subjects
      });
    }
    setDraggedIndex(null);
  };

  const copyStreamsFromDept = async () => {
    if (!copyFromDept || !copyFromYear) {
      alert('Please select source department and year');
      return;
    }
    
    setLoading(true);
    try {
      const q = query(
        collection(db, 'electiveStreams'),
        where('department', '==', copyFromDept),
        where('academicYear', '==', copyFromYear)
      );
      const snapshot = await getDocs(q);
      const sourceStreams = snapshot.docs.map(d => d.data());
      
      if (sourceStreams.length === 0) {
        alert('No streams found in source department/year');
        setLoading(false);
        return;
      }
      
      for (const stream of sourceStreams) {
        await addDoc(collection(db, 'electiveStreams'), {
          department: selectedDept,
          academicYear: selectedYear,
          streamNumber: stream.streamNumber,
          streamName: stream.streamName,
          subjects: stream.subjects || [],
          overlappingStreams: stream.overlappingStreams || [],
          createdAt: new Date().toISOString()
        });
      }
      
      alert(`✅ Copied ${sourceStreams.length} streams from ${copyFromDept}!`);
      setShowCopyModal(false);
      setCopyFromDept('');
      setCopyFromYear('');
      await fetchStreams();
    } catch (error) {
      alert('Error copying streams: ' + error.message);
    }
    setLoading(false);
  };

  const college = colleges.find(c => c.id === selectedCollege?.id);
  const depts = college ? Object.keys(college.departments || {}) : [];
  const academicYearMap = college && selectedDept ? (college.departments[selectedDept]?.academicYears || {}) : {};
  const academicYearKeys = Object.keys(academicYearMap).sort();
  const currentStream = streams.find(s => s.id === selectedStream);

  // For copy modal
  const copyYearMap = college && copyFromDept ? (college.departments[copyFromDept]?.academicYears || {}) : {};
  const copyYearKeys = Object.keys(copyYearMap).sort();

  const inputCls = "flex-1 bg-gray-50 border-none ring-1 ring-gray-200 dark:ring-gray-700 rounded-xl px-4 py-2.5 text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all";
  const btnPrimary = "bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50";
  const chipCls = (active) => `px-4 py-1.5 rounded-xl text-sm font-medium border transition-all cursor-pointer shadow-sm ${active ? "bg-blue-600 text-white border-blue-600 scale-105" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500"}`;

  return (
    <div className="space-y-6">
      {loading && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg z-50">
          Processing...
        </div>
      )}

      {/* Step 1: Select College */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Select Institution</h4>
        <div className="flex flex-wrap gap-3">
          {colleges.map(c => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCollege(c);
                setSelectedDept(null);
                setSelectedYear(null);
                setSelectedStream(null);
              }}
              className={chipCls(selectedCollege?.id === c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Select Department */}
      {selectedCollege && (
        <div className="space-y-3 animate-in slide-in-from-bottom-4">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Select Department</h4>
          <div className="flex flex-wrap gap-3">
            {depts.map(d => (
              <button
                key={d}
                onClick={() => {
                  setSelectedDept(d);
                  setSelectedYear(null);
                  setSelectedStream(null);
                }}
                className={chipCls(selectedDept === d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Select Academic Year */}
      {selectedDept && (
        <div className="space-y-3 animate-in slide-in-from-bottom-4">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Select Academic Year</h4>
          <div className="flex flex-wrap gap-3">
            {academicYearKeys.map(y => (
              <button
                key={y}
                onClick={() => {
                  setSelectedYear(y);
                  setSelectedStream(null);
                }}
                className={chipCls(selectedYear === y)}
              >
                {y} - {parseInt(y) + 4}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Create New Stream */}
      {selectedYear && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Create New Stream</h4>
            <button
              onClick={() => setShowCopyModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy from Dept
            </button>
          </div>
          <form onSubmit={addStream} className="flex gap-3 flex-wrap">
            <input
              type="number"
              value={newStreamNumber}
              onChange={(e) => setNewStreamNumber(e.target.value)}
              placeholder="Stream Number (e.g., 1)"
              className={inputCls}
              style={{ maxWidth: '200px' }}
              required
            />
            <input
              value={newStreamName}
              onChange={(e) => setNewStreamName(e.target.value)}
              placeholder="Stream Name (e.g., Machine Learning Engineering)"
              className={inputCls}
              required
            />
            <button type="submit" disabled={loading} className={btnPrimary}>
              + Create Stream
            </button>
          </form>
        </div>
      )}

      {/* Step 5: Select Stream to Add Subjects */}
      {streams.length > 0 && (
        <div className="space-y-3 animate-in slide-in-from-bottom-4">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Select Stream to Manage</h4>
          <div className="flex flex-wrap gap-3">
            {streams.map(s => (
              <div key={s.id} className="group relative">
                {editingStream === s.id ? (
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-xl ring-2 ring-blue-500">
                    <input
                      type="number"
                      value={editStreamData.streamNumber}
                      onChange={(e) => setEditStreamData({ ...editStreamData, streamNumber: e.target.value })}
                      className="w-16 bg-white dark:bg-gray-700 border border-blue-500 rounded-lg px-2 py-1 text-sm outline-none"
                      placeholder="#"
                    />
                    <input
                      value={editStreamData.streamName}
                      onChange={(e) => setEditStreamData({ ...editStreamData, streamName: e.target.value })}
                      className="w-48 bg-white dark:bg-gray-700 border border-blue-500 rounded-lg px-2 py-1 text-sm outline-none"
                      placeholder="Stream name"
                    />
                    <button
                      onClick={() => saveEditStream(s.id)}
                      className="px-2 py-1 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600"
                    >
                      ✓
                    </button>
                    <button
                      onClick={cancelEditStream}
                      className="px-2 py-1 bg-gray-400 text-white rounded-lg text-xs font-bold hover:bg-gray-500"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setSelectedStream(s.id);
                        setOverlappingStreams(s.overlappingStreams || []);
                      }}
                      className={chipCls(selectedStream === s.id)}
                    >
                      Stream {s.streamNumber}: {s.streamName}
                      <span className="ml-2 text-xs opacity-70">({s.subjects?.length || 0} subjects)</span>
                    </button>
                    <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditStream(s)}
                        className="w-6 h-6 bg-blue-500 text-white rounded-full text-xs hover:bg-blue-600"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => deleteStream(s.id)}
                        className="w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 6: Add Subjects to Selected Stream */}
      {selectedStream && currentStream && (
        <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 animate-in slide-in-from-bottom-4">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Managing: Stream {currentStream.streamNumber} - {currentStream.streamName}
          </h4>

          {/* Add Subject Form */}
          <form onSubmit={addSubjectToStream} className="flex gap-3 flex-wrap">
            <input
              value={newSubject.courseCode}
              onChange={(e) => setNewSubject({ ...newSubject, courseCode: e.target.value })}
              placeholder="Course Code"
              className={inputCls}
              style={{ maxWidth: '150px' }}
            />
            <input
              value={newSubject.name}
              onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
              placeholder="Subject Name"
              className={inputCls}
              required
            />
            <input
              type="number"
              value={newSubject.credits}
              onChange={(e) => setNewSubject({ ...newSubject, credits: e.target.value })}
              placeholder="Credits"
              className={inputCls}
              style={{ maxWidth: '120px' }}
              min="1"
              required
            />
            <button type="submit" disabled={loading} className={btnPrimary}>
              + Add Subject
            </button>
          </form>

          {/* Subjects List */}
          {currentStream.subjects && currentStream.subjects.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Subjects ({currentStream.subjects.length})</h5>
              <div className="space-y-2">
                {currentStream.subjects.map((sub, idx) => (
                  <div 
                    key={idx} 
                    draggable={editingSubject === null}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center justify-between bg-white dark:bg-gray-700 rounded-xl p-3 border border-gray-200 dark:border-gray-600 transition-opacity ${
                      draggedIndex === idx ? 'opacity-50' : ''
                    } ${editingSubject === null ? 'cursor-move' : ''}`}
                  >
                    {editingSubject === idx ? (
                      <>
                        <div className="flex gap-2 flex-1">
                          <input
                            value={editSubjectData.courseCode || ''}
                            onChange={(e) => setEditSubjectData({ ...editSubjectData, courseCode: e.target.value })}
                            className="w-32 bg-white dark:bg-gray-600 border border-blue-500 rounded-lg px-3 py-1.5 text-sm outline-none"
                            placeholder="Course Code"
                          />
                          <input
                            value={editSubjectData.name}
                            onChange={(e) => setEditSubjectData({ ...editSubjectData, name: e.target.value })}
                            className="flex-1 bg-white dark:bg-gray-600 border border-blue-500 rounded-lg px-3 py-1.5 text-sm outline-none"
                            placeholder="Subject name"
                          />
                          <input
                            type="number"
                            value={editSubjectData.credits}
                            onChange={(e) => setEditSubjectData({ ...editSubjectData, credits: e.target.value })}
                            className="w-20 bg-white dark:bg-gray-600 border border-blue-500 rounded-lg px-3 py-1.5 text-sm outline-none"
                            placeholder="Credits"
                            min="1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveEditSubject}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditSubject}
                            className="px-3 py-1.5 bg-gray-400 text-white rounded-lg text-xs font-bold hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="font-semibold text-sm text-gray-800 dark:text-white">{sub.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {sub.courseCode && <span className="font-mono">{sub.courseCode} • </span>}
                            {sub.credits} credits
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditSubject(idx, sub)}
                            className="text-blue-500 hover:text-blue-700 text-xs font-bold px-3 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteSubject(selectedStream, sub.name)}
                            className="text-red-500 hover:text-red-700 text-xs font-bold px-3 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {currentStream.subjects.length > 0 && (
                <div className="text-center py-2 text-xs text-gray-400">💡 Drag rows to reorder subjects</div>
              )}
            </div>
          )}

          {/* Overlapping Streams Configuration */}
          <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h5 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Overlapping Streams Configuration</h5>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Select streams that share subjects with Stream {currentStream.streamNumber}. Students cannot choose overlapping streams for honors.
            </p>
            <div className="flex flex-wrap gap-2">
              {streams
                .filter(s => s.streamNumber !== currentStream.streamNumber)
                .map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (overlappingStreams.includes(s.streamNumber)) {
                        setOverlappingStreams(overlappingStreams.filter(n => n !== s.streamNumber));
                      } else {
                        setOverlappingStreams([...overlappingStreams, s.streamNumber]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      overlappingStreams.includes(s.streamNumber)
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-orange-400'
                    }`}
                  >
                    Stream {s.streamNumber}
                  </button>
                ))}
            </div>
            <button
              onClick={updateOverlappingStreams}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50"
            >
              Save Overlapping Configuration
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedYear && streams.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          No streams created yet for {selectedDept} ({selectedYear}). Create one above!
        </div>
      )}

      {/* Copy Streams Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowCopyModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full shadow-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg border-2 border-white/30">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">Copy Streams</h3>
                    <p className="text-sm text-indigo-100 mt-0.5 font-medium">From another department</p>
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
                  onChange={(e) => { setCopyFromDept(e.target.value); setCopyFromYear(''); }}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-white text-sm font-semibold outline-none transition-all"
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
                    onChange={(e) => setCopyFromYear(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-white text-sm font-semibold outline-none transition-all"
                  >
                    <option value="">Select Year</option>
                    {copyYearKeys.map(year => (
                      <option key={year} value={year}>{year} - {parseInt(year) + 4}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-3 text-amber-700 dark:text-amber-300 text-xs font-medium">
                <span className="font-bold">⚠️ Warning:</span> This will copy all streams and their subjects from the source department/year.
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-sm font-bold py-3 rounded-xl transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={copyStreamsFromDept}
                  disabled={!copyFromDept || !copyFromYear || loading}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Copying...' : 'Copy Streams'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
