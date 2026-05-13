import React from 'react'
import HotelsPage from './HotelPageClient'
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Hotels - Dashboard",
    description: "Hotels",
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
    <HotelsPage />
  )
}

export default page
