type Props = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/50">
        {title}
      </p>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
