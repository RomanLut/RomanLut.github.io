# Modernization of a High-Power Flashlight with a 5-Watt LED

*Article published on [cxem.net](https://cxem.net/cms/drafts/637/preview/)*

As a result of the manufacturer's relentless drive to cut costs, products of such poor quality end up on store shelves that they really ought to be banned from production — otherwise the industry is essentially working straight into the trash bin.

As an example, let's take a flashlight by "Doberman":
Despite looking sturdy on the outside, it turns out to contain a 6V 7Ah lead-acid battery, a switch, and a 6V 20W bulb.

![lighter](images/lighter.jpg)

Anyone familiar with the operating conditions of lead-acid batteries knows that these batteries do not tolerate deep discharge. Quite literally: a dozen deep discharges and storage in a discharged state completely "kill" the battery. In other words, leaving such a flashlight on just a few times means the battery can be thrown away, since a 20W bulb easily drains it to zero.

![charger](images/charger.jpg)

Secondly, the included "charger" is simply a 9V 500mA power supply. A 10 Ohm resistor is installed inside the flashlight to limit the charging current. If you leave the flashlight charging for more than a day, the battery will "boil" and again quickly become unusable.

This is the state in which it came to me: the battery was outputting 3.7V and refused to charge.
Simply buying a new battery didn't make sense, so I decided to add a charge controller inside the flashlight and also convert it to a high-power LED.

![graph1](images/graph1.png)

The electronic internals of the flashlight should include a high-power LED driver and a battery charge/discharge controller. The driver's task is to provide stable current to the LED. The charge controller's task is to ensure a proper battery charging regime. The discharge controller's task is to disconnect the battery from the load when the voltage drops below a set threshold, preventing deep discharge.

## Schematic

Dedicated LED driver and charge controller ICs exist. In my case, however, it was more convenient to use the common ATTiny26 microcontroller to monitor all parameters. Unlike power supplies, where a fast response to current changes is required, in a charging device and LED driver the microcontroller's speed is more than sufficient.

![schematix](images/schematix.png)

The microcontroller monitors the charger connection status and its voltage, charging current, battery voltage, and LED current using ADC inputs 1, 2, 3, 4, 5 respectively (charging current is calculated from the difference between External Voltage and Charge Voltage).

The firmware is designed for use with a two-position switch SW2.
Reed relay RL1 connects the battery to the charger if external power is connected while switch SW2 is off.

Diode D6 is any diode with low forward voltage drop; regulator U2 should preferably be a low-dropout type, but a standard one will also work. At 5.8V on the battery, the voltage on the controller when using a BAT31 diode and a 78l05 regulator is 4.5V, which is acceptable.

All bipolar transistors operate in switching mode and can therefore be replaced with equivalents, taking into account the maximum collector current.

Diodes D2, D3, and D4 are Schottky diodes, for example — 5820.

Resistors R15, R16, R5, R13 are precision resistors, or matched standard ones (it is important to ensure the equality of the ratios R15:R16, R5:R13 — the charging current is measured by the voltage drop).

The inductors were taken from a computer PSU without rewinding. The measured actual inductance is indicated on the schematic.

## Operating Description

If the charger is disconnected, the controller connects the load (5W LED D1) and regulates the output current. If the battery voltage drops below 6V, LED D5 begins blinking slowly (duty cycle — 25%), signaling low battery charge.

![blink_lowbat](images/blink_lowbat.gif)

Pressing button SW1 toggles between two brightness modes (0.9A and 0.45A).
When the battery voltage drops below 5.8V, the load is disconnected.

Charging algorithm:

![UIOU](images/UIOU.png)

When the charger is connected, LED D1 is turned off and the controller begins the battery charging process. In the first phase, the charging current is limited to 0.6A and the battery voltage is limited to 7.35V. LED D5 blinks rapidly with a 50% duty cycle.

![blink_fast_50](images/blink_fast_50.gif)

The controller also monitors the voltage level from the charger. If the external power drops below 7.3V, the charging current will be limited (it is assumed that a low-power supply is connected). A 9–19V power supply or a car cigarette lighter adapter can be used as an external source.

Upon reaching a stable battery voltage of 7.2V–7.35V, the controller begins monitoring whether the charging current has dropped below 0.2A. The LED blinks slowly with a 50% duty cycle.

![blink_slow_50](images/blink_slow_50.gif)

After the charging current drops or after 2 hours have elapsed, the controller switches to standby charging mode — the battery voltage is maintained at 6.8V. In this mode, the battery can remain for an extended period without harm. LED D5 is continuously lit.

![glow](images/glow.jpg)

By pressing button SW1, the flashlight can be turned on during charging. In this case, its current is limited to 0.3A to ensure normal battery charging.

![lighter5](images/lighter5.jpg)

## Firmware

When programming the controller, jumper X1 must be removed, as a very high current may flow to the LED during firmware upload. Accidental experiments showed that a 5W LED can briefly withstand 3A, so no LEDs were harmed during development.

Fuses:

![fuses](images/fuses1.png)

The maximum output current value should not exceed 1.249A, since with a 0.1 Ohm resistor and a x20 multiplier this is exactly the ADC measurement limit. To increase the current, the simplest approach is to use a smaller resistor or remove the x20 multiplier in the firmware.

I tried running the LED at 1.2A — the MOSFET does not heat up. But the LED itself gets very hot, and I had to modify the heatsink. Ultimately, I settled on 0.9A to prevent overheating — the LED operates in an enclosed housing, meaning it has nowhere to dissipate heat. This brightness level is perfectly adequate.

![lighter3](images/lighter3.jpg)

If the component values differ from the schematic, the exact values need to be entered into the firmware source code and recompiled (all constants are defined at the beginning of the main.c file).

![lighter4](images/lighter4.jpg)

## Calibration

Before the first power-on, a 2 Ohm 5W resistor or the original bulb should be connected in place of LED D1. Turn on the device and verify the presence of rectangular pulses on LED PWM. Check the current through the load — the voltage drop across resistor R1 should be approximately 0.9V.

Connect the external power supply. Relay RL1 should engage and the load should disconnect. Verify the presence of rectangular pulses on Charge PWM.

During charging, monitor the voltage and current on the battery (see the graph above).

If something is wrong, enable debug output in the firmware (uncomment the corresponding stx_string() functions) and check what the microcontroller sees. Connect a UART input to pin A7 to view the debug information (19200N1).

## PCB

There is plenty of room inside the flashlight; the design uses through-hole components:

![PCB](images/PCB.png)

![3dview](images/3dview.png)

**In essence, the proposed circuit is a lead-acid battery controller with maximum current limiting. It can be used in other devices as well, for example — a children's electric car with a 6V battery.**

Schematic, PCB layout, firmware (Codevision AVR source code): [lighter_src.zip](lighter_src.zip)

Compiled firmware for the component values shown in the schematic. LED current — 0.9A, charging current — 0.6A, fast charge (cycle use) cutoff voltage — 7.35V, standby mode: 6.8V: [lighter_hex.zip](lighter_hex.zip)

![lighter2](images/lighter2.jpg)

P.S. A month later, the flashlight stopped working... When attempting to charge the battery, the voltage would quickly rise to maximum, as if the battery had "boiled dry" and no longer accepted a charge. I was initially upset: probably a firmware bug, killed the battery... A detailed investigation revealed that the resistance of the Chinese-made switch SW2 at a current of one ampere increased to 100 Ohms, which prevented the controller from functioning normally. After replacing the switch, the circuit resumed normal operation.

## References

- [Cree® XLamp® XT Family LEDs](http://www.cree.com/~/media/Files/Cree/LED%20Components%20and%20Modules/XLamp/Data%20and%20Binning/XLampXTE_BL.pdf)
- [AVR450: Battery Charger for SLA, NiCd, NiMH and Li-Ion Batteries](http://www.gaw.ru/pdf/Atmel/app/avr/AVR450.pdf)
