'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import type { CheckoutStep } from './types';

type StepConfig = { number: CheckoutStep; titleKey: 'step1' | 'step2' | 'step3' | 'step4' };

const STEPS: StepConfig[] = [
  { number: 1, titleKey: 'step1' },
  { number: 2, titleKey: 'step2' },
  { number: 3, titleKey: 'step3' },
  { number: 4, titleKey: 'step4' },
];

type Props = { current: CheckoutStep };

export default function StepIndicator({ current }: Props) {
  const t = useTranslations('checkout.steps');
  return (
    <ol aria-label={t('aria')} className="flex items-center">
      {STEPS.map((step, index) => {
        const isComplete = current > step.number;
        const isCurrent = current === step.number;
        const title = t(step.titleKey);
        const prefix = isComplete
          ? t('completedPrefix')
          : isCurrent
            ? t('currentPrefix')
            : t('futurePrefix');
        return (
          <li
            key={step.number}
            className={index < STEPS.length - 1 ? 'flex flex-1 items-center' : 'flex items-center'}
          >
            <div className="flex flex-col items-center">
              <div
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors sm:h-12 sm:w-12 sm:text-base ${
                  isComplete
                    ? 'bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/30'
                      : 'bg-secondary text-muted-foreground'
                }`}
              >
                {isComplete ? <Check aria-hidden="true" className="h-5 w-5" /> : step.number}
                <span className="sr-only">
                  {prefix} {title}
                </span>
              </div>
              <span
                className={`mt-2 hidden text-xs sm:block ${
                  isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                }`}
              >
                {title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                aria-hidden="true"
                className={`mx-2 h-0.5 flex-1 transition-colors ${
                  isComplete ? 'bg-primary' : 'bg-secondary'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
