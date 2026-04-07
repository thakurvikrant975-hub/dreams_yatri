// app/(website)/login/page.tsx

"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone]               = useState("");
  const [countryCode, setCountryCode]   = useState("+91");
  const [code, setCode]                 = useState("");
  const [step, setStep]                 = useState<"phone" | "otp">("phone");
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);

  // Step 1 — Send OTP
  async function handleSendOtp() {
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/send-otp", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone, country_code: countryCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
    } else {
      setStep("otp");
    }

    setLoading(false);
  }

  // Step 2 — Verify OTP via NextAuth signIn
  async function handleVerifyOtp() {
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      phone,
      code,
      country_code: countryCode,
      redirect:     false,          // handle redirect manually
    });

    if (result?.error) {
      setError("Invalid or expired OTP.");
    } else {
      router.push("/dashboard");    // NextAuth cookie already set at this point
    }

    setLoading(false);
  }

  return (
    <div>
      {step === "phone" ? (
        <>
          <input
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            placeholder="+91"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
          />
          <button onClick={handleSendOtp} disabled={loading}>
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </>
      ) : (
        <>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter 6-digit OTP"
            maxLength={6}
          />
          <button onClick={handleVerifyOtp} disabled={loading}>
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
          <button onClick={() => setStep("phone")}>Change number</button>
        </>
      )}
      {error && <p>{error}</p>}
    </div>
  );
}

// 4. Reading Session on Server Components
// any server component or route

// import { auth } from "@/auth";

// export default async function DashboardPage() {
//   const session = await auth();

//   if (!session) redirect("/login");

//   return <div>Welcome {session.user.phone}</div>;
// }

// 5. Reading Session on Client Components
// "use client";

// import { useSession } from "next-auth/react";

// export default function Navbar() {
//   const { data: session } = useSession();

//   return <div>{session?.user?.phone}</div>;
// }


// app/layout.tsx

// import { SessionProvider } from "next-auth/react";

// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html>
//       <body>
//         <SessionProvider>
//           {children}
//         </SessionProvider>
//       </body>
//     </html>
//   );
// }



// Cookie Summary
// CookieSet ByTypeExpiresnext-auth.session-tokenNextAuth automaticallyHttpOnly, Secure30 days (default)next-auth.csrf-tokenNextAuth automaticallyHttpOnlySessionnext-auth.callback-urlNextAuth automaticallyHttpOnlySession