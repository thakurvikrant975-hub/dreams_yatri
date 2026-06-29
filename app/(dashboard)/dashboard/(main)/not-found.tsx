import Link from "next/link";
import Image from "next/image";

export default function DashboardNotFound() {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-4 text-center pb-20">

            <Image src="/404.png" alt="404" width={620} height={540} priority />

            <h1 className="mt-4 text-4xl font-bold text-gray-800">
                You came to the wrong neighborhood
            </h1>
            <p className="mt-1 text-[7px] font-semibold text-red-400">MotherF****r</p>

            <div className="mt-4 h-px w-20 bg-gray-200" />

            <Link
                href="/dashboard"
                className="mt-5 rounded-full border-2 border-red-500 px-8 py-2.5 text-sm font-semibold uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-colors"
            >
                I was just leaving
            </Link>
        </div>
    );
}