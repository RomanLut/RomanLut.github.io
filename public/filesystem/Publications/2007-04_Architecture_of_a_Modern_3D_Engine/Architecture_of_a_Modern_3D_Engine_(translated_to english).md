# Architecture of a Modern 3D Engine: Development of Xenus: Boiling Point

*Lecture delivered at the conference of computer game developers [KRI-2007](https://web.archive.org/web/20071217140959/http://www.kriconf.ru/2007/)*
*Audio recording of the lecture ([ogg](KRI_2007_Programming_08apr_neptun_03_Lut_Roman_DeepShadows.ogg))*

[Slides on SlideShare: Architecture of a Modern 3D "Engine"](https://www.slideshare.net/slideshow/3-d-xenus/13904796)


## Lecture Summary

I will introduce myself: I am Roman Lut, lead programmer, Deep Shadows company.

What the lecture is about: the lecture about what systems must be present in a modern 3D engine for first/third person games, using the Vital Engine as an example. To some extent, this will be a postmortem of Xenus, but the talk will go beyond that. I will also show screenshots and videos from two of our current projects: Precursors and White Gold.

Who the lecture is for: the lecture is oriented towards programmers, project managers. The lecture is quite overview-oriented. It will not discuss specific technologies, but mainly principles of operation, so it should actually be interesting for a fairly wide range of developers.

Purpose of the lecture: advertising the Vital Engine.

![ ](images/01.jpg)

What is this? This is the office of a typical gaming company from the 80s. As you know, back then games were made by enthusiasts in their own garage.

![ ](images/02.jpg)

*BattleZone. Atari, 1980*

Here is a screenshot from the first 3D game. Wireframe graphics, two colors.

Now let's look at a screenshot from a modern 3D game.

![ ](images/03.jpg)

There is a huge difference. What has changed over these years? Computer power has increased hundreds of times. Accordingly, it became possible to produce much more realistic images, perform high-quality simulation of the world, reproduce excellent sound, and significantly increase attention to details.

What is immediately visible from the screenshot:
– phototextures;
– imitation of various materials (shaders);
– complex lighting;
– abundance of details;
– postprocessing;

What is not visible from the screenshot:
– interactivity
– precise collisions, complex physics;
– artificial intelligence;
– quality animation;
– quality sound;

To see this, let's watch a video from the game "Xenus: Boiling Point".

[Watch Xenus trailer on YouTube](https://www.youtube.com/watch?v=MBV_Fxryj3Q)

So – abundance of details, abundance of systems. All this entails a significant increase in the complexity of developing modern games. A typical development team includes 30 or more people. The complexity of development has increased so much that many inexperienced, and sometimes experienced but too optimistically minded developers simply forget to include in the work plan almost half of the necessary tasks. This leads to deadline violations, budget overruns, project crashes or reduction in their quality.

Today, game development includes engine development, game code development, and content development.

When starting the development of a modern 3D "engine" for an AAA-class game, you need to clearly understand what systems will have to be made. And a lot will have to be made. This is what our lecture will be about, using the Vital Engine as an example.

So, engine development.

First of all, I want to say that many novice developers understand "engine" as the renderer. Unfortunately, for game creation, one renderer is not enough. Sound, collision, physics, network, editors and plugins are forgotten. Say, in fact, the development of internal editors can take more time than developing the part of the engine that goes on the disk. The current level of sound, collision, and physics and other systems in games is very high, so their development takes time no less, and perhaps more, than the renderer itself.

Although, in general, it's understandable why the renderer got this role – the first acquaintance of the public with the game happens precisely through screenshots. So, let's start with graphics.

So, the renderer. What should it be able to do?

Since corridor games have started to bore everyone lately, modern games are gradually shifting towards open spaces and simulation of large interactive worlds.

![ ](images/04.jpg)

The Vital engine uses a tiled world map: the map is composed of cells, each cell is a level of 600×600m (in Xenus it was 200×200m). Levels can be reused, which we actively used in Xenus. Moreover, cells can be rotated by 90, 180, and 270 degrees, combining typical road segments into tracks.

![ ](images/05.jpg)

The geometry is drawn so that when rotated, the vertices of neighboring cells match. The editor has special utilities for automatic stitching of vertices of neighboring levels, for stitching of terrain layer rendering, for stitching of lighting.

![ ](images/06.jpg)

This is how this map looks from the first person.

Since the levels are very detailed, the engine can hold in memory only about 12 unique levels. These are several cells closest to the player. As the player moves around the world, levels load in the background thread.

To ensure high visibility distance, the "engine" on the far distance draws the so-called Impostors (impostors) of levels. An impostor is a simplified version of the level, 2000-3000 triangles, one texture.

The impostor is created automatically using a special utility. That is, the artist loads the level into the editor, presses "create impostor", specifies the number of triangles and goes for a smoke. Artists really like it.

![ ](images/07.jpg)

On the slide on the left – the level, on the right – the impostor. At long distances they are practically indistinguishable. The technology is very powerful.

![ ](images/08.jpg)

Impostors take up little memory and render very quickly. This way the engine can provide very large visibility distances.

![ ](images/09.jpg)

Here on the slide – the real level, here the impostor.

Terrain and buildings – that's just the beginning. To fill the world with details, you need to place a mass of diverse objects in it.

The designer does this in our level editor.

We have a clear division: objects that do not move (trees, poles) and objects that move (characters, cars). This is done because for objects that do not move (and there are an order of magnitude more of them), certain optimizations can be applied.

![ ](images/10.jpg)

This is how the editor looks. Here the designer is placing benches – moving, cloning, rotating.

There can be a very large number of such objects on a level. This is what happens. Terrain and houses – level geometry, all trees – objects.

In order for the engine to "handle" such a huge number of objects, it must necessarily use levels of detail – simplify models with distance.

For many engines, LOD levels need to be created manually, but the Vital Engine export plugin does this automatically.

But even model simplification doesn't help, so at long distances, sprites are displayed instead of objects. In Xenus we made them manually, now they are created automatically by a special utility.

![ ](images/11.jpg)

Here in the pictures you can see what sprites look like: on the left – only models, on the right – only sprites. Practically indistinguishable. In Xenus, the moment of switching to sprite was quite noticeable because there was one sprite. Now there are several per model – with different lighting, and crossfade is used when switching. The switching is practically invisible.

Static objects – this does not mean that they are motionless. Nearby objects can switch to active state and play animation, for example – trees sway in the wind. They react to explosions, can be destroyed.

[Watch video on YouTube](https://www.youtube.com/watch?v=e_nv_3p9RH0)

These are not special cacti – this can be done with all cacti on the level.

![ ](images/12.jpg)

Further. Rendering of moving objects. These are cars, characters, movable items (barrels, boxes). How do they differ from static ones? They are always animated. That is, a tree at a long distance can freeze and switch to a sprite, a monster – no. Rendering animated objects is harder, so they are processed separately. In addition, lighting and shadows need to be calculated differently for them.

![ ](images/13.jpg)

Since these models have many triangles (on average, 5000 triangles per car and character), LOD levels are also mandatory here, and for the skeleton too. That is, at a distance of 20 meters, facial animation and fingers are already disabled.

[Watch video on YouTube](https://www.youtube.com/watch?v=0YfUcgd9OaU)

This is the kind of soldier we have.

Further. Rendering of effects. Most effects in the game are particle systems. Explosions, crumbs from hitting the wall, fire, smoke from the chimney, fire from the barrel when shooting.

Particles are implemented in the engine concept as a procedural model – that is, a model not created in Max, but created programmatically in real time and knows how to render itself.

In the same way, other effects are implemented – tracers, flare, lens flare, brake marks on asphalt, contrail in space. By the way, I will show space at the end of the lecture.

[Watch video on YouTube](https://www.youtube.com/watch?v=9vC6wU8-hJI)

Further – detail objects. That is, grass, various small debris. Allow significantly increasing the perceived detail. Allow hiding the "ground plane", getting away from "running on texture".

![ ](images/14.jpg)

Postprocessing. After everything is rendered, the final processing of the 2D image begins. This is a very important stage. Postprocessing allows with minimal costs to significantly improve the image quality.

Postprocess is described as the order of applying various filters to the image – reduction, blurring, combining, highlighting bright parts of the image. This is how bloom is implemented (halos around bright objects, highlights), fake HDR – that is, when we exit the room into the street, everything is overexposed at first, then the eyes get used to it. In the desert, we have image distortion from hot air.

The postprocess itself is described in a regular text file, here is an example.

What does this give? Here is an image without processing, here with bloom effect. Much more pleasant. The sun shines, the grass is green.

![ ](images/15.jpg)

Further – rendering of HUD elements. This is what everyone forgets. As a result, they start manually prescribing each button, dialog, and then when you need to move something 10 pixels, the programmer says he will shoot himself.

The Vital Engine includes a UI system with a Delphi-like editor. There are already ready-made interface elements, in which the editor specifies what texture to take for the frame, what width this part is, etc.

Since game UI does not tolerate standards, you have to write your own elements, inheriting from TWidget. You just need to add new properties and implement the Draw method. The new interface element automatically appears in the editor.

I talked about what we draw, now about how we draw. Shader library.

[Watch video on YouTube](https://www.youtube.com/watch?v=iak9fWH-tyo)

The engine is written for DirectX 9.0. We do not have a shader editor like Maya – shader graph, or like in Unreal Engine. Shaders are written by a separate programmer, inheriting the TShader class.

Still, shaders are programming. No matter how advanced the artist is, he will not be able to write an optimized shader. And a pixel shader is what executes millions of times per frame, so optimization is very important here.

Here it should be noted that our "engine" is oriented towards materials, not shaders. That is, the artist specifies that he wants to use a material with such-and-such behavior, and that's it. He should not worry about where the lighting comes from – from lightmap, vertex colors, dynamic source – the engine takes care of that. Therefore, several pixel shaders correspond to one material, and the engine itself chooses which one to use.

Here is an example of material description. Text file, here the material type is specified: Bumpmap. This material needs two textures, here they are specified.

We have already implemented a bunch of materials with different behaviors. If a new shader is needed – adding takes from half a day to 4 days.

Lighting.
We use lightmaps for level geometry, vertex lighting for static objects, and dynamic lighting for characters.

![ ](images/16.jpg)

After the artist has drawn the level, everything looks like this.
Completely flat picture, no volume is visible.

Here the lighting calculated by the editor is shown. We calculate ambient occlusion + lighting from the sun and light sources. Ambient occlusion allows very well to show form and volume. Here you can see how the fence and the wall are shaded.

![ ](images/17.jpg)

The engine can work in vertex lighting only mode. This saves memory on lightmaps. Clear shadows, naturally, disappear. This is what vertex lighting looks like.

![ ](images/18.jpg)

Lighting calculation is completely automatic, can be performed in batch mode. No need to do any lightmap layouts. Usually the artist leaves a pack of levels for the weekend, on Monday they are ready. Full compilation of one level takes up to 20 hours.

The editor calculates two lightings: daytime and nighttime. Nighttime lighting is vertex. By combining two lightings, you can get time of day change in real time.

About collision, AI, physics, network, sound Sergey Zabarjansky will tell you.

![ ](images/19.jpg)

*(Sergey Zabarjansky speaks)*

Editors. The engine is data-driven. Where, actually, to create these data, that is, content?

![ ](images/20.jpg)

Of course, you can take 3DS Max and make levels in it. But if you have read postmortems from game developers who did this, you know they regretted it a lot. 3DS MAX does not handle huge scenes, requires a lot of memory, slows down, glitches, does not allow seeing the level in final quality.

Our level editor allows making levels from scratch or just making small changes. Since many things are still more convenient to do in 3DS Max, the editor interacts closely with it. Literally: you select several triangles, press the "Send to max" button, and they are transferred to 3DS MAX. You make changes there, and just as easily transfer back.

The engine does not use CSG, like Quake for example. The level is a mesh. Literally: the artist drew something in 3ds max, shoved it into the engine – and you can run, shoot, drive.

![ ](images/21.jpg)

What besides geometry editing: applying materials, painting terrain layers. Painted with a brush. Applied a material – paint.

![ ](images/22.jpg)

Painting grass – also with a brush. Select the style in the dialog, and paint.

One of the most important purposes of the editor is placing objects on the level and editing their parameters.

![ ](images/23.jpg)

This is what the dialog looks like: each object has a set of parameters.

Moreover, if the programmer wrote a new unit, it appears in the editor automatically, no need to recompile the editor.

The editor supports collaborative work: objects can be placed by several people simultaneously. For example, the level designer is still placing trees, and the game designer is already placing characters and scripting dialogues and quests. Both upload their objects to the server, and receive others from it. Here there are buttons get and upload. The server has a database where all objects of all levels are stored.

![ ](images/24.jpg)

Further. World map editor. Everything is very simple and clear here. Simultaneous work and upload to the server are also supported.

Export plugin. As for level editing – it's better to have your own editor. But as for models – 3DS Max "cannot be surpassed". So we didn't make our own editor. We have a powerful export plugin that can automatically create LOD levels of geometry and skeleton on export, compresses animation, supports any type of animation keys.

![ ](images/25.jpg)

To see what came out, a model viewer is used. It starts automatically after export. This is how it looks. Here is the list of models, here is the skeleton hierarchy, here are the bone groups, here are the materials. Here you can check animation, separation into parts, whether controllers work correctly.

![ ](images/26.jpg)

Separately, it should be said about skeletal animation. In order to implement what we see in modern games, the skeletal animation system must allow a lot. I listed here, I will read:

- blending 2 or 4 animations
- skeleton divided into parts – each part plays its own animation
- you can programmatically hide triangles attached to the specified bone group
- you can programmatically rotate bone groups (bone controller)
- you can programmatically control the position and orientation of the bone group (bone controller)
- animation compression is used (character – 4000 frames, 60 bones)
- skeleton LOD is used
- you can "hang" one model on a bone ("port") of another – pistol in hand, particle of shot on the pistol barrel
- facial animation – 12 bones on the face

Further. Particle system editor.

![ ](images/27.jpg)

Everything I talked about in this lecture is in Vital Engine.
Questions?

## Other materials for the slides

Boiling Point: Road to Hell (Xenus) trailer

[Watch on YouTube](https://www.youtube.com/watch?v=PJcGcuDtDY8)

The Precursors gameplay

[Watch on YouTube](https://www.youtube.com/watch?v=Xt-sv4_Oe1I)