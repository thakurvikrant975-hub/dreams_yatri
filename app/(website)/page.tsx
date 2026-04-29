// app/page.tsx
import { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "DreamsYatri | Best Travel Company in India",
  description: "Explore Kashmir, Manali, Dubai & more with DreamsYatri.",
};

export default function Page() {
  return <HomeClient />;
}