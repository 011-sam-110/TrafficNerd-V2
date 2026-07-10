import { cameraProviderLink } from "@/lib/cameras/providerLink";

// Mandatory upstream credit under a camera snapshot. The operator name links to
// its open-data / home page when we can resolve one (the product rule: every
// selector shows its source as a real clickable link); unknown operators stay
// plain text — honest, never a fabricated link.
export function AttributionBadge({ attribution, license }: { attribution: string; license: string }) {
  const src = cameraProviderLink(attribution);
  return (
    <span className="attribution" data-testid="attribution">
      {attribution} · {license}
      {src && (
        <>
          {" · "}
          <a href={src.url} target="_blank" rel="noreferrer noopener">
            {src.label} ↗
          </a>
        </>
      )}
    </span>
  );
}
