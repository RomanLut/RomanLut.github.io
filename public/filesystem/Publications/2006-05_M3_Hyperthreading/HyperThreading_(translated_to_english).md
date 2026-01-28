# HyperThreading

*Article published on [dtf.ru](https://web.archive.org/web/20080208042404/http://dtf.ru/articles/read.php?id=39888) on May 17, 2006*

It is recommended to start with [the first part of the article](http:)

## Part 3. HyperThreading Technology

This part of the article will be simpler, since in this case we are dealing with a processor that can execute two threads simultaneously at the hardware level – we will have to delve less into the OS internals.

Let's approach this critically and verify how threads work on these processors, and what real performance gain can be obtained. This article will be useful as "an article about HyperThreading – not a reprint of Intel presentations" 🙂

### Evaluating the Advantages of HT

![image23](images/image23.png)

*Figure 23. Test #2 clearly shows that threads are truly executed in parallel. Windows perceives the system as dual-processor.*

![image24](images/image24.png)

*Figure 24. Test #3. When launching 4 threads, the system distributes two per each "processor".*

As I said at the beginning, everything here will be significantly simpler: we open a second thread, and it runs in parallel. We don't need to worry about allocating CPU time. The task of executing a background algorithm without slowing down the main thread by more than 10% is solved. Or is it?

![image25](images/image25.png)

*Figure 25. Test #1. One thread with normal priority.*

Let's compare the results of tests #1 and #2. The "useful" work execution speed in the first thread decreased by 36% when opening the second thread (532528/829456 = 0.64). This means that when launching a background task, FPS will drop from 50 to 32.

Worst of all, in this situation there are no methods to regulate the share of CPU time allocated to the second thread. Both virtual processors are equal. We either give up 36% of performance to get a second thread running at the same speed, or we must modify the algorithm running in the second thread so that it regularly "sleeps".

Conclusion: the task we set on HT systems, while observing all the stated conditions, is not solvable.

From this it also follows that examples like "HyperThreading technology allowed us to calculate a complex particle system using an additional thread, which was impossible on regular processors" [6] are not entirely correct. In practice, the game sacrificed 36% FPS to obtain a particle system that is only ~1.3 times more complex than a system that could be calculated with the same FPS loss on a regular processor.

### How to Really Gain Performance Using HT

The total "useful" work execution speed increased by 28% (1065492/829456 = 1.28). I by no means deny the advantages of HT technology, but I want to draw attention to the fact that to obtain real gains, it is necessary to carefully plan the software architecture. The second thread is not "free", and if it is decided to use it, it should work on the main task on par with the first, not calculate additional "features". With a total performance increase of 28%, this is not so easy to do.

Let me give an example. Suppose frame rendering takes 12ms, physics calculation – 4ms, total frame time – 16ms. We launch the application, we get 1000/16 ~ 62.5 FPS.

| Thread 1                    |       |
|-----------------------------|-------|
| Rendering frame n           | 12 ms |
| Physics calculation frame n+1 | 4 ms |
| Present()                   |       |
| **Total**                   | **16ms** |

Now let's "optimize" the application for HT: we move physics calculation to the second thread. The first thread renders frames based on the latest information from the physics engine, the physics engine in the background continuously recalculates the world state.

| Thread 1                    |              | Thread 2                    |              |
|-----------------------------|--------------|-----------------------------|--------------|
| Rendering frame n = m       | 12 ms * 1.56 | Physics calculation frame m+1 | 4 ms * 1.56 |
|                             |              | Physics calculation frame m+2 | 4 ms * 1.56 |
|                             |              | Physics calculation frame m+3 | 4 ms * 1.56 |
| Present()                   |              |                             |              |
| **Total**                   | **12 ms * 1.56  ~ 18.72 ms** |              |              |

(1.56 ~ 1/0.64 – correction for thread execution speed reduction)

We launch it, we get 1000/12*0.64 ~ 53.3 FPS (0.64 – the thread began executing 36% slower), that is, a FPS reduction of (53.3/62.5) => 15%! And this is without accounting for synchronization costs.

The funny thing is that by running this dual-threaded application variant on a regular processor and getting 1000/(12+12) ~ 41.66 FPS, a programmer can happily report a (50/41.66) => 17% FPS increase through using HT technology!

First, now our program logic has changed: physics is recalculated 3 times more often than at the start (12/4=3). The error lies in the assumption that the second thread is "free" and allows executing 100% additional tasks. We already know this is not so – let's fix the error. Frame rendering and physics calculation will start synchronously in different threads. When the calculation/rendering of a frame completes, the threads must synchronize by stopping the thread until an event occurs from another thread (WaitForObject()). In our case, the physics engine will wait 8ms for rendering to complete.

| Thread 1                    |              | Thread 2                    |              |
|-----------------------------|--------------|-----------------------------|--------------|
| Rendering frame n           | 4*1.56+ 8 ~  | Physics calculation frame n+1 | 4 ms * 1.56 |
|                             | 14.24 ms     | Waiting                     | 8 ms         |
| Present()                   |              |                             |              |
| **Total**                   | **14.24 ms** |                             |              |

With this architecture, FPS will be 1000/14.64 ~ 70.2, that is, 20.2/62.5 ~ 11.2% performance increase. This is far from the calculated 28%, and is due to poor task balancing across threads. In practice, we used the 28% speedup only for (4*1.56)/14.24 ~ 44% of the time, the remaining 8 ms the system worked in single-threaded mode.

Unfortunately, the task of balancing tasks across threads significantly complicates the software architecture, and is often not 100% solvable. We will have to divide the program into short independent 2-3 ms tasks that can be distributed across free threads. Such a radical change in architecture may require large investments of time and possibly abandonment of already debugged working code, and you need to immediately think whether you are ready to pay this price for a 10-25% performance gain in your game.

### Conclusions and Notes

**1.** The second thread in HT processors is not "free". If a decision is made to use it to increase performance, it should work on the main task on par with the first, not calculate additional "features".

**2.** To obtain real performance gains, good task balancing across threads is necessary, which in turn requires a well-thought-out application architecture.

**3.** To achieve the theoretical 40% speedup, threads must load different processor blocks. Real speedup will be less.

**4.** If both threads contain few calculations and actively access memory, due to the unified memory interface, thread execution becomes practically sequential (it's impossible to speed up memcpy() operation by dividing it across threads).

**5.** If you use a second thread in your program – you will have to abandon OpenMP, since it no longer has anywhere to place its hidden thread.

**6.** Only you know about your program's internal logic. Help the OS – assign a thread to a specific processor using SetThreadAfinityMask().

Fourth part of the article: [Dual-core Processors](http://localhost:8080/?page_id=644)

### References

1. Multitasking Discussion
   [http://www.wideman-one.com/gw/tech/dataacq/multitasking.htm](http://www.wideman-one.com/gw/tech/dataacq/multitasking.htm)

2. Timers tutorial
   [http://www.codeproject.com/system/timers_intro.asp](http://www.codeproject.com/system/timers_intro.asp)

3. Time is the Simplest Thing…
   [http://www.codeproject.com/system/simpletime.asp](http://www.codeproject.com/system/simpletime.asp)

4. Quantifying The Accuracy Of Sleep
   [http://www.codeproject.com/system/sleepstudy.asp](http://www.codeproject.com/system/sleepstudy.asp)
   (commendable diligence in testing, but the author did not read this article)

5. Threading Articles
   [http://www.devx.com/Intel/Door/29081](http://www.devx.com/Intel/Door/29081)

6. GDC 2004: Multithreading in Games
   [http://www.extremetech.com/article2/0,1697,1554193,00.asp](http://www.extremetech.com/article2/0,1697,1554193,00.asp)

7. Threading Basics for Games
   [http://www.devx.com/Intel/Link/28614](http://www.devx.com/Intel/Link/28614)

8. Application of Multithreading in Games
   [http://www.gamedev.ru/articles/?id=70119](http://www.gamedev.ru/articles/?id=70119)
   (the example of performance increase through using threads presented in the article is incorrect)

9. Hyper-Threading Technology and Computer Games
   [http://www.dtf.ru/articles/read.php?id=113](http://www.dtf.ru/articles/read.php?id=113)

10. ProcessTamer
    [http://www.donationcoder.com/Software/Mouser/proctamer/](http://www.donationcoder.com/Software/Mouser/proctamer/)

11. Managing Concurrency: Latent Futures, Parallel Lives
    [http://www.gamearchitect.net/Articles/ManagingConcurrency1.html](http://www.gamearchitect.net/Articles/ManagingConcurrency1.html)

12. The Free Lunch Is Over: A Fundamental Turn Toward Concurrency in Software
    [http://www.gotw.ca/publications/concurrency-ddj.htm](http://www.gotw.ca/publications/concurrency-ddj.htm)

13. ThreadTest Application with Source Code
    [threadtest.zip](/filesystem/Publications/2006-05_M1_What_No_One_Told_You_About_Multitasking_in_Windows/threadtest.zip)
