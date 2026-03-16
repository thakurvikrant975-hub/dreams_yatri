interface Tab {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
}

interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
}