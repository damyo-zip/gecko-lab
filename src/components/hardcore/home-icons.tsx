export type HomeIconName = "gear" | "leaf" | "coin" | "food" | "plus" | "pen" | "grid" | "heart" | "clock" | "chevron" | "dna" | "collection" | "egg" | "tree" | "shop" | "female" | "male" | "cart" | "calendar" | "refresh" | "star" | "search" | "compare";
/** Stepped, filled silhouettes used only by the reference home UI. */
export function HomeIcon({name,size=24}:{name:HomeIconName;size?:number}) {
  const shapes:Record<HomeIconName,string> = {
    star:"M10 0h4v7h7v3h3v4h-6v3h2v7h-4v-3h-3v-3h-2v3H8v3H4v-7h2v-3H0v-4h3V7h7Z",
    search:"M4 0h10v2h4v4h2v8h-2v3h-2v2h3v2h3v3h-4v-3h-3v-3H4v-2H1V4h3ZM5 4v10h10V4Z",
    compare:"M1 13h5v11H1ZM9 7h5v17H9ZM17 0h6v24h-6Z",
    cart:"M0 1h5v4h17v3h-2v9H6v-3H4V5H0ZM7 8v6h10V8ZM6 19h4v5H6ZM16 19h4v5h-4Z",
    calendar:"M4 0h3v4h10V0h3v4h3v20H1V4h3ZM4 9v12h16V9ZM6 11h3v3H6ZM11 11h3v3h-3ZM16 11h3v3h-3ZM6 16h3v3H6ZM11 16h3v3h-3Z",
    refresh:"M7 1h10v2h4v5h3v3h-9V8h3V5h-3V4H8v2H5v5H2V7h2V3h3ZM0 13h9v3H6v3h3v1h7v-2h3v-5h3v4h-2v4h-3v2H7v-2H3v-5H0Z",
    gear:"M9 2h6v3l3 2 3-1 2 5-3 2v3l2 2-3 4-3-2-3 1-1 3H7v-3l-3-2-3 1-2-5 3-2v-3L0 9l3-4 3 2 3-2ZM9 9v6h6V9Z",
    leaf:"M5 1h4v3h3v3h3v4h-4V8H8V5H5ZM16 11h4v4h3v4h-7v-3h-4v-3H8v-2ZM1 13h4v-3h4v4H6v3H2v3H0v-4ZM10 18h4v3h-3v3H7v-3h3Z",
    coin:"M7 1h10v2h4v4h2v10h-2v4h-4v2H7v-2H3v-4H1V7h2V3h4ZM9 5v2H7v10h2v2h6v-2h2V7h-2V5Zm1 4h4v6h-4Z",
    food:"M8 1h8v2h4v4h3v10h-3v4h-4v2H8v-2H4v-4H1V7h3V3h4ZM9 7v10h6V7Z",
    plus:"M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7Z",
    pen:"m15 2 7 7-3 3-7-7ZM10 7l7 7-9 9H1v-7Z",
    grid:"M2 2h8v8H2ZM14 2h8v8h-8ZM2 14h8v8H2ZM14 14h8v8h-8Z",
    heart:"M3 3h5v2h2v2h4V5h2V3h5v2h2v8h-2v3h-3v3h-3v3H9v-3H6v-3H3v-3H1V5h2Z",
    clock:"M7 1h10v2h4v4h2v10h-2v4h-4v2H7v-2H3v-4H1V7h2V3h4ZM9 5v9h7v-3h-4V5Z",
    chevron:"M7 2h4v3h3v3h3v3h3v2h-3v3h-3v3h-3v3H7v-5h3v-3h3v-4h-3V7H7Z",
    dna:"M4 0h3v3h10V0h3v7h-3v4h-3v3h-3v3H7v4h10v-4h-3v-3h3v3h3v7h-3v-1H7v1H4v-7h3v-4h3v-3h3V7h4V5H7v2h3v3H7V7H4ZM8 9h8v2H8ZM8 15h8v2H8Z",
    collection:"M11 0h3v2h3v2h3v2h3v18H1V6h3V4h3V2h4ZM4 8v13h16V8ZM8 11h8v2h3v5h-3v-2h-3v2H6v-5h2Z",
    egg:"M10 0h4v2h3v3h2v4h2v5h1v6h-2v2h-3v2H7v-2H4v-2H2v-6h1V9h2V5h2V2h3ZM10 5v3h3V5ZM6 12v3h3v-3ZM14 15v4h4v-4ZM8 19v3h3v-3Z",
    tree:"M9 0h6v7H9ZM11 7h2v5h8v4h2v8h-8v-8h3v-2H6v2h3v8H1v-8h2v-4h8Z",
    shop:"M3 1h18v3H3ZM2 5h5v6H1V8ZM9 5h6v6H9ZM17 5h5l1 3v3h-6ZM3 12h18v12h-6v-8H9v8H3Z",
    female:"M7 1h10v2h3v3h2v8h-2v3h-6v3h4v3h-4v1h-4v-1H6v-3h4v-3H4v-3H2V6h2V3h3ZM7 5v9h10V5Z",
    male:"M14 0h10v10h-3V6l-5 5v2h1v6h-3v3H4v-3H1v-9h3V7h9V5l5-2h-4ZM5 11v8h8v-8Z",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" shapeRendering="crispEdges" aria-hidden="true"><path d={shapes[name]}/></svg>;
}
