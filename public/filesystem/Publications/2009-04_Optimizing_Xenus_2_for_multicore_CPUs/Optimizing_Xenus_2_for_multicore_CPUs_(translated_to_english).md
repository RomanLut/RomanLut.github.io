# Optimizing Xenus 2 for multicore CPUs

*The presentation won second place at the [Intel Game Demo 2008 contest](https://web.archive.org/web/20091214110526/http://software.intel.com/ru-ru/articles/spotlight-on-the-2008-intel-game-demo-contest-winners/).*

*The lecture was presented at the game developers conference [KRI 2009](https://web.archive.org/web/20100107024116/http://kriconf.ru/2009/)*

[Slides on SlideShare](https://www.slideshare.net/slideshow/embed_code/14002127)

## Lecture Notes

Today I will talk about the issues that arise when parallelizing a game engine "in general," and about what we did in our two most recent projects, in particular.

Technologies in games are developing at enormous speed: more complex algorithms, more objects. Accordingly, more processing power is required. But while previously everything was compensated by increasing the processor's clock frequency, about 2 years ago everything changed. Clock frequency growth has stopped, and now processors are increasing the number of cores.

To utilize the full power of modern processors, in addition to knowledge of classical algorithms that we all studied for a long time, you need to learn programming for multiprocessor systems—and this is an entirely separate field, with its own nuances.

I want to point out that today it's already too late to just be interested in this—it's time to implement. If someone hasn't fully grasped what a powerful conceptual change has occurred in recent years, I recommend reading Herb Sutter's article "The Free Lunch Is Over"—everything is very beautifully described there from a philosophical perspective.

Realistically, as of today, Core 2 Duo is already the minimum processor for a gamer. Therefore, games are simply forced to use multiple cores if they want to remain competitive.

When developers realize this, they start thinking about how to change the engine so that it uses more cores, and as a result they choose certain models, architectural solutions, which I'll begin by reviewing.

I'll start with the wrong solution.

The first thing that comes to mind for a programmer who recently learned that you can create threads and they execute in parallel—is to create several threads and somehow execute something in them.

This approach leads to nothing good. Very soon the entire program turns into a mess, where one thread reads another's data at unpredictable times and it's unclear what it will read as a result. To fix the errors, the programmer starts inserting critical sections everywhere, as a result the cores start waiting for each other, and everything works even slower than before such "optimization."

For a program to work correctly, you need a clear, understandable system design, clear and understandable rules and protocols for component interaction.

Parallelization begins with analysis.

So, having a "linear" program, we must distribute the work so that all cores are always doing useful work, without idle time.

Obviously, the linear nature of program execution hinders parallelization—the next block uses data created by the previous one. Therefore, the first thing you have to think about when parallelizing is whether it's possible to divide the program into relatively independent components, with minimal, clearly described interaction.

Having a clear picture of the system components and their interaction, we proceed to choosing a parallelization model. In fact, there aren't that many models, just like design patterns. I'll list the most common ones.

### Model 1: Independent engine components run in different threads

Examples of successful solutions:

If in a game frame the game world state is first updated and then rendered—we can move rendering to a second thread, and update the world for the next frame in parallel.

With a client-server architecture (in single-player mode, client and server run on the same machine)—server in one thread, client in another.

You can move particle system calculations for the next frame—into a separate thread.

### Model 2: Producer – consumer

Unfortunately, the frame loop doesn't always have such a clear structure. For example, the game traverses the object hierarchy, determines what exactly needs to be rendered, updates only those objects and draws them. There's no clear separation between update and rendering in the frame.

In this case, you can apply the producer-consumer model: the first thread traverses the scene, updates objects and puts rendering requests into a queue. In parallel, the second thread takes tasks from the queue and draws objects.

Update and rendering are given as a specific example. In fact, the system is applicable everywhere where there's one-way interaction between program blocks (commands go in one direction, without feedback).

### Model 3: Execution thread splitting

If during code analysis you can find sequential program blocks that don't depend on each other, then the blocks can be executed in parallel.

In the given abstract example, blocks 2 and 3 prepare input data for block 4. They don't depend on each other, and therefore can be executed in parallel. This is the so-called Task parallel approach—different algorithms are executed in threads.

There's also the Data parallel approach—when the same algorithm is executed in different threads, but each instance processes different data. The simplest example—processing array elements. The algorithm inside the loop can be run on different threads, each instance processes one array element.

The advantage of this method is that we maintain approximately linear program execution, and if desired we can even execute everything linearly in one thread, if needed for debugging.

This approach also allows gradual optimization of code sections without breaking the entire application architecture.

On the other hand, we have too much idle time, because after splitting and execution, we must synchronize task completion to continue linear execution. Naturally, one of the tasks will execute longer than the others, so the remaining cores will be idle.

In fact, the indicated approach is just a way to slightly optimize existing code, but it will never give 100% core utilization. It's in the concept itself. But, if we analyze the downsides of this model, we arrive at the perfect architecture: Task dependency graph.

### Model 4: Task dependency graph

We divide the entire program into functional blocks, and analyze the dependencies between them.

The diagram should be understood as follows: before we can execute block 1, we must execute blocks 2, 3 and 4, because they prepare the necessary data. Before we can execute block 2, we must execute blocks 5 and 6, and so on.

What's the advantage of such a system? That now we know which blocks can be executed in parallel. For example, at the beginning of execution we know that we can start executing blocks 6, 8, 9, and 10 on all available cores.

With sufficiently fine-grained decomposition, core utilization and scalability approach 100%.

This system will give maximum performance, and it has only one drawback: complexity of implementation and maintenance. To build such an engine, you need to think in terms of "Functional block" and "Dependency" from the very beginning. If engine development has already started, transitioning to such an architecture practically means rewriting from scratch.

Furthermore, such a program is extremely difficult to debug. Say, in the current frame block A was executed in the first thread, before independent blocks B and C, and in the next frame it will be executed in another thread after blocks B and C, because task execution shifted in time. Finding bugs will be very difficult.

I know of only two games using such architecture: Lost Planet and Kill Zone 2. There are separate lectures on both games, links will be on the last slide.

### Implementing Task Dependency graphs

In all the listed methods, the concept of "Launch a task in the second thread" is used. A naive programmer will try to create a thread. For reference: creating and deleting threads is a very lengthy operation. From the moment of creation to the moment of execution, 100ms can pass, while a game frame is 33ms.

For effective implementation of the indicated methods, a higher-level library is required that creates threads in advance and independently distributes tasks among them.

For implementing the execution thread splitting method, OpenMP is quite suitable. With OpenMP you can implement Data-parallel and Task-parallel sections. But OpenMP has no ability to track dependencies between tasks, and there's no concept of "task" at all.

### Intel Threading Building Blocks

Now I'll promote the Intel Threading Building Blocks library a bit. First, I strongly don't recommend trying to write such a library yourself. To implement everything correctly and without errors, you need specialized experience and a lot of time. I doubt that one person could complete an equivalent in even six months. Especially since Intel distributes the library for free.

The library is object-oriented. For the user, the library looks very simple. We inherit a class from the base class tbb::task and override the run() method. After that we can add our class to the execution queue, and the library will execute it on an available thread. You can spawn new tasks in the run() method and wait for their completion, that is, practically, dynamically build a dependency graph.

Let's return to the previous slide: what the Task Dependency Graph implementation under Intel TBB would look like.

Block1 is, roughly speaking, the final task, say, the task "output frame to screen." We spawn this task, it starts executing. The task knows that to output the screen, you need to update the world, calculate skeletal animation and render the world. The task in its Run() method spawns three tasks using task::spawnChild() and waits for their execution. The "Update world" task, in turn, spawns 100 "update object" tasks, and so on.

And when we call task::waitforall(), actually no idle time occurs. The library, inside the waitforall() method, doesn't idle, but takes dependent tasks from the queue and executes them together with the other threads.

The library is optimally written, uses lockless algorithms, is cache-optimized and available for PC and XBOX 360.

Tasks can be very small—less than a millisecond and less.

## Deep Shadows Practical Experience

After the overview, let's get back to our sheep—what was our situation at Deep Shadows.

If I had a lot of time and could program for my own pleasure, I would of course start writing everything from scratch and implement Task Dependency Graph. Unfortunately, in reality various milestones prevent enjoying work, and starting a global "engine" overhaul six months before release means project failure. So implementing Task Dependency Graph remains just a dream for now.

On the other hand, nobody forces us to do everything perfectly. We have a specific task: ensure 30FPS on target hardware.

Therefore from the very beginning I was already planning to use Producer-consumer and execution thread splitting.

We had the following situation. The game showed about 20-23 FPS. We optimized the "engine" as much as possible: algorithms, batching, SSE, prefetch, but we couldn't achieve an FPS increase to 30. The game world simply has a lot of objects and details, and they all need to be processed. A situation where there's nothing specific that's slow, but overall—everything is slow.

Here's the frame time distribution.

Here's how the game looked under Vtune. Vital.dll and game.dll—that's world update. VERender2—that's scene traversal. DX9render and ShaderLib—our graphics library, a layer over DirectX 9. It's noticeable here that the game is already so optimized that speeding up, say, scene traversal by 20% (which isn't that easy), we'd get an FPS increase of only 2-3%, and we need 150%.

That's how we came to the conclusion that without parallelization we won't achieve the result. We need to move something to a second thread.

What exactly?

Here it's visible that DirectX and Driver take a lot of time, and we have no way to optimize them—we've already reduced the number of drawcalls as much as we could.

Here's the solution: the graphics library is an excellent candidate for the Producer-consumer model. Data flow goes in one direction. We had several GetViewPort(), GetWorldMatrix() calls, but we got rid of them. We could have moved only the DirectX API, but we moved our entire graphics library to the second thread, the dividing line—our library's API.

### Parallel Rendering Implementation

Everything works as follows.

Scene traversal, instead of calling graphics library API methods, writes commands to a circular buffer. The second thread in parallel takes commands and executes them.

Result: 60% of the green line is moved to the second thread. Rendering happens in parallel with world update. The synchronization point is before checking the game cache state (waiting for rendering to finish).

Here's how it looks under Vtune: DirectX, driver and our graphics library work in the second thread.

**Result: FPS increase of >150%!**

Thanks to such a simple system, parallel rendering was working in just 2 weeks, and one person did it. During the following three months we periodically caught forgotten bugs.

### GameBrio: Alternative Approach

About a couple of months ago in one programmer's blog I came across a lecture by a programmer from Emergent Technologies. In his lecture he describes how they implemented parallel rendering in GameBrio.

They also strived to do everything with minimal code changes. The Direct3DDevice interface was chosen as the dividing line.

Literally, instead of a pointer to the device, the "engine" is given a pointer to its own class, which puts all methods into a Ring Buffer. I highly recommend watching this lecture, because they made the library open source. This is perhaps the simplest way to implement parallel rendering in an "engine." There are some nuances related to creating vertex buffers, with subsequent locking, but in principle, everything is quite simple.

## Future work

At the moment, only 2 cores are loaded.

DirectX 9 and 10 are single-threaded APIs, and therefore there's nothing much to improve there. What we can actually do is write multiple queues, processing game objects in parallel. The resulting queues should be joined into the main Ring buffer.

By the way, ITBB is very convenient to use here.

In DirectX 11, so-called Deferred contexts will finally appear—objects with the IDirect3DDevice interface that don't render, but record calls. The resulting queue can be executed on the main device.

By the way, on XBOX 360 this is available today.

## References

1. Intel Threading BuildingBlocks
   [www.threadingbuildingblocks.org](http://www.threadingbuildingblocks.org)

2. Vincent Scheb, GameBrio, Emergent game technologies, "Practical Parallel rendering with DirectX 9 and 10"
   [http://emergent.net/GameFest2008](http://emergent.net/GameFest2008)

3. "Emergent open source Command Buffer library"
   [http://emergent.net/GameFest2008](http://emergent.net/GameFest2008)

4. Jim Tilander, Vassily Filippov, Sony Santa Monica, "Practical SPU Programming in God of War III"

5. Capcom lecture, "Capcom MT framework"

6. Capcom lecture, "Lost planet multithreaded rendering"

7. Ville Mönkkönen, Gamasutra, "Multithreaded game engine architectures"

8. Henry Gabb and Adam Lake, Gamasutra, "Threading 3D Game Engine Basics"

9. Jonathan Haas, Game Technology Group, Microsoft, "Designing Multi-Core Games: How to Walk and Chew Bubblegum at the Same Time"

10. Abdennour El Rhalibi, Dave England and Steven Costa, "Game Engineering for a Multiprocessor Architecture"

11. Tom Leonard, Valve, "Dragged Kicking and Screaming: Source Multicore"

12. Will Damon, Engineer Software Solutions Group, Intel Corporation "Multithreading Your Game Engine for Hyper-Threading Technology"

13. Leigh Davies, Senior Application Engineer, INTEL, "Optimizing DirectX on Multi-core architectures"

14. Maxim Perminov, Aaron Coday, Will Damon, "Real World Multithreading in PC Games Case Studies"
