import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectGroup } from '@/components/ui/select';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { BreadPhoto } from '../tray/TrayArt';
import { breadCatalog } from '../tray/tray-data';
import { historyPeriods } from './account-model.mjs';
import { displayTagLabel } from '../../lib/tag-labels.mjs';

export const displayDate = (date) => date.replaceAll('-', '.');
export function PeriodFilter({ value, onChange }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label="조회 기간"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{historyPeriods.map(({ value: option, label }) => <SelectItem value={option} key={option}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select>;
}
export function BreadSummary({ name, tags }) {
  const visualKey = breadCatalog.find(({ label }) => label === name)?.id ?? null;
  return <div className="history-bread"><BreadPhoto visualKey={visualKey} /><div><strong>{name}</strong><div className="history-tags">{tags.map((tag, index) => <Badge key={`${tag}:${index}`} active>{displayTagLabel(tag)}</Badge>)}</div></div></div>;
}
export function Rating({ value }) {
  return <span className="history-rating" aria-label={`별점 5점 중 ${value}점`}><span aria-hidden="true">{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={star <= value ? 'is-filled' : ''} />)}</span><strong>{Number(value).toFixed(1)}</strong></span>;
}
export function HistoryEmpty({ title, description, action, onAction }) {
  return <Empty><EmptyHeader><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" onClick={onAction}>{action}</Button></EmptyContent></Empty>;
}
