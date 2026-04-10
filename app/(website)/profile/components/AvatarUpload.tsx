import { cn } from "@/app/lib/utils"
import { CameraIcon } from "@heroicons/react/24/solid"

export function AvatarUpload() {
  return (
    <div className="relative group inline-block">
      <div className="size-24 sm:size-28 rounded-2xl overflow-hidden ring-4 ring-white shadow-lg">
        <div className="size-full bg-linear-to-br from-primary-300 to-primary-600 flex items-center justify-center">
          <span className="text-3xl font-bold text-white select-none">K</span>
        </div>
      </div>
      <button
        className={cn(
          'absolute -bottom-1.5 -right-1.5 size-8 rounded-lg',
          'bg-white border border-neutral-200 shadow-md',
          'flex items-center justify-center',
          'hover:bg-primary-50 hover:border-primary/30 transition-all',
          'group-hover:scale-110'
        )}
        aria-label="Change profile photo"
      >
        <CameraIcon className="size-4 text-primary" />
      </button>
    </div>
  )
}
