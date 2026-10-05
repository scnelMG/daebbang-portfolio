// Bag stages: closed → shaking → revealing → open. Moving between bags is instant.
// `freshIndex` marks the one bag whose card is coming out for the first time — only
// that reveal animates; skipping the animation or coming back to an opened bag shows it at rest.
export function createBagState(count) {
  return { activeIndex: 0, stages: Array.from({ length: count }, () => 'closed'), freshIndex: null };
}

export function transitionBags(state, action) {
  const stage = state.stages[state.activeIndex];
  const busy = stage === 'shaking' || stage === 'revealing';
  if (action.type === 'select') {
    if (busy || !Number.isInteger(action.index) || action.index < 0 || action.index >= state.stages.length || action.index === state.activeIndex) return state;
    return { ...state, activeIndex: action.index, freshIndex: null };
  }
  let next;
  if (action.type === 'open' && stage === 'closed') next = action.immediate ? 'open' : 'shaking';
  if (action.type === 'advance' && action.index === state.activeIndex && busy) next = stage === 'shaking' ? 'revealing' : 'open';
  if (action.type === 'finish' && stage && stage !== 'open') next = 'open';
  if (!next) return state;
  const fresh = action.type === 'advance' && stage === 'revealing' && next === 'open';
  return {
    ...state,
    stages: state.stages.map((value, index) => index === state.activeIndex ? next : value),
    freshIndex: fresh ? state.activeIndex : null,
  };
}
