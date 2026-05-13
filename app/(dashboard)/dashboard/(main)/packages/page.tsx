import React from 'react'
import PackagesPage from './PackageClient'

import type { Metadata } from "next";


export const metadata: Metadata = {
    title: "Packages - Dashboard",
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
    <PackagesPage />
  )
}

export default page
