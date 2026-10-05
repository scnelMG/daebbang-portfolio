import { cn } from '@/lib/utils';

export function Table({ className, ...props }) { return <div className="ui-table-container"><table className={cn('ui-table', className)} {...props} /></div>; }
export function TableHeader(props) { return <thead {...props} />; }
export function TableBody(props) { return <tbody {...props} />; }
export function TableRow(props) { return <tr {...props} />; }
export function TableHead(props) { return <th scope="col" {...props} />; }
export function TableCell(props) { return <td {...props} />; }
