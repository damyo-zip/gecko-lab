export function Icon({ name, size = 18 }: { name: "leaf" | "sun" | "moon" | "sliders" | "grid" | "download" | "arrow" | "spark" | "dna" | "egg" | "tree"; size?: number }) {
  const paths = {
    leaf: "M20 4C11 3 4 6 4 13a7 7 0 0 0 7 7c7 0 10-7 9-16ZM5 19 15 9M10 14v-4M10 14h5",
    sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5",
    moon: "M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z",
    sliders: "M4 7h6M14 7h6M4 17h10M18 17h2M10 4v6M14 14v6",
    grid: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
    download: "M12 3v12M7 10l5 5 5-5M4 16v5h16v-5",
    arrow: "M5 12h14M14 7l5 5-5 5",
    spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z",
    dna: "M7 2c0 7 10 13 10 20M17 2C17 9 7 15 7 22M7 5h10M9 9h6M9 15h6M7 19h10",
    egg: "M12 2C8 2 4 10 4 15a8 7 0 0 0 16 0c0-5-4-13-8-13ZM9 11h1M14 14h1M10 18h1",
    tree: "M9 2h6v6H9ZM3 16h6v6H3ZM15 16h6v6h-6ZM12 8v5M6 16v-3h12v3",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true"><path d={paths[name]} /></svg>;
}
