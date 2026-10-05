// Display aliases only. Backend tag names and numeric IDs remain unchanged.
export function displayTagLabel(name) {
  return ({ 근본: '오리지널', 사파: '이색적인' })[name] ?? name;
}
