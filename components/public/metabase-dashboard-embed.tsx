interface MetabaseDashboardEmbedProps {
  embedUrl: string;
  title?: string;
}

export function MetabaseDashboardEmbed({
  embedUrl,
  title = "Metabase dashboard",
}: MetabaseDashboardEmbedProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <iframe
        src={embedUrl}
        title={title}
        className="h-[720px] w-full border-0"
        allowTransparency
      />
    </div>
  );
}
