import type { Metadata } from 'next';
import ResetPasswordView from './ResetPasswordView';

export const metadata: Metadata = {
  title: 'Nouveau mot de passe — Cyna',
  description: 'Définissez un nouveau mot de passe pour votre compte Cyna.',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background py-12 sm:py-16">
      <div className="w-full max-w-md px-4 sm:px-6">
        <ResetPasswordView />
      </div>
    </div>
  );
}
