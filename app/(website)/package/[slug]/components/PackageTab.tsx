'use client';

import { useRouter, usePathname } from 'next/navigation';
import {
    CalendarDateRangeIcon,
    DocumentIcon,
    ShieldCheckIcon
} from '@heroicons/react/24/solid';

import Tabs from '@/app/components/ui/Tabs';

export default function PackageTab({ slug }: { slug: string }) {
    const router = useRouter();
    const pathname = usePathname();

    const tabs = [
        { id: 'Itinary', label: 'Itinary', icon: CalendarDateRangeIcon, path: `/package/${slug}` },
        { id: 'Policies', label: 'Policies', icon: DocumentIcon, path: `/package/${slug}/policy` },
        { id: 'Highlights', label: 'Highlights And Summary', icon: ShieldCheckIcon, path: `/package/${slug}/policy` },
    ];

    const activeTab =
        tabs.find(tab => tab.path === pathname)?.id ?? 'Profile';

    return (

        <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(tabId) => {
                const tab = tabs.find(t => t.id === tabId);
                if (tab) router.push(tab.path);
            }}
        />
    );
}
