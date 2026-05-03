# 🎓 Electives & Honors System - Implementation Guide

## 📋 System Overview

### Key Features
1. **Electives (Mandatory)**: Every student must choose 1 stream and complete 2 subjects per semester
2. **Honors (Optional)**: Students with CGPA ≥7.5 and no arrears can choose additional subjects from non-overlapping streams
3. **Stream Overlap Management**: Prevents selecting overlapping streams for honors
4. **Department-Specific**: Different streams per department and academic year

---

## 🗄️ Database Structure

### Collection: `electiveStreams`
```javascript
{
  department: "IT",
  academicYear: "2024-2028",
  streamNumber: 1,
  streamName: "Machine Learning Engineering",
  subjects: [
    { name: "Exploratory Data Analysis (EDA) using Python", credits: 3 },
    { name: "Statistical Methods and Basic Machine Learning Models", credits: 3 },
    { name: "Advanced ML Techniques", credits: 3 },
    { name: "Natural Language Processing", credits: 3 },
    { name: "Computer Vision", credits: 3 },
    { name: "GenAI Advanced Prompt Engineering & LLMs", credits: 3 }
  ],
  overlappingStreams: [2], // Stream 1 overlaps with Stream 2
  createdAt: "2024-01-15T10:30:00Z"
}
```

### Collection: `studentElectives`
```javascript
{
  studentId: "IT2024001",
  department: "IT",
  academicYear: "2024-2028",
  streamNumber: 1,
  selectedSubjects: {
    sem5: ["Exploratory Data Analysis (EDA) using Python", "Statistical Methods and Basic Machine Learning Models"],
    sem6: ["Advanced ML Techniques", "Natural Language Processing"],
    sem7: ["Computer Vision", "GenAI Advanced Prompt Engineering & LLMs"]
  },
  updatedAt: "2024-01-15T10:30:00Z"
}
```

### Collection: `studentHonors`
```javascript
{
  studentId: "IT2024001",
  department: "IT",
  academicYear: "2024-2028",
  streamNumber: 3, // Must be non-overlapping with elective stream
  selectedSubjects: {
    sem5: ["Implementing and Administering Enterprise Networks", "Linux System Administration"],
    sem6: ["Information Security Systems", "Low Code – No Code Application Building"],
    sem7: ["Virtualization, Cloud Computing and SysOps", "Continuous Monitoring and Observability (AWS)"]
  },
  cgpaAtSelection: 8.2,
  updatedAt: "2024-01-15T10:30:00Z"
}
```

---

## 🔧 Integration Steps

### 1. Admin Page Integration

Add to your `Admin.jsx`:

```javascript
import ElectiveStreamsManager from './components/ElectiveStreamsManager';

// Add a new tab/section in your admin panel
<div>
  <h2>Manage Elective Streams</h2>
  <ElectiveStreamsManager />
</div>
```

### 2. Student Dashboard Integration

Add to your `Dashboard.jsx`:

```javascript
import ElectiveSelector from './components/ElectiveSelector';
import HonorsSelector from './components/HonorsSelector';

// Inside your dashboard component
const [studentData, setStudentData] = useState({
  id: 'IT2024001',
  department: 'IT',
  academicYear: '2024-2028',
  cgpa: 8.2,
  hasArrears: false
});

// Add sections in your dashboard
<div>
  {/* Electives Section */}
  <section>
    <ElectiveSelector 
      studentId={studentData.id}
      department={studentData.department}
      academicYear={studentData.academicYear}
    />
  </section>

  {/* Honors Section - Only shows if eligible */}
  <section>
    <HonorsSelector 
      studentId={studentData.id}
      department={studentData.department}
      academicYear={studentData.academicYear}
      cgpa={studentData.cgpa}
      hasArrears={studentData.hasArrears}
    />
  </section>
</div>
```

---

## 📊 Business Logic

### Elective Rules
- ✅ Mandatory for all students
- ✅ Choose 1 stream from available streams
- ✅ Select 2 subjects per semester (Semesters 5, 6, 7)
- ✅ Total: 6 subjects = 18 credits
- ✅ Credits count towards CGPA

### Honors Rules
- ✅ Optional (only for eligible students)
- ✅ Eligibility: CGPA ≥ 7.5 AND no arrears
- ✅ Cannot select same stream as elective
- ✅ Cannot select overlapping streams (e.g., if elective is Stream 1, cannot choose Stream 2)
- ✅ Select 2 subjects per semester
- ✅ Credits are additional (DO NOT affect CGPA)

