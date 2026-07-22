import { Badge, Tooltip } from '@kitkat/ui';

/**
 * Top-bar source indicator. In the v1 web app the source is the in-memory
 * inline registry; this component surfaces that clearly and explains the model.
 * (The iframe host backend — demo + URL loading — is the next enhancement.)
 */
export function SourceSwitcher() {
  return (
    <div className="flex items-center gap-2">
      <Tooltip content="Tools registered in the in-memory backend. Use the Editor to add more.">
        <Badge tone="accent" dot>
          inline editor
        </Badge>
      </Tooltip>
      <span className="text-xs text-content-tertiary">·</span>
      <span className="text-xs text-content-muted">no extension, no install — runs entirely in this tab</span>
    </div>
  );
}
