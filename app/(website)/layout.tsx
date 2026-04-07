

export default function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>

      
      <div className="mx-auto" data-layout='website'>
        {children}
      </div>
    </>
  );
}