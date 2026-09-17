/**
 * Per-target caption override. An empty / whitespace-only override is treated
 * as "not set" so it falls back to the post caption. The compose UI's
 * "Customize for {platform}" checkbox writes `""` when checked and empty,
 * and `??` would otherwise send YouTube an empty title ("Untitled").
 */
export function resolvePlatformCaption(
  override: string | null | undefined,
  caption: string | null | undefined,
): string {
  const fromOverride = override?.trim() ?? "";
  if (fromOverride.length > 0) return fromOverride;
  return caption?.trim() ?? "";
}
