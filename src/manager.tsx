import * as React from 'react';
import { addons, types, useAddonState } from 'storybook/manager-api';
import { IconButton } from 'storybook/internal/components';
import { SidebarAltIcon } from '@storybook/icons';

import { ADDON_ID, TOOL_ID, STYLE_ID, STORAGE_KEY } from './constants';

/**
 * Read sidebar position preference from localStorage.
 * Returns true if sidebar should be on the right, false otherwise.
 */
function getStoredPosition(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'right';
  } catch {
    return false;
  }
}

/**
 * Save sidebar position preference to localStorage.
 */
function setStoredPosition(isRight: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, isRight ? 'right' : 'left');
  } catch {
    // Ignore localStorage errors (e.g., private browsing)
  }
}

/**
 * Sidebar position toggle tool.
 * Moves the Storybook sidebar between left (default) and right positions.
 *
 * State is persisted to localStorage for permanence across browser sessions.
 * Uses local useState for immediate reactivity, synced to useAddonState for
 * Storybook's internal state management.
 */
function SidebarPositionTool() {
  // Initialize from localStorage
  const storedValue = React.useMemo(() => getStoredPosition(), []);

  // Local state is the source of truth for immediate reactivity
  const [isRight, setIsRight] = React.useState(storedValue);

  // Sync to Storybook's addon state (for internal state management)
  const [, setAddonState] = useAddonState<boolean>(ADDON_ID, storedValue);

  // Handle toggle - update local state, addon state, and localStorage
  const handleToggle = React.useCallback(() => {
    const newValue = !isRight;
    setIsRight(newValue);
    setAddonState(newValue);
    setStoredPosition(newValue);
  }, [isRight, setAddonState]);

  // Set up the polling loop for sidebar position CSS injection
  React.useEffect(() => {
    // Remove style when switching to left
    if (!isRight) {
      document.getElementById(STYLE_ID)?.remove();
      return;
    }

    const gridContainer = document.querySelector<HTMLElement>('#root > div');
    if (!gridContainer) return;

    let lastNavSize = -1;
    let rafId: number;

    const updateStyles = (navSize: number) => {
      const existingStyle = document.getElementById(STYLE_ID);

      if (navSize > 0) {
        // Sidebar visible - inject CSS with dynamic width
        const css = `
          @media (min-width: 600px) {
            #root > div[class] {
              grid-template-areas: 
                "content sidebar"
                "panel sidebar" !important;
              grid-template-columns: 1fr ${navSize}px !important;
            }
          }
        `;

        if (!existingStyle) {
          const el = document.createElement('style');
          el.id = STYLE_ID;
          el.textContent = css;
          document.head.appendChild(el);
        } else if (existingStyle.textContent !== css) {
          existingStyle.textContent = css;
        }
      } else {
        // Fullscreen mode (navSize === 0) - remove CSS override
        existingStyle?.remove();
      }
    };

    const pollForChanges = () => {
      const existingStyle = document.getElementById(STYLE_ID);
      let navSize: number;

      if (existingStyle) {
        // Temporarily remove our style to read the original navSize
        existingStyle.remove();
        const originalColumns =
          getComputedStyle(gridContainer).gridTemplateColumns;
        const match = originalColumns.match(/^(\d+)px/);
        navSize = match ? Number.parseInt(match[1], 10) : 0;
        document.head.appendChild(existingStyle);
      } else {
        const columns = getComputedStyle(gridContainer).gridTemplateColumns;
        const match = columns.match(/^(\d+)px/);
        navSize = match ? Number.parseInt(match[1], 10) : 0;
      }

      if (navSize !== lastNavSize) {
        lastNavSize = navSize;
        updateStyles(navSize);
      }

      rafId = requestAnimationFrame(pollForChanges);
    };

    pollForChanges();

    return () => {
      cancelAnimationFrame(rafId);
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [isRight]);

  return (
    <IconButton
      key={TOOL_ID}
      active={isRight}
      title={isRight ? 'Move sidebar to left' : 'Move sidebar to right'}
      onClick={handleToggle}
    >
      <SidebarAltIcon
        style={{
          transform: isRight ? 'scaleX(-1)' : undefined,
        }}
      />
    </IconButton>
  );
}

// Register the addon
addons.register(ADDON_ID, () => {
  addons.add(TOOL_ID, {
    type: types.TOOL,
    title: 'Sidebar position',
    match: ({ viewMode }) => viewMode === 'story' || viewMode === 'docs',
    render: () => <SidebarPositionTool />,
  });
});
