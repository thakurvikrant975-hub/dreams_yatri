import Header from "../components/navigation/Header";

export default function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header transparent={true} />
      <div className="mx-auto">
        {children}
      </div>
    </>
  );
}