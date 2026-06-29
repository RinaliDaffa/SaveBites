/**
 * SaveBites V3 — Card Component Suite
 * Flexible card container with header, body, footer sections.
 */

'use client';

import React from 'react';
import { cn } from '@/components/shared/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden',
        hover && 'transition-shadow duration-200 hover:shadow-lg',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

Card.displayName = 'Card';

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 pt-5 pb-3', className)} {...props} />
  );
}
CardHeader.displayName = 'CardHeader';

function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 py-4', className)} {...props} />
  );
}
CardBody.displayName = 'CardBody';

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 py-4 border-t border-stone-100', className)} {...props} />
  );
}
CardFooter.displayName = 'CardFooter';

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-lg font-semibold text-stone-900', className)} {...props} />
  );
}
CardTitle.displayName = 'CardTitle';

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-stone-500 mt-1', className)} {...props} />
  );
}
CardDescription.displayName = 'CardDescription';

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
Card.Title = CardTitle;
Card.Description = CardDescription;
