# storybook-addon-sidebar-position

A Storybook addon that adds a toolbar button to toggle the sidebar position between left and right.

## Installation

```bash
npm install storybook-addon-sidebar-position
# or
pnpm add storybook-addon-sidebar-position
# or
yarn add storybook-addon-sidebar-position
```

## Usage

Add the addon to your `.storybook/main.ts` (or `.storybook/main.js`):

```typescript
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  // ... your config
  addons: [
    // ... other addons
    'storybook-addon-sidebar-position',
  ],
};

export default config;
```

## How It Works

Once installed, you'll see a new sidebar icon in the Storybook toolbar. Click it to toggle the sidebar between left (default) and right positions.

- **Left position**: Default Storybook layout
- **Right position**: Sidebar moves to the right side of the screen

The addon automatically handles:
- Dynamic sidebar width changes
- Fullscreen mode (hides the override when sidebar is hidden)
- State persistence across story navigation and page refreshes (via localStorage)

## Features

- Toggle sidebar position with a single click
- Visual indicator when sidebar is on the right (icon flips)
- Persists preference to localStorage (survives browser refresh)
- Works with all Storybook view modes (story, docs)
- Compatible with Storybook 8.x, 9.x, and 10.x
- Framework agnostic (React, Vue, Angular, etc.)

## Compatibility

| Storybook Version | Supported |
|-------------------|-----------|
| 10.x              | Yes       |
| 9.x               | Yes       |
| 8.x               | Yes       |
| 7.x and below     | No        |

## License

MIT
