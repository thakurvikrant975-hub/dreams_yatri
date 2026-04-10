// app/layout.tsx
import { Providers } from "./providers";

export default function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="mx-auto" data-layout='website'>
        {children}
      </div>
    </Providers>
  );
}