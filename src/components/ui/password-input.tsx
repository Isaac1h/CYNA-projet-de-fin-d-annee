'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  showLabel?: string;
  hideLabel?: string;
};

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      className,
      showLabel = 'Afficher le mot de passe',
      hideLabel = 'Masquer le mot de passe',
      ...rest
    },
    ref,
  ) {
    const [visible, setVisible] = React.useState(false);
    const Icon = visible ? EyeOff : Eye;
    return (
      <div className="relative">
        <input
          ref={ref}
          {...rest}
          type={visible ? 'text' : 'password'}
          className={cn(className, 'pr-10')}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    );
  },
);

export { PasswordInput };
