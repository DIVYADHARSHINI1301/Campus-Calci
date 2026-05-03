import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, where, setDoc, doc, getDoc } from 'firebase/firestore';

export default function ElectiveSelector({ studentId, department, academicYear, isModal = false }) {
  const [streams, setStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (studentId && department && academicYear) {
      fetchStreams();
      loadSavedSelection();
    }
  }, [studentId, department, academicYear]);

  const fetchStreams = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'electiveStreams'),
        where('department', '==', department),
        where('academicYear', '==', academicYear)
      );
      const snapshot = await getDocs(q);
      const streamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by stream number
      streamsData.sort((a, b) => a.streamNumber - b.streamNumber);
      setStreams(streamsData);
    } catch (error) {
      console.error('Error fetching streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedSelection = async () => {
    try {
      const docRef = doc(db, 'studentElectives', studentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSelectedStream(data.streamNumber);
        setSaved(true);
      }
    } catch (error) {
      console.error('Error loading saved selection:', error);
    }
  };

  const handleStreamSelect = async (streamNumber) => {
    if (saved && !isModal && !confirm('Change your elective stream? This will update your selection.')) {
      return;
    }

    setSelectedStream(streamNumber);
    
    // Auto-save the selection
    try {
      const selectedStreamData = streams.find(s => s.streamNumber === streamNumber);
      
      await setDoc(doc(db, 'studentElectives', studentId), {
        studentId,
        department,
        academicYear,
        streamNumber: streamNumber,
        streamName: selectedStreamData.streamName,
        subjects: selectedStreamData.subjects, // All 6 subjects automatically assigned
        updatedAt: new Date().toISOString()
      });
      
      setSaved(true);
      setShowSuccess(true);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  if (!studentId || !department || !academicYear) {
    return (
      <div style={styles.emptyState}>
        <p>⚠️ Missing student information. Please complete your profile.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.emptyState}>
        <p>Loading elective streams...</p>
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div style={styles.emptyState}>
        <p>📚 No elective streams available yet for {department} ({academicYear}).</p>
        <p style={{ fontSize: '14px', marginTop: '10px', color: '#888' }}>Contact admin to set up elective streams.</p>
      </div>
    );
  }

  // Show success message for 5 seconds after selection
  if (showSuccess) {
    const selectedStreamData = streams.find(s => s.streamNumber === selectedStream);
    return (
      <div style={styles.successContainer}>
        <div style={styles.successIcon}>✅</div>
        <h3 style={styles.successTitle}>Elective Stream Selected!</h3>
        <p style={styles.successMessage}>
          You have successfully selected <strong>{selectedStreamData?.streamName}</strong>
        </p>
        <p style={styles.successNote}>
          All 6 subjects from this stream are now assigned to you. You can edit your selection anytime from your profile.
        </p>
      </div>
    );
  }

  // If already saved and not in modal, don't show anything (only editable from profile)
  if (saved && !isModal) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>{isModal ? 'Edit Your Elective Stream' : 'Which stream do you want to do for elective?'}</h3>
        <p style={styles.subtitle}>Choose ONE stream. All 6 subjects from this stream are mandatory.</p>
      </div>

      <div style={styles.streamsGrid}>
        {streams.map(s => (
          <div
            key={s.id}
            onClick={() => handleStreamSelect(s.streamNumber)}
            style={{
              ...styles.streamCard,
              ...(selectedStream === s.streamNumber ? styles.streamCardActive : {})
            }}
          >
            <div style={styles.streamBadge}>Stream {s.streamNumber}</div>
            <h4 style={styles.streamName}>{s.streamName}</h4>
            <p style={styles.subjectCount}>{s.subjects?.length || 0} subjects (mandatory)</p>
            {selectedStream === s.streamNumber && (
              <div style={styles.selectedBadge}>✓ Selected</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '0' },
  emptyState: { padding: '40px', textAlign: 'center', color: '#666', background: '#f9f9f9', borderRadius: '12px' },
  header: { marginBottom: '30px' },
  title: { fontSize: '20px', fontWeight: 'bold', color: '#333', marginBottom: '8px' },
  subtitle: { color: '#666', fontSize: '14px' },
  streamsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' },
  streamCard: { 
    padding: '24px', 
    background: 'white', 
    borderRadius: '16px', 
    cursor: 'pointer', 
    border: '3px solid #e0e0e0', 
    transition: 'all 0.3s',
    position: 'relative',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    ':hover': { transform: 'translateY(-4px)' }
  },
  streamCardActive: { 
    border: '3px solid #2196F3', 
    background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
    boxShadow: '0 8px 24px rgba(33, 150, 243, 0.3)'
  },
  streamBadge: { 
    display: 'inline-block',
    background: '#2196F3', 
    color: 'white', 
    padding: '6px 14px', 
    borderRadius: '20px', 
    fontSize: '12px', 
    fontWeight: 'bold',
    marginBottom: '12px'
  },
  streamName: { fontSize: '16px', fontWeight: 'bold', color: '#333', marginBottom: '8px', lineHeight: '1.4' },
  subjectCount: { color: '#888', fontSize: '13px', marginTop: '8px' },
  selectedBadge: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: '#4CAF50',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  successContainer: {
    padding: '40px',
    textAlign: 'center',
    background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
    borderRadius: '16px',
    border: '3px solid #4CAF50'
  },
  successIcon: {
    fontSize: '64px',
    marginBottom: '20px',
    animation: 'bounce 1s ease-in-out'
  },
  successTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: '12px'
  },
  successMessage: {
    fontSize: '16px',
    color: '#1b5e20',
    marginBottom: '16px'
  },
  successNote: {
    fontSize: '14px',
    color: '#388e3c',
    fontStyle: 'italic'
  }
};
