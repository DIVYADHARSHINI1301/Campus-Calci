export const calculateSGPA = (subjects) => {
  const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
  const totalPoints = subjects.reduce((sum, s) => sum + s.credits * s.gradePoint, 0);
  return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : 0;
};
