import React from 'react'
import ActivitiesPage from './ActivityClient'
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Activities - Dashboard",
    description: "",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
            index: false,
            follow: false,
        },
    },
};

const page = () => {
  return (
    <ActivitiesPage />
      
  )
}

export default page
