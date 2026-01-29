# Infrared Command Recognition Using UART on AVR

*Article published on [cxem.net](http://cxem.net/ik/2-21.php)*

## Introduction

![titlepic](images/titlepic.png)

Many articles have been written about recognizing commands from an infrared remote control. Most of them discuss the RC5 protocol used by Philips remotes [1]. This protocol is neither the only one nor the most widely used. A good description of other formats in Russian can be found in document [2].

In all the articles I found, recognition is performed by reading the state of the TSOP sensor at strictly defined moments in time (in a timer interrupt handler or in the main program loop). However, in my latest project I need to communicate with an external device with strict timing constraints, which requires disabling interrupts for periods of up to 2ms. This makes it impossible to poll the TSOP sensor state with the required accuracy (once every 560us +-100us).

This is how the idea was born to use UART as a "clever" shift register. In the resulting implementation, when decoding an NEC-like protocol, it is only necessary to leisurely poll the sensor state once every 4ms, while the microcontroller itself can be in idle mode or even in power down mode!

![iks](images/iks.jpg)

## IR Protocols

I see no point in repeating the description of IR remote protocols — they are described well enough in article [2]. I will only outline the key points:

![nec_pulse600](images/nec_pulse600.jpg)

An IR transmission, using the NEC protocol as an example, consists of a Mark pulse (9ms), a Space pulse (4.5ms), and a sequence of data pulses.

![datapulse](images/datapulse.png)

In different protocols, data bits are encoded differently, but the pulse length of one polarity is always equal to or a multiple of the pulse length of the opposite polarity (a difference of a few microseconds can be ignored, since the accumulated error during the transmission does not interfere with decoding. What matters is that in the middle of a pulse, the bit value can be obtained).

It should be noted that the signal shown above will be inverted at the output of the TSOP sensor:

![irburst](images/irburst.png)

To decode a command, it is necessary to synchronize with the edge of the first data pulse, wait for its midpoint (280us), and then continue polling the sensor state every 560us:

![datapulseSample](images/datapulseSample.png)

The sensor polling moments must be maintained fairly precisely (no more than +-100us).

If the timing intervals cannot be maintained, then software decoding will not work. A different solution is needed. A brute-force approach would be to use a second microcontroller or a specialized decoder IC.

However, it is worth remembering that the AVR has plenty of on-board peripherals that can be repurposed in creative ways :)

## UART Protocol

UART uses a simple serial protocol [3]:

![UARTProtocol](images/UARTProtocol.png)

When idle, the line is held at "1". The start of transmission is determined by the falling edge of the "start" bit (0). This is followed by the data bits, then the parity bit (which may not be used), and then one or two stop bits (1). That is, after transmitting a byte, the line returns to state 1, and the transmission cycle begins again. All bit lengths are equal to 1/Baud rate.

The UART protocol is not compatible with IR protocols.

However, if we forget about the UART protocol and consider the UART receiver as a shift register with a timer and falling-edge synchronization, it turns out that it is suitable for recognizing (almost) any sequences.

How exactly the UART receiver works can be read in the AT90USB162 datasheet [4].

![usartsample](images/usartsample.png)

After detecting the falling edge, the receiver pauses for ½ bit length, then checks that the line is still at "0" (valid start bit detection).

![usartsample2](images/usartsample2.png)

After that, the data bit reception cycle begins, without any checks, at intervals equal to the bit length. The data bits "shift into" the receiver's shift register, and the first stop bit goes into the FE flag in inverted form.

If we describe this entire process in simplified terms, in 7N1 mode the receiver waits for a falling edge, then reads the input 8 times at equal intervals. But this is exactly how the software IR protocol decoding described above works!

## IR Command Recognition Using UART

![schematics](images/schematics.png)

Let's see what happens if we "feed" the signal from the IR receiver into UART.

My remote uses a protocol with the same timing intervals as the NEC protocol [2], although the command format itself differs.

![irburst2](images/irburst2.png)

We configure UART in 7N1 mode (7 data bits, no parity bits, 1 stop bit). We set the baud rate to 1,000,000 / 560us = 1786 baud.

