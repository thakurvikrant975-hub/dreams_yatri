import React from 'react'
import MealTypesPage from './MealPageClient'
import type { Metadata } from "next";


export const metadata: Metadata = {
    title: "Meal Type - Dashboard",
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
    <MealTypesPage />
  )
}

export default page
