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


#### 5.2.4 Destop screen generic window

Reusable class `AppWindow` renders desktop windows with:
- Header: app icon, title, close/minimize/maximize buttons (hover states; no pointer cursor), double-click header toggles maximize/restore. Drag header to move; z-order focuses.
- Resize: grab edges/corners (resize cursors) with min sizes; text selection disabled during resize.
- Maximize: fills desktop height above the 44px taskbar; restore returns to last bounds.
- Minimize: hides the window; its taskbar button remains and restores on click. Active window is highlighted; clicking active button minimizes, clicking inactive focuses.
- Taskbar buttons show the window icon + title, shrink and clip when space is tight; tray stays visible.
- Windows spawn: one test window on load, additional windows when the taskbar Start button is clicked. Multiple windows are supported.


Reusable class appWindowToolbar simulates toolbar at the bottom of window. 

Reusable class appWindowMenu simulates menu below window header.





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
