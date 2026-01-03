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
 * Moves native resize handle to the left edge of sidebar.
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
    /* Move native resize handle to left edge of sidebar */
    #root > div[class] > *:first-child > *:first-child {
      right: auto !important;
      left: -6px !important;
    }
  }
`;

// =============================================================================
// EVENT MIRRORING - Let Storybook handle resize, just mirror mouse coordinates
// =============================================================================

let mirrorCleanup: (() => void) | null = null;

/**
 * Mirror mouse X coordinates during drag so that:
 * - Dragging LEFT (toward content) → Storybook sees drag RIGHT → sidebar grows
 * - Dragging RIGHT (toward edge) → Storybook sees drag LEFT → sidebar shrinks
 *
 * This lets Storybook's native resize logic handle all the complexity
 * (column redistribution, persistence, constraints) correctly.
 */
function setupEventMirroring(): void {
  cleanupEventMirroring();

  let isDragging = false;
  let dragStartX = 0;

  /**
   * Check if target is Storybook's native resize handle
   */
  const isResizeHandle = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    const handle = document.querySelector(
      '#root > div[class] > *:first-child > *:first-child',
    );
    return handle !== null && (target === handle || handle.contains(target));
  };

  /**
   * Create a mirrored mouse event with X coordinate reflected around dragStartX
   */
  const createMirroredEvent = (
    original: MouseEvent,
    type: string,
  ): MouseEvent => {
    const mirroredX = 2 * dragStartX - original.clientX;
    return new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: mirroredX,
      clientY: original.clientY,
      screenX: original.screenX,
      screenY: original.screenY,
      ctrlKey: original.ctrlKey,
      shiftKey: original.shiftKey,
      altKey: original.altKey,
      metaKey: original.metaKey,
      button: original.button,
      buttons: original.buttons,
    });
  };

  const onMouseDown = (e: MouseEvent): void => {
    if (!e.isTrusted) return;
    if (!isResizeHandle(e.target)) return;
    isDragging = true;
    dragStartX = e.clientX;
  };

  const onMouseMove = (e: MouseEvent): void => {
    if (!isDragging || !e.isTrusted) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    window.dispatchEvent(createMirroredEvent(e, 'mousemove'));
  };

  const onMouseUp = (e: MouseEvent): void => {
    if (!isDragging || !e.isTrusted) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    window.dispatchEvent(createMirroredEvent(e, 'mouseup'));
    isDragging = false;
  };

  // Capture phase to intercept before Storybook's handlers
  window.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('mouseup', onMouseUp, true);

  mirrorCleanup = () => {
    window.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup', onMouseUp, true);
  };
}

function cleanupEventMirroring(): void {
  mirrorCleanup?.();
  mirrorCleanup = null;
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

  // Set up event mirroring for resize handle
  setupEventMirroring();
}

/**
 * Remove the sidebar-right CSS from the document head.
 */
function removeSidebarRightStyle(): void {
  document.getElementById(STYLE_ID)?.remove();
  cleanupEventMirroring();
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

  // Ensure event mirroring is set up when component mounts
  React.useEffect(() => {
    if (isRight) {
      // Re-setup in case DOM changed (hot reload, navigation, etc.)
      const timer = setTimeout(() => {
        setupEventMirroring();
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
