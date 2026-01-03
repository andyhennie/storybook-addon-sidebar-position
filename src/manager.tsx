import * as React from 'react';
import { addons, types, useAddonState } from 'storybook/manager-api';
import { IconButton } from 'storybook/internal/components';
import { SidebarAltIcon } from '@storybook/icons';

import { ADDON_ID, TOOL_ID, STYLE_ID, STORAGE_KEY } from './constants';

// =============================================================================
// MODULE-SCOPE CSS INJECTION (runs immediately when file loads, before React)
// =============================================================================

/**
 * CSS that moves sidebar to the right using RTL direction trick.
 * This reverses the grid column order while preserving Storybook's
 * internal width handling (resizable sidebar continues to work).
 */
const SIDEBAR_RIGHT_CSS = `
  @media (min-width: 600px) {
    /* Reverse grid column visual order */
    #root > div[class] {
      direction: rtl;
    }
    #root > div[class] > * {
      direction: ltr;
    }
    /* Move resize handle to inner edge (between content and sidebar) */
    #root > div[class] > *:first-child > *:first-child {
      right: auto !important;
      left: -7px !important;
    }
  }
`;

/**
 * Inject the sidebar-right CSS into the document head.
 */
function injectSidebarRightStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = SIDEBAR_RIGHT_CSS;
  document.head.appendChild(style);
}

/**
 * Remove the sidebar-right CSS from the document head.
 */
function removeSidebarRightStyle(): void {
  document.getElementById(STYLE_ID)?.remove();
}

/**
 * Check if sidebar should be on the right (from localStorage).
 */
function shouldSidebarBeRight(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'right';
  } catch {
    return false;
  }
}

/**
 * Save sidebar position preference to localStorage.
 */
function setSidebarPosition(isRight: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, isRight ? 'right' : 'left');
  } catch {
    // Ignore localStorage errors
  }
}

// IMMEDIATE INJECTION: If localStorage says "right", inject CSS NOW
// This happens before React renders, eliminating flicker
if (shouldSidebarBeRight()) {
  injectSidebarRightStyle();
}

// =============================================================================
// REACT COMPONENT (for toggle UI only)
// =============================================================================

/**
 * Sidebar position toggle tool.
 * The CSS is already injected at module scope if needed.
 * This component only handles the toggle UI interaction.
 */
function SidebarPositionTool() {
  const [isRight, setIsRight] = React.useState(shouldSidebarBeRight);
  const [, setAddonState] = useAddonState<boolean>(ADDON_ID, isRight);

  const handleToggle = React.useCallback(() => {
    const newValue = !isRight;
    setIsRight(newValue);
    setAddonState(newValue);
    setSidebarPosition(newValue);

    // Update CSS immediately
    if (newValue) {
      injectSidebarRightStyle();
    } else {
      removeSidebarRightStyle();
    }
  }, [isRight, setAddonState]);

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
