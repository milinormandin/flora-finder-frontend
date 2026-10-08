"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type AccordionExpandProps = {
  value: string;
  title: string;
  content?: string | null;
};

export default function AccordionExpand({ value, title, content }: AccordionExpandProps) {
  if (!content?.trim()) return null;

  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="py-5 text-base font-medium hover:no-underline">
        {title}
      </AccordionTrigger>
      <AccordionContent className="pb-6">
        <p className="whitespace-pre-line text-base leading-7 text-muted-foreground">{content}</p>
      </AccordionContent>
    </AccordionItem>
  );
}