The 9ms Mark pulse ("0" at the TSOP sensor output) will be received as 0000000b with an erroneous stop bit:

![code](images/code.png)

After that, the receiver will wait for the next falling edge (it will skip to the end of Mark and the entire Space). When the IR data transmission begins, the receiver synchronizes to the bit midpoint (560us / 2 = 280us) and reads 7 data bits + the stop bit:

![UARTFeed](images/UARTFeed.gif)

After receiving 7+1 bits, UART will wait for the next falling edge, and if the last bit was "0", the line must first return to "1". At this point we have a certain "gap" in reception, which makes it impossible to precisely decode IR protocols where bits are encoded by pulse length. But even in this case, a unique packet will produce unique data in the UART receiver. Since the goal is not to decode the command content but to recognize the transmission, this situation suits us perfectly.

## Implementation

![board](images/board.jpg)

The example is written in Codevision AVR 2.05 for ATMega8A, with an 8MHz crystal oscillator.

The main program loop polls the UART state every 4ms and writes the received data into a circular buffer of 12 bytes. The buffer length is chosen based on the IR transmission length.

![bork](images/bork.jpg)

My remote's transmission is 54ms long. 54000 / 560 = 96 bits or 12 full bytes. We choose 11 bytes + 1 for the starting zero (it is not necessary to parse the entire transmission, but it is very important that the transmission causes the buffer to wrap around). For remotes where the transmission length differs depending on the button, the algorithm will be slightly more complex (this will not be discussed here).

After receiving each byte, it is checked whether the next byte in the circular buffer is zero. A zero byte means that we have already received 11 bytes of the transmission and it is time to respond to the command.

The example outputs to the terminal (9600N1) the CRC32 of the received command, the command bytes, and the symbolic representation of the transmission:

[Video: Demonstration](https://www.youtube.com/watch?v=0atAirktwn0)

After obtaining the codes, false triggers can be reduced by uncommenting the section:

```
( readCMDBuffer( s_cmdBufferIndex ) == 0 ) &&
( readCMDBuffer( s_cmdBufferIndex + 1 ) == 0x95 ) &&
( readCMDBuffer( s_cmdBufferIndex + 2 ) == 0x95 ) &&
( readCMDBuffer( s_cmdBufferIndex + 3 ) == 0xB7 ) &&
( readCMDBuffer( s_cmdBufferIndex + 4 ) == 0xB7 ) &&
( readCMDBuffer( s_cmdBufferIndex + 5 ) == 0xB7 )
 (insert your remote's header codes above)
```

By "false triggers" here we mean detecting noise as a command with some code, not a false trigger of the correct button.

## Improvements

1. If UART is used in 9 data bits, 1 parity, and 1 stop mode, the polling period can be increased further.

2. The presented algorithm does not check the time elapsed between byte receptions. By checking it, false triggers can be reduced.

3. While waiting for a command, the microcontroller can be in idle mode and wake up on a UART interrupt.

4. In Power down mode, UART does not work. But if RX is connected to INT0, this allows waking the microcontroller to normal mode for command reception.

## Conclusion

The algorithm has been tested in a real device and has shown excellent results.

## References

1. [RC-5](http://en.wikipedia.org/wiki/RC-5)
2. [Infrared Remote Control (PDF)](http://labkit.ru/userfiles/file/documentation/Remote_control/A.Tores_Infrakrasnoe_distancionnoe_upravlenie.pdf)
3. [Wikipedia – UART](http://ru.wikipedia.org/wiki/%D0%A3%D0%BD%D0%B8%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B9_%D0%B0%D1%81%D0%B8%D0%BD%D1%85%D1%80%D0%BE%D0%BD%D0%BD%D1%8B%D0%B9_%D0%BF%D1%80%D0%B8%D1%91%D0%BC%D0%BE%D0%BF%D0%B5%D1%80%D0%B5%D0%B4%D0%B0%D1%82%D1%87%D0%B8%D0%BA)
4. [AT90USB162 datasheet (PDF)](http://www.atmel.com/images/doc7707.pdf)

Article source code:

[IRDecoderUART.rar](IRDecoderUART.rar)
