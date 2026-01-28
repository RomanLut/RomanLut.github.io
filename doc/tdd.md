# Technical Design Document: Personal Page

## 1. Overview

This document outlines the technical design for a personal portfolio website.

*   **Project:** Personal Page
*   **Language:** TypeScript, which is compiled to HTML/CSS/JS.
*   **Output:** Static files in the `/dist` folder.
*   **Hosting:** GitHub Pages.

## 2. Goals and Objectives

*   To create a modern, responsive, and fast-loading personal website.
*   To showcase projects, skills, and contact information.
*   To serve as a live portfolio and a playground for web technologies.

## 3. Non-Goals

*   This project will not have a server-side backend or a database. It is a purely static site.
*   User accounts or dynamic, user-generated content are out of scope.

## 4. Proposed Architecture

The project will follow a simple, static site generator pattern.

*   **Source Code (`/src`)**:
    *   TypeScript files for logic and interactivity.
    *   Sass/CSS files for styling.
    *   HTML templates or Markdown files for content.
*   **Build Process**:
    *   A build script (e.g., using Vite, Webpack, or `tsc` + other tools) will compile TypeScript to JavaScript.
    *   Sass will be compiled to CSS.
    *   All assets will be bundled and optimized into the `/dist` directory.
*   **Deployment**:
    *   The `/dist` directory will be the root for the GitHub Pages site.
    *   Deployment can be automated using GitHub Actions.

## 5. Component Breakdown

### 5.1. Landing page

#### 5.1.1 Background image

*   Rendering: A canvas fills the landing container, drawing `room.png` as the backdrop.
*   Layout & scaling: The image scales to fill viewport width. Up to 20% top / 10% bottom crop is allowed before adding side bars; when scaled to height, up to 10% left / 60% right crop is allowed before adding top/bottom bars. Cropping is proportional until limits are reached.
*   Buffering: A 1.5% overdraw buffer is added on all sides to avoid revealing bars during parallax shifts.
*   Parallax translate: Cursor movement up to half-screen moves the image in the opposite direction by up to 0.5% of its width/height.
*   Parallax rotation: Horizontal movement applies `rotateY` up to 1° around the viewport's vertical center axis (right shift makes the right edge recede). Vertical movement applies `rotateX` up to 1° (down shift makes the top recede). The transform origin is pinned to screen center.
*   Perspective: The landing container uses a 1200px centered perspective to support the 3D tilt.

#### 5.1.2 Background image composition

room.png contains the notebook and monitor frames with transparent screens; it is drawn last as the frame over the composed content. An offscreen canvas the size of the base image is used to layer content, then the result is copied to the visible canvas.

Layers (draw order top to bottom):
- Notebook screen: `nbscreen.jpg` at (218, 415) when loaded.
- Notebook clock/date: translated to (253, 547), rotated -6°, draws HH:MM in white 22px Space Grotesk, then the date below in white 14px (26px vertical offset); textBaseline is `top`.
- Monitor screen: `mscreen.jpg` at (550, 231) when loaded.
- Monitor noise: tiled 180px texture made of 6×6 grayscale blocks (JPEG-like macroblocks) over the monitor region (550, 231) sized 442×270 with global alpha 0.02.
- Frame: `room.png` covering the full natural size.


#### 5.1.3 Background image animation

*   The background is drawn on the canvas; a white HDD LED overlay is composited during redraw.
*   LED details: 2px diameter (source pixels) at source coordinates (409, 737), scaling with the rendered image. It blinks on for ~120ms at random intervals between 0.1–5 seconds to simulate a notebook HDD indicator.
*   Background noise: A subtle white-noise overlay (tiled, low-res texture) is refreshed at ~30 FPS with low opacity to add slight film grain to the scene.

### 5.1.4 Introduction text

```
Above image, introduction text and "Start" button are shown:

Roman Lut - Personal Page

Welcome to the personal page of Roman Lut.

Due to the large amount of material, everything is organized using a Desktop-style user interface. Feel free to explore the folders and read the documents. For the best experience, fullscreen mode is recommended.

[Start]
```

Below Start button there should be checkbox named "Fullscreen" checked by default.
If Fullscreen checkbox is cheched, than when user clicks "Start", &fulscreen=1 url parameter should be added.


