// app/auth/magic-callback/page.tsx

"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function MagicCallbackInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token || !email) {
      router.replace("/?auth_error=invalid_link");
      return;
    }

    signIn("credentials", {
      magicSessionToken: token,
      redirect:          false,
    }).then((result) => {
      if (result?.error || !result?.ok) {
        router.replace("/?auth_error=invalid_link");
      } else {
        router.replace("/profile");
      }
    });
  }, []);

  return (
    <div style={{
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      minHeight:      "100vh",
      fontFamily:     "sans-serif",
      color:          "#6b7280",
      fontSize:       "15px",
    }}>
      Signing you in...
    </div>
  );
}

export default function MagicCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        minHeight:      "100vh",  
        fontFamily:     "sans-serif",
        color:          "#6b7280",
        fontSize:       "15px", 
      }}>
        Signing you in...
      </div>
    }>
      <MagicCallbackInner />
    </Suspense> 
  );
}