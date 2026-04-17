import React from 'react'
import { dashboardAuth } from '@/app/lib/auth-dashboard'


async function page() {
    const session = await dashboardAuth();

  return (
    <div>
       Hii <b>{session?.user.name ?? "there"}</b> 👋
    </div>
  )
}

export default page;
