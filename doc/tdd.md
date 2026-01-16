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

Due to the large amount of material, everything is organized using a Windows-style user interface. Feel free to explore the folders and read the documents. For the best experience, fullscreen mode is recommended (press F11).

[Start]
```

### 5.1.5 Starting animation### 5.1.5 Starting animation

After user clicks [start] button, animation starts. Duration is 2 seconds. Background is zoomed so notebook screen region fits the screen.
For lanscape screen aspect raio, it fits by heigh. For portait, it fits by width.
Notebook region on the room.png image is 226,444 - 532,573. Animation is translation and rotation. As notebook screen is rotated on the room.png, animation should rotate image cw to make it horisontal at he end.



## Glossary

*   **TDD**: Technical Design Document.
*   **Static Site**: A website consisting of pre-built HTML, CSS, and JavaScript files that are served directly to the user without server-side processing.
