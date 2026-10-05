import { Button } from './ui/button';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from './ui/empty';
import { errorMessage } from '../lib/api/error-message.mjs';

export function ApiState({ status, error, onRetry, title, description, children }) {
  return <Empty className="api-state" role={status === 'error' ? 'alert' : 'status'}>
    <EmptyHeader><EmptyTitle>{title || (status === 'error' ? '불러오지 못했어요' : '불러오는 중이에요')}</EmptyTitle>
      <EmptyDescription>{description || (error ? errorMessage(error) : '잠시만 기다려주세요.')}</EmptyDescription></EmptyHeader>
    {onRetry || children ? <EmptyContent>{onRetry ? <Button variant="outline" onClick={onRetry}>다시 시도</Button> : null}{children}</EmptyContent> : null}
  </Empty>;
}
