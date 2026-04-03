'use client'

import { Fragment, useState } from 'react'

import { ChevronDownIcon, PlusIcon } from '@heroicons/react/20/solid'
import HotelCard, {HotelTypes} from './components/hotelCard'

const filters = [
  {
    id: 'color',
    name: 'Color',
    options: [
      { value: 'white', label: 'White' },
      { value: 'beige', label: 'Beige' },
      { value: 'blue', label: 'Blue' },
      { value: 'brown', label: 'Brown' },
      { value: 'green', label: 'Green' },
      { value: 'purple', label: 'Purple' },
    ],
  },
  {
    id: 'category',
    name: 'Category',
    options: [
      { value: 'new-arrivals', label: 'All New Arrivals' },
      { value: 'tees', label: 'Tees' },
      { value: 'crewnecks', label: 'Crewnecks' },
      { value: 'sweatshirts', label: 'Sweatshirts' },
      { value: 'pants-shorts', label: 'Pants & Shorts' },
    ],
  },
  {
    id: 'sizes',
    name: 'Sizes',
    options: [
      { value: 'xs', label: 'XS' },
      { value: 's', label: 'S' },
      { value: 'm', label: 'M' },
      { value: 'l', label: 'L' },
      { value: 'xl', label: 'XL' },
      { value: '2xl', label: '2XL' },
    ],
  },
]
const HOTELS: HotelTypes[] = [
  {
    id: 1,
    name:          "Grand Houseboat Srinagar",
    location:      "Dal Lake, Srinagar · Kashmir",
    category:      "Houseboat",
    stars:         4,
    rating:        4.8,
    reviewCount:   124,
    price:         4500,
    originalPrice: 5500,
    checkIn:       "13:00",
    checkOut:      "10:00",
    roomTypes:     2,
    amenities:     ["WiFi", "Breakfast", "Lake view", "Shikara ride", "Restaurant"],
    thumbnail:     "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80",
    href:          "/hotels/grand-houseboat-srinagar",
  },
  {
    id: 2,
    name:          "Hotel Nehru Palace",
    location:      "Boulevard Road, Srinagar · Kashmir",
    category:      "5-Star Hotel",
    stars:         5,
    rating:        4.6,
    reviewCount:   89,
    price:         9000,
    originalPrice: 11000,
    checkIn:       "14:00",
    checkOut:      "11:00",
    roomTypes:     2,
    amenities:     ["Pool", "Spa", "Restaurant", "Gym", "Parking"],
    thumbnail:     "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80",
    href:          "/hotels/hotel-nehru-palace",
  },
  {
    id: 3,
    name:          "Hotel Manuallaya Manali",
    location:      "Old Manali Road, Manali · Himachal Pradesh",
    category:      "4-Star Resort",
    stars:         4,
    rating:        4.7,
    reviewCount:   212,
    price:         6500,
    originalPrice: 8000,
    checkIn:       "14:00",
    checkOut:      "11:00",
    roomTypes:     2,
    amenities:     ["Spa", "Restaurant", "Mountain view", "Bonfire", "WiFi"],
    thumbnail:     "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80",
    href:          "/hotels/hotel-manuallaya-manali",
  },
];




export default function Page() {

  return (
    <main >

      <div className=" pb-24 lg:grid lg:grid-cols-3 lg:gap-x-8 xl:grid-cols-4">
        <aside>
          <h2 className="sr-only">Filters</h2>

          <button
            type="button"
            className="inline-flex items-center lg:hidden"
          >
            <span className="text-sm font-medium text-gray-700">Filters</span>
            <PlusIcon aria-hidden="true" className="ml-1 size-5 shrink-0 text-gray-400" />
          </button>

          <div className="hidden lg:block">
            <form className="divide-y divide-gray-200">
              {filters.map((section) => (
                <div key={section.name} className="py-10 first:pt-0 last:pb-0">
                  <fieldset>
                    <legend className="block text-sm font-medium text-gray-900">{section.name}</legend>
                    <div className="space-y-3 pt-6">
                      {section.options.map((option, optionIdx) => (
                        <div key={option.value} className="flex gap-3">
                          <div className="flex h-5 shrink-0 items-center">
                            <div className="group grid size-4 grid-cols-1">
                              <input
                                defaultValue={option.value}
                                id={`${section.id}-${optionIdx}`}
                                name={`${section.id}[]`}
                                type="checkbox"
                                className="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 indeterminate:border-indigo-600 indeterminate:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto"
                              />
                              <svg
                                fill="none"
                                viewBox="0 0 14 14"
                                className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-gray-950/25"
                              >
                                <path
                                  d="M3 8L6 11L11 3.5"
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="opacity-0 group-has-checked:opacity-100"
                                />
                                <path
                                  d="M3 7H11"
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="opacity-0 group-has-indeterminate:opacity-100"
                                />
                              </svg>
                            </div>
                          </div>
                          <label htmlFor={`${section.id}-${optionIdx}`} className="text-sm text-gray-600">
                            {option.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                </div>
              ))}
            </form>
          </div>
        </aside>

        <section aria-labelledby="product-heading" className="mt-6 lg:col-span-2 lg:mt-0 xl:col-span-3">
          <h2 id="product-heading" className="sr-only">
            Products
          </h2>

          <div className="grid grid-cols-1 gap-y-4  sm:gap-x-6 sm:gap-y-10 lg:gap-x-8">
            {HOTELS.map(hotel => <HotelCard key={hotel.id} hotel={hotel} />)}
          </div>
        </section>
      </div>
    </main>
  )
}
