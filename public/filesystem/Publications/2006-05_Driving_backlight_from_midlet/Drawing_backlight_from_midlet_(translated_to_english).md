# Screen Backlight Control from a Midlet

*Article was published on dev.juga.ru, 17.05.2006*

### Introduction

![picture1](images/picture1.bmp)

I think the question of backlight control interests everyone who has ever written midlets. Despite this, searching in Google gives no results. Since I had to study this issue in detail, I want to "shed light" on this problem in this article.

### The Problem of Standards

Unfortunately, neither the MIDP1.0 standard nor the MIDP2.0 standard regulate classes for backlight control. I don't know why the consortium ignored this issue, but this leads to the fact that to control the backlight, you have to use manufacturer APIs.

This means that you either have to distribute different versions of midlets for different phone models, or write a universal class that will determine the presence of a specific API automatically.

This article will discuss creating such a class.

## Manufacturer APIs

### Nokia UI API

Backlight control on Nokia phones is done using methods of the DeviceControl class:

```java
import com.nokia.mid.ui.DeviceControl;

DeviceControl.setLights(0,100); //region (0-screen), brightness (0..100)
DeviceControl.setLights(0,0);
```

This method allows adjusting the backlight brightness in the range from 0 to 100, if the phone supports such a possibility. Here it should be noted that when turning on medium brightness, screens of some phones (for example, 3200) start flickering unpleasantly (about 40 Hz). Nokia UI API is contained not only in Nokia phones, but also in some models of other manufacturers, for example SonyErricsson (although this is often undocumented).

### Siemens Game API

Backlight control on Siemens phones is done with methods:

```java
import com.siemens.mp.game.Light;

Light.setLightOn();
Light.setLightOff();
```

This class is present in all Siemens phones, including the latest 75 series (although this is not documented).

### Motorola Backlight and FunLights API

All Motorola phones (except A760/A780) have BackLight API:

```java
import com.motorola.multimedia.Lighting;

com.motorola.multimedia.Lighting.backlightOn();
com.motorola.multimedia.Lighting.backlightOff();
```

In addition, some models have Funlights API, which besides screen backlight, allows controlling other indicators (more about this later):

```java
import com.motorola.funlight.*;

FunLight.getRegion(1).setColor(c); //RGB color
```

Moreover, the phone can have Backlight API, and FunLights API, and MIDP2.0 Display API at the same time. How the backlight behaves when using all these APIs simultaneously is a little-studied question 🙂 I recommend using one of them, in the following priority order: FunLight, Backlight, MIDP2.0.

### Samsung LCDLight API

On Samsung phones, you need to use LCDLight API:

```java
import com.samsung.util.LCDLight;

com.samsung.util.LCDLight.on(0x0fffffff); //time in ms
com.samsung.util.LCDLight.off();
```

### LG Backlight API

LG phones contain LG Backlight API:

```java
import mmpp.media.BackLight;

mmpp.media.BackLight.on(0x0fffffff); //time in ms
mmpp.media.BackLight.off();
```

This API also allows adjusting the backlight color (more precisely, setting one of a set of colors, and only if this is supported by the phone).

### MIDP2.0 Display API

The MIDP2.0 standard regulates the flashBacklight method:

```java
import javax.microedition.lcdui.Display;

javax.microedition.lcdui.Display.getDisplay(midlet).flashBacklight(0x7fffffff); //time in ms
javax.microedition.lcdui.Display.getDisplay(midlet).flashBacklight(0);
```

Unfortunately, it is vaguely described as "create a visual effect", which can be understood as "turn on the backlight for the specified period of time" and "flash the backlight for the specified period of time".

Accordingly, the behavior of this method on different phone models differs, and may differ in the emulator and on the real phone. As practice shows, the idea to create a thread and periodically call flashBacklight() from it to avoid flickering - does not work.

This is the least reliable way to control the backlight, so it should be used last - if there are no other APIs. And in this case, backlight control must be disableable in the midlet menu (otherwise instead of backlight you can get a constantly flashing screen).

### Other Manufacturers' APIs

As far as I know, Vodafone and Sharp also provide their APIs. Unfortunately, I could not get their SDKs.

### Interaction with Phone Firmware

It should be noted that not on all phones does the midlet control the backlight exclusively. For example, on Siemens phones, even when turning off the backlight from the midlet, the firmware still turns on the backlight when pressing phone buttons, if such an option is set in its settings.

## Controlling Indicators

![picture2](images/picture2.bmp)

Some Motorola phone models allow separately controlling keyboard backlight and joystick area using FunLight API:

```java
FunLight.getRegion(n).setColor(c); //region n, RGB color
```

