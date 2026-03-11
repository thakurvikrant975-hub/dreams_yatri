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

export interface Feature {
    icon: string;
    title: string;
    description: string;
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
    tagColor?: string;
    title: string;
    subtitle?: string;
}

export interface FeatureCardProps {
    feature: Feature;
    visible: boolean;
    index: number;
}

export interface ReviewCardProps {
    review: Review;
}

export interface BlogCardProps {
    post: BlogPost;
    visible: boolean;
    index: number;
}