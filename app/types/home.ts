import { EngineKeys } from "./engine";



export interface HeroTab {
    key: EngineKeys;
    label: string;
    badge?: string;
    icon: React.ElementType
}

export interface HeroField {
    label: string;
    placeholder: string;
    type?: string
}