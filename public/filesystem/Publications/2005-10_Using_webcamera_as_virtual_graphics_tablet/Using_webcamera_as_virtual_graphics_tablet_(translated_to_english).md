# Making a Graphics Tablet from a Webcam

The article was published on the website [Hardware Portal](https://web.archive.org/web/20171215200516/http://www.hwp.ru/Handmade/Vtablet/index.html) on October 20, 2005. It was a prize winner of the “Do It Yourself” contest.

## Preface

What does a webcam have to do with a tablet, you might ask? Well, our tablet will be virtual!

![Striving for the ideal - let's try to make something similar](images/Picture1.jpg)

Once, after reading about Sony's Eye toy [1], I was thinking about unusual ways to input data into a computer. At that moment, the idea came to try assembling something similar myself - luckily, a webcam was at hand.

So, let's think - what can we track with one camera? First - the position of some object that differs from the background. At the same time, it should move only in some plane - since tracking coordinates in space will require two cameras. Second - we can track the change in color and shape of the object. Unfortunately, shape recognition will require studying serious pattern recognition algorithms, and it's better to abandon that. But even simple position tracking in space is enough to assemble a virtual tablet, if we take care of the pressure sensor.

## Virtual Tablet

So, the principle of operation. We place a white sheet of paper in the camera's field of view. We glue a colored marker to the tip of the pen. If we move the pen over the sheet of paper, then by recognizing the color of the marker on the image, we can get the coordinates of the pen in the plane of the sheet. If these coordinates are converted into cursor movement on the screen, we get the simplest virtual tablet.

![Such a non-trivial construction](images/Picture2.jpg)

## Pen with Colored Marker

For stable recognition, it is necessary that the tracked color differs significantly from the background of the image. Moreover, this color should be saturated. The best thing that was found at hand were stickers used for attaching prices to goods. The bright green color contrasts well with the image background.

![Ordinary ballpoint pen](images/Picture3.jpg)

We take an ordinary ballpoint pen.

![Stickers](images/Picture4.jpg)

We take one sticker, and cut a thin strip.

![Ready stylus](images/Picture5.jpg)

We wind the strip around the pen shaft.

![Ready stylus](images/Picture6.jpg)

Our "stylus" is ready! In the picture, you can see that the saturated color literally "burns", and therefore will be stably recognized by our program. Our pen does not have a pressure sensor, so the user will have to use some keyboard key, for example - left Ctrl.

## Software

Actually, the "hardware" part is already finished. We rigidly fixed the camera so that the sheet of paper occupies as much of the image as possible, and made the "stylus". Using the camera software, we can see that when we draw on the sheet of paper, the colored marker is clearly visible on the camera image. We need to write software that will track the position of the marker on the sheet of paper, and convert its movement into mouse cursor movement on the computer screen. I'll say right away that a reader unfamiliar with programming can skip the next two sections and immediately proceed to testing, since ready-made software is attached to the article.

As the programming language, we'll take Delphi, since it's easy to find ready-made components for working with a webcam and com-port (more on that later), and it's easy to make a user interface. But before launching the editor, let's discuss the algorithms.

## Color Recognition

From the camera, we get an image in RGB format (red, green, blue). Having this data, we must recognize the position (coordinates) of the marker on the image. I didn't want to delve into complex pattern recognition algorithms, so I took the simplest algorithm: loop through all pixels of the image, select those whose color is similar to the marker color, and find the average coordinates of these points (X,Y).

It's better to compare colors in YUV space (Y - brightness, UV - color), ignoring brightness (Y). This is to ensure that lighting conditions do not affect recognition stability.

The coordinates of all points similar to the marker color need to be summed and divided by their number. Thus, we get the average coordinates, which will be the position of our marker on the image.

![Formulas](images/Picture7.gif)

, where n - number of similar points.

## Mathematical Calculations

So, the first version of our "driver" already knows how to determine the coordinates of the marker on the image. However, coordinates on the image are not yet coordinates on the sheet of paper, since the sheet does not occupy the entire image area. Second, the sheet is located at an angle to the image plane.

To convert the coordinates of the marker on the image to coordinates on the sheet of paper, we need to know the coordinates of the corners of the sheet of paper on the image. To do this, we simply ask the user to "calibrate" our virtual tablet - click on the corners of the sheet of paper.

After "calibration", we get four pairs of coordinates (x1,y1, x2,y2, x3,y3, x4,y4) on the image, which correspond to the corners of the sheet of paper. Now we need to derive a relation that will allow us to convert coordinates on the image (x,y) to coordinates on the sheet of paper (X,Y). At first, I couldn't think of how to do this, but eventually I managed to find a solution.

The sheet of paper represents a plane in space. Let's assume that the coordinates of the corners of the image in three-dimensional space are equal to:

![Formulas](images/Picture8.gif)

Since we are not interested in real sizes in space, but only relative coordinates on the sheet of paper, we can take any coordinates lying in the three-dimensional plane. I chose the indicated ones to get output coordinates X and Y in the range [0..1].

From the course of three-dimensional graphics, we know that to create a two-dimensional image from a three-dimensional model, the coordinates of three-dimensional points are multiplied by the local matrix of the object and by the camera matrix:

![Formulas](images/Picture9.gif)

The obtained three-dimensional coordinates in the camera space are projected onto the screen plane. Usually, a projection matrix is used for this, but in the case of perspective projection, the same process can be described by simple formulas:

![Formulas](images/Picture10.gif)

, where f – focal length.

Substituting (1) into (2), and writing out the matrix multiplication by vector:

![Formulas](images/Picture11.gif)

, where ![Formulas](images/Picture12.gif) - elements of the total matrix ![Formulas](images/Picture13.gif).gif

Again, since we are interested in only ratios, the focal length can be omitted and considered included in the elements of the matrix located in the numerator.

Multiply and expand (3):

![Formulas](images/Picture14.gif)

Express X,Y (coordinates on the sheet of paper):

![Formulas](images/Picture15.gif)

Having formulas (4), we can get coordinates on the sheet of paper (X,Y) from coordinates on the image (x,y). The coordinates on the sheet of paper will be in the range [0..1], and it remains only to multiply them by the screen resolution to get the required cursor position.

How to find the elements of the matrix ![Formulas](images/Picture12.gif) for formula (4)? We know the three-dimensional coordinates of the paper corners (![Formulas](images/Picture16.gif) - accepted earlier) and their coordinates on the image (![Formulas](images/Picture17.gif) - obtained during calibration). We need to substitute them into formulas (4) and solve the resulting system of equations.

We get a system of linear equations, which can be written in matrix form as:

![Formulas](images/Picture18.gif)

![Formulas](images/Picture19.gif)

![Formulas](images/Picture20.gif)

I supplemented matrix A with zeros from below to make it square.

We got 8 equations and 9 unknowns. To find 9 unknowns, 8 equations are not enough. But we know that points (X,Y,Z) lie in a plane, and therefore are linearly dependent. That is, there are actually more equations than unknowns, which means the system has a solution. I'll just say that such systems of equations are solved using singular matrix decomposition, which I won't consider here, as I've probably already tired you :).

## Complicating the Hardware Part

So, we can already draw with our tablet! However, recognition stability strongly depends on lighting conditions, and using the Ctrl key for pressing is not very convenient. Let's assemble an "advanced stylus" for our tablet.

To increase stability, I decided to place a green LED on the tip of the pen. Now recognition stability practically does not depend on lighting. As a pressure sensor, I took a microswitch from an old mouse.

![Blank for advanced stylus](images/Picture21.jpg)

We take an old ballpoint pen with a diameter of 1 cm.

![Donor mouse](images/Picture22.jpg)

We take an old COM-mouse.

![Donor mouse](images/Picture23.jpg)

From the mouse, we need a wire with a connector and a microswitch.

![Installing microswitch in pen](images/Picture24.jpg)

We insert the microswitch into the pen so that when pressed, the pen shaft turns it on.

![LED](images/Picture25.jpg)

We take a green LED. I filed it a bit on the edges to make it smaller.

![Installing LED in pen](images/Picture26.jpg)

We glue the LED to the tip of the pen. I wrapped the LED with foil on the sides. Now in the dark, there is no halo around the LED, and recognition stability improves.

![Scheme](images/Picture27.jpg)

We solder everything according to the given scheme. The point is as follows: the LED is powered from the signal lines of the COM-port and constantly lights. The microswitch closes the receive-transmit circuit, and thus, in the pressed state, the program receives "echo" from the sent data. This can be checked by running HyperTerminal and typing several characters on the console. When the switch is released - characters are not displayed. When pressed - the entered characters are transmitted by the terminal, received back and displayed on the console.

![Ready stylus](images/Picture28.jpg)

![Stylus in hand](images/Picture29.jpg)

After assembly, you should get something like this.

## About Software Setup

I tried to make the software with the most understandable interface in the form of a Wizard.

Immediately after launch, the software tries to connect to the webcam and requires calibration. I'll dwell separately on some pages of the Wizard.

![Stylus in hand](images/Picture30.jpg)

On the webcam selection screen, you need to select the camera (Button "Source…") and image format ("Format…"). If you have two video input devices in the system, for example - there is a video input on the video card, then you need to choose the source correctly. In format settings, you need to select one of the following formats: I420, IYUV, UYVY. The software does not work with other formats. It should also be noted that at higher webcam resolutions, they often give 2-3 times lower FPS, so you may have to sacrifice resolution in favor of response speed. With correct settings, the image from the camera should be fed into the left window.

![Stylus in hand](images/Picture31.jpg)

On the tracking color setup screen, you need to select the "Spread", "Sensitivity" parameters and tracking color such that a red cross clearly follows the tip of the pen in the left image.

You need to start with the "Sensitivity" parameter. Set it so that in the right window our marker is clearly highlighted in color. Click with the mouse cursor on the marker image in the right or left window. The program remembered the required color, and begins to collect similar points. The number of similar points is displayed under the label "Samples count:". In the left window, similar points are marked with pink color. You need to adjust the "Spread" parameter so that the number of similar points is approximately fifty. You may need to adjust the size of the colored marker on the pen tip and remove foreign objects from the camera's field of view.

I hope the rest of the Wizard screens won't cause questions. After completing the Wizard, our "driver" sits in the tray. You can also turn the tablet on/off with the "Scroll lock" key on the keyboard.

## Conclusion

I think that if you ever had a desire to buy yourself some cheap tablet "for fun", then a virtual one will be quite enough for these purposes. After all, all you need is to fix the camera, glue the marker to the pen tip, install the software - and the tablet is ready.

As an option, you can draw with a laser pointer (or keychain) on the wall. The webcam can also be replaced with a digital camera connected to the video input of the video card. Personally, I tried with Canon A70 + video input on GeForce 4 TI4200, as well as Agfa CL20 camera in webcam mode.

I didn't call this tablet a "toy" for nothing. It will never compare to professional tablets like Wacom due to low resolution (and it's about 50% less than the webcam resolution), as well as the delay arising from the video signal delay during digitization. For comparison, I'll say that the Wacom Intuos tablet works at a resolution of at least 1024x768, recognizes 512 levels of pressure and pen tilt. In addition, many cameras change white balance when lighting conditions change, which changes the tracking color and causes stability problems in recognition.

## Materials on the Topic

- Software for virtual tablet http://www.deep-shadows.com/hax/vtablet.htm
- Sony Eyetoy http://www.us.playstation.com/Content/OGS/SCUS-97319/Site/
- Flight of Fantasy http://gaijin.ru/projects/flight.htm
- VISUAL INPUT FOR PEN-BASED COMPUTERS http://www.vision.caltech.edu/mariomu/research/pentrack/long.html
- YUV at Wiki pedia http://en.wikipedia.org/wiki/YUV
- Com port library for Delphi http://sourceforge.net/projects/comport/
- tscap32 for Delphi http://tscap32.sourceforge.net/
- DKLang translation package, DK Software, http://www.dk-soft.org/
- Hax's personal page http://www.deep-shadows.com/hax/ 

20/10.2005*