### 5.1.5 Starting animation

After user clicks [start] button, animation starts. Duration is 2 seconds. Background is zoomed so notebook screen region fits the screen.
For lanscape screen aspect raio, it fits by heigh. For portait, it fits by width.
Notebook region on the room.png image is 226,444 - 532,573. Animation is translation and rotation. As notebook screen is rotated on the room.png, animation should rotate image cw to make it horisontal at he end.
At last 300 ms image is faded to blocked screen(5.2.1).

If &fullscreen=1 url parameter is present, the page should switch to fulscreen mode after fading to blocked screen.



### 5.2 Windows PC emulation page

#### 5.2.1 Blocked screen

The viewport is covered by a fixed wallpaper layer:
- Background: `wallpaper.jpg` from `public/`, scaled with `cover`. 
- Clock/date overlay: bottom-left at 64px offsets, white text with subtle shadow; time in Arial 140px bold, date in Arial 48px medium; kept in sync with the notebook clock/date.
 When user clicks [Login], blocked screen fades away in 1 second, revealing Desktop screen.
 Blocked screen should became invisible with display: none. Anmations and updates hsould be stopped.

#### 5.2.2 Desktop Screen

The div is below blocked screen.
The viewport is covered by a fixed wallpaper layer:
- Background: `wallpaper2.jpg` from `public/`, scaled with `cover`

#### 5.2.3 Destop screen taskbar

Desktop screen should contain taskbar at bottom, which visually looks like Windows 11 taskbar.
There is Windows logo button at the left border.
There are a  clock and date at the right border.
There are dummy battery, volume and wifi indicators at tray area.


#### 5.2.4 Desktop screen generic window

Reusable class `AppWindow` renders desktop windows with:
- Header: app icon, title, close/minimize/maximize buttons (hover states; no pointer cursor), double-click header toggles maximize/restore. Drag header to move; z-order focuses.
- Resize: grab edges/corners (resize cursors) with min sizes; text selection disabled during resize.
- Maximize: fills desktop height above the 44px taskbar; restore returns to last bounds.
- Minimize: hides the window; its taskbar button remains and restores on click. Active window is highlighted; clicking active button minimizes, clicking inactive focuses.
- Taskbar buttons show the window icon + title, shrink and clip when space is tight; tray stays visible.
- Windows spawn: one test window on load, additional windows when the taskbar Start button is clicked. Multiple windows are supported.


Reusable class appWindowToolbar simulates toolbar at the bottom of window. 

Reusable class appWindowMenu simulates menu below window header.


#### 5.2.5. Markdown file viewer

Application: **Wordpad** (inherits `AppWindow`, reuses `AppWindowMenu` and status bar).

Behaviour:
- Opens Markdown files from the virtual filesystem and renders them read-only.
- Window title shows the file name; taskbar button shows the same icon/title.
- Menu (File/View/Help stubs) has no functionality yet.
- Status bar is visible on load and stays at the bottom after minimize/restore; shows scroll position as `{current line} / {total lines}`.
- Scrolling: mouse wheel/trackpad; vertical scrollbar styled like other app windows.
- Layout: header menu at top, preview pane fills the rest; no textarea visible.

Markdown support (rendered):
- Headings: `#`..`###` mapped to H1–H3 sizes.
- Text: paragraphs, bold (`**`/`__`), italic (`*`/`_`), inline code (backticks).
- Lists: unordered (`-`). Ordered lists are not supported.
- Links: `[text](url)` open in a new tab.
- Images: `![alt](path)` resolve relative to the markdown file location.
- Images with html tag: <img src="/images/test.jpg" width="50%" align="left">
- Youtube videos: `![alt](path)` ambedded as miniplayer.
- Code blocks: triple backticks rendered in monospace with preserved whitespace.
- Blockquotes: `>` indented with a subtle left border.
- Tables. Example:
| Поток 1                     |              | Поток 2                     |              |
|-----------------------------|--------------|-----------------------------|--------------|
| Ренедринг кадра n = m       | 12 ms * 1.56 | Расчет физики кадра m+1     | 4 ms * 1.56  |
|                             |              | Расчет физики кадра m+2     | 4 ms * 1.56  |
|                             |              | Расчет физики кадра m+3     | 4 ms * 1.56  |
| Present()                   |              |                             |              |
| **Всего**                   | **12 ms * 1.56  ~ 18.72 мс** |              |              |


Non‑supported/other tags are rendered as plain text.

Styling:
- Body font follows desktop default; code uses monospace.
- Content has comfortable padding (16px) and max width of 900px centered.
- Headings use descending sizes and normal weight; links colored blue with hover underline.
- Images are responsive (max-width: 100%) with a light border radius.


#### 5.2.6. Windows spawn behavior

- Base spawn point is (80px, 80px) within the desktop, respecting a 16px margin.
- On creation a window searches for the first non-overlapping position against existing windows, shifting by +32px X and +32px Y.
- When window no longer fits vertically, y is restored to 80 and the process continues (shifting by x and y).
- Only origin is checked. Windows appear on top of eachother, but with shift. The only goal of this bechaviuor is to avoid spawing windows at the same point and same size.
- Up to 500 placement attempts are made; if no free slot is found, the window falls back near the base with a small offset derived from the number of open windows.
- Positions are clamped to keep the full window visible inside the desktop.
- When all windows are closed, spawning restarts from the base point.

#### 5.2.7. Broser app

- Application name: **Browser** (inherits AppWindow; no app menu).
- Window layout: header with icon/title, toolbar/status row, address bar, content area.
- Toolbar/status:
  - Back, Forward (no history yet, disabled style).
  - Reload button.
  - URL input field showing the current address; pressing Enter loads the page.
  - Status text area showing loading/loaded/error messages.
- Content:
  - Uses an `<iframe>` (or similar) to display external sites (e.g., github.com).
  - The iframe fills the remaining window space, scrollable as needed.
- Behavior:
  - When a URL is entered and submitted, status shows “Loading…” then “Done” or error.
  - External sites open in the embedded frame (subject to target site embedding/CORS policies).
  - No top-level app menu is present; only the toolbar/status and content area.


#### 5.2.8. FileExplorer  app

Allow browsing virtual filesystem defied in /public/filesystem/filesystem.json.

- Application name: **FileExporer** (inherits AppWindow; no app menu). 
- Data source: `/public/filesystem/filesystem.json`. No client-side sorting; preserve the order from JSON.
- Generator sorts items alphabetically by display name; FileExplorer shows them in that order.
- Initial path: root (top-level items).
- Layout: header with icon/title, toolbar/status row, path bar, content area.
- Toolbar/status row:
  - Back, Forward buttons (no history yet) rendered disabled style.
  - Up folder button; disabled at root.
  - Read-only breadcrumb; each segment is a button with hover and click to jump to that ancestor. Format: `> CNC > DIY CNC1`.
  - Root breadcrumb is empty or `>` followed by first segment; clicking the first segment returns to root.
  Status bar at the bottom of window:
  - `"{n} item(s)"`, updates when folder changes.
- Content area:
  - Optional header block if folder has `image` or `desc`: left column shows folder image (full image size); right column shows description text; vertical divider between.
  - Below, a list of items in JSON order. Each row has icon + name; desktop icons reused at 30% scale.
  - Rows have hover highlight and click target covering icon + label.
  - Empty folders show a centered “Empty folder” placeholder and still update the status count.
- Behavior:
  - Double Click folder row to navigate into that folder.
  - Double Click wordpad row to open WordPad for that `path`.
  - File paths are relative to `/filesystem/` base when opening.
  - Navigation updates breadcrumbs and status immediately; no history stack needed yet.


## 6. Global state

The applicaiton should have two global states:
- Landing: Landing page is shown.
- PC emulation : PC Emulation is shown.

Starting state is Landing.
If ?start=1 query parameter is specified, then starting state is PC emulation, blocked screen
If ?start=2 query parameter is specified, then starting state is PC emulation, desktop screen.
If &fullscreen=1 parameter is present, page should switch to fulscreen.




## Glossary

*   **TDD**: Technical Design Document.
*   **Static Site**: A website consisting of pre-built HTML, CSS, and JavaScript files that are served directly to the user without server-side processing.
