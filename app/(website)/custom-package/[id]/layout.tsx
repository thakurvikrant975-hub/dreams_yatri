// ─────────────────────────────────────────────────────────────────────────────
// The client's link has no site chrome, on purpose.
//
// This route serves one thing: the itinerary the sales exec designed. That
// document is a whole page in its own right — its own header with the company
// mark and contact details, its own cover, its own footer — so wrapping it in
// the website's header and footer gave the client two of each, and made the
// itinerary read as something embedded in a page rather than being the page.
//
// It is also not a browsing surface. Nobody arrives here to search packages or
// read the blog; they arrive from a message from the person selling them this
// trip, to look at this trip. Site navigation around it is an invitation to
// leave.
//
// The parent (website) layout still applies, and is still wanted: it carries
// the providers, the modal root and the toaster that booking needs.
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomPackageLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
