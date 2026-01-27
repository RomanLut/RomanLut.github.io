# Streaming and effective reading from a DVD disc

This lecture was prepared for the computer game developers conference [KRI-2008](https://web.archive.org/web/20091201033637/http://kriconf.ru/2008/).

[Audio recording of the lecture](KRI_2008_Programming_20apr_saturn_04_Lut_Roman_Deep_Shadows.ogg)

The article was published on the website [DTF.ru](https://web.archive.org/web/20090908184352/http://dtf.ru/articles/read.php?id=52134).

[Slides on SlideShare: Streaming and effective reading from a DVD disc](http://www.slideshare.net/Roman_Lut/dvd-13813392)

At present, CPU speed, GPU power, and HDD size are growing much faster than RAM volume. Modern game levels have huge detail, but relatively small memory does not let you load the whole world at once. In the simplest case the game is forced to interrupt gameplay with loading screens, which is especially annoying in role-playing games.

![Figure 1. Loading.](images/image1.jpg)

To get rid of loading screens, streaming is used—loading resources in the background. The article examines the advantages and problems of this technology, loading strategies, implementation in modern "engines," and questions of effective streaming from DVD. Despite the wide use of streaming in modern games, there is practically no information on this topic on the internet, which prompted the author to write this article.

## What is streaming?

Streaming is loading resources from disk into RAM in the background. For the player the process is transparent: they keep playing without pauses. Streaming allows building large detailed worlds where only the "active" content is in memory. When traveling, unnecessary content is unloaded and instead the data that will be needed soon are loaded.

![Figure 2. World Xenus 2: White Gold [8].](images/image2.jpg)

Players hate loading screens "at the most interesting moment." Console owners expect to insert a disc and play right away. Many console games with streaming are not only free from loading screens but also shorten the initial startup time by loading content during cutscenes or menus. On consoles, small memory volume and a slow DVD/Blu-ray drive are the main constraints against which streaming works.

## Resources

Part of the resources (UI strings, scripts, material and object descriptions, shaders, texture lists) takes little memory and is usually loaded at game start. The largest volume is almost always textures, so they are streamed most often. Besides textures the game can load sounds, music, models, levels, animation, collision mesh, scripts, video, etc. Code streaming is rare.

![Figure 3. Resources of Xenus 2: White Gold.](images/image3.gif)

## What supporting streaming includes

After the decision "add streaming" you need to provide:

- the ability to load resources in the background;
- an "engine" oriented toward asynchronous work with resources;
- a preloading strategy;
- a strategy for unloading resources when memory is insufficient.

The main thing is the mechanism of background loading (an example implementation is given below). Since at any moment some resource may not be in memory, the game must understand this: request background loading and begin using only after it is finished. If an algorithm with waiting is impossible, you must guarantee that by the time of use the resource is already in memory (preloading strategy). When different types of resources are streamed, you have to decide what to unload when memory is lacking.

## Classic (linear) streaming

The simplest example is a racing simulator. The track is divided into segments of about 200 m, viewing distance is 150 m. At most two zones are in memory (the player can be at a joint). The next zone is loaded in the background; the one behind is unloaded when the new one is connected.

![Figure 4. The racing simulator track is an ideal "world" for linear streaming.](images/image4.gif)

Thanks to the linearity of movement, the order of zone loading is known. In an RPG, where the player can go anywhere, the principle is the same but more complicated. The world is divided into compact zones (often squares).

![Figure 5. Political map. Example of dividing an open world into zones.](images/image5.gif)

Zones inside a circle with a radius of about 150% of the visibility distance are kept in memory; otherwise the zone is unloaded. Background loading starts when the zone enters a circle with a radius of about 140% of visibility distance. The radius depends on loading speed and player speed. Because of freedom of movement, cases are possible when a loaded zone turns out unnecessary. Examples of games: GTAIII (architectural elements), Oblivion (squares), Gothic (squares), Operation Flashpoint (1x1 km squares), Xenus (200x200 m squares).

## Unique and shared resources

Each zone uses a set of resources. There are unique ones (landscape, building geometry) and common ones (library of textures, models). Different approaches to handling common resources are possible.

### Strategy 1. All resources of the zone are considered unique

![Figure 6. All resources of the zone are considered unique; the entire set lies in one block.](images/image6.gif)

**Advantages**

- simplicity of the "engine" design;
- the zone is a linear block on disk (fast reading, less memory fragmentation);
- unambiguous requirements for content.

**Disadvantages**

- duplication of identical resources in memory and on disk -> growth of zone and game size.

### Strategy 2. Part of the types are common, each type has its own cache

When loading a zone, the resources it needs are additionally loaded into the cache; when unloading, resources with `refcount == 0` are removed.

![Figure 7. Some resources of the zone are common. The zone refers to cache elements.](images/image7.gif)

**Advantages**

- memory saving;
- reduction of the volume of additionally loaded data (part already in cache).

**Disadvantages**

- memory fragmentation;
- nondeterministic reading order (many DVD seeks).

### Strategy 3. Common resources are stored in an independent cache and loaded as needed

![Figure 8. Independent resource cache. The "engine" looks for a resource in the cache at render time.](images/image8.gif)

Zones can be large; part of their resources (for example, a painting texture inside a building) may not be needed. Such resources are loaded only when they enter the field of view.

**Advantages**

- even greater memory savings;
- even smaller zone loading volume.

**Disadvantages**

- memory fragmentation;
- many unpredictable seeks;
- complex logic of cache interaction (which cache frees memory?);
- hard to set clear art budgets, have to rely on testing.

## Class StreamableResource

All resource classes inherit from the abstract `TStreamableResource`; background loading is performed by the resource manager. Resource instances are created during engine initialization and contain a description, but in the start state they are ready only for binding.

The interface should include:

- a state polling method: not loaded / loading / loaded;
- `StartBackgroundLoad()` — a signal to the manager about the start of background loading;
- `Unload()` — immediate unloading (without long waiting);
- a resource priority method (for strategy 3);
- methods supporting `refCount` (for strategies 2 and 3); with strategy 3 the engine must "lock" the whole group of dependent resources;
- a field `lastUsedOnFrameId` (for choosing candidates for unloading under strategy 3).

## Efficient background reading

CPU and DVD work in parallel. For maximum speed, reading from disk and processing (unpacking) should go simultaneously, which requires two additional threads.

![Figure 9. Operation of the engine threads.](images/image9.gif)

- The loading thread processes the read queue; it is blocked by I/O almost all the time and can run on the core of the main thread.
- The processing thread (resource init thread) prepares resources for use: unpacking, initialization.

So that the main thread does not use resources that are not yet connected, a "finalization" stage is introduced at the end of the frame in the main thread. The background thread fully prepares the resource, but the main one "sees" it only after finalization. This simplifies debugging and eliminates races.

## Strategies for preloading zone resources

A resource must be in memory by the time of use, otherwise you will have to wait for loading and FPS will collapse. Possible criteria for starting preloading:

- distance to the zone;
- a trigger set by the designer;
- statistics (for strategy 3): if texture `stone39` was needed at point X,Y,Z, then when approaching it you can initiate preloading (the disadvantages of statistics are obvious);
- heuristics (for example, a car is visible -> load the damaged model and textures; the player switched to a grenade launcher -> load the rocket model, smoke, explosion).

For some resources it is difficult to ensure preloading. Before they load you can:

- use a dummy resource (reduced texture, etc.). 5000 textures 64x64 DXT1 take about 50 MB and can be loaded at initialization;
- not render the object (if models are visible from 600 m, you can start showing from 500 m; fog can hide the late appearance).

For sounds and collision mesh dummy resources are impossible, therefore strategy 3 does not suit them—they need to be loaded at initialization or together with the zone (strategies 1/2).

If a resource cannot be kept in memory but the volume is large, it can be stored compressed (for example, ZIP) and unpacked on demand. Unpacking is faster than reading from disk and does not cause an FPS drop.

Examples of dummy resources: reduced texture; model — billboard or lower LOD; sound — mono, low bitrate; music may not play until loading.

## Memory fragmentation

Strategy 1 fights fragmentation best: the zone is a linear block, you can load the prepared block and do fixup. Therefore it is popular on portable consoles. With strategy 3 the fragmentation problem is maximal; custom allocators with size-based pools, handle-based pointers, and garbage collection help. It is effective to reserve "slots" for unique zone data: if two zones must be in memory and one is loading, three identical slots are reserved.

## How large can a zone be?

All "active" zones and their common resources must fit in memory. If zones are loaded into "slots," their size is strictly limited by slot size. Player speed and disk reading speed are also important.

Example (racing): a zone is a 0.5 km segment, maximum speed 100 km/h. The next segment must be in memory 0.1 km before it, so loading must not exceed 14.5 s (0.4 km / 100 km/h). Minimum DVD speed is 6 MB/s; in 14.5 s that is 87 MB not counting seek and assuming a linear block. Here the zone size is limited by disk speed, not memory volume (512 MB), so we are interested in physical characteristics of storage devices.

## Physical characteristics of HDD / DVD / Blu-ray

![Figure 10. Physical characteristics of storage devices [6].](images/image10.gif)

A DVD drive can reduce speed on poorly readable discs. Before reading the drive positions the head (seek), making several "pushes" and checks "where am I?", so seek takes noticeable time.

**Rule:** maximum reading speed is achieved by reducing seek time.

Example: average speed 12 MB/s. One seek of 120 ms loses 1.44 MB/s; seek + layer change (200 ms) loses 2.4 MB/s; spin up 2 s — minus 24 MB.

Reading a 0.5 MB file requires three seeks (directory, FAT, data), giving 7.68 MB/s instead of 12 MB/s. The deeper the file in the tree, the slower.

## Optimizing reading from DVD

The main task is to minimize the number of seeks.

![Figure 11. Mechanism of the HD-DVD drive [7].](images/image11.jpg)

If a seek is inevitable, it would be good to position to neighboring tracks: short seeks are faster (within several tracks the laser can just tilt). The second task is to reduce data volume.

There are several techniques:

- Compressing resources reduces volume and shortens seeks (resources are closer to each other).
- Group files eliminate parsing of the directory tree and cluster alignment, bringing the number of positions closer to one. Files are placed tightly, saving space and reducing seek length.
- Place dependent resources physically next to each other (textures of a model immediately after the geometry). It is more convenient to do this inside group files.
- Sometimes it is useful to duplicate files to reduce seeks (a texture immediately after each model that uses it). This increases game size and random seeks, so apply with caution.
- A loading queue with the same priority should be resorted: load the next resource whose data are closer to the current head position (or position in the group file). A simple optimization can give up to 50% effect.
- If the console has an HDD, you can cache data from DVD on a dedicated partition during DVD idle time (menus, cutscenes). After copying, HDD is used, but world streaming must work using only DVD, since HDD may be optional.

## Compression

For ordinary data, Zlib or LZO are suitable. LZO compresses worse (~+20% compared to ZIP) but can decompress *in place* — packed data are loaded into a "slot" and decompressed there without additional memory, which is useful for strategy 1.

For textures — DXT/JPEG or ZLIB on top of DXT. For sounds — mp3, ogg.

Parallel reading and unpacking almost doubles effective speed. Example: reading 12 MB/s, ZIP unpacking 30 MB/s, compression ratio 0.6. Sequentially: 14.3 MB/s; in parallel: 20 MB/s.

## Xenus 2: White Gold. Loading strategy

![Figure 13. Xenus 2: White Gold [8].](images/image12.jpg)

The Xenus 2 world is divided into squares 600x600 m. Unique zone resources: landscape and building geometry, collision mesh, AI structures, lightmaps, vertex lighting of models. Common (independent cache): textures, models, animations, sounds, music, impostors of levels. At initialization shaders, string resources (dialogs), hitmesh and collision mesh of models, particle system descriptions are loaded.

Zones intersecting the 1100x1100 m bounding box around the player (4 nearest zones) are in memory. The designer can specify groups of zones that must be loaded as a whole (for example, a mountain peak). Content is prepared so that the total volume of unique data of loaded zones does not exceed a fixed budget.

A fixed volume is allocated for the texture cache; the cache does not load textures above the budget. Reduced versions of all textures (no more than 64x64) are loaded at initialization (~50 MB for 5000 textures).

Models and animation start loading when an attempt to render occurs; before loading the model is not drawn. For trees at long distances impostors are used, which remain until the full model appears. To reduce unpleasant effects, dependency heuristics are applied (car <-> blown-up car, weapon model <-> shells, etc.). Some models and textures (for example, HUD) are "locked" in the cache.

To minimize seeks, group files (100 MB–2 GB) are used separately by resource types (textures, models, levels). Thus data of one priority lie close. When loading, requests are sorted to reduce seeks.

When building group files, a graph of connections between files is created (texture–texture within a model; model–model within a zone and between dependent models; sound–sound, etc.). The stronger the connection, the closer the files should be. Placement optimization reduces to minimizing the function:

```
S = sum((k * distance(f1, f2))^2)
```

where `k` is the "thickness" of the connection (each dependency adds +1), `distance(f1, f2)` is the distance between the positions of the start of the files (in bytes). Because of the large graph (~5000 nodes, ~50,000 connections) an optimal solution is unreachable, so a genetic algorithm with a time limit is applied: 2 hours per group file (during this time the function stops decreasing quickly). The algorithm can insert file duplicates, but the size of the group file must not grow by more than 20%.

The solution is saved to a special file and reused at build time; ideally it is recalculated periodically on a dedicated machine. Textures are DXT1/DXT5 + ZIP on top, sounds and music — ogg (decoded in real time), other resources — ZIP.

## Optimizing reading from DVD: where to start?

Actual contribution of methods (from greater to lesser):

1. Sorting the resource loading queue.
2. Parallel unpacking and reading from DVD.
3. Group files.
4. Resource compression.
5. Optimizing file placement inside a group file.
6. Inserting file duplicates.

Depending on the content, sometimes sorting the queue alone is enough.

## Conclusion and future plans

Optimizing DVD loading is a task with fuzzy criteria. You can understand whether it is solved only by testing; when the test department stops complaining, the result can be considered achieved. Practical figure: the time of initial initialization was reduced from 2 minutes to 30 seconds.

Now the loading system is being expanded for a parallelized engine. Before finalization of resources all threads that use them synchronize: at the right moments threads briefly stop so that one thread performs finalization. This makes it possible to do without critical sections. With the introduction of parallel rendering all resources received a `RefCount` field so that any thread could "lock" a resource in the cache for the time of use. After the described optimizations are implemented, work on the resource manager is finished, the set goals are achieved.

## References

1. [Highly Detailed Continuous Worlds: Streaming Game Resources From Slow Media](https://web.archive.org/web/20081201000000/http://www.gamasutra.com/features/gdcarchive/2003/Denman_Stu.ppt)
2. [Streaming for Next Generation Games](https://web.archive.org/web/20081201000000/http://www.gamasutra.com/view/feature/1769/streaming_for_next_generation_games.php?print=1)
3. [It’s Still Loading?](https://web.archive.org/web/20081201000000/http://www.drizzle.com/~scottb/gdc/its-still-loading.ppt)
4. [PS3 Oblivion Seeing Double To Counteract Blu-Ray](https://web.archive.org/web/20081201000000/http://www.gamesetwatch.com/2007/01/ps3_oblivion_seeing_double_to.php)
5. [Blog debate: PS3 to load games slower than the Xbox 360](https://web.archive.org/web/20081201000000/http://www.joystiq.com/2006/09/04/ps3-to-load-games-slower-than-the-xbox-360/2)
6. [Is Blu-Ray better for Games](https://web.archive.org/web/20081201000000/http://forum.beyond3d.com/showthread.php?t=37751)
7. [Format war 2: HD DVD advances under NEC's flag, but so far only in the field of DVD-ROM](https://web.archive.org/web/20081201000000/http://www.ixbt.com/optical/nec-hr1100.shtml)
8. [Official site of the game Xenus 2: White Gold](https://web.archive.org/web/20081201000000/http://whitegold-game.com/)
9. [Lecture materials](https://web.archive.org/web/20081201000000/http://www.deep-shadows.com/hax/downloads/DVDReading.7z)
10. [Audio recording of the lecture](KRI_2008_Programming_20apr_saturn_04_Lut_Roman_Deep_Shadows.ogg)
