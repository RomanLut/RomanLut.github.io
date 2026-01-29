# Digital control system for a toy railway

*Article published on [radiokot.ru](https://www.radiokot.ru/konkursCatDay2014/28/)*  
**Article took 1st place in the "Congratulate the Cat in a Human Way 2014" article contest**

![Title image](images/01.jpg)

After the child got two Piko starter sets, and also my childhood Piko Junior set from GDR production (probably everyone had one) was deconserved from the garage, controlling three locomotives with a simple forward-backward knob became uninteresting. I wanted "digital control".

Currently, you can buy ready-made decoders for locomotives, a booster, a remote control, and switch drives for digitizing the railway, investing up to $400. But as a result, you'll get absolutely useless knowledge about decoder compatibility, protocols, special software, stores, how to buy, etc.

![Setup](images/02.jpg)

Therefore, the task was set to independently make separate control of locomotives and switches from an Android tablet, to learn how to make ultra-miniature boards and communicate with my devices via Bluetooth.

**Total to digitize:**

Diesel locomotive from Piko Junior set (production year - ~1985):

![Locomotive 1](images/03.jpg)

Steam locomotive from Piko Starter Kit 57160:

![Locomotive 2](images/04.jpg)

Locomotive from Piko Starter Kit 57175:

![Locomotive 3](images/05.jpg)

Three Piko 55221 switches:

![Switch](images/06.jpg)

## How Separate Locomotive Control Works

As is known, in a regular railway, control is done by a simple remote that regulates the magnitude and polarity of voltage supplied to the rails. The locomotive's motor is connected to the rails through wheel pairs.

![Analog control](images/07.jpg)

For separate control, the locomotive's motor and lights are connected to the rails through a decoder board.

![Decoder](images/08.jpg)

A Control Station - Booster pair is connected to the rails, which simultaneously supply power and control signals to the decoder board via the pair of rails.

![Digital control](images/09.jpg)

Railway control, in the simplest case, is done by an IR remote.

The IR signal receiver is located on the Control Station, which generates control signals for the Booster. The Booster forms an alternating voltage on the rails, modulated by control signals. Booster and Control Station are often combined in one device.

Decoders of varying degrees of "sophistication" may also contain a locomotive sound player, a steam locomotive smoke generator, locomotive speed control with feedback, and support for smooth starts/stops.

I had to make a Control Station + Booster with IR and Bluetooth command reception, three locomotive decoders, and three switch decoders.

## Command Transmission Over Rails

In the standard implementation, data transmission is done via the DCC protocol[8]. An alternating voltage modulated by a digital signal is supplied to the rails. This is not a sine wave, but a switching of 12V DC voltage polarity. Ones and zeros are formed by pulses of different durations:

![DCC signal](images/10.png)

The decoder contains rectifier diodes that form a constant voltage supply for the microcontroller and motor.

The microcontroller decodes incoming commands and controls the locomotive's motor and lights. Each locomotive has a unique number and processes commands sent only to it.

On the internet, you can find a software implementation of the DCC protocol[9], as well as open DCC Control Station projects[6] with lots of "bells and whistles". However, attempts to quickly "get into" the library source code led to the conclusion that it would be faster to make a simplified control system with my own simplest protocol, and in the future, if desired, write source code for working with the DCC standard. You need to set yourself final tasks - otherwise, the child instead of playing will watch dad constantly tinkering with a soldering iron. Compatibility with the standard is not part of the task.

## Data Packet Format

As the protocol, a simple format similar to the RC5 IR remote protocol was chosen. In idle mode, the station transmits "ones". The beginning of a packet is indicated by 8 "zeros". Then follow 16 bits of data, and the same 16 bits in inverted form.

A pulse of 100 µs width - "1".  
A pulse of 200 µs width = "0".

Silence:

![Silence](images/11.png)

Data packet:

![Data packet](images/12.png)

16 bits of data contain: 5 bits - device identifier, 5 bits - command, and 6 bits - data for the command:

![Data format](images/13.png)

One decoder module contains:
- 1 PWM channel with polarity switching (for motor);
- 2 PWM channels for lights (software PWM);

In the switch decoder, the motor PWM channel controls the servo.

**Table. List of commands.**

![Commands table](images/14.png)

Direct setting of motor PWM duty cycle is not used. Instead, "minimum", "small", and "large" speeds are configured in the decoder, and commands to set the corresponding speed are sent to the locomotive. This allows implementing smooth acceleration/braking in the decoder itself in the future.

## Control Station and Booster

The power supply, control station, booster, bluetooth module, and IR signal receiver are assembled in a small metal case, which simultaneously serves as a heatsink for LM7812.

![Control station](images/15.jpg)

The following are brought to the front panel:
- power switch;
- terminals;
- short circuit indicator;
- Bluetooth connection indicator;
- IR signal sensor.

The control station and booster are located on separate boards. This gives the opportunity to change the power supply and booster to get greater power.

![Control station boards](images/16.jpg)

I used a 14V 1A transformer, which allows powering three locomotives with an average current consumption of 300mA. The power supply was fundamentally chosen as a classic transformer, not a switching one, to ensure greater safety.

The LM7812 regulator is mounted on the case through an insulating pad. There is no galvanic connection between the case and the circuit.

### Control Station

The control station is built on an Atmega168 microcontroller, to which an IR signal sensor TSOP4836 and a ready-made Bluetooth module BT_BOARD v1.03 are connected.

![Control station schematic](images/17.png)

![Control station PCB](images/18.png)

![Control station PCB top](images/19.png)

![Control station PCB bottom](images/20.png)

Several free pins remain on the ATmega, brought out to connector J5. This allows, if desired, to connect position sensors to automatically control a full-fledged railway layout.

### Booster

The initial version of the booster was assembled on field-effect transistors and an IR2153 chip in a non-traditional connection.

![Booster v1](images/21.jpg)

Unfortunately, the circuit performed poorly in short circuit and overload detection tasks. Therefore, I had to get the box with old boards again and look for something suitable.

As a candidate, a board from an Epson Stylus 440 printer was found, which contains two bipolar stepper motor drivers LB1845:

![Printer board](images/22.jpg)

![Printer board detail](images/23.jpg)

Each of the drivers, in turn, contains two full-fledged H-Bridges and a current limiting circuit (for windings):

![LB1845 schematic](images/24.png)

Half of such a chip will work excellently as a booster, as it can switch polarity, limit maximum current, and withstand short circuits for a long time.

To ease the circuit's operating mode, the control station can detect the fact of prolonged current exceeding and disconnect power from the rails for 10 seconds, making attempts to recover, while pausing. The thing is, short circuits will occur quite often - from iron objects falling on the rails, locomotives derailing, or even due to connecting rails in a certain configuration.

![Overload detection](images/25.png)

Overload/short circuit are detected by the fact of LB1845 PWM starting for current limiting, which is much more reliable than monitoring a current shunt. When PWM is turned on, pulses appear on the RC pin of the LB1845 chip, which are fed through a divider to the input of an analog comparator of the ATMega.

![PWM detection](images/26.jpg)

Since all the necessary "peripheral" of the driver was already present on the (correctly) routed printer board, it was decided to simply saw off the needed part of the board with a hacksaw and change resistors to set the current limit to 1A.

![Booster final](images/27.jpg)

As the IR remote, I used an existing remote from a broken DVD player (the TSOP receiver was taken from there too). Based on the results, I'll say it's better to take a remote with rubber buttons, as film buttons often don't work.

![IR remote](images/28.jpg)

## Locomotive Decoder

The general structure of decoder circuits was observed in various sources (see links at the end of the article). The specific circuit was developed based on available parts and free space in the locomotives.

![Locomotive decoder schematic](images/29.png)

### Estimating Available Space in Locomotives

The decoder board dimensions must allow its installation in all three existing locomotives. Therefore, first of all, all locomotives were disassembled and studied for free space under the decoder board.

In the Junior locomotive, there was the least free space - 16x32x10mm or 20x32x4mm:

![Junior space](images/30.jpg)

Despite smaller dimensions, there was more space in the steam locomotive - 24x31x4mm:

![Steam engine space](images/31.jpg)

Large locomotive: unlike the previous ones, this locomotive is originally designed for decoder installation and even contains a dummy board. A 25x50mm board will fit inside:

![Big locomotive space](images/32.jpg)

Based on the results, it was decided to make a board of 31x16x4mm size.

On this area, it's necessary to place rectifier diodes, smoothing capacitors, microcontroller power supply regulator, the microcontroller itself, motor control bridge, and light control transistors.  
Based on this, it becomes obvious that all parts must be in SMD form with dense double-sided mounting.

![Decoder PCB](images/33.png)

With such microscopic dimensions, even a regular "header" has unacceptably large dimensions as a connector for programming.

Since I need a single standard for miniature boards in the future, I decided to make a programming adapter based on the principle of a computer PCI connector - in this case, I will always "have available" connectors for new boards.

I found a connector from an unknown phone's headset, sawed it, and glued an adapter:

![Programming adapter](images/34.jpg)

![Programming adapter detail](images/35.jpg)

The connector fits well on a 1mm thick fiberglass board:

![Adapter on board](images/36.jpg)

![Adapter on board detail](images/37.jpg)

![Adapter on board final](images/38.jpg)

The final size of the connector on the board is less than 6x4mm.

### Manufacturing Decoder Boards

Decoder boards are double-layer on 1mm fiberglass. I make boards at home on a homemade CNC machine. This imposes a certain manufacturing style:
- distance between tracks not less than 0.3mm
- preferably as few vias as possible, as they will need to be soldered;
- preferably not to place vias under parts;
- it's simpler to throw a jumper than to solder 3 vias.

In the final board, 4 jumpers need to be soldered:

![Decoder PCB with jumpers](images/39.jpg)

![Decoder PCB assembled](images/40.jpg)

### Installing Decoder Boards

The decoder can control the locomotive's lights, so front and rear lights (white LEDs in 0805 SMD package) and a front light (regular white LED) were added to the Junior locomotive.

![Locomotive with lights](images/41.jpg)

Copper enameled wires are soldered to the 0805 LED leads and laid along the locomotive wall. A hole is drilled in the center of the headlight, to the inner side of which the LED is glued. The headlight hole is filled with PVA glue, which forms a translucent film.

![Headlight detail](images/42.jpg)

When mounting connections, it's convenient to make a "wiring block" on the locomotive wall:

![Wiring harness](images/43.jpg)

![Wiring harness detail](images/44.jpg)

So that boards and wires don't stick out, locomotive windows are closed from the inside with black film.

In the steam locomotive, rear lights were not installed (they are not provided there anyway):

![Steam engine with decoder](images/45.jpg)

Previously, the body was put on the base using a latch. To free up space, this plastic part was completely discarded, and M3 stands were glued for attaching the body.

When installing the decoder in the large locomotive, no difficulties arose. Since incandescent lamps are used as lights in it, the current-limiting resistors R11R12 on the decoder board must be replaced with jumpers:

![Big locomotive with decoder](images/46.jpg)

## Switch Decoder

Factory switch drives are built on electromagnets:

![Switch drive](images/47.jpg)

My attempts to construct reliably working electromagnets failed. Moreover, controlling electromagnets requires a high-current pulse, which is obtained by discharging electrolytic capacitors in the decoder, which increases the switch decoder dimensions.

Therefore, I had to buy available Tower Pro SG90 servo motors, which handle the task excellently.

![Servo motor](images/48.jpg)

The decoder circuit changes slightly: the H-bridge is discarded, and the PWM signal is used to control the servo motor position. Since the motor is powered from 5V, a regulator in a TO-220 package is installed:

![Switch decoder schematic](images/49.png)

![Switch decoder PCB](images/50.jpg)

![Switch decoder assembled](images/52.jpg)

The decoder board with the glued motor is attached to the switch with screws. The servo motor shaft is connected to the switch with a spring:

![Switch decoder mounted](images/51.jpg)

The switch decoder case was cut from fiberglass, soldered with tin, and painted black:

![Switch decoder case](images/53.jpg)

![Switch decoder case detail](images/54.jpg)

![Switch decoder final](images/46.jpg)

## Control Station Firmware

The control station firmware is written in Atmel Studio 6. Fuses are configured for operation from an internal 8MHz oscillator.

### Decoder Firmware

The decoder firmware is written in Atmel Studio 6. Fuses are configured for operation from an internal 8MHz oscillator. When compiling the firmware, it's necessary to uncomment the line `#define SWITCH` in the common.h file to get firmware for the switch. Its difference is that the PWM signal frequency becomes 50Hz, which is necessary for controlling the servo motor. At the same time, PWM is disabled 3 seconds after switching the switch to not load the motor.

### Android Software

Playing with a phone is much more interesting, as it reproduces locomotive and railway station sounds :)

