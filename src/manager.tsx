import * as React from 'react';
import { addons, types, useAddonState } from 'storybook/manager-api';
import { IconButton } from 'storybook/internal/components';
import { SidebarAltIcon } from '@storybook/icons';

import { ADDON_ID, TOOL_ID, STYLE_ID, STORAGE_KEY } from './constants';

const CUSTOM_HANDLE_ID = 'storybook-sidebar-resize-handle';
const CUSTOM_HANDLE_STYLE_ID = `${CUSTOM_HANDLE_ID}-style`;
const WIDTH_STORAGE_KEY = 'storybook-sidebar-width';

// =============================================================================
// MODULE-SCOPE CSS INJECTION (runs immediately when file loads, before React)
// =============================================================================

/**
 * CSS that moves sidebar to the right using RTL direction trick.
 * Hides Storybook's native resize handle (we provide our own with correct behavior).
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
    /* Hide Storybook's native resize handle - we use our own */
    #root > div[class] > *:first-child > *:first-child {
      display: none !important;
    }
  }
`;

/**
 * CSS for our custom resize handle
 */
const CUSTOM_HANDLE_CSS = `
  #${CUSTOM_HANDLE_ID} {
    position: absolute;
    top: 0;
    left: -5px;
    width: 10px;
    height: 100%;
    cursor: col-resize;
    z-index: 9999;
    background: transparent;
  }
  #${CUSTOM_HANDLE_ID}:hover,
  #${CUSTOM_HANDLE_ID}.dragging {
    background: rgba(100, 100, 255, 0.15);
  }
`;

// Store cleanup function
let resizeCleanup: (() => void) | null = null;

/**
 * Set up custom resize handler for right sidebar.
 * Uses correct drag direction: LEFT = larger, RIGHT = smaller.
 */
function setupCustomResizeHandler(): void {
  // Clean up any existing handler first
  cleanupCustomResizeHandler();

  const root = document.querySelector('#root > div') as HTMLElement | null;
  const sidebar = root?.children[0] as HTMLElement | null;

  if (!root || !sidebar) {
    // DOM not ready, retry
    setTimeout(setupCustomResizeHandler, 100);
    return;
  }

  // Add custom handle CSS
  let handleStyleEl = document.getElementById(CUSTOM_HANDLE_STYLE_ID);
  if (!handleStyleEl) {
    handleStyleEl = document.createElement('style');
    handleStyleEl.id = CUSTOM_HANDLE_STYLE_ID;
    handleStyleEl.textContent = CUSTOM_HANDLE_CSS;
    document.head.appendChild(handleStyleEl);
  }

  // Create custom resize handle
  let handle = document.getElementById(CUSTOM_HANDLE_ID);
  if (handle) {
    handle.remove();
  }
  handle = document.createElement('div');
  handle.id = CUSTOM_HANDLE_ID;
  sidebar.appendChild(handle);

  // Resize state
  let isDragging = false;
  let startX = 0;
  let startWidth = 0;

  const onMouseDown = (e: MouseEvent) => {
    isDragging = true;
    startX = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    handle?.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    // For right sidebar: drag LEFT (negative delta) = LARGER
    // drag RIGHT (positive delta) = SMALLER
    const delta = e.clientX - startX;
    const newWidth = Math.max(200, Math.min(600, startWidth - delta));

    // Update grid columns
    const currentColumns = getComputedStyle(root).gridTemplateColumns;
    const parts = currentColumns.split(' ');
    if (parts.length >= 1) {
      parts[0] = `${newWidth}px`;
      root.style.gridTemplateColumns = parts.join(' ');
    }
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    handle?.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Save width preference
    try {
      const currentWidth = sidebar.getBoundingClientRect().width;
      localStorage.setItem(WIDTH_STORAGE_KEY, String(Math.round(currentWidth)));
    } catch {
      // Ignore storage errors
    }
  };

  // Use capture phase to ensure we get events before Storybook
  handle.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('mouseup', onMouseUp, true);

  // Store cleanup function
  resizeCleanup = () => {
    handle?.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    document.getElementById(CUSTOM_HANDLE_ID)?.remove();
    document.getElementById(CUSTOM_HANDLE_STYLE_ID)?.remove();
    root.style.gridTemplateColumns = '';
  };

  // Restore saved width
  try {
    const savedWidth = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (savedWidth) {
      const width = Number.parseInt(savedWidth, 10);
      if (width >= 200 && width <= 600) {
        const currentColumns = getComputedStyle(root).gridTemplateColumns;
        const parts = currentColumns.split(' ');
        if (parts.length >= 1) {
          parts[0] = `${width}px`;
          root.style.gridTemplateColumns = parts.join(' ');
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clean up custom resize handler
 */
function cleanupCustomResizeHandler(): void {
  if (resizeCleanup) {
    resizeCleanup();
    resizeCleanup = null;
  }
}

/**
 * Inject the sidebar-right CSS into the document head.
 */
function injectSidebarRightStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = SIDEBAR_RIGHT_CSS;
  document.head.appendChild(style);

  // Set up custom resize handler
  requestAnimationFrame(() => {
    setupCustomResizeHandler();
  });
}

/**
 * Remove the sidebar-right CSS from the document head.
 */
function removeSidebarRightStyle(): void {
  document.getElementById(STYLE_ID)?.remove();
  cleanupCustomResizeHandler();
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

  // Ensure resize handler is set up when component mounts
  React.useEffect(() => {
    if (isRight) {
      // Re-setup in case DOM changed (hot reload, navigation, etc.)
      const timer = setTimeout(() => {
        setupCustomResizeHandler();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isRight]);

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
