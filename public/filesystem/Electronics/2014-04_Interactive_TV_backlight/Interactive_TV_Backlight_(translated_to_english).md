# Interactive TV Backlight + Mood Lamp + Beat Detector

*Article originally published on [cxem.net](https://cxem.net/sound/light/light94.php)*

I present my version of an interactive TV backlight using an RGB LED strip.

I've been interested in this idea for a long time, but I didn't build a complete device because it required using a laptop. However, recently software for Android appeared that worked even better on the Freelander AP10 media player than on a PC.

## Introduction

![Interactive TV backlight](images/01.jpg)

In brief, for those unfamiliar: interactive monitor or TV backlight illuminates the wall behind the TV according to the image on the screen. This effect looks beautiful and makes watching movies more spectacular.

Currently, there are fully hardware solutions with HDMI stream analysis, but these are closed projects and complex devices to manufacture.

Therefore, devices using a PC as the image source have become widespread, where special software is installed on the PC to control the backlight device.

In the simplest case, the device can be an Arduino Uno with an LED strip directly connected.

There are several device variants with their own software: [Lightpack](https://github.com/Atarity/Lightpack-docs/blob/master/RUS/%D0%9E_%D0%BF%D1%80%D0%BE%D0%B5%D0%BA%D1%82%D0%B5.md), [Paintpack](http://paintpack.ru), [Adalight](http://www.adafruit.com/products/461), [Boblight](https://code.google.com/p/boblight/), [Ardulight](https://code.google.com/p/ardulight/), and others.

### Video demonstration:

[Watch video on YouTube](https://youtu.be/WZPNB0-d4Vw)

### Device capabilities:

- Hardware compatibility with Lightpack, operation in interactive backlight mode controlled by PC or Android media player (USB);
- Turning on/off, switching modes using remote control (IR);
- Brightness adjustment via remote control;
- Turning on/off one external load (audio system) via remote control;
- Standalone "Mood lamp" mode;
- Standalone "color music" mode (sound is listened to via built-in microphone);
- Mode where color music affects Mood lamp or interactive backlight.

![Device in operation](images/02.jpg)

![Backlight on the wall](images/03.jpg)

## Choosing the RGB Strip

Considering the large size of the TV, I decided to use an RGB strip to provide uniform zone lighting instead of clearly visible circular spots from individual LEDs, and simultaneously minimize the length of wires hanging behind the TV.

![RGB strip](images/04.jpg)

There are several types of RGB strips available for sale. We are interested in strips with individually addressable LEDs (or groups of 3 LEDs), built on RGB5050 LEDs. They differ in:

1. Number of LEDs per meter (30 or 60);
2. The chip they are built on (WS2801 or WS2811, or analogs);
3. Individually addressable, or in groups of 3 LEDs;
4. Supply voltage: 12V or 5V;
5. Presence of moisture protection.

Since the price difference between 30 and 60 LEDs is 2 times, and between WS2801 and WS2811 chips is another 2 times, I bought a 5m spool of "12V 5m WS2811IC digital magic RGB 5050 SMD led strip waterproof IP66 in Silicone" on eBay for $43 with shipping, and a 12V 2A power supply for it.

![WS2811 strip](images/05.jpg)

In this strip, every 3 LEDs are connected in series to one WS2811 chip.

![Strip structure](images/06.jpg)

The nominal current of the LEDs is 20mA per color. So for 1 meter we get:

```
20mA * 3 colors * 30/3 groups = 600mA/meter
```

![Current consumption](images/07.jpg)

30 LEDs are enough to watch movies normally in the evening. For daytime viewing, it's better to take a strip with 60 LEDs per meter.

The WS2801 chip is controlled via SPI interface (listens to Data and Clock lines). Software implementation is not difficult.

However, the WS2811 chip is controlled via a single-wire interface with strict timing intervals. Breaking the transmission leads to applying partially received data. Fortunately, procedures for controlling WS2811 strips are already available online. The only thing to understand is that during data transmission, interrupts must be disabled. For one group of LEDs it takes:

```
1.25us * 24bit = 30us
```

For 27 zones:

```
27 * 30us = 810 us
```

Disabling interrupts for the specified period of time may cause some problems (more on this later).

## Choosing the Software

As is known, the main thing in interactive backlight is the host software. Among several options, I settled on [Prizmatik for Lightpack](https://github.com/Atarity/Lightpack-docs/blob/master/RUS/%D0%9E_%D0%BF%D1%80%D0%BE%D0%B5%D0%BA%D1%82%D0%B5.md) software, as this project has clear development plans and received support on Kickstarter. And the deciding factor was the promise to release software for Android.

![Prizmatik](images/08.jpg)

Therefore, I decided to make the hardware compatible with Lightpack (i.e., a USB device based on AT90USB162), since AdaLight/Ardulight interfaces for Android were not promised to be supported (and that's exactly what happened).

The Freelander AP10 Android media player is powerful enough to watch 720p movies with software decoding in MX Player (with hardware decoding, Lightpack software doesn't work).

One Lightpack supports 10 zones. In my case, I got 27 zones, so I decided to modify the firmware so that my device would "pretend" to be 3 Lightpacks.

The firmware was optimized for memory, and 2 more HID interfaces were added.

Despite this, additional zones did not appear in the software.

After two days of searching for errors in the firmware, it turned out that in Prizmatik for Windows, additional zones appear only when launching with a special key (`--wizard`), while Prizmatik for Android simply doesn't support more than one device!

![Settings](images/09.png)

In the latest firmware for Lightpack, a request for the device serial number appeared. Prizmatik for Windows (Lightpack software) normally detects multiple connected devices without a serial number. I couldn't find out whether the absence of a serial number in my device is the cause of the problem, since the authors didn't publish the Android software source code in free access. The submitted bug remains unaddressed. Unfortunately, a serial number is a property of the device, not the interface, so it's fundamentally impossible to assign a unique serial number to each HID interface within a single chip.

![Device](images/10.jpg)

In the end, since the device was assembled for use with an Android media player, I modified the firmware so that 10 zones are interpolated into 27 strip zones, and stopped there for now.

## Schematic Diagram

[![Schematic diagram](images/11.png)](images/11.png)

The device is assembled based on my development board on AT90USB162, to the pins of which additional modules are connected.

![Development board](images/12.jpg)

[![Connection diagram](images/13.png)](images/13.png)

## Relay Module

![Relay module](images/14.jpg)

The relay module is assembled on a prototyping board. Both relays are 5V and switch 220V. Relay RL1 turns on the 12V power supply for the LED strip. Relay RL2 supplies 220V to an external load - in my case, this is an audio system that doesn't have its own remote control.

## IR Command Receiver

The TSOP4836 receiver is glued to the case near a window made of plexiglass and connected to the main board. R1 and C1 are mounted with point-to-point wiring on the receiver pins.

![IR receiver](images/15.jpg)

I used a remote control from a heater.

![Remote control](images/16.jpg)

On the internet, you can find many articles on how to recognize commands from an IR remote. But in this device, there's a trap, which is that to control an RGB strip on WS2811 chips, you need to disable interrupts for a time exceeding the length of an IR command bit. Software decoding of IR commands won't work.

Therefore, specifically for this device, I developed a method of hardware decoding of commands using the microcontroller's UART module.

Button SB1 starts the remote control button learning procedure. The strip flashes red four times. Now you need to press the buttons twice, corresponding to On/Off, External On/Off, Mode: Backlight, Mode: MoodLamp, Brightness+, Brightness-. When the first button is learned, one segment of the strip lights up, and so on.

Color music (beat detector) is turned on/off by pressing the mode selection buttons again.

## Beat Detector

[![Beat Detector schematic](images/17.png)](images/17.png)

The schematic was seen [here](http://tim.cexx.org/?page_id=374). The Beat Detector outputs "1" when a signal peak is detected.

In this device, the implementation must be completely hardware-based, since:
1. The microcontroller lacks an ADC;
2. Interrupts are disabled for long periods.

![Beat Detector board](images/18.png)

On U1:A, a preamplifier is assembled, at the output of which high frequencies are cut off by the R6C3C4 filter. On U1B and Q1, an amplification stage with AGC is assembled. Its output is amplified by the U1:C stage. The D2C8C9R12 and D5C10R14 chains represent two peak detectors operating at different frequencies (see the oscillogram). The last stage U1:D is a comparator, at the output of which "1" appears when a signal peak is detected.

![Oscillogram](images/19.jpg)

This is the most complex part of the schematic. It requires tuning with an oscilloscope.

It is recommended to debug this part of the schematic with power from 4 AA batteries, as power from the USB port contains a large amount of ripple and common-mode noise that can completely override the weak signal from the microphone.

The electret microphone should be as large as possible. Microscopic microphones from phone headsets performed poorly, as they produced a very weak signal and responded poorly to low frequencies.

![Microphone](images/20.png)

The firmware adds a "flash" of LEDs on each beat, ignoring possible chatter at the detector output. This algorithm is not ideal, as the detector may often miss peaks. A "self-oscillator" that adjusts to the detector frequency would work better. Thus, a person continues to count the rhythm for some time even if the beats stop.

Since there is currently an uncertain situation with Android software, I decided to temporarily save the simplified algorithm until it's unclear how much RAM can be allocated for this purpose.

## Firmware

The firmware is a heavily modified Lightpack firmware.

At the moment, only the mode of emulating 3 Lightpacks and the mode of interpolating one Lightpack to 27 zones have been tested.

The `LIGHTPACKS_COUNT` macro sets the number of emulated Lightpack devices.

The `RESAMPLE` macro enables interpolation of 10 Lightpack zones to a larger number of RGB strip zones.

In this case, it's necessary to specify exactly how to interpolate the zones.

The `LZ_***` macros set the position of Lightpack zones on the Andromeda layout.
The `RZ_**` macros set the position of strip zones on the TV.

In my case, the beginning of the strip is in the bottom right corner. The strip wraps around a 37" TV counterclockwise, creating 27 zones (3 LEDs per zone).

![Zone layout](images/21.png)

The device is flashed similarly to Lightpack, via USB port. The process is described [here](https://github.com/Atarity/Lightpack-docs/blob/master/RUS/%D0%9E_%D0%BF%D1%80%D0%BE%D0%B5%D0%BA%D1%82%D0%B5.md).

## Case

The device is assembled in a 130x65x45 case. The power supply was disassembled and placed inside the construction case, inside the aluminum shield.

![Device case](images/22.jpg)

Firmware source code, schematics, and PCBs (Proteus) are in the attached archives.

## Materials

1. [Contactless color music for RGB strip](https://cxem.net/sound/light/light55.php)
2. [Das Blinkenlichten – wearable lighting](http://tim.cexx.org/?page_id=374)
3. [Soyuz-1 - Color music installations](http://lightportal.at.ua/publ/cvetomuzykalnye_ustanovki/sojuz_1/3-1-0-18)
4. [Simple beat detector](http://engineeringentropy.wordpress.com/2013/05/24/a-simple-beat-detector/)
5. [An ambilight system for WS2811 RGB strips](https://github.com/rosterloh/ambilight)
6. [Driving the WS2811 at 800KHz with a 16MHz AVR](http://bleaklow.com/2012/12/02/driving_the_ws2811_at_800khz_with_a_16mhz_avr.html)
7. [Lightpack - USB monitor backlight for enhancing the presence effect](https://github.com/Atarity/Lightpack-docs/blob/master/RUS/%D0%9E_%D0%BF%D1%80%D0%BE%D0%B5%D0%BA%D1%82%D0%B5.md)
8. [Lightpack — ambient backlight for your displays (Kickstarter)](https://www.kickstarter.com/projects/woodenshark/lightpack-ambient-backlight-for-your-displays)
9. [Lightpack — content-driven lighting system](http://lightpack.tv/)
10. [Paintpack - Interactive backlight](http://paintpack.ru)
11. [Adalight - DIY Ambient Monitor Lighting Project Pack](http://www.adafruit.com/products/461)
12. [Boblight - Boblight is a collection of tools for driving lights connected to an external controller](https://code.google.com/p/boblight/)
13. [Ardulight - Interactive backlight](https://code.google.com/p/ardulight/)
14. [IR command recognition using UART on AVR](https://cxem.net/ik/2-21.php)
15. [Das Blinkenlichten – wearable lighting](http://tim.cexx.org/?page_id=374)
16. [WS2811 Datasheet](http://solderingsunday.com/wp-content/uploads/2014/01/ws2811.pdf)
17. [Lightpack bug database](https://code.google.com/p/lightpack/issues/detail?id=355)

## Parts List

| Designation | Type | Value | Quantity | Note |
|-------------|-----|---------|------------|------------|
| U1 | AVR 8-bit MCU | AT90USB162 | 1 | |
| U2 | Protection diode | USB6B1 | 1 | |
| R1, R3 | Resistor | 22 Ω | 2 | |
| R2 | Resistor | 1 MΩ | 1 | |
| R4 | Resistor | 1 kΩ | 1 | |
| R5 | Resistor | 100 kΩ | 1 | |
| R6 | Resistor | 20 kΩ | 1 | |
| C1 | Capacitor | 10nF 50V | 1 | |
| C2, C7 | Capacitor | 4.7µF 6.3V | 2 | |
| C3 | Capacitor | 47µF 6.3V | 1 | |
| C4 | Capacitor | 100nF 6.3V | 1 | |
| C5, C6 | Capacitor | 18 pF | 2 | |
| D1 | Rectifier diode | BAV70 | 1 | |
| X1 | Crystal resonator | 16 MHz | 1 | |
| J1-J7 | Connector | DIL-40 | 1 | |
| SW1 | Button | | 1 | |

## Attached Files

- [LightpackFW_mod.zip](LightpackFW_mod.zip) (2080 KB)
- [Schematics_proteus.zip](Schematics_proteus.zip) (448 KB)
- [https://github.com/psieg/Lightpack](https://github.com/psieg/Lightpack)