The software is written in Flash Builder 4.6. For Bluetooth communication, the Bluetooth Android ANE extension[11] is used.

The main application screen is shown below:

![Android main screen](images/56.jpg)

The purpose of buttons on the main screen is described in the video.

The console screen allows viewing debug information from the control station:

![Android console](images/57.jpg)

The settings screen is intended for configuring decoders:

![Android settings](images/58.jpg)

### IR Remote Setup

To set up the IR remote, you need to connect to the control station either directly via UART interface, or via a Bluetooth terminal, or with the provided Android software. The control station outputs recognized IR button codes to the terminal, which must be entered into the firmware: KEX_XXX in IRManager.c.

![IR remote setup](images/59.jpg)

### Locomotive Decoder Setup

![Locomotive decoder setup](images/60.jpg)

To set up the decoder, you need to place the locomotive on the rails and connect the Android software to the control station.

1. Assigning locomotive id [1...3]:
   - specify id in the "Data" field;
   - select the "Set id" command;
   - press the "Send" button.

The id change command is perceived by all decoders, so other locomotives and switches must be disconnected at the time of setup.

2. Setting PWM normal speed [0..63]:
   - select locomotive id in the "Device Id" list;
   - specify PWM value in the "Data" field;
   - select the "Set slow speed" command;
   - press the "Send" button.

