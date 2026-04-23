export type CountryCode = {
    name: string;
    code: string; // unique ISO code — used as Select value
    dial: string; // actual dial prefix e.g. "+91"
    flag: string;
};

export const COUNTRY_CODES: CountryCode[] = [
    { name: "India",                code: "IN",  dial: "+91",  flag: "🇮🇳" },
    { name: "United States",        code: "US",  dial: "+1",   flag: "🇺🇸" },
    { name: "United Kingdom",       code: "GB",  dial: "+44",  flag: "🇬🇧" },
    { name: "United Arab Emirates", code: "AE",  dial: "+971", flag: "🇦🇪" },
    { name: "Australia",            code: "AU",  dial: "+61",  flag: "🇦🇺" },
    { name: "Canada",               code: "CA",  dial: "+1",   flag: "🇨🇦" },
    { name: "Germany",              code: "DE",  dial: "+49",  flag: "🇩🇪" },
    { name: "France",               code: "FR",  dial: "+33",  flag: "🇫🇷" },
    { name: "Singapore",            code: "SG",  dial: "+65",  flag: "🇸🇬" },
    { name: "Nepal",                code: "NP",  dial: "+977", flag: "🇳🇵" },
    { name: "Sri Lanka",            code: "LK",  dial: "+94",  flag: "🇱🇰" },
    { name: "Bangladesh",           code: "BD",  dial: "+880", flag: "🇧🇩" },
    { name: "Pakistan",             code: "PK",  dial: "+92",  flag: "🇵🇰" },
    { name: "Maldives",             code: "MV",  dial: "+960", flag: "🇲🇻" },
    { name: "Bhutan",               code: "BT",  dial: "+975", flag: "🇧🇹" },
    { name: "South Africa",         code: "ZA",  dial: "+27",  flag: "🇿🇦" },
    { name: "Kenya",                code: "KE",  dial: "+254", flag: "🇰🇪" },
    { name: "New Zealand",          code: "NZ",  dial: "+64",  flag: "🇳🇿" },
    { name: "Malaysia",             code: "MY",  dial: "+60",  flag: "🇲🇾" },
    { name: "Thailand",             code: "TH",  dial: "+66",  flag: "🇹🇭" },
    { name: "Japan",                code: "JP",  dial: "+81",  flag: "🇯🇵" },
    { name: "China",                code: "CN",  dial: "+86",  flag: "🇨🇳" },
    { name: "Hong Kong",            code: "HK",  dial: "+852", flag: "🇭🇰" },
    { name: "Qatar",                code: "QA",  dial: "+974", flag: "🇶🇦" },
    { name: "Kuwait",               code: "KW",  dial: "+965", flag: "🇰🇼" },
    { name: "Saudi Arabia",         code: "SA",  dial: "+966", flag: "🇸🇦" },
    { name: "Bahrain",              code: "BH",  dial: "+973", flag: "🇧🇭" },
    { name: "Oman",                 code: "OM",  dial: "+968", flag: "🇴🇲" },
    { name: "Italy",                code: "IT",  dial: "+39",  flag: "🇮🇹" },
    { name: "Spain",                code: "ES",  dial: "+34",  flag: "🇪🇸" },
    { name: "Netherlands",          code: "NL",  dial: "+31",  flag: "🇳🇱" },
    { name: "Switzerland",          code: "CH",  dial: "+41",  flag: "🇨🇭" },
    { name: "Sweden",               code: "SE",  dial: "+46",  flag: "🇸🇪" },
    { name: "Norway",               code: "NO",  dial: "+47",  flag: "🇳🇴" },
    { name: "Denmark",              code: "DK",  dial: "+45",  flag: "🇩🇰" },
    { name: "Russia",               code: "RU",  dial: "+7",   flag: "🇷🇺" },
    { name: "Indonesia",            code: "ID",  dial: "+62",  flag: "🇮🇩" },
    { name: "Philippines",          code: "PH",  dial: "+63",  flag: "🇵🇭" },
    { name: "Vietnam",              code: "VN",  dial: "+84",  flag: "🇻🇳" },
    { name: "Myanmar",              code: "MM",  dial: "+95",  flag: "🇲🇲" },
];

export const DEFAULT_COUNTRY = COUNTRY_CODES[0]; // India