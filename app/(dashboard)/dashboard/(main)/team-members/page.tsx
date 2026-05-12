import TeamMembersPage from './TeamMemberClient'
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Team Members",
    description: "Team members of dreams yatri",
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

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default function Page({ searchParams }: PageProps) {
  return (
    <div>
      <TeamMembersPage searchParams={searchParams} />
    </div>
  )
}