Region numbers are different for different models. I recommend turning off regions 2 and 3, since 1 is always screen backlight. Some phone models allow controlling side indicators of phones: 1) Motorola FinLight API;

```java
FunLight.getRegion(n).setColor(c); //region n, RGB color
```

2) Siemens M55:

```java
com.siemens.mp.m55.Ledcontrol.switchOn();
com.siemens.mp.m55.Ledcontrol.switchOff();
```

3) LG LED API:

```java
mmpp.media.LED.setColor(c); //RGB color
```

4) Nokia UI API also accepts a region number, but I don't know of any phone that supports this. It makes sense to turn off keyboard backlight and all indicators to reduce battery drain and remove distracting light.

### Universal Class for Backlight Control.

Summarizing all APIs, I came to the conclusion that the TLightController class should have the following methods:

1. query about the ability to control backlight in general;
2. query about the ability to control brightness;
3. method for setting backlight brightness (0 - turning off backlight);

If on this phone model it is impossible to control the backlight or its brightness, then the corresponding menu item in the midlet should be absent.

The presence of each API is determined automatically using Class.forName().

With the Display.flashBacklight() method, it's a bit more complicated. The Display class exists in both MIDP1.0 and MIDP2.0, but in MIDP1.0 this method is absent from the class. There are several ways to check:

1. just try to call the method and catch the "No such method" exception. Unfortunately, this rarely works, because such an exception usually leads to closing the midlet, or generally refusing to install the midlet;

2. analyze the string getAppProperty("microedition.profiles"). Some phones may return null, the configuration specified in the "MicroEdition-Profile: MIDP-1.0" attribute in the JAD file, or even a string in an unknown format.

Method 2 is safer, and therefore it is used in the class. On the other hand, if you supply the midlet in separate versions for MIDP1.0 and MIDP2.0 phones, it is better to enable/disable the Display.flashBacklight() method in different versions using a preprocessor (I use the JEnable preprocessor [2])

To increase reliability, a separate thread is created for backlight control. This is necessary because some phones still turn off the backlight after some time if methods are not called to turn it on.

To turn off keyboard backlight on Motorola, on the contrary, you need to periodically (every 100 ms) call the turn off method. The full source code of the class is given below.

