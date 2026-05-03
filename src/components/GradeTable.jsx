const GRADE_MAP = { O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, U: 0, CO: 0 };

export default function GradeTable({ subjects, grades, onChange }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 border-b border-blue-100 dark:border-slate-600">
            <th className="px-3 py-3 text-left text-xs font-bold text-blue-900 dark:text-slate-200 uppercase tracking-wider">Subject</th>
            <th className="px-3 py-3 text-center text-xs font-bold text-blue-900 dark:text-slate-200 uppercase tracking-wider w-16">Credits</th>
            <th className="px-3 py-3 text-left text-xs font-bold text-blue-900 dark:text-slate-200 uppercase tracking-wider w-16">Grade</th>
            <th className="px-3 py-3 text-center text-xs font-bold text-blue-900 dark:text-slate-200 uppercase tracking-wider w-16">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {subjects.map((sub, i) => {
            const grade = grades[i] || "";
            const gp = GRADE_MAP[grade] ?? "—";
            
            // Determine row background color based on grade
            let rowBgClass = "bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700/50";
            if (grade === "U") {
              rowBgClass = "bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-950/60";
            }
            
            return (
              <tr key={i} className={`${rowBgClass} transition-colors`}>
                <td className="px-2 py-2 text-xs text-slate-800 dark:text-slate-200">{sub.name}</td>
                <td className="px-2 py-2 text-xs text-center text-slate-700 dark:text-slate-300">{sub.credits}</td>
                <td className="px-2 py-2">
                  <select
                    value={grade}
                    onChange={(e) => onChange(i, e.target.value)}
                    className="w-14 px-1 py-0.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">—</option>
                    {Object.keys(GRADE_MAP).map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 text-xs text-center font-medium text-slate-800 dark:text-slate-200">{gp}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
