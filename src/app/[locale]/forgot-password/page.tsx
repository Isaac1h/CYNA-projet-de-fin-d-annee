import type { Metadata } from 'next';
import ForgotPasswordView from './ForgotPasswordView';

export const metadata: Metadata = {
  title: 'Mot de passe oublié — Cyna',
  description: 'Demandez un lien de réinitialisation pour votre compte Cyna.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background py-12 sm:py-16">
      <div className="w-full max-w-md px-4 sm:px-6">
        <ForgotPasswordView />
      </div>
    </div>
  );
}
