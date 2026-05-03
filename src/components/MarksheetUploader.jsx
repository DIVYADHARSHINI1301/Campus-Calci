import { useState } from "react";

export default function MarksheetUploader({ subjects, onDataExtracted }) {
  const [showInput, setShowInput] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleManualSubmit = () => {
    setError(null);
    setSuccess(false);

    try {
      const lines = manualInput.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error("Please enter at least one subject");
      }

      const extractedData = [];

      for (const line of lines) {
        const parts = line.split('|').map(p => p.trim());
        
        if (parts.length < 3) {
          throw new Error(`Invalid format in line: "${line}". Use format: Subject | Credits | Grade`);
        }

        const subject = parts[0];
        const credit = parseInt(parts[1]);
        const grade = parts[2].toUpperCase();

        const validGrades = ["O", "A+", "A", "B+", "B", "C", "U"];
        if (!validGrades.includes(grade)) {
          throw new Error(`Invalid grade "${grade}". Valid grades: O, A+, A, B+, B, C, U`);
        }

        if (isNaN(credit) || credit < 1 || credit > 10) {
          throw new Error(`Invalid credit "${parts[1]}". Must be 1-10`);
        }

        extractedData.push({ subject, credit, grade });
      }

      const mappedGrades = mapToSubjects(subjects, extractedData);
      onDataExtracted(mappedGrades);
      setSuccess(true);
      setManualInput("");
      
      setTimeout(() => {
        setShowInput(false);
        setSuccess(false);
      }, 2000);

    } catch (err) {
      setError(err.message);
    }
  };

  const mapToSubjects = (subjects, extractedData) => {
    const grades = [];
    const usedIndices = new Set();

    subjects.forEach((sub) => {
      let matchIndex = extractedData.findIndex((ext, i) => 
        !usedIndices.has(i) && ext.credit === sub.credits
      );
      
      if (matchIndex === -1) {
        matchIndex = extractedData.findIndex((ext, i) => {
          if (usedIndices.has(i)) return false;
          
          const subNameLower = sub.name.toLowerCase();
          const extNameLower = ext.subject.toLowerCase();
          
          const cleanSubName = subNameLower
            .replace(/\b(and|the|of|in|to|for|using|with|development|design)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const cleanExtName = extNameLower
            .replace(/\b(and|the|of|in|to|for|using|with|development|design)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          const subWords = cleanSubName.split(' ').filter(w => w.length > 3);
          const extWords = cleanExtName.split(' ').filter(w => w.length > 3);
          
          const matchingWords = subWords.filter(w => 
            extWords.some(ew => ew.includes(w) || w.includes(ew))
          );
          const matchScore = matchingWords.length / Math.max(subWords.length, 1);
          
          return matchScore > 0.3;
        });
      }

      if (matchIndex !== -1) {
        const match = extractedData[matchIndex];
        grades.push(match.grade);
        usedIndices.add(matchIndex);
      } else {
        grades.push("");
      }
    });

    return grades;
  };

  const exampleText = `Problem Solving using C++ | 3 | A
Digital Logic Design | 4 | B
Mathematics I | 4 | A
Applied Science | 4 | A`;

  return (
    <div className="mb-4">
      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-green-300 dark:border-green-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 transition-all"
        >
          <div className="text-3xl">⚡</div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-green-700 dark:text-green-300">
              Quick Fill Grades
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
              Type or paste your grades - Fast & Easy
            </p>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-black shadow-lg">
            Open
          </div>
        </button>
      ) : (
        <div className="border-2 border-green-300 dark:border-green-700 rounded-2xl p-4 bg-white dark:bg-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Enter Your Grades
            </h4>
            <button
              onClick={() => {
                setShowInput(false);
                setError(null);
                setManualInput("");
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl"
            >
              ✕
            </button>
          </div>

          <div className="mb-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">
              📝 Format: Subject Name | Credits | Grade
            </p>
            <pre className="text-[10px] text-blue-600 dark:text-blue-400 font-mono whitespace-pre-wrap">
{exampleText}
            </pre>
          </div>

          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Paste your grades here (one per line)..."
            className="w-full h-40 p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="mt-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-xs">
              ✓ Grades filled successfully!
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleManualSubmit}
              disabled={!manualInput.trim()}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-2.5 rounded-xl text-sm font-black shadow-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ✓ Fill Grades
            </button>
            <button
              onClick={() => setManualInput(exampleText)}
              className="px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              Use Example
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
