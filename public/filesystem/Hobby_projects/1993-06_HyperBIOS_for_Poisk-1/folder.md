**HyperBIOS**

**Date:** 1993
**Platform:** POISK-1, DOS
**Language:** 8086 Assembler


The low-cost IBM-compatible PC called **POISK-1**, developed by the Ukrainian company **ElectronMash** in 1992, became a memorable milestone in the lives of many people. Its significance is comparable to the emergence of the ZX Spectrum series.

This was my first home computer. After extensive experimentation, I developed a resident program that replaced the original BIOS and:
- Made screen output 2-3 times faster
- Solved many compatibility issues
- Remapped the keyboard layout for better usability
- Added support for a low-cost joystick interface that I designed myself

Program became very popular, many users considered it the most useful program for this PC 🙂

*The POISK-1 had only two native graphics modes: 320x200x with 4 colors and 640x200 with 2 colors. All standard text modes were emulated by the BIOS by rendering characters within these graphics modes. Direct writes to video memory were intercepted by the BIOS (triggering INT 1), allowing the system to remain compatible with software that accessed video memory directly.*

*HyperBIOS replaced both the INT 10 and INT 1 handlers with highly optimized assembly code, increasing screen output speed by 2-3 times. Performance could have been even better if HyperBIOS had been placed in ROM, which was 2-3 times faster than RAM on this system.*

The joystick interface wiring diagram and source code have unfortunately been lost 🙁