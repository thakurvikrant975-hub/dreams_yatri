export type createPackagesTypes = {
  title: string;
  slug: string;
  thumbnail?: string;
  description?: string;
  destination_id: number;
  inclusions: string[];
  exclusions: string[];
  tags: string[];
  category: string[];
}
