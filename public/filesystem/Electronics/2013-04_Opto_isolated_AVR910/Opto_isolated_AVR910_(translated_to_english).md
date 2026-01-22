# USB AVR910 Programmer with Opto-Isolation

> Article published on the [Radiokot](http://radiokot.ru/circuit/digital/pcmod/46/) website on 09.04.2013.

![Finished programmer](images/01.jpg)

With the final transition from desktops to laptops, I had an urgent need for an AVR programmer with a USB interface.

After experimenting with the [Prottoss](https://prottoss.com/projects/AVR910.usb.prog/avr910_usb_programmer.htm) programmer, I discovered that devices with software USB emulation are USB low-speed devices, with a maximum transfer speed of 800 bytes/sec, which leads to low flashing speed. True, if you're lucky, the programmer might work at speeds up to 5KB/sec on USB hosts that don't adhere to the standard. But I wasn't lucky.

In addition, a mandatory requirement for me is galvanic isolation. It's scary to connect devices to a new laptop where there might be, say, 40V! Somewhere a wire might not lie right on the breadboard - and that's it... Still, it's easier to replace a couple of optocouplers than the motherboard.

With this programmer, I would have to install either an expensive galvanic isolation on the USB interface (ADUM 4160), or isolate the 5 SPI interface lines.

It's much simpler to isolate the 2 RS232 interface lines! Therefore, the basis was taken from the [RS232 programmer on ATTINY2313](https://www.klaus-leidinger.de/mp/), and as a USB->RS232 converter - the DKU-5 cable (also known as CA-42) from Nokia.

![DKU-5](images/02.jpg)

This cable costs $5 (practically the price of FT232RL), comes assembled with a connector, case, and cable, and has drivers for all versions of Windows, including x64. The cable outputs 3.3V logic levels. The cable in Chinese version is assembled on some microcontroller that emulates early revision Prolific chips.

![DKU-5 pinout](images/03.jpg)

High-speed optocouplers H11L1 are used for isolation to achieve a communication speed of 115200 baud. Experiments showed that slower PC817 do not allow speeds above 19200.

The programmer is powered from the USB port. An isolated DC-DC converter P10AU-0505ELF is used for isolation. Note that, contrary to the datasheet, the converter's output voltage is not stabilized and is 5.6V without load, so diode D1 is installed to reduce the voltage to 4.8V. The programmer has the ability to power the programmed device (4.5V-4.8V, maximum 400mA - the limit of the DC-DC converter).

![Schematic](images/04_pre.png)

Since the programmer contains a full-featured opto-isolated USB to RS232-TTL converter, I decided to add a switch to RS232-TTL mode to communicate with AVR devices through the programmer. The 74LS32 chip is used so that a switch with one contact group can be installed. You can do without it.

The exchange speed at 115200 baud is ~30KB/sec, but the real programming speed depends on the software. AVRProg allows flashing an ATMega8 in less than 5 seconds, while CVAVR requires 10.

The device is assembled on a breadboard.

![Device](images/05.jpg)

The firmware is taken from the above-mentioned site and modified to get ~1MHz square wave on pin PB2, which can be used to clock the controller if you accidentally flashed incorrect fuses and enabled a non-existent external quartz.

You can use a quartz resonator with a different frequency, but then you need to uncomment the corresponding section in the firmware.

[Firmware and schematic in Proteus](https://www.deep-shadows.com/hax/wordpress/?page_id=793)
