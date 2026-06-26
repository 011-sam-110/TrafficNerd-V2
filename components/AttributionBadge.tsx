export function AttributionBadge({ attribution, license }: { attribution: string; license: string }) {
  return (
    <span className="attribution" data-testid="attribution">
      {attribution} · {license}
    </span>
  );
}
