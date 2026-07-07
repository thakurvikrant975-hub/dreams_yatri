import DyLogo from "@/app/components/ui/DyLogo";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 py-12">
      <div className="flex items-center gap-2 mb-10">
        <DyLogo className="h-6 text-primary-500" />
        <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-primary-500 bg-primary-50 px-1.5 py-0.5 rounded">
          CONNECT
        </span>
      </div>
      <div className="w-full max-w-sm">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
