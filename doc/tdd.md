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
*   Parallax rotation: Horizontal movement applies `rotateY` up to 1° around the viewport’s vertical center axis (right shift makes the right edge recede). Vertical movement applies `rotateX` up to 1° (down shift makes the top recede). The transform origin is pinned to screen center.
*   Perspective: The landing container uses a 1200px centered perspective to support the 3D tilt.

#### 5.1.2 Background image animation

*   The background is drawn on the canvas; a white HDD LED overlay is composited during redraw.
*   LED details: 2px diameter (source pixels) at source coordinates (409, 737), scaling with the rendered image. It blinks on for ~120ms at random intervals between 0.1–5 seconds to simulate a notebook HDD indicator.


## Glossary

*   **TDD**: Technical Design Document.
*   **Static Site**: A website consisting of pre-built HTML, CSS, and JavaScript files that are served directly to the user without server-side processing.