```java
//*******************************************************************************
//*******************************************************************************
// Universal backlight control class
// Copyright © 2006 by Roman Lut
// Free for any use. Please mention me in "About" box 
//*******************************************************************************
//*******************************************************************************

/*
Singleton. Reference with TLightController.GetInstance()
Default state is ENABLE.

Query TLightController.GetInstance(midlet).CanControl() to see whether class is able to control backlight.
Query TLightController.GetInstance(midlet).CanControlBrightness() to see whether class is able to control brightness.
Use TLightController.GetInstance(midlet).SetBrightness(brightness) to control backlight brightness.
brightness is 0 (minimum) to 255 (maximum);
*/

import javax.microedition.midlet.*;
import com.siemens.mp.game.Light;
import com.nokia.mid.ui.DeviceControl;
import com.motorola.multimedia.Lighting;
import com.motorola.funlight.*;
import javax.microedition.lcdui.Display;
import java.util.Timer;
import java.util.TimerTask;
import com.samsung.util.LCDLight;
import mmpp.media.BackLight;

//=============================================
// TLightController
//=============================================
public class TLightController extends TimerTask
{
  //light control method
  private static final byte LIGHT_NONE       = 0;
  private static final byte LIGHT_SIEMENS    = 1;
  private static final byte LIGHT_NOKIA      = 2;
  private static final byte LIGHT_MOTOROLA_LIGHT = 3;
  private static final byte LIGHT_MOTOROLA_FUNLIGHT = 4;
  private static final byte LIGHT_SAMSUNG    = 5;
  private static final byte LIGHT_LG         = 6;
  private static final byte LIGHT_MIDP20     = 7;

  private byte method;
  private static TLightController inst = null;

  private Region r1,r2,r3;
  Timer funLightsTimer;

  //---- for timertask -----
  private static MIDlet midlet;
  private static int curBrightness;
  //------------------------

  //============================
  // void ApplyState()
  //============================
  private final void ApplyState()
  {
    switch (method)
    {
      case LIGHT_SIEMENS:
      {
        if (curBrightness>0)
        {
          Light.setLightOn();
        }
        else
        {
          Light.setLightOff();
        }
      }
      break;

      case LIGHT_NOKIA:
      {
        DeviceControl.setLights(0,curBrightness*100/255);
      }
      break;

      case LIGHT_MOTOROLA_LIGHT:
        if (curBrightness>0)
        {
          com.motorola.multimedia.Lighting.backlightOn();
        }
        else
        {
          com.motorola.multimedia.Lighting.backlightOff();
        }
      break;

      case LIGHT_MOTOROLA_FUNLIGHT:
        int c = curBrightness + (curBrightness << 8) + (curBrightness << 16);
        FunLight.getRegion(1).setColor(c);
        r1.setColor(0);
        r2.setColor(0);
        r3.setColor(0);
      break;

      case LIGHT_SAMSUNG:
        if (curBrightness>0)
        {
          com.samsung.util.LCDLight.on(0x0fffffff); // max 60 seconds ?
        }
        else
        {
          com.samsung.util.LCDLight.off();
        }
      break;

      case LIGHT_LG:
        if (curBrightness>0)
        {
          mmpp.media.BackLight.on(0x0fffffff);
        }
        else
        {
          mmpp.media.BackLight.off();
        }
      break;
//#MIDP20{
      case LIGHT_MIDP20:
        if (curBrightness>0)
        {
          javax.microedition.lcdui.Display.getDisplay(midlet).flashBacklight(0x7fffffff);
        }
        else
        {
          javax.microedition.lcdui.Display.getDisplay(midlet).flashBacklight(0);
        }
      break;
//#MIDP20}
    }
  }

  //============================
  // run() (timer task)
  //============================
  public final void run()
  {
    ApplyState();
  }

  //=============================================
  // public TLightController()
  //=============================================
  private TLightController(MIDlet midlet)
  {
    curBrightness=(byte)255;
    this.midlet=midlet;

//#DEBUG{
//#DEBUG:  System.out.println("Initializing light controller");
//#DEBUG}

    method = LIGHT_NONE;

    try
    {
      Class.forName("com.siemens.mp.game.Light");
//#DEBUG{
//#DEBUG:   System.out.println("Using com.siemens.mp.game.Light");
//#DEBUG}
      method = LIGHT_SIEMENS;
    }
    catch (Exception e)
    {

    try
    {
      Class.forName("com.nokia.mid.ui.DeviceControl");
//#DEBUG{
//#DEBUG:   System.out.println("Using com.nokia.mid.ui.DeviceControl");
//#DEBUG}
      method = LIGHT_NOKIA;
    }
    catch (Exception e3)
    {

    try
    {
      Class.forName("com.motorola.funlight.FunLight");
//#DEBUG{
//#DEBUG:   System.out.println("Using com.motorola.multimedia.FunLight");
//#DEBUG}
      method = LIGHT_MOTOROLA_FUNLIGHT;
    }

    catch (Exception e1)
    {

    try
    {
      Class.forName("com.motorola.multimedia.Lighting");
//#DEBUG{
//#DEBUG:   System.out.println("Using com.motorola.multimedia.Lighting");
//#DEBUG}
      method = LIGHT_MOTOROLA_LIGHT;
    }
    catch (Exception e2)
    {

    try
    {
      Class.forName("com.samsung.util.LCDLight");

      if (LCDLight.isSupported()==false)
      {

//#DEBUG{
//#DEBUG:   System.out.println("LCDLight present, but not supported");
//#DEBUG}
        throw new Exception();
      }
//#DEBUG{
//#DEBUG:   System.out.println("Using com.samsung.LCDLight");
//#DEBUG}

      method = LIGHT_SAMSUNG;
    }
    catch (Exception e4)
    {

    try
    {
      Class.forName("mmpp.media.BackLight");

//#DEBUG{
//#DEBUG:   System.out.println("mmpp.media.BackLight");
//#DEBUG}

      method = LIGHT_LG;
    }
    catch (Exception e5)
    {

//#MIDP20{

      if (System.getProperty("microedition.profiles").indexOf("2.0")>0)
      {
//#DEBUG{
//#DEBUG:   System.out.println("javax.microedition.lcdui.Display");
//#DEBUG}
        method = LIGHT_MIDP20;
      }
//#MIDP20}

    }
    }
    }
    }
    }
    }

    if (method == LIGHT_MOTOROLA_FUNLIGHT)
    {
      FunLight.getControl();
      r1 = FunLight.getRegion(2);
      r2 = FunLight.getRegion(3);
      r3 = FunLight.getRegion(4);

      funLightsTimer = new Timer();
      funLightsTimer.scheduleAtFixedRate(this,0,100);
    }
    else
    {
      funLightsTimer = new Timer();
      funLightsTimer.scheduleAtFixedRate(this,0,3000);
    }
    ApplyState();
  }

  //=============================================
  //GetInstance()
  //=============================================
  public static TLightController GetInstance(MIDlet midlet)
  {
    if (inst==null) inst = new TLightController(midlet);
    return inst;
  }

  //=============================================
  //public boolean CanControl()
  //=============================================
  public boolean CanControl()
  {
    return method!=LIGHT_NONE;
  }

  //=============================================
  //public boolean CanControlBrightness()
  //=============================================
  public boolean CanControlBrightness()
  {
    return (method==LIGHT_NOKIA) || (method==LIGHT_MOTOROLA_FUNLIGHT);
  }

  //=============================================
  //public void SetBrightness()
  //=============================================
  public void SetBrightness(int brightness)
  {
    if (curBrightness == brightness) return;
    curBrightness = brightness;
    ApplyState();
  }
}
```

