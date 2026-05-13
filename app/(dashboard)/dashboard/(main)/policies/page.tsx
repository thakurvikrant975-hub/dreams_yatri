import React from 'react'
import PoliciesPage from './PoliciesClient'
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Policies  - Dashboard",
    description: "",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
};

const page = () => {
  return (
    <PoliciesPage />
  )
}

export default page
