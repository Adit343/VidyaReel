import { ForgotForm } from '@/components/auth/ForgotForm';
import { CardAuth } from '@/components/auth/layouts';

export const metadata = { title: 'Forgot password · Vidyareel' };

export default function Page() {
  return (
    <CardAuth chip="SECURE RESET" trust="ENCRYPTED IN TRANSIT">
      <ForgotForm />
    </CardAuth>
  );
}