3. Setting PWM fast speed [0..63]:
   - select locomotive id in the "Device Id" list;
   - specify PWM value in the "Data" field;
   - select the "Set max speed" command;
   - press the "Send" button.

The locomotive is ready for operation.

### Switch Decoder Setup

![Switch decoder setup](images/61.jpg)

To set up the decoder, you need to connect the switch to the control station and connect the Android software.

SG90 servo motors can jam when an incorrect signal is applied, so before setting safe parameters, it's better to disconnect the servo motor.

1. Setting switch id: [4...6].
   - specify id in the "Data" field;
   - select the "Set ID" command;
   - press the "Send" button.

The id change command is perceived by all decoders, so other locomotives and switches must be disconnected at the time of setup.

2. Setting PWM first switch position:
   - select switch id in the "Device Id" list;
   - specify 7 in the "Data" field;
   - select the "Set min speed" command;
   - and press the "Send" button.

3. Setting PWM second switch position:
   - select switch id in the "Device Id" list;
   - specify 14 in the "Data" field;
   - select the "Set max speed" command;
   - press the "Send" button.

### Removing Capacitors

![Capacitor removal](images/62.jpg)

A capacitor is installed in terminal rails, which must be removed. Now, when AC voltage is applied, it causes a short circuit. It's also highly desirable to carefully solder the contacts between copper plates and rails.

