/** Hero stats helper for the academy route (static-ish catalog counters). */
export function academyHeroStats(
  academies: { courseCount: number }[],
): { label: string; value: string }[] {
  const totalCourses = academies.reduce((sum, a) => sum + a.courseCount, 0);
  return [
    { label: 'Academies', value: String(academies.length || 4) },
    { label: 'Courses', value: String(totalCourses || 12) },
    { label: 'Price', value: '$0' },
    { label: 'Format', value: 'Self-paced' },
  ];
}
