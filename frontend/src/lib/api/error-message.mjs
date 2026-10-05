const messages = {
  EMPTY_TRAY: '빵을 한 종류 이상 담아주세요.',
  UNKNOWN_BREAD: '빵 목록이 바뀌었어요. 목록을 다시 불러온 뒤 빵을 골라주세요.',
  TAG_REQUIRED_FOR_BREAD: '담을 빵의 취향을 한 개 이상 골라주세요.',
  INVALID_TAG_FOR_BREAD: '선택한 취향이 현재 빵 목록과 맞지 않아요. 다시 골라주세요.',
  TAG_LIMIT_EXCEEDED: '빵마다 서로 다른 태그를 최대 2개까지 골라주세요.',
  CUSTOM_BREAD_LIMIT_EXCEEDED: '목록 외 빵 이름은 최대 5개까지 남길 수 있어요.',
  REVIEW_TARGET_REQUIRED: '리뷰를 남길 빵집을 먼저 선택해주세요.',
  INVALID_VISIT_DATE: '올바른 방문 날짜를 선택해주세요.',
  FUTURE_VISIT_DATE: '방문 날짜는 오늘 또는 이전 날짜로 선택해주세요.',
  INVALID_RATING: '별점을 1~5점 중에서 선택해주세요.',
  EMPTY_REVIEW: '먹은 빵을 고르거나 목록 외 빵 이름을 입력해주세요.',
  SESSION_CHANGED: '로그인 상태가 바뀌었어요. 다시 시도해주세요.',
};

export function errorMessage(error) {
  if (error?.kind === 'api' && error.message) return error.message;
  if (messages[error?.code]) return messages[error.code];
  if (error?.kind === 'network') return '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.';
  if (error?.status === 401) return '로그인이 필요하거나 로그인 정보가 올바르지 않아요.';
  return error?.message || '요청을 완료하지 못했어요. 다시 시도해주세요.';
}
