# Tips on Geometry Export Plugin Architecture

*Article published on [gamedev.ru](http://www.gamedev.ru/community/toolcorner/articles/?id=723)*

## Introduction

If you are a tools programmer, you will inevitably have to work with artists. This set of tips will help save time by using the right approach to problem solving. In practice, these tips help save no less time than knowing all the secrets of 3DS MAX.

Yes – this article does *not* discuss the software architecture of the plugin.

## Error Handling

If you think you've saved time by skipping error handling and exception handling – you are very mistaken. Every time the plugin crashes for an artist, they will call you. Multiply this by the number of plugin users and the number of times they invoke export – and you get a full-time job of user support.

The plugin should *never* crash, regardless of whether the 3DS MAX scene meets the requirements or not.

Also keep in mind that a plugin error leads to a 3DS MAX crash, and the artist may not have saved before exporting….

## "Proper" Error Messages

An error message like "Failed !" will not help much in solving the problem described above. A "proper" error message should contain:

1. Description of the error situation.
2. Reasons, including possible ones, that led to this situation.
3. How to resolve the error situation.

Many programmers limit themselves to point 1, believing that everything else is self-evident. In reality, point 3 is the most important. Don't be afraid to give long descriptions. As is well known, artists think differently, and things that are obvious to a programmer are not obvious to an artist.

A message like "Error: Node PORT_GUN has no parent" is incomprehensible to an artist, and as a result they will come to you with a complaint "The plugin is giving some error there". Write in plain text that the PORT_GUN object must be linked to the character's hand. If possible, indicate the chapter in the manual that describes what PORT_GUN is and what requirements it has. And also: write messages in the user's native language!

## Scaling

No matter how much you tell them, someone will definitely make a model in different units than required. For this reason, in the export parameters you absolutely need to provide the ability to scale the model during export. This will help save time on redoing the scene, since scaling a rigged Biped in 3DS MAX is *very* difficult.

## What to Export

Provide the ability to export only part of the scene. For example, we use options: "Export selected only" and "Export hidden". In addition, objects whose names begin with "NOEXPORT_" are never exported. Animators will add various auxiliary objects to the scene, such as benches and tables. Forcing them to delete these objects before each export is unreasonable.

## Remembering Export Parameters

![Export parameters](images/01.gif)

*Figure 1. Export parameters are automatically set to the last used values.*

If you need to specify any parameters when exporting a model, remember the last used values in the max-file's user-defined properties (Interface->FindProperty()). On the next export, all controls in the parameters dialog should contain the values used last time. For example, a week later you may not remember what Scale parameter was used to export the model.

Ideally, you should also set the filename in the export dialog to the last used one. Unfortunately, 3DS MAX does not provide standard functionality for this, but as usual, the desired result can be achieved by applying knowledge of WinAPI.

## Build Number

Display the build number or build date/time somewhere in the export dialog. This will help save time checking in situations where the artist simply has an old version of the plugin.

## Installer

![Installer](images/02.gif)

*Figure 2. The installer automatically finds 3DS MAX directories and sets checkboxes.*

It may seem simple to take the plugin from the repository and copy it to the "C:\3dsmax\plugins" directory. In reality, it turns out that artists are not always savvy users.

It's preferable for the plugin to be stored in the repository as an installer that automatically finds the 3DS MAX directory and installs the plugin. You can create it, for example, using InnoSetup[1] with built-in Pascal scripts.

## Log

After export, display a dialog with a log, or at least use OutputDebugString() during export. The log should output messages about decisions made, such as "Bone Bip 01 Finger1 skipped – no bound vertices", "Object gun01 skipped – no UV coordinates", etc. In other words, maximize your chances of indicating "on the spot" why something is not happening as intended. Otherwise you'll have to ask the artist to send you the max-file, run it under your debugger – which will take an order of magnitude more time.

The strings output by OutputDebugString() can be viewed using the DbWin32 utility [3].

## Specification Compliance Check

If your engine imposes certain requirements on models, introduce the ability to check them at the export stage. For example, if a character must contain PORT_FIRE and TAG_FRAMECENTER objects – this is the specification for this model type. The model type is selected in the export parameters dialog. Without this system, an incorrect model reaches the AI programmer, who will spend time checking it and sending it back to the modeler.

The specification can also automatically set the correct export parameters.

## Scene Rotation

Besides units of measurement, modelers sometimes confuse the model's orientation. When a character is already made, textured, rigged, and animated, it suddenly turns out that it should be facing along the Z axis, not X. You will most likely be asked to add scene rotation during export, because rotating the scene in 3DS MAX doesn't work. Resist! Scaling is one thing, but complicating the plugin interface indefinitely is also bad, since the more parameters there are, the more likely they will be set incorrectly.

I'd better tell you how to rotate a scene in 3DS MAX. I myself thought for some time that rotating an animated Biped was impossible. In reality, you need to create a dummy at the origin, link all objects that are roots of hierarchies to it (including Biped), and rotate this dummy. After rotation, it can be deleted. An important point is that you cannot attach objects with the Physique modifier, objects with Link Constraint controller, splines, etc. to this dummy – in other words, objects that move indirectly as a result of moving controlling objects (bones, controller target, spline control points). My SceneMainTool plugin [2] creates such a dummy with one click.

## Conclusion

This list does not claim to be complete – I would like to hear similar tips in the discussion of this article.

## References

1. InnoSetup
   [http://www.jrsoftware.org/isinfo.php](http://www.jrsoftware.org/isinfo.php)

2. SceneMainTool plugin
   [SceneMainTool.zip](SceneMainTool.zip)

3. DbWin32
   [http://grantschenck.tripod.com/dbwinv2.htm](http://grantschenck.tripod.com/dbwinv2.htm)
