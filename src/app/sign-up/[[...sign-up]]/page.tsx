import { SignUp } from "@clerk/nextjs";
import { SetupMessage } from "@/lib/setup-message";
import { isClerkConfigured } from "@/lib/auth";
import { env } from "@/lib/env";
import { Logo } from "@/components/brand/logo";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        {isClerkConfigured() ? (
          <SignUp
            fallbackRedirectUrl={env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL}
          />
        ) : (
          <SetupMessage
            title="Clerk setup required"
            items={[
              "Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to .env.local.",
              "See docs/CLERK_SETUP.md before enabling production authentication.",
            ]}
          />
        )}
      </div>
    </main>
  );
}
