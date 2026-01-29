# Biomechanical Energy of Small Rodents as a Renewable Energy Source

*Article published on [radiokot.ru](https://radiokot.ru/lab/hardwork/99/)*
*Article is a prize winner of the "Congratulate the Cat like a Human 2014!" contest*


Rising energy prices and the depletion of fossil fuel resources have made the demand for alternative solutions in the field of electricity generation essential worldwide. At the same time, energy demand is increasing, especially in regions with a high level of industrial development. Industrialized countries are also striving to reduce their dependence on imports of oil, gas, coal, and uranium.

These are the reasons why the importance of renewable energy sources in the electricity market is growing. Increasing their use enhances the regional contribution to generation capacity — an aspect that should not be overlooked. These types of energy make a significant contribution in countries with underdeveloped infrastructure: large segments of the population are supplied with energy, for example, through rural electrification.

Until recently, for a number of reasons — primarily due to the vast reserves of conventional energy resources — relatively little attention was paid to the development of renewable energy sources in energy policy. In recent years, the situation has begun to change noticeably. The need to fight for a better environment, new opportunities to improve people's quality of life, participation in the global development of advanced technologies, the drive to improve the energy efficiency of economic development, the logic of international cooperation — these and other considerations have contributed to the intensification of national efforts to create greener energy and move toward a low-carbon economy.

However, alongside wind energy, solar energy, and other well-known alternative technologies, unjustifiably little attention is paid to the colossal reserves of energy that is literally lying around or running underfoot — the biomechanical energy of small rodents.

Among the wide variety of the Myomorpha suborder, one representative worth highlighting is the domestic hamster.

Literature reports that in the wild, a hamster can run up to 12 km per day (the measurement methodology is unknown to us, unfortunately). Under domestic conditions, one can measure how many kilometers a hamster runs in a wheel. Technically minded people easily build devices that record the number of wheel rotations. Results for the Syrian hamster: 6–10 km per night, speed — from 2 to 3.6 km per hour.

[Video: Hamster in a wheel](https://www.youtube.com/watch?v=DhIVtGS3-dk)

When using two or more test subjects, one can obtain a virtually non-stop source of rotational torque:

[Video: Two hamsters in a wheel](https://www.youtube.com/watch?v=YyDMEYzFUeQ)

Running is an integral part of a hamster's life, so having a wheel or a disc in the cage is, one might say, a necessity.

Although recent research has emerged on converting muscle contraction movements into electrical energy using piezoelectric nanotubes[1], compared to traditional mechanical energy conversion, most of the power remains unused:

[Video: Piezoelectric nanotubes](https://www.youtube.com/watch?v=P9x1myxGzVQ)

Therefore, classical electrical machines should still be considered as generators, with particular attention paid to reducing friction losses, which can be achieved by using good bearings — for example, from tachometers manufactured in the USSR.

Miniature generators from self-charging flashlights, DC motors from toys manufactured by Chinese industry, or custom-built generators based on neodymium magnets can serve as miniature generators. Unfortunately, these devices require a high shaft rotation speed and therefore perform unsatisfactorily.

Bipolar stepper motors have shown themselves in the best light in this application, as they generate a large amount of energy even at low shaft rotation speeds. Preference should be given to motors with the lowest rotational resistance, since an animal weighing less than 200g is unable to provide high torque.

The alternating voltage taken from the windings of a bipolar motor must be rectified and fed to a load, which can be a 1W white LED:

![Half-wave rectifier schematic](images/01.png)

Schottky diodes with low forward voltage drop should be used as rectifier diodes.

To achieve maximum efficiency, a full-wave rectifier can be built:

![Full-wave rectifier schematic](images/02.png)

A small-capacity Li-Ion battery from a radio-controlled helicopter or a mobile phone can serve as the energy storage element, but it must include a protection board against overcharging and over-discharging.

A few wheel rotations provide continuous LED illumination for 30 seconds.

![General view of the setup](images/03.jpg)

*General view of the setup, assembled to demonstrate the principles of electrical energy generation to the younger generation*

Working video:

[Video: Demonstration of the setup in action](https://www.youtube.com/watch?v=Z7I_TOyNfIY)

**Happy April 1st to all aspiring radio enthusiasts!**


## References

1. Converting Biomechanical Energy into Electricity by a Muscle-Movement-Driven Nanogenerator
   [https://pubs.acs.org/doi/abs/10.1021/nl803904b](https://pubs.acs.org/doi/abs/10.1021/nl803904b)

2. Yandex - abstract
   [https://vesna.yandex.ru/](https://vesna.yandex.ru/)

3. Other sources on the internet.
