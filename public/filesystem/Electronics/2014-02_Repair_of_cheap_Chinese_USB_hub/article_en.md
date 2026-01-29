# Repair of a Cheap Chinese USB Hub

*Article published on [cxem.net](https://cxem.net/remont/remont63.php)*

I decided to share this information, as eBay and AliExpress are currently flooded with such hubs. Surely, the same problem may occur with hubs in different cases.

![USB Hub](images/01.jpg)

The first HUB instance was purchased on PandaWill together with an Android mini PC, tested and put on the shelf, as it would freeze and disconnect every 30 seconds.

![USB Hub packaging](images/02.jpg)

Finding a similar HUB on AliExpress with assurances that it "provides 4 USB 2.0 ports", I ordered this item. After 2 weeks, to my disappointment, I received exactly the same device made of cheap plastic without any identifying marks:

![USB Hub device](images/03.jpg)

But! This time the hub, at least, worked. When connected, Windows happily reported a new device "USB 2.0 Hub", although in reality all ports on the hub are USB 1.0, whose speed does not exceed 1 MB/s.

After opening both instances, almost identical boards with a black blob controller were discovered. As I suspected, the cause of the first hub's freezing was the absence of a ceramic resonator. Obviously, it (somehow) worked from an RC oscillator.

![USB Hub PCB](images/04.jpg)

The device boards differ slightly, but the component numbering matches.

![USB Hub PCB comparison](images/05.jpg)

The repair itself consists of:

1. soldering the missing ceramic resonator Y1 at 6 MHz;
2. soldering resistor R2 with a value of 1.5 kΩ (I assume it enables the use of the resonator);
3. adding a power supply capacitor of 47 μF 6.3 V;
4. desoldering capacitor C1 (apparently - part of the RC oscillator);
5. soldering capacitors C3 and C4 with a value of 22 pF from the resonator pins to ground.

The resonator can be found in some mouse models:

![Mouse resonator](images/06.jpg)

Capacitors C3 and C4 are used in the case of two-legged resonators:

![Two-legged resonator](images/07.jpg)

I have a three-legged resonator, so I did not solder C3 and C4.

After the above manipulations, the hub worked stably.