### What You Need to Compile the Class

To compile this class, you will need API classes from all manufacturers, which must be unpacked from SDK libraries and put into a separate LightAPIs.jar, which must be specified in the classpath.

1) Nokia UI API:

You will need the files:

```
com\nokia\mid\ui\DeviceControl$VibraTimerClient.class
com\nokia\mid\ui\DeviceControl$LightTimerClient.class
com\nokia\mid\ui\DeviceControl.class
```

Which can be found, for example, in the file lib\classes.zip from Nokia 3300 SDK (or in any other Nokia SDK) [3]. 2) Siemens Game API File:

```
com\siemens\mp\game\Light.class
```

can be found in the file lib\api.jar in any emulator of the 55 series phone, or C60 [4]. 3) Motorola Backlight and Funlights APIs Files:

```
com\motorola\funlight\Factory.class
com\motorola\funlight\FunLight.class
com\motorola\funlight\FunLightException.class
com\motorola\funlight\Region.class
com\motorola\funlight\Region_Blank.class
com\motorola\funlight\Region_Impl.class
com\motorola\mutimedia\lighting.class
```

are located in the file "\emulator A.1\lib\javaextensions.jar" from Motorola SDK 5.2.1 [5]. 4) Samsung LCDLights API File:

```
com\samsung\util\LCDLight.class
```

is located in the archive lib\midpapi.zip from the Samsung WTK 2.0 package [6]. 5) LG BackLight API File:

```
mmpp\media\BackLight.class
```

is located in the archive

classes.zip

from LG Java Station SDK [7].

PLEASE do not ask me to send these classes, as this violates the SDK license agreements.

If you don't want to download all SDKs, you can take the compiled TLightController as a ready .class file from the example midlet[1].

### Where This Doesn't Work

Unfortunately, implementation of such a class is fundamentally impossible on phones where Class.forName() does not work.

Some phones analyze the midlet's classes during installation, and if the midlet imports libraries that are not in the phone, the midlet is not installed. This does not comply with the standard, but is a reality, in particular for Motorola C370/C450/C550, Samsung C100 models, and possibly others that I don't know about.

### References

1. Source code of the TLightController class, example, binary files
   [http://www.deep-shadows.com/hax/downloads/BacklightControl.zip](https://web.archive.org/web/20180303115709/http://www.deep-shadows.com/hax/downloads/BacklightControl.zip)
2. JEnable preprocessor
   [http://www.sosnoski.com/opensrc/jenable/](https://web.archive.org/web/20180303115709/http://www.sosnoski.com/opensrc/jenable/)
3. Forum Nokia
   [http://forum.nokia.com/](https://web.archive.org/web/20180303115709/http://forum.nokia.com/)

4. BenQ Mobile developer section (Siemens Developer Portal)
   [http://www.benqmobile.com/developer](https://web.archive.org/web/20180303115709/http://www.benqmobile.com/developer)

5. Motocoder.com
   [http://developer.motorola.com/](https://web.archive.org/web/20180303115709/http://developer.motorola.com/)

6. Samsung Developers Club
   [http://developer.samsungmobile.com/](https://web.archive.org/web/20180303115709/http://developer.samsungmobile.com/)

7. LG Developer portal
   [http://java.ez-i.co.kr/wire/list.asp?code=java_mqa&skey=&sel_key=&page=5](https://web.archive.org/web/20180303115709/http://java.ez-i.co.kr/wire/list.asp?code=java_mqa&skey=&sel_key=&page=5)
   Site in Korean, you'll have to register by trial and error.
   Easier to download from other links:
   [http://lgfiles.net/portal/modules/files/showfile.php?lid=17](https://web.archive.org/web/20180303115709/http://lgfiles.net/portal/modules/files/showfile.php?lid=17)
   [http://www.mobilelab.co.kr/programming/up/data_j2me/lgtjavastationsdk101_2.zip](https://web.archive.org/web/20180303115709/http://www.mobilelab.co.kr/programming/up/data_j2me/lgtjavastationsdk101_2.zip)
