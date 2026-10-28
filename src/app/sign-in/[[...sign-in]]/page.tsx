import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex flex-1 items-start justify-center px-4 py-12">
      <SignIn fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
