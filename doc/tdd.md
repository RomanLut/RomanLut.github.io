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

The landing page is a fullscreen view without scrolling. It displays the `room.png` image.

The image is scaled to fill the screen width horizontally.
It is allowed to crop up to 20% of the upper part of image and up to 10% of bottom part of the image to fill the screen. Top and bottom parts a cropped proportionally. 
If limits are hit, then image is cropped by maximum limits and black bars are placed on the left and right edges.
 
If image is wider than viewport, then image should be croped up to 10% from the left side and up to 60% from the right side proportionally. If limits are hit, then black borders should be added on top and bottom.

When mouse is moved, image should be moved in opposite direction up to 0.5% of with and height. Half-screen mouse movement should result in 0.5% movement of the image.

To avoid introducing black bars with a movement, image cropping calculated above should include minium 1.5% of cropping.

When image is moved to the right, it should be transfomed: the 
image plane should be rotated around middle screen vertical axis. The left side of screen shold became close, the right side should became smaler. Maximum is 1 degree.
The same effect is applied to the left, top and bottom movement.


## Glossary

*   **TDD**: Technical Design Document.
*   **Static Site**: A website consisting of pre-built HTML, CSS, and JavaScript files that are served directly to the user without server-side processing.
