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


export interface Review {
    id: number;
    name: string;
    package: string;
    date: string;
    rating: number;
    text: string;
    images: string[];
}

export interface BlogPost {
    id: number;
    date: string;
    category: string;
    title: string;
    excerpt: string;
    image: string;
}

export interface SectionHeaderProps {
    tag: string;
    title: string;
    subtitle?: string;
    icon?: React.ElementType;
}

export interface FeatureCardProps {
    icon: React.ElementType;
    title: string;
    description: string;
}

export interface ReviewCardProps {
    review: Review;
}

export interface BlogCardProps {
    post: BlogPost;
    index: number;
}