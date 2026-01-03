import * as React from 'react';
import { addons, types, useAddonState } from 'storybook/manager-api';
import { IconButton } from 'storybook/internal/components';
import { SidebarAltIcon } from '@storybook/icons';

import { ADDON_ID, TOOL_ID, STYLE_ID } from './constants';

/**
 * Sidebar position toggle tool.
 * Moves the Storybook sidebar between left (default) and right positions.
 *
 * Uses local state for reactivity and syncs to addon state for persistence.
 */
function SidebarPositionTool() {
  const [addonState, setAddonState] = useAddonState<boolean>(ADDON_ID, false);
  const [isRight, setIsRight] = React.useState(addonState);

  // Sync local state to addon state
  const handleToggle = React.useCallback(() => {
    const newValue = !isRight;
    setIsRight(newValue);
    setAddonState(newValue);
  }, [isRight, setAddonState]);

  // Set up the polling loop for sidebar position
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
