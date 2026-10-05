import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { AccountLayout } from './AccountLayout';
import { faqEntries } from './account-data';

export function FaqPage({ go }) {
  return <AccountLayout active="faq" go={go}>
    <header className="page-heading account-heading"><h1>자주 묻는 질문</h1></header>
    <Accordion type="single" collapsible defaultValue="privacy" className="faq-list">{faqEntries.map(({ id, question, answer }) => <AccordionItem value={id} key={id}><AccordionTrigger>{question}</AccordionTrigger><AccordionContent>{answer.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</AccordionContent></AccordionItem>)}</Accordion>
  </AccountLayout>;
}