### Stream Overlap Configuration
```javascript
// Example: Stream 1 and Stream 2 share subjects
Stream 1: overlappingStreams: [2]
Stream 2: overlappingStreams: [1]

// Stream 3 and 4 are independent
Stream 3: overlappingStreams: []
Stream 4: overlappingStreams: []
```

---

## 🎨 UI Flow

### Admin Flow
1. Navigate to "Elective Streams Manager"
2. Fill in department, academic year, stream details
3. Add subjects with credits
4. Specify overlapping streams (if any)
5. Save stream
6. View/manage all existing streams

### Student Flow - Electives
1. View available streams for their department/year
2. Select ONE stream
3. For each semester (5, 6, 7):
   - View 2 subjects from the stream
   - Select both subjects
4. Save selection

### Student Flow - Honors
1. System checks eligibility (CGPA ≥ 7.5, no arrears)
2. If eligible:
   - View available streams (excluding elective stream and overlapping streams)
   - Select ONE stream
   - Select 2 subjects per semester
   - Save selection
3. If not eligible:
   - Show requirements and current status

---

## 🔐 Validation Rules

### Frontend Validation
- ✅ Must select exactly 1 stream
- ✅ Must select exactly 2 subjects per semester
- ✅ Cannot save without completing all selections
- ✅ Honors: Check CGPA and arrears before showing options

### Backend Validation (Add to Firebase Rules)
```javascript
// Firestore Security Rules
match /studentElectives/{studentId} {
  allow write: if request.auth.uid == studentId 
    && request.resource.data.selectedSubjects.size() == 3 // 3 semesters
    && request.resource.data.selectedSubjects.sem5.size() == 2
    && request.resource.data.selectedSubjects.sem6.size() == 2
    && request.resource.data.selectedSubjects.sem7.size() == 2;
}

match /studentHonors/{studentId} {
  allow write: if request.auth.uid == studentId 
    && get(/databases/$(database)/documents/students/$(studentId)).data.cgpa >= 7.5
    && get(/databases/$(database)/documents/students/$(studentId)).data.hasArrears == false;
}
```

---

## 📈 CGPA Calculation Impact

### Elective Credits
```javascript
// Include in CGPA calculation
const electiveCredits = 18; // 6 subjects × 3 credits
totalCredits += electiveCredits;
totalGradePoints += (electiveGrade × electiveCredits);
```

### Honors Credits
```javascript
// DO NOT include in CGPA calculation
// Store separately for transcript purposes only
const honorsCredits = 18; // Additional credits
// These are bonus credits shown on transcript but don't affect CGPA
```

---

## 🚀 Quick Setup

### Step 1: Add Components
Copy the 3 component files to your `src/components/` folder:
- `ElectiveStreamsManager.jsx`
- `ElectiveSelector.jsx`
- `HonorsSelector.jsx`

### Step 2: Seed Initial Data (Admin)
Use the ElectiveStreamsManager to add the 4 streams for IT 2024-2028:

**Stream 1**: Machine Learning Engineering (overlaps: [2])
**Stream 2**: Data Analyst with ML Essentials (overlaps: [1])
**Stream 3**: Cloud IT Administration (overlaps: [])
**Stream 4**: Cyber Security (overlaps: [])

### Step 3: Test Flow
1. Admin: Create all 4 streams
2. Student: Select elective stream (e.g., Stream 1)
3. Student: Select 2 subjects per semester
4. Student: If CGPA ≥ 7.5, select honors from Stream 3 or 4 only

---

## 💡 Future Enhancements

1. **Auto-enrollment**: Automatically enroll students in selected subjects
2. **Grade Entry**: Allow faculty to enter grades for elective/honors subjects
3. **Transcript Generation**: Generate PDF transcripts showing elective + honors
4. **Analytics**: Track popular streams and subject selections
5. **Waitlist**: Handle capacity constraints for popular subjects
6. **Prerequisites**: Add prerequisite checking for advanced subjects

---

## 🐛 Troubleshooting

### Issue: Honors not showing
- Check CGPA ≥ 7.5
- Verify hasArrears = false
- Ensure elective stream is selected first

### Issue: Cannot select stream for honors
- Check if stream overlaps with elective stream
- Verify overlappingStreams array is correctly configured

### Issue: Subjects not loading
- Verify department and academicYear match exactly
- Check Firebase collection name is 'electiveStreams'

---

## 📞 Support

For questions or issues, refer to:
- Firebase Console: Check data structure
- Browser Console: Check for errors
- Component Props: Verify correct data is passed

---

**Created for**: IT Department 2024-2028 Batch
**Last Updated**: January 2024
