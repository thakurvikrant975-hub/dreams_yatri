import React from 'react'
import DestinationsPage from './DestinationsClient'
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Destinations - Dashboard",
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
    <DestinationsPage />
  )
}

export default page
