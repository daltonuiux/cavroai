export type NavItem = {
  label: string;
  href: string;
};

export const primaryNav: NavItem[] = [
  { label: "Dashboard",     href: "/dashboard"     },
  { label: "Clients",       href: "/clients"       },
  { label: "Opportunities", href: "/opportunities" },
];

export const secondaryNav: NavItem[] = [
  { label: "Settings", href: "/settings" },
];
