# Dual-Channel Programmable Laboratory Power Supply

*Article published on [radiokot.ru](https://radiokot.ru/circuit/power/supply/55/)*
**The article took 1st place in the "Congratulate the Cat in Human Style 2016!" article contest!**

![images/01.jpg](images/01.jpg)

## Brief Specifications

![images/02.png](images/02.png)

For a long time, I used a laptop charger, phone chargers, and a simple adjustable power supply converted from an ATX "standby" to power my devices.

I always felt the need for a good laboratory power supply, and I wanted to make it myself.

In the end, armed with laboratory power supply schematics from the internet, I managed to develop a schematic, firmware, and assemble a power supply that has been working flawlessly for over a year now. The result fully satisfied my needs.

Next, I'll try to compress into the article what was done over almost two years with breaks.

## Problem Statement

So, development began with a problem statement, all points of which were ultimately 100% fulfilled:

- dual-channel power supply. Channels are independent. Can be connected in series to obtain bipolar or increased voltage. There is a parameter synchronization mode;
- voltage adjustment range: 0 - 25V;
- current adjustment range: 10mA - 3A. Lower limit of 10mA is desirable for testing LEDs, zener diodes;
- cutoff and current limiting modes. During short circuit in current limiting mode, voltage should drop to zero. Current limiting should respond within 1ms;
- voltage ripple level less than 50mV;
- voltage setting accuracy - up to 100mV;
- current setting accuracy - up to 10mA;
- display of current measured voltage and current (4 digits) on 7-segment LED indicators. These indicators are perfectly readable at any lighting and viewing angle;
- small plastic case Z2W 70x150x180;
- channel control with one encoder
- general power on/off button;
- automatic fan speed control and emergency shutdown when temperature is exceeded;
- high efficiency and low heat generation, operation without forced cooling is desirable;
- primary source must have sufficient power reserve to deliver 3A current across the entire voltage adjustment range;
- maximize use of available parts from computer power supplies, motherboards, energy-saving lamps, radio-controlled toys;
- circuit can use more parts than necessary if they are available or very cheap;
- balance towards circuit simplicity rather than obtaining extraordinary characteristics.

As inspiration, a laptop power supply served, which at its dimensions and complete absence of cooling is capable of delivering 200W!

![images/03.jpg](images/03.jpg)

## Overview of Power Supply Modules

![images/04.png](images/04.png)

The general view of the power supply is shown in the diagram. The primary power supply with two galvanically isolated outputs supplies power to two identical channel controllers. Controllers connect to the display module, each to its own. Both display modules are on the front panel, but they are not galvanically connected. The general power on button connects to the first channel.

## Galvanic Isolation of Channels

Galvanic isolation of measuring modules is itself a non-trivial task. To simplify the circuit, another path was chosen: channels are controlled by completely identical modules, each on its separate microcontroller. Communication between modules is carried out via UART interface, isolated using optocouplers. Both channels are equal, carry out two-way communication for parameter synchronization and for emergency shutdown.

Next, let's examine all modules in more detail.

## Primary Power Supply

![images/05.jpg](images/05.jpg)

As the primary power supply, an unregulated switching power supply 2x38V is used.  
The transformer-based option was immediately rejected for several reasons. First, within the set task, there is simply no space for such a transformer. Second, I didn't have a ready-made transformer, and they are expensive. But I have a whole bunch of faulty ATX power supplies, from whose parts I can make a miniature powerful primary source.

The circuit on IR2153 chip was chosen for its simplicity. In addition, it uses a ready-made transformer from an ATX power supply, which I haven't yet learned to correctly calculate and wind.

![images/06.jpg](images/06.jpg)

However, IR2153 circuits, which are plentiful on the internet, are too simplified. The circuit with all "extra" parts is shown below:

![images/07.jpg](images/07.jpg)

Let's examine the circuit in detail.

All parts for the input part of the circuit (X-capacitor, thermistor, choke, diodes, power capacitors) are desoldered from any ATX power supply.  
Next comes the IR2153 controller, which controls two power keys IRF840, forming a forward converter operating at ~32 kHz frequency.  
Winding L3 serves to power the controller in operating mode. In simplified circuits, the controller is powered through resistor R5, but in this case, ~2W of heat is dissipated on it, which is unacceptable in our case. In this circuit, R5 is maximally increased instead, power supply startup occurs through ~3 seconds after turn-on due to waiting for C5 charge, but then nothing heats up.  
Power transformer TR2 - from ATX power supply at 200W, with modification.

![images/08.jpg](images/08.jpg)

To obtain 38V, it is necessary to unwind the "braid" and connect 3 windings of 5V and 12V windings in series, obtaining 2 independent windings at 38V. The typical connection scheme in an ATX power supply transformer is shown below:

![images/09.jpg](images/09.jpg)

The main thing is not to confuse the winding direction!  
Next, the power winding is wound on top with MGTF wire of minimum diameter:

![images/10.jpg](images/10.jpg)

Next, the transformer is insulated, and on top a shorted turn is made of copper foil, as shown above.

The output part of the circuit represents 2 independent full-bridge rectifiers.  
FR302 diodes from ATX power supply are suitable. Chokes too:

![images/11.jpg](images/11.jpg)

Capacitors at 50V will need to be purchased.

12V taps were planned to power the channel microcontrollers, but in the final version, I had to abandon them, as there was simply no space under the rectifier diodes and capacitors. However, the controller circuit became more universal - requires only 38...40V.

As can be seen, there is no feedback in the circuit. Essentially, it represents an electronic transformer. Output voltage will decrease with increasing load, from 38V to 28V at 3A per channel.

## Primary Source Adjustment Procedure on IR2153

1. From an external power supply, apply 12V to pins 1(+) and 4(-) of the chip (do not connect to mains!) Verify that rectangular pulses ~32kHz are present on the gates of both transistors. Select R4C4 to obtain this frequency.
2. Instead of resistor R5, solder a 47kΩ 2W resistor. Desolder resistor R13 (disable self-powering). Turn on the power supply to mains through a 100W lamp. Load should not be connected. The lamp should flash for a second and go out. After 5 seconds, disconnect from mains and verify that no parts have heated up.  
   If the lamp burns - there is a short circuit somewhere. If the lamp flashes - check the chip power circuit (pins 1,4), check for short circuit in the output rectifier.
3. Turn on to mains and carefully measure voltage on pins 1,4. It should be within 10-15.6V.
4. Load the output rectifier of the self-powering winding with a 1.2kΩ resistor. Turn on and measure voltage. Turn off and wind turns to obtain 16.5-17.5V.
5. Replace resistor R5 with 300kΩ, solder resistor R13. Check circuit operation with self-powering.
6. Remove the lamp and check circuit operation under load in long-term mode.

## Fighting High-Frequency Noise in Primary Power Supply

Separately, it's necessary to consider the issue of noise suppression, or "why all these extra parts are needed".  
In any switching power supply, high-frequency ripples are present. To prevent ripples from going into the mains and not causing radio emission, a filter TR1C1 is installed at the input.

![images/12.jpg](images/12.jpg)

In any transformer, there is parasitic capacitance between windings. There are transformer winding techniques to reduce it, but it's always there. Pulses in the primary winding get into the secondary circuit, as a result of which the potential of the secondary circuit "flies up" relative to neutral by hundreds of volts. Interference occurs in the secondary circuit. These are common-mode noise - they go as if simultaneously on two wires, they cannot be filtered by smoothing filters L1C9, L2C10.  
To fight common-mode noise inside the power supply, so-called Y-capacitors are used. Usually, one capacitor is installed between the minuses of "hot" and "cold" parts, on which high-frequency noise is shorted. At low frequency, the capacitor remains an insulator.

![images/13.jpg](images/13.jpg)

The design feature of a Y-capacitor guarantees that when it fails, it won't go into breakdown, and mains voltage won't get into the secondary circuit. Therefore, only capacitors marked "Y" should be used, not just high-voltage ones.

![images/14.jpg](images/14.jpg)

In our case, everything is somewhat more complex: we plan to connect outputs in series in different configurations. Therefore, several Y capacitors are installed in the circuit, connected in some virtual point, to which a metal screen (tin case) is also connected.

The shorted turn of the transformer (copper screen) is connected to "-" of the hot part! (source Q2).

More about common-mode noise can be learned in articles [3.7] [3.10].

On the "cold" side, a simple LC filter, shunting of diodes with ceramic capacitors, and shunting of electrolytics with tantalum capacitors are used for ripple smoothing and noise filtering. Next, we will have ferrite rings - but about that later.

## Final Assembly of Primary Source

Unfortunately, knowledge was gained in the process, so the board is not final.

![images/15.jpg](images/15.jpg)
![images/16.jpg](images/16.jpg)

Changes were made with point-to-point wiring, in particular - adding the controller power winding and soldering Y-capacitors.

![images/17.jpg](images/17.jpg)

How Y-capacitors were soldered - it's generally scary to show :)

![images/18.jpg](images/18.jpg)

Aluminum heatsinks in the form of 3mm thick plates are screwed to power keys and diode assemblies through insulating pads (taken from the same ATX power supplies).  
After testing, the block is placed in a tin case, cut from ATX power supply and CD-ROM cases.

![images/19.jpg](images/19.jpg)

It's important to provide a large number of ventilation holes. Unfortunately, the transformer from an ATX power supply is designed with forced cooling in mind, so it heats up noticeably even in idle mode. Also, output diodes will heat up under load.

## Channel Controller

![images/20.jpg](images/20.jpg)

To achieve all set goals (high efficiency, low heating, fast response to current limiting), a linear regulator with a switching pre-regulator is used.

A standalone linear regulator would require a huge heatsink, as all excess power above the set voltage must be dissipated on the regulating transistor, and it can reach 150W.

![images/21.jpg](images/21.jpg)

A standalone switching regulator, on the contrary, cannot provide fast response to current limiting, since a large capacitor is part of the output filter.

Using a pre-regulator that outputs voltage 1.2V higher than required, we don't dissipate energy as heat, and so little energy is dissipated on the linear regulator transistor that it can work with a minimal heatsink even at 3A.

The linear regulator circuit is based on a power supply circuit by Koyodza. All its advantages are described in article [2.12]. I liked it for its simplicity and stability of operation during current limiting.

![images/22.jpg](images/22.jpg)

Let's examine the circuit elements in detail.

![images/23.jpg](images/23.jpg)

The switching pre-regulator is built on TL494 controller - the "heart" of most ATX power supplies. The pre-regulator output voltage is set by OUT_SENSE signal - voltage at the power supply output. It is compared with PRE_SENSE signal - voltage at the pre-regulator output, lowered by ~1.2V due to voltage drop across diodes D7, D11 (both signals are reduced by ~10 times with resistive dividers). Thus, the voltage at the pre-regulator output is maintained approximately 1.2V higher than at the power supply output.

*At this stage, development was strongly slowed down, almost to complete despair - couldn't overcome the power supply oscillation. I had to study the quite extensive topic of feedback stability, simulate in LTSpice! [3.11 - 3.17].*

Voltage is supplied to the pre-regulator from the primary source through a choke on the filter board and passes through an improvised fuse FU1, which represents a jumper with ~0.05 wire directly between board traces.  
Choke L1 is wound on a ring from the group stabilization choke of an ATX power supply with 1mm diameter wire until full.

![images/24.jpg](images/24.jpg)

Choke L3 is a ready-made choke from the 12V line of an ATX power supply.

![images/25.jpg](images/25.jpg)

![images/26.jpg](images/26.jpg)

The linear regulator is taken from Koyodza almost unchanged. Component values were corrected to improve stability after simulating the circuit in LTSpice. Diode D5 was added, preventing a battery connected to the power supply from powering the power supply after turn-off. Gain coefficients were changed to bring signals at outputs U1D U1A and inputs U1B, U1C to the 0...3.6V range, corresponding to power supply characteristics 25V/3A (3.6V is the maximum output voltage of LM324 when powered from 5V)..

The digital part of the channel controller is built on ATMega328p microcontroller.

![images/27.jpg](images/27.jpg)

5V power for the microcontroller is also obtained with a switching pre-regulator + linear regulator combination, since LM7805 cannot withstand neither 38V input voltage nor 33V drop at 0.1A.

The switching pre-regulator is built on MC34063 chip. It drops voltage to 7V, and then LM7805 works.  
LM7805 comes in different versions, with tolerance from 0.5 to 5%. Since the stability of microcontroller power supply, which sets reference voltages, depends on the accuracy of the entire power supply, it's better to take a more precise regulator, for example LM7805CV.  
Already during tuning, I made a discovery for myself that MC34063 is not PWM but a relay regulator. If the key opens, the voltage comparator can no longer close it until the end of the pulse. Because of this, with a large voltage difference (38->5V), large ripples appear at the output, which can only be slightly reduced by increasing frequency to the limit - 100kHz (thus reducing pulse length). The pre-regulator output has to be filtered with an additional choke L7. About how to further reduce high-frequency ripples in this combination, you can listen here[3.3].

![images/28.jpg](images/28.jpg)

Ferrite beads for chokes L6 and L7 are obtained from CFL ballasts.

The microcontroller generates reference voltages using PWM. Signals are smoothed by two-stage filters R33R34C17R35C18 and R36R37C19R38C20. PWM with 4096 counts is used, which theoretically allows setting voltage and current with discretization 25/4096=0.0061V, 3/4096=0.0007A.

For voltage and current measurement, the built-in ADC is used, which allows measuring voltage and current with accuracy 25/4096/3.6*5=0.0084V and 3/4096/3.6*5=0.001A if lucky (oversampling up to 4096 - 16 measurements with averaging by 4 is applied), where 3.6 is the maximum voltage at LM324 output, 5 is the ADC reference voltage.

Usually, I make many changes during development, so as a result, I usually don't have a final printed board. But in this case, the board was redesigned for the second controller and it's contained in the archive.

First version board during development:

![images/29.jpg](images/29.jpg)
![images/30.jpg](images/30.jpg)
![images/31.jpg](images/31.jpg)

As can be seen, some conductors need to be reinforced with 1mm^2 copper wire to improve overall accuracy and stability of the power supply.

## Stability

At the controller tuning stage, development was strongly slowed down, almost to complete despair - couldn't overcome the power supply oscillation. I had to study the quite extensive topic of feedback stability, simulate in LTSpice [3.11 - 3.18].

Stability calculation is performed according to the methodology described in [3.18].

Stability of linear stabilizer in voltage stabilization mode:

![images/32.png](images/32.png)

![images/33.png](images/33.png)

Crossover frequency = 7kHz  
Phase margin = 84°  
Gain Margin = 26dB  
Very good indicators.

Stability of linear stabilizer in current limiting mode:

![images/34.png](images/34.png)

Crossover frequency = 5kHz  
Phase margin = 79°  
Gain Margin = 22dB

Stability of pre-regulator + linear stabilizer combination, voltage stabilization mode:

![images/35.png](images/35.png)
![images/36.png](images/36.png)

Crossover frequency = 7kHz  
Phase margin = 85°

## Display Module

The display module board is screwed to the front panel of the Z2W case. Front stands need to be removed.

![images/37.jpg](images/37.jpg)
![images/38.jpg](images/38.jpg)

The display module contains two independent circuits for each channel, consisting of:

- 7-segment indicators, RGB status LEDs, SYNC, CUTOFF LEDs connected to 74HC595 shift registers. Controlled by three wires;
- encoder;
- terminals
- power on button
- 220V on switch.

The power on button and SYNC, CUTOFF LEDs are connected to the first channel.

![images/39.jpg](images/39.jpg)

The status LED is an SMD 5050 from an LED strip. A "fake" is cut from plexiglass for it, so it looks like a regular LED.

![images/40.jpg](images/40.jpg)

I couldn't find quality red terminals - painted with nail polish.

## Filter Board

Significant noise reduction in a switching power supply can be achieved using ferrite beads [3.8] and common mode chokes [3.5,3.9].

All 20uH inductors in the controller circuit are SMD Ferrite beads:

![images/41.jpg](images/41.jpg)

Black-colored parts, desoldered in huge quantities from motherboards and video cards, have zero resistance. Rules for using ferrite beads are simple: don't want the microcontroller to noise the power bus - power through ferrite bead! Don't want noise from the power bus to get to the op-amp - power through ferrite bead! Don't want high-frequency noise to get to the gate - put a ferrite bead! And of course, put bypass capacitors on both sides of the power supply, naturally.

To fight common-mode noise, Common Mode Chokes are used:

![images/42.jpg](images/42.jpg)

Thanks to the special winding [3.5], we can suppress common-mode noise at the power supply output right before the terminals.  
Rings for such chokes are obtained from old CRT monitors and printers - these are the thickenings on wires:

![images/43.jpg](images/43.jpg)

I was too lazy to etch a separate board - milled manually:

![images/44.jpg](images/44.jpg)

The board is attached as a sandwich to the front panel, directly to the terminals. Upper inductors are connected between the primary source and controllers - there simply wasn't more space for them.

![images/45.jpg](images/45.jpg)

## Computer Connection

The power supply connects to a computer via USB interface. A USB<->UART converter is built into the device. The power supply and computer are galvanically isolated.  
Communication with the computer is handled by the master, which has two UART interfaces. On the slave, the second UART is not soldered. The computer communicates with the slave through the master.  
A simple text protocol is implemented (convenient for debugging), protected with checksums.  
The second UART in the master is implemented in software.  
Operating speed: UART1 - 9600, UART2 - 4800.

## Computer Communication Module

The communication module consists of a ready-made USB->UART converter and an optocoupler board.

![images/46.jpg](images/46.jpg)

I use ready-made modules on CH340G chip, as they are cheap, have drivers for all Windows versions, and there's no chance of getting a blocked fake.

![images/47.jpg](images/47.jpg)

From the module, the USB connector must be desoldered and replaced with a "header". The module is inserted from above into the optocoupler board.

![images/48.jpg](images/48.jpg)

The optocoupler, built on PC817 optocouplers, allows communication at speeds up to 19200 baud.

![images/49.jpg](images/49.jpg)

The module is installed on the back wall of the device using a mount, printed on a 3D printer.

## Enclosure Assembly

The disadvantage of dense mounting is that with any failure, you'll have to reach the needed board for a long time. Fortunately - I had a failure only once - a blocking capacitor went into short circuit, the fuse blew.

The back cover was cut from 3mm thick aluminum - it serves as a heatsink for linear regulator transistors. They are attached to it through insulating pads.  
There was no space for the fan inside - it sticks out a bit from the back.

![images/50.jpg](images/50.jpg)

Channel controller boards are installed on stands, one on top of the other.

![images/51.jpg](images/51.jpg)

For the pre-regulator power transistor, a small aluminum heatsink needs to be made, cutting part of a heatsink from a video card. Also, a small (1cm^2 plate) heatsink is needed on the fan driver transistor. Heatsinks and chokes are slightly fixed to the board with sealant.

The primary source is located in the middle, all wires go under it.

![images/52.jpg](images/52.jpg)

One temperature sensor is pushed inside the primary source, the second is pressed against the back wall closer to the transistors. Both sensors are connected to the master. To the slave, sensors are not connected, instead of the TEMP1 sensor, a jumper is installed so the controller works in slave mode.

![images/53.jpg](images/53.jpg)

As temperature sensors, by the way, some germanium diodes work, D9V, I think:

![images/54.jpg](images/54.jpg)

In the front part of the case, on the sides and top, longitudinal ventilation holes 2cm long need to be made - air should pass through the primary source, controllers, and exit at the back.  
The USB-UART module is screwed to the back wall. Stands, USB-UART module mount, speaker mount, heatsink temperature sensor mount, and fan grille were printed on a 3D printer.

![images/55.jpg](images/55.jpg)

The top part of the case is screwed with two M3 screws to aluminum stands with threaded holes.

![images/56.jpg](images/56.jpg)
![images/57.jpg](images/57.jpg)

## Firmware

The firmware is written in CodeVisionAVR 2.05.  
The same firmware is flashed into both controllers. The controller starts working as a slave if a jumper is installed instead of the first temperature sensor.

The firmware can be flashed through the ISP connector, but it's much more convenient to do it via PC software.  
For this, a bootloader is recorded into the controllers, which implements the AVR910 programmer protocol, at 9600 speed for the master and 4800 for the slave. The bootloader selects speed depending on the presence of a jumper instead of the temperature sensor.  
For manual translation of the controller to bootloader mode, you need to hold the encoder button when turning on the device. The controller will display the letter P on the upper indicator. This may be needed for the first firmware flash into the power supply. In the future, PC software can automatically translate controllers to programming mode, firmware of both controllers is flashed via USB, no need to disassemble the device.  
The master performs packet tunneling to provide PC communication with the slave, including firmware flashing. Implementation of such a system with minimal memory costs is the most complex part of the firmware. Communication subroutines use less than 256 bytes of RAM, the rest of the memory is used by the logging system.

The power supply can autonomously maintain an operation log. The log can be viewed by running PC software. You can view battery charging curves. The log contains 200 records. The logging period is set in the settings. When the log is full, the period automatically doubles, the log is compressed, and logging continues.

## PC Software

The software is written in Flash Builder 4.6 environment.

![images/58.jpg](images/58.jpg)

The software allows you to see the front panel indicators, set voltages and currents, turn on/off the device.  
The main application of the software is firmware update and configuration. All this can be done without software, but it's much more convenient.

![images/59.jpg](images/59.jpg)

## Control Elements Description

![images/60.jpg](images/60.jpg)

The overall state of the power supply is displayed by RGB LEDs located above the terminals.  
**In the off state**, the LED shines blue.  
The upper indicator displays the set voltage, the lower - the set current limit.  
Each encoder controls its channel. To change voltage, you need to press the encoder button, at which a dot lights up in the extreme right digit of the voltage indicator. The encoder knob changes the setting.  
To change current, you need to press the encoder button again. At this point, a dot lights up in the extreme right digit of the current indicator.

The "Sync" LED signals that parameter synchronization mode is enabled. When this happens, changing the set voltage or current on one channel is immediately transmitted to the other channel.

The "Cutoff" LED signals that cutoff mode is enabled due to exceeding maximum current.

To turn on the power supply, you need to press the "All On/Off" button. Both channels turn on and off simultaneously. There is no possibility to separately control channel turning on. When cutoff triggers on any channel, both channels turn off simultaneously.

**In the on state**, the RGB LED shines green. If current limiting is triggered - red.

The upper and lower indicators display real measured voltage and current values at the terminals.

Changing voltage and current settings is done similarly, but set values are displayed briefly during change, during which a dot flashes in the extreme right position. After changing settings, the power supply returns to displaying measured values.

## Options Menu

To enter the options menu, you need to hold the encoder button for 1 second.  
Switching between menu items is a short press on the encoder button.  
Turning the encoder knob changes the setting.

**Table. Options Menu**

![images/61.png](images/61.png)

Since this is a programmable power supply, measured values may differ from set values by several lower digits due to low accuracy of the built-in ADC, shunt, noise, temperature drift. For example, the power supply generates reference voltages to set 5V at the output, but the measuring module due to poor calibration or general inaccuracy of the power supply will display 4.98. To avoid such "ugly" behavior, dU and dI settings are added, which set the maximum difference between set and measured values, at which correction is applied. For example, 5.00-4.98 => 2, with dU >= 2, the measured voltage will be displayed as 5.00, with dU < 2 - as 4.98.

To exit the options menu, you need to hold the encoder button for 1 second.

## Power Supply Calibration

After firmware flashing, voltage and current setting and measurement work inaccurately. The power supply needs to be calibrated.  
Channels are calibrated independently.

**Table. Calibration Points**

![images/62.png](images/62.png)

## Calibration Menu

To enter calibration mode, you need to hold the encoder button for 5 seconds.

Settings are saved in EEPROM.

The On/Off button turns on or off both channels.

To exit calibration mode, you need to hold the encoder button for 5 seconds.

Calibration is more convenient to perform using PC software, as all parameters are displayed on the screen.

Table. Calibration Menu.

![images/63.png](images/63.png)
![images/64.png](images/64.png)
![images/65.png](images/65.png)
![images/66.png](images/66.png)

**Voltage setting calibration:**

1. set current limit to maximum;
2. in menu item "Ure0", change the PWM value so that the power supply output is 0V; press the encoder button for 1 second;
3. in menu item "Ure1", change the PWM value so that the power supply output is 1V; press the encoder button for 1 second;
4. in menu item "Ure2", change the PWM value so that the power supply output is 20V; press the encoder button for 1 second.

**Current limit setting calibration:**

1. connect an ammeter and load with 10...200Ω resistance to the power supply;
2. set such output voltage so that current is 110...200mA;
3. in menu item "Ire0", specify the PWM value at which the power supply limits current to 10mA; press the encoder button for 1 second;
4. in menu item "Ire1", specify the PWM value at which the power supply limits current to 100mA; press the encoder button for 1 second;
5. connect an ammeter and load with 1...10Ω resistance to the power supply;
6. set such output voltage so that current is 1.6...2A;
7. in menu item "Ire2", specify the PWM value at which the power supply limits current to 1.5A; press the encoder button for 1 second.

**Voltage measurement calibration:**

1. in menu item "U0", set output voltage to 0V; press the encoder button for 1 second;
2. in menu item "U1", set output voltage to 1V; press the encoder button for 1 second;
3. in menu item "U2", set output voltage to 20V; press the encoder button for 1 second.

**Current measurement calibration:**

1. connect load 1...10Ω;
2. in menu item "I0", set current limit to 10mA; press the encoder button for 1 second;
3. in menu item "I1", set current limit to 100mA; press the encoder button for 1 second;
4. in menu item "I2", set current limit to 1.5A; press the encoder button for 1 second.

**Temperature calibration:**

Unfortunately, fully passive cooling couldn't be implemented. The fan must always rotate at minimum speed to create at least some airflow. Fortunately, at minimum fan speed, it's completely inaudible even in complete silence.

1. In menu item Fan1, set the minimum fan speed. This is the speed at which the fan reliably starts.
2. In menu item Fan2, set the maximum fan speed (12V should be applied to the fan)
3. In menu item t1°1, specify the ADC value from the sensor left at 20°
4. In menu item t1°2, specify the ADC value from the sensor heated with a heat gun to 70°
5. In menu item t1°3, specify the ADC value from the sensor heated to 80°
6. Do the same for t2

## Oscillograms

In conclusion, I'll present several oscillograms.

12V, no load, voltage rise at turn-on:

![images/67.png](images/67.png)

12V, 1A load, voltage rise at turn-on:

![images/68.png](images/68.png)

12V, no load, voltage fall at turn-off:

![images/69.png](images/69.png)

12V, 1A load, voltage fall at turn-off:

![images/70.png](images/70.png)

5V, 0.7A load, noise level:

![images/71.png](images/71.png)

12V, 1A load, noise level:

![images/72.png](images/72.png)

25V, 1.5A load, noise level:

![images/73.png](images/73.png)

12V, 1A current limit, short circuit:

![images/74.png](images/74.png)

## Further Development

- Add battery charging modes. I'm not sure about Li-Ion, but fast SLA battery charging can definitely be implemented.
- Small current measurement. The circuit uses a 0.13Ω shunt, as it shouldn't heat up at maximum current. But at small currents (less than 50mA), the voltage across the shunt is too small ~6mV for the LM324 op-amp to perceive, which has an Offset Voltage of 5mV. We slightly improve the situation by biasing the amplifier with R49, which allows displaying currents of 10, 20, 30, 40, 50mA, but still doesn't allow distinguishing currents of a few milliamps. And the signal from the shunt, when it reaches the amplifier, turns out too noisy. There's an idea to find a specialized current shunt amplifier and mount it with point-to-point wiring directly on the shunt, connecting the output to a free pin - ADC7.

Video demonstrating device operation:  
[https://youtu.be/EF3L979mCus](https://youtu.be/EF3L979mCus)

Schematics, boards (Proteus), firmware (CVAVR 2.05), software (Flash Builder 4.6):  
[hxpsu.rar](hxpsu.rar)

## Materials

**Primary Sources:**

1.1. SMPS for beginners  
[https://radiokot.ru/forum/viewtopic.php?f=11&t=85106](https://radiokot.ru/forum/viewtopic.php?f=11&t=85106)

1.2. Assembling a switching power supply. Power supply on KA2S0880 chip (as an alternative to IR2153)  
[https://radiokot.ru/circuit/power/supply/03/](https://radiokot.ru/circuit/power/supply/03/)

1.3. Switching power supply (60W) (flyback on UC3842)  
[https://radiokot.ru/circuit/power/supply/04/](https://radiokot.ru/circuit/power/supply/04/)

1.4. 200W switching power supply for audio amplifier (UC3825AN)  
[https://radiokot.ru/circuit/power/supply/33/](https://radiokot.ru/circuit/power/supply/33/)

**Laboratory Power Supplies:**

2.1. Laboratory power supply (ATMega8, op-amp, TIP 121, not programmable)  
[https://radiokot.ru/circuit/power/supply/14/](https://radiokot.ru/circuit/power/supply/14/)

2.2. Power supply with microcontroller control and parameter adjustment using encoder (sonata)  
[https://radiokot.ru/circuit/power/supply/19/](https://radiokot.ru/circuit/power/supply/19/)

2.3. Laboratory with op-amp (IRL530N, op-amp, point-to-point I)  
[https://radiokot.ru/circuit/power/supply/21/](https://radiokot.ru/circuit/power/supply/21/)

2.4. Digital control of laboratory power supply (stm32f100c4)  
[https://radiokot.ru/circuit/power/supply/22/](https://radiokot.ru/circuit/power/supply/22/)

2.5. Built-in universal control board for laboratory power supplies (KT819 x 2 + KT817, КР572ПВ2)  
[https://radiokot.ru/circuit/power/supply/24/](https://radiokot.ru/circuit/power/supply/24/)

2.6. Power supply 2x35V (КТ818 x 2 + KT816, КР572ПВ2)  
[https://radiokot.ru/circuit/power/supply/25/](https://radiokot.ru/circuit/power/supply/25/)

2.6. Display, protection, and control module for laboratory power supply (PIC)  
[https://radiokot.ru/circuit/power/supply/32/](https://radiokot.ru/circuit/power/supply/32/)

2.7. Reliable, like a Kalashnikov automatic (Tip122, ATMega16, not programmable)  
[https://radiokot.ru/circuit/power/supply/34/](https://radiokot.ru/circuit/power/supply/34/)

2.8. Laboratory Power Supply on ATmega16 (Atmega16, Tip 142, winding switching)  
[https://radiokot.ru/circuit/power/supply/37/](https://radiokot.ru/circuit/power/supply/37/)

2.9. Simple and Accessible Power Supply 0...50V (2N3055+BD140, impossible to make programmable)  
[https://forum.cxem.net/index.php?showtopic=76820](https://forum.cxem.net/index.php?showtopic=76820)

2.10. Laboratory power supply on STM32F100  
[https://radiokot.ru/forum/viewtopic.php?f=11&t=90037](https://radiokot.ru/forum/viewtopic.php?f=11&t=90037)

2.11. Unusual power supply on microcontroller. (ATMega16, LM2596)  
[https://forum.easyelectronics.ru/viewtopic.php?f=16&t=4853](https://forum.easyelectronics.ru/viewtopic.php?f=16&t=4853)

2.12. Laboratory power supply (koyodza)  
[https://koyodza.embedders.org/powers.html](https://koyodza.embedders.org/powers.html)  
[https://caxapa.ru/190584.html](https://caxapa.ru/190584.html)  
[https://caxapa.ru/191294.html](https://caxapa.ru/191294.html)  
[https://caxapa.ru/342843.html](https://caxapa.ru/342843.html)  
[https://caxapa.ru/194433.html](https://caxapa.ru/194433.html)  
[https://caxapa.ru/277725.html](https://caxapa.ru/277725.html)

2.13. Laboratory power supply PSA2 (koyodza)  
[https://radiokot.ru/forum/viewtopic.php?f=11&t=92885](https://radiokot.ru/forum/viewtopic.php?f=11&t=92885)

2.14. Laboratory power supply PSL-3604 (Leonid Ivanovich)  
[https://radiokot.ru/forum/viewtopic.php?f=11&t=59168](https://radiokot.ru/forum/viewtopic.php?f=11&t=59168)

2.15. Home Built Bench Power Supply V1 - Schematic  
[https://www.youtube.com/watch?v=x0fjSleInEw](https://www.youtube.com/watch?v=x0fjSleInEw)

2.16. Laboratory power supply on IGBT transistor  
[https://cxem.net/pitanie/5-273.php](https://cxem.net/pitanie/5-273.php)

2.17. 0-50V 2A Bench power supply  
[https://www.electronics-lab.com/projects/power/003/index.html](https://www.electronics-lab.com/projects/power/003/index.html)  
[https://radiokot.ru/forum/viewtopic.php?f=11&t=2587](https://radiokot.ru/forum/viewtopic.php?f=11&t=2587)

2.18. Fan noise level, poor quality  
[https://www.youtube.com/watch?v=-lq1YGAgJ0c](https://www.youtube.com/watch?v=-lq1YGAgJ0c)

2.19. Chinese laboratory power supply DAZHENG PS-1502DD  
[https://microsin.ru/content/view/1126/43/](https://microsin.ru/content/view/1126/43/)  
[https://radiokot.ru/forum/viewtopic.php?f=11&t=11898](https://radiokot.ru/forum/viewtopic.php?f=11&t=11898)

2.20. Digital laboratory power supply with PC control  
[https://mysku.ru/blog/russia-stores/34623.html](https://mysku.ru/blog/russia-stores/34623.html)

2.21. Sorensen DLM600 DC Power Supply Product Demo  
[https://www.youtube.com/watch?v=Ur-prMeM6NY](https://www.youtube.com/watch?v=Ur-prMeM6NY)

2.22. LABORATORY POWER SUPPLY WITH MICROCONTROLLER DISPLAY  
[https://elwo.ru/publ/skhemy_blokov_pitanija/laboratornyj_bp_s_indikaciej_na_mikrokontrollere/7-1-0-503](https://elwo.ru/publ/skhemy_blokov_pitanija/laboratornyj_bp_s_indikaciej_na_mikrokontrollere/7-1-0-503)

2.23. Power supply 13.8V/10A  
[https://rudig.ru/categors/open_t/383](https://rudig.ru/categors/open_t/383)

2.24. Laboratory power supply on TL431  
[https://forum.cxem.net/index.php?showtopic=123103&st=0](https://forum.cxem.net/index.php?showtopic=123103&st=0)

2.25. Fully Programmable Modular Bench Power Supply  
[https://gerrysweeney.com/fully-programmable-modular-bench-power-supply-part-14/?wppa-occur=1&wppa-cover=0&wppa-album=7&wppa-photo=108](https://gerrysweeney.com/fully-programmable-modular-bench-power-supply-part-14/?wppa-occur=1&wppa-cover=0&wppa-album=7&wppa-photo=108)

2.26. Korad KA3005D review  
[https://www.youtube.com/watch?v=JMiOATzAT6Q](https://www.youtube.com/watch?v=JMiOATzAT6Q)

**Theory:**

3.1. Power Supplies: What is Slew Rate?  
[https://www.youtube.com/watch?v=WA8Glt4K_bs](https://www.youtube.com/watch?v=WA8Glt4K_bs)

3.2. DIY Bench Power Supply Video series  
[https://www.youtube.com/watch?v=70dsAWBkXIM&list=PLDBuVMDVJaX2wCN84B5sjFMKDsMbsS7jq](https://www.youtube.com/watch?v=70dsAWBkXIM&list=PLDBuVMDVJaX2wCN84B5sjFMKDsMbsS7jq)

3.3. Engineer It - How to test power supplies - Measuring Noise  
[https://www.youtube.com/watch?v=pKXPqApOYfk](https://www.youtube.com/watch?v=pKXPqApOYfk)

3.3. Minimizing Switching Regulator Residue in Linear Regulator  
[https://www.youtube.com/watch?v=WxhjLIu-vPg](https://www.youtube.com/watch?v=WxhjLIu-vPg)

3.4. LM321/LM324 for current sensing  
[https://e2e.ti.com/support/amplifiers/precision_amplifiers/f/14/t/244945](https://e2e.ti.com/support/amplifiers/precision_amplifiers/f/14/t/244945)

3.5. Common mode choke winding  
[https://jeelabs.net/boards/7/topics/1094?r=1355](https://jeelabs.net/boards/7/topics/1094?r=1355)

3.6. Tips for designing buck converters  
[https://www.compel.ru/lib/ne/2007/8/7-sovetyi-po-proektirovaniyu-ponizhayushhih-preobrazovateley/#rlcje](https://www.compel.ru/lib/ne/2007/8/7-sovetyi-po-proektirovaniyu-ponizhayushhih-preobrazovateley/#rlcje)

3.7. Mains filters and noise suppression capacitors  
[https://bsvi.ru/setevye-filtry-i-pomexopodavlyayushhie-kondensatory/](https://bsvi.ru/setevye-filtry-i-pomexopodavlyayushhie-kondensatory/)

3.8. Ferrite beads  
[https://tqfp.org/parts/ferrite-beads.html](https://tqfp.org/parts/ferrite-beads.html)

3.9. Basics of Ferrite Beads: Filters, EMI Suppression, Parasitic oscillation suppression / Tutorial  
[https://www.youtube.com/watch?v=81C4IfONt3o](https://www.youtube.com/watch?v=81C4IfONt3o)

3.10. Methods for fighting noise in switching power supplies  
[https://www.xn--b1agveejs.su/radiotehnika/146-sposoby-borby-s-pomehami-blokah-pitaniya.html](https://www.xn--b1agveejs.su/radiotehnika/146-sposoby-borby-s-pomehami-blokah-pitaniya.html)

3.11. Feedback compensation in switching power supplies part 1.  
[https://bsvi.ru/kompensaciya-obratnoj-svyazi-v-impulsnyx-istochnikax-pitaniya-chast-1/](https://bsvi.ru/kompensaciya-obratnoj-svyazi-v-impulsnyx-istochnikax-pitaniya-chast-1/)

3.12. Feedback compensation: practical approach  
[https://bsvi.ru/kompensaciya-obratnoj-svyazi-prakticheskij-podxod/](https://bsvi.ru/kompensaciya-obratnoj-svyazi-prakticheskij-podxod/)

3.13. Biricha Digital. Foundations (Part 1.A) - Understanding Bode Plots and Stability of Power Supplies  
[https://www.biricha.com/articles/view/bode_plot_analysis_of_smps](https://www.biricha.com/articles/view/bode_plot_analysis_of_smps)

3.14. Biricha Digital. Foundations (Part 1.B) - Frequency Response Measurement of Plant, Compensator and Loop of our Switch Mode Power Supply  
[https://www.biricha.com/articles/view/frequency_response_measurement](https://www.biricha.com/articles/view/frequency_response_measurement)

3.15. Biricha Digital. Foundations (Part 1.C) - Understanding and Using Transfer Functions  
[https://www.biricha.com/articles/view/transfer_functions_poles_zeros](https://www.biricha.com/articles/view/transfer_functions_poles_zeros)

3.16. H4621852 - Bode Plot Example and Interpretation  
[https://www.youtube.com/watch?v=__WpViE9LKE](https://www.youtube.com/watch?v=__WpViE9LKE)

3.17. Stability 101 Whiteboard Series by Analog Devices, Inc.  
Stability 101: Loop Gain in Operational Amplifiers  
Stability 101: Bode Plots and Operational Amplifiers  
Stability 101: Decompensated Operational Amplifiers  
Stability 101: Driving a Capacitive Load (Operational Amplifiers)  
Stability 101: Parasitic Capacitance in Operational Amplifiers  
[https://www.youtube.com/playlist?list=PLiwaj4qabLWwAenk99ONF2_JUjopeAXo4](https://www.youtube.com/playlist?list=PLiwaj4qabLWwAenk99ONF2_JUjopeAXo4)

3.18. Dynamic Electronic Load Project (EEVBlog)  
[https://www.eevblog.com/forum/projects/dynamic-electronic-load-project](https://www.eevblog.com/forum/projects/dynamic-electronic-load-project)

