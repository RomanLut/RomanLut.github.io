**HW Sound blaster 1.0 emulator**
There was a time when Sound blaster was so high-tech and cost so much, that rare people own it. Using my knowledge of digital electronics, I developed and built Sound blaster 1.0 compatible card. It has about 30 chips (just a logical elements, no microcontroller) and emulated digital part of Sound Blaster 1.0.

**Date:** 1996
**Platform:** DOS
*Comments: Unfortunatelly, schematics and firmware have been lost.*

Actually, emulating Sound Blater 1.0 is easy. There are only two output modes: immediate byte-to-DAC output and DMA output. Also care must be taken to emulate SB responce behaviour so games could detect that SB is  resent. Since all games used standart library from Creative, SB detection pattern was known and was hard-wired into emulator. By using simple trigger-switching, it was possible to emulate SB without microcontroller. I also seen microcontroller-based SB emulator  from other author somewhere in the net.