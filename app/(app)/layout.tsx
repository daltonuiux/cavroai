export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Shell (sidebar + topbar) is provided by the root layout.
  // This route group exists for shared data-fetching / auth guards only.
  return <>{children}</>;
}
