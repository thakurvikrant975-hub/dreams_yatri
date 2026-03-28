'use client';

import { useRouter, usePathname } from 'next/navigation';
import {
    CalendarDateRangeIcon,
    DocumentTextIcon,
    ShieldCheckIcon
} from '@heroicons/react/24/solid';

import Tabs from '@/app/components/ui/Tabs';

export default function PackageTab({ slug, duration, route, stay }: { slug: string, duration: string, route: string, stay: string }) {
    const router = useRouter();
    const pathname = usePathname();

    const tabs = [
        { id: 'Itinary', label: 'Itinary', icon: CalendarDateRangeIcon, path: `/package/${slug}/${duration}/${route}/${stay}` },
        { id: 'Policies', label: 'Policies', icon: DocumentTextIcon, path: `/package/${slug}/${duration}/${route}/${stay}/policy` },
        { id: 'Highlights', label: 'Highlights And Summary', icon: ShieldCheckIcon, path: `/package/${slug}/${duration}/${route}/${stay}/summary` },
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
