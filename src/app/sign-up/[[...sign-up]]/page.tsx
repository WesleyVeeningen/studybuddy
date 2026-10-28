import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex flex-1 items-start justify-center px-4 py-12">
      <SignUp fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
