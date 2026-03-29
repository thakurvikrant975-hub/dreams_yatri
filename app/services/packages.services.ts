// app/services/packages.service.ts
import { packagesRepository } from "@/app/repositories/packages.repository";
import type { PaginationInput } from "@/app/types";


export const packagesService = {

  getAll: (pagination: PaginationInput) =>
    packagesRepository.findMany(pagination),

  getPageData: (slug: string, duration: string, route: string, stay: string) =>
    packagesRepository.findPageData(slug, duration, route, stay),

  getPricing: (slug: string) =>
    packagesRepository.findPricing(slug),

  getHotels: (slug: string) =>
    packagesRepository.findHotels(slug),

  getActivities: (slug: string) =>
    packagesRepository.findActivities(slug),

};