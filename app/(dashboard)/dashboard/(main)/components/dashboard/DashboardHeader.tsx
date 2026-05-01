import React from 'react'
import { GreetingBanner } from './Greetingbanner'
import { SalesStatusToggle } from './Salesstatustoggle'
import { CurrentMember } from '@/app/types/members';

interface DashboardHeaderProps {
  member: CurrentMember;
}

const DashboardHeader = ({ member }: DashboardHeaderProps) => {
  return (
    <div className="space-y-6">
      {/* Header row: greeting + status toggle */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <GreetingBanner
              name={member.name}
              role={member.teamRole?.name}
              department={member.department?.name}
            />
            <div className="shrink-0">
              <SalesStatusToggle
                memberId={member.id}
                initialActive={member.isActive}
              />
            </div>
          </div>
      
    </div>
  )
}

export default DashboardHeader
