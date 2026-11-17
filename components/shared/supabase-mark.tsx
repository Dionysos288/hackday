/* the Supabase mark in the masthead (a redrawn stand-in until the official asset is in). It keeps the brand green on
   every ground: the logo is never recoloured. */
export function SupabaseMark() {
  return (
    <svg viewBox="0 0 109 113" aria-hidden="true" className="h-[21px] w-5 flex-none fill-brand">
      <path className="fill-[color-mix(in_oklch,var(--brand)_62%,var(--c-ground))]" d="M63.708 110.284C60.8455 113.885 55.0414 111.912 54.9725 107.314L53.964 40.0627H99.2193C107.413 40.0627 111.983 49.5228 106.888 55.9374L63.708 110.284Z" />
      <path d="M45.317 2.07103C48.1765 -1.53037 53.9809 0.442937 54.0498 5.04075L54.4916 72.2922H9.80319C1.60924 72.2922 -2.96112 62.8321 2.13456 56.4175L45.317 2.07103Z" />
    </svg>
  );
}
