// CGPA = Σ(all weighted points) / Σ(all credits) across all semesters
export const calculateCGPA = (semDataList) => {
  if (!semDataList.length) return 0;
  const totalWeighted = semDataList.reduce((sum, s) => sum + s.totalWeighted, 0);
  const totalCredits = semDataList.reduce((sum, s) => sum + s.totalCredits, 0);
  return totalCredits > 0 ? (totalWeighted / totalCredits).toFixed(2) : 0;
};