### Restoring the Diesel Locomotive Motor

A bit off-topic. The motor in the diesel locomotive from the Junior set was completely worn. It uses a fairly high-quality motor with carbon brushes, but due to prolonged use, both the brushes and the rotor contact pad were heavily worn.

![Worn motor](images/63.jpg)

After attempts to replace brushes, completely replace the contact pad with a circle cut from fiberglass, replace pressure brushes with simple copper brushes, it was decided to completely replace the motor.

Lower quality, regular motors from toys fit by size. I couldn't find a motor with a long double-sided shaft. I pushed (knocked out) the shaft from the rotor, and inserted a shaft from the same motor on the other side.  
Chokes and filter capacitor were transferred to the new motor, and secured with hot glue.

![New motor](images/64.jpg)

The new motor's supply voltage is 3V, not 12V. But this is not a problem, as the decoder allows setting the duty cycle corresponding to the locomotive's maximum speed.

![Motor installed](images/65.jpg)

Video (HD):  
[https://www.youtube.com/watch?v=5xEB9pbQEE0](https://www.youtube.com/watch?v=5xEB9pbQEE0)

The customer was satisfied.

![Final result](images/66.jpg)

## Materials

1. Automating a children's railway  
   [https://robocraft.ru/blog/379.html](https://robocraft.ru/blog/379.html)

2. Self made decoder for MNRA-DCC  
   [https://groups.yahoo.com/neo/groups/selfmade_decoder/info](https://groups.yahoo.com/neo/groups/selfmade_decoder/info)

3. Decoder on ATTiny15  
   [https://www.g-zi.de/](https://www.g-zi.de/)

4. Bluetooth library for Flex on Android  
   [https://as3breeze.com/bluetooth-ane/](https://as3breeze.com/bluetooth-ane/)

5. BT-Board Setup  
   [https://apirola.wordpress.com/2012/09/05/setup-jy-mcu-bt-board-v1-2/](https://apirola.wordpress.com/2012/09/05/setup-jy-mcu-bt-board-v1-2/)

6. OpenDCC  
   [https://www.opendcc.de/](https://www.opendcc.de)

7. Brief buyer's guide for DCC standard digital control systems.  
   [https://www.railwaymodel.com/info/articles/dcc_us.html](https://www.railwaymodel.com/info/articles/dcc_us.html)

8. Digital Command Control  
   [https://en.wikipedia.org/wiki/Digital_Command_Control](https://en.wikipedia.org/wiki/Digital_Command_Control)

9. OpenDCC Project  
   [https://opendcc.sourceforge.net/](https://opendcc.sourceforge.net/)

10. NMRA-DCC Loco Decoder with ATtiny15  
    [https://www.g-zi.de/Decoder/ATtiny15/desc2pinNpwmR_e.html](https://www.g-zi.de/Decoder/ATtiny15/desc2pinNpwmR_e.html)

11. Bluetooth ANE  
    [https://as3breeze.com/bluetooth-ane/](https://as3breeze.com/bluetooth-ane/)

12. My personal website on the internet  
    [https://www.deep-shadows.com/hax/](https://www.deep-shadows.com/hax/)

## Firmware and Source Code

**Files:**

[Android software source code](railway_android_src.rar)  
[Decoder firmware source code](railway_decoder_firmware_src.rar)  
[Control station firmware source code](railway_controller_firmware_src.rar)  
[Android application](hxRailRoad_apk.zip)
