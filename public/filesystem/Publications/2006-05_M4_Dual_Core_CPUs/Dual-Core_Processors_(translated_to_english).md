# Dual-Core Processors

*Article published on [dtf.ru](https://web.archive.org/web/20070512233426/http://dtf.ru/articles/read.php?id=39888) on May 17, 2006*

It is recommended to start with the [first part of the article](../2006-05_M1_Multitasking_Windows/article_en.md)

## Part 4. Dual-Core Processors

The hardware press has written numerous times that processor manufacturers have nearly exhausted the possibilities of simply increasing clock speeds. Therefore, the next step in development is increasing the number of cores — essentially, multiple processors in a single package. These developments are expected to significantly impact the entire software industry in the near future [12].

Now let's get back to the matter at hand. Fortunately, this processor architecture practically eliminates all the problems of solving our task (background loading), which makes the solution almost uninteresting :)

So, armed with the ThreadTest program, I ran it on a dual-core Pentium D, expecting a perfectly obvious result — completely independent thread execution. But what did I see?

![Figure 27](images/image27.png)

*Figure 27. Test #1. One thread with normal priority on a Pentium D processor. Exactly "half" of the processor is loaded.*

![Figure 28](images/image28.png)

*Figure 28. Test #2. Two threads with normal priority on a Pentium D processor.*

Based on test 2, two threads are executing simultaneously. But pay attention to the amount of "useful" work performed! It increased by only ~10%!

Frankly, these results left me stunned. The first thing I assumed was an error in the testing program or some BIOS settings. The most surprising thing was that 4 threads actually showed nearly a 2x performance increase:

![Figure 29](images/image29.png)

*Figure 29. Test #3. Four threads with normal priority on a Pentium D processor. It should be noted that the task scheduler is going completely crazy.*

But there were no problems with either the settings or the program.

After some experimentation, I finally discovered that I had stumbled upon a common problem with shared memory architectures: simultaneous access by two processors to nearby memory regions causes the internal controller to flush the memory cache (false sharing).

After I separated the thread data structures by 256 bytes by adding a small array:

```
TMyThreadData data;
BYTE guard[256];
TMyThreadData data2;
```

Everything fell into place:

![Figure 30](images/image30.png)

*Figure 30. Test #18. Two threads with normal priority. Thread local data is separated in memory.*

We get approximately ~73 additional percent of performance, which is very close to a twofold increase. At full load, each thread runs at about 88% of the speed relative to a single running thread, which almost satisfies the conditions of our task (slow down the first thread by no more than 10%).

We don't see 100% speedup because the bottleneck is the single memory interface, but this problem is already being addressed in new motherboards.

From this "incident" we can conclude that processing even array elements on one core and odd elements on another is a bad idea. The array should be divided in half. Strangely, this problem did not manifest on the HT processor.

But overall, the conclusion about dual-core processors is: this is cool, dude! All that's left is to wait until everyone has them.

So the question is not whether to consider transitioning the engine to multithreading, but when to start doing it. Processor manufacturers are still releasing single-core solutions, and I don't think they'll stop anytime soon. Will users get multiple cores soon, and will it happen at all? Perhaps we'll have to write two versions of the engine, as we do now with SSE/non-SSE, just to keep up with competitors delivering 1.5 to 1.8 times better performance. For now, not everything is clear on this front.

With that, let me conclude. Now I suggest returning to the [first paragraph of the article](../2006-05_M1_Multitasking_Windows/article_en.md), and assess how naive our notions about multitasking in Windows were :)

**Note.** *All the arguments presented in this article are the personal opinion of the author. There's a chance to change it by participating in the article discussion :)*

## References

1. Multitasking Discussion
   [http://www.wideman-one.com/gw/tech/dataacq/multitasking.htm](http://www.wideman-one.com/gw/tech/dataacq/multitasking.htm)

2. Timers tutorial
   [http://www.codeproject.com/system/timers_intro.asp](http://www.codeproject.com/system/timers_intro.asp)

3. Time is the Simplest Thing...
   [http://www.codeproject.com/system/simpletime.asp](http://www.codeproject.com/system/simpletime.asp)

4. Quantifying The Accuracy Of Sleep
   [http://www.codeproject.com/system/sleepstudy.asp](http://www.codeproject.com/system/sleepstudy.asp)
   (commendable diligence in testing, but the author hasn't read this article)

5. Threading Articles
   [http://www.devx.com/Intel/Door/29081](http://www.devx.com/Intel/Door/29081)

6. GDC 2004: Multithreading in Games
   [http://www.extremetech.com/article2/0,1697,1554193,00.asp](http://www.extremetech.com/article2/0,1697,1554193,00.asp)

7. Threading Basics for Games
   [http://www.devx.com/Intel/Link/28614](http://www.devx.com/Intel/Link/28614)

8. Using Multithreading in Games
   [http://www.gamedev.ru/articles/?id=70119](http://www.gamedev.ru/articles/?id=70119)
   (the example of performance improvement through thread usage presented in the article is incorrect)

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
