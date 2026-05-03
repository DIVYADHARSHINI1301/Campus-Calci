import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, where, setDoc, doc, getDoc } from 'firebase/firestore';

export default function HonorsSelector({ studentId, department, academicYear, cgpa, hasArrears }) {
  const [streams, setStreams] = useState([]);
  const [electiveStream, setElectiveStream] = useState(null);
  const [availableStreams, setAvailableStreams] = useState([]);
  const [selectedHonorStream, setSelectedHonorStream] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState({});
  const [saved, setSaved] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentId && department && academicYear) {
      checkEligibility();
      fetchStreams();
      loadElectiveSelection();
      loadSavedHonors();
    }
  }, [studentId, department, academicYear, cgpa, hasArrears]);

  const checkEligibility = () => {
    setEligible(cgpa >= 7.5 && !hasArrears);
  };

  const fetchStreams = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'electiveStreams'),
        where('department', '==', department),
        where('academicYear', '==', academicYear)
      );
      const snapshot = await getDocs(q);
      setStreams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadElectiveSelection = async () => {
    try {
      const docRef = doc(db, 'studentElectives', studentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const electiveStreamNum = docSnap.data().streamNumber;
        setElectiveStream(electiveStreamNum);
      }
    } catch (error) {
      console.error('Error loading elective selection:', error);
    }
  };

  const filterAvailableStreams = (electiveStreamNum) => {
    const electiveStreamData = streams.find(s => s.streamNumber === electiveStreamNum);
    if (!electiveStreamData) return;

    const overlapping = electiveStreamData.overlappingStreams || [];
    const available = streams.filter(s => 
      s.streamNumber !== electiveStreamNum && 
      !overlapping.includes(s.streamNumber)
    );
    setAvailableStreams(available);
  };

  const loadSavedHonors = async () => {
    try {
      const docRef = doc(db, 'studentHonors', studentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSelectedHonorStream(data.streamNumber);
        setSelectedSubjects(data.selectedSubjects || {});
        setSaved(true);
      }
    } catch (error) {
      console.error('Error loading saved honors:', error);
    }
  };

  // Second useEffect to filter available streams when electiveStream or streams change
  useEffect(() => {
    if (electiveStream && streams.length > 0) {
      filterAvailableStreams(electiveStream);
    }
  }, [electiveStream, streams]);

  const handleStreamSelect = (streamNumber) => {
    setSelectedHonorStream(streamNumber);
    setSelectedSubjects({});
    setSaved(false);
  };

  const toggleSubject = (semester, subjectName) => {
    const key = `sem${semester}`;
    const current = selectedSubjects[key] || [];
    
    if (current.includes(subjectName)) {
      setSelectedSubjects({
        ...selectedSubjects,
        [key]: current.filter(s => s !== subjectName)
      });
    } else if (current.length < 2) {
      setSelectedSubjects({
        ...selectedSubjects,
        [key]: [...current, subjectName]
      });
    } else {
      alert('You can only select 2 subjects per semester');
    }
  };

  const saveSelection = async () => {
    if (!selectedHonorStream) {
      alert('Please select a stream');
      return;
    }

    try {
      await setDoc(doc(db, 'studentHonors', studentId), {
        studentId,
        department,
        academicYear,
        streamNumber: selectedHonorStream,
        selectedSubjects,
        cgpaAtSelection: cgpa,
        updatedAt: new Date().toISOString()
      });
      setSaved(true);
      alert('Honors selection saved! (No CGPA impact)');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  if (!studentId || !department || !academicYear) {
    return (
      <div style={styles.emptyState}>
        <p>⚠️ Missing student information.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.emptyState}>
        <p>Loading honors program...</p>
      </div>
    );
  }

  if (!eligible) {
    return (
      <div style={styles.ineligible}>
        <h2>🏆 Honors Program</h2>
        <div style={styles.requirementBox}>
          <h3>Eligibility Requirements:</h3>
          <p style={{ color: cgpa >= 7.5 ? '#4CAF50' : '#ff4444' }}>
            ✓ CGPA ≥ 7.5 (Current: {cgpa})
          </p>
          <p style={{ color: !hasArrears ? '#4CAF50' : '#ff4444' }}>
            ✓ No arrears history
          </p>
          <p style={styles.note}>
            {cgpa < 7.5 && 'Maintain CGPA ≥ 7.5 to unlock honors.'}
            {hasArrears && 'Clear all arrears to become eligible.'}
          </p>
        </div>
      </div>
    );
  }

  const stream = availableStreams.find(s => s.streamNumber === selectedHonorStream);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🏆 Honors Program (Optional)</h2>
      <div style={styles.badge}>✓ Eligible | CGPA: {cgpa}</div>
      <p style={styles.subtitle}>
        Additional credits (No CGPA impact) | Cannot select overlapping streams
      </p>

      {electiveStream && (
        <p style={styles.info}>
          Your Elective: Stream {electiveStream} | Available for Honors: {availableStreams.map(s => s.streamNumber).join(', ')}
        </p>
      )}

      <div style={styles.streamsGrid}>
        {availableStreams.map(s => (
          <div
            key={s.id}
            onClick={() => handleStreamSelect(s.streamNumber)}
            style={{
              ...styles.streamCard,
              ...(selectedHonorStream === s.streamNumber ? styles.streamCardActive : {})
            }}
          >
            <h3>Stream {s.streamNumber}</h3>
            <h4>{s.streamName}</h4>
            <p style={styles.subjectCount}>{s.subjects.length} subjects</p>
          </div>
        ))}
      </div>

      {stream && (
        <div style={styles.subjectSelection}>
          <h3>Select Subjects from {stream.streamName}</h3>
          <p style={styles.honorsNote}>⭐ Honors credits are additional and won't affect your CGPA</p>

          {[5, 6, 7].map(sem => (
            <div key={sem} style={styles.semesterSection}>
              <h4>Semester {sem} - Select 2 subjects</h4>
              <div style={styles.subjectsGrid}>
                {stream.subjects.slice((sem - 5) * 2, (sem - 4) * 2).map((subject, idx) => {
                  const isSelected = (selectedSubjects[`sem${sem}`] || []).includes(subject.name);
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleSubject(sem, subject.name)}
                      style={{
                        ...styles.subjectCard,
                        ...(isSelected ? styles.subjectCardSelected : {})
                      }}
                    >
                      <div style={styles.checkbox}>
                        {isSelected && '✓'}
                      </div>
                      <div>
                        <p style={styles.subjectName}>{subject.name}</p>
                        <p style={styles.credits}>{subject.credits} credits (Honors)</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button onClick={saveSelection} style={styles.saveBtn}>
            {saved ? '✓ Saved' : 'Save Honors Selection'}
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '20px', maxWidth: '1000px', margin: '0 auto' },
  ineligible: { padding: '20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' },
  emptyState: { padding: '40px', textAlign: 'center', color: '#666', background: '#f9f9f9', borderRadius: '12px' },
  requirementBox: { background: '#f9f9f9', padding: '25px', borderRadius: '12px', marginTop: '20px' },
  note: { marginTop: '15px', color: '#666', fontSize: '14px' },
  title: { marginBottom: '10px', color: '#333' },
  badge: { display: 'inline-block', background: '#4CAF50', color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', marginBottom: '15px' },
  subtitle: { color: '#666', marginBottom: '20px' },
  info: { background: '#fff3cd', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' },
  streamsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' },
  streamCard: { padding: '20px', background: 'white', borderRadius: '10px', cursor: 'pointer', border: '2px solid #e0e0e0', transition: 'all 0.3s' },
  streamCardActive: { border: '2px solid #FF9800', background: '#fff3e0' },
  subjectCount: { color: '#888', fontSize: '14px', marginTop: '10px' },
  subjectSelection: { background: '#f9f9f9', padding: '25px', borderRadius: '12px' },
  honorsNote: { color: '#FF9800', marginBottom: '20px', fontSize: '14px', fontWeight: 'bold' },
  semesterSection: { marginBottom: '25px' },
  subjectsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px', marginTop: '15px' },
  subjectCard: { padding: '15px', background: 'white', borderRadius: '8px', cursor: 'pointer', border: '2px solid #e0e0e0', display: 'flex', gap: '12px', alignItems: 'center', transition: 'all 0.3s' },
  subjectCardSelected: { border: '2px solid #FF9800', background: '#fff3e0' },
  checkbox: { width: '24px', height: '24px', border: '2px solid #ddd', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#FF9800' },
  subjectName: { fontWeight: '500', marginBottom: '5px' },
  credits: { fontSize: '13px', color: '#888' },
  saveBtn: { width: '100%', padding: '15px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px' }
};
