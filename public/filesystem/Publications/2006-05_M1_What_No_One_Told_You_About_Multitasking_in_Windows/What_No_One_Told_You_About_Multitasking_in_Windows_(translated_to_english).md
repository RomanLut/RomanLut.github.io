# What No One Told You About Multitasking in Windows

*Article published on [dtf.ru](https://web.archive.org/web/20071021090052/http://dtf.ru/articles/read.php?id=39888) on May 17, 2006*

## **Is Multitasking Simple?**

When I first started developing multithreaded applications, my thoughts were simple and straightforward: you just need to create a second thread and perform some work in it. The threads will execute simultaneously, the operating system handles all the complexity, and all I need to do is use a few WinAPI functions.

Unfortunately, things are not that simple in reality, especially when it comes to real-time applications (which computer games are). To understand this, I had to go through a long journey from bewilderment (why doesn't everything work as it should?) to a more or less clear understanding of how multitasking is actually implemented in Windows.

In this article, I'm ready to share the information I've gathered, debunk some common misconceptions, visually demonstrate the principles outlined, and at the same time, without claiming complete accuracy, hear other opinions.

The main goal of the research focuses on the possibility of using multithreading in games, and in particular, in DirectX applications. The second thread is intended for background level loading from disk, but taking no more than 10% of CPU time from the main thread (when launching background tasks, FPS should not drop significantly).

### **What This Article Will NOT Cover**

I won't be explaining why synchronization between threads is important. I won't describe WinAPI functions and objects used in multithreaded programs. I won't even describe what algorithms and patterns should be applied in multithreaded applications. There are plenty of articles on these topics, and I want to provide answers to questions that are very difficult to find answers to – nuances that often nullify the entire application architecture.

***Note.*** *Terms. Поток – thread. Многопоточность – multithreading. Многозадачность – multitasking.*

## **Part One. Principles of Multitasking.**

### **Let's Start with Misconceptions. Misconception One – Threads Execute Simultaneously.**

If you're even slightly familiar with hardware and assembly language, you know that the processor is originally designed to execute only one instruction stream. It has only one instruction pointer register and one set of general-purpose registers.

![Image](images/image1.png)

*Figure 1. Simplified processor diagram.*

The processor cannot physically execute multiple threads simultaneously (we'll talk about HyperThreading and DualCore in the third part of the article. Let's start with the basics – a regular processor). In reality, the operating system creates the illusion of simultaneous execution for us.

There are two main ways to organize a multitasking OS:

**1.** Applications are built on a window message queue. Each application must call the operating system's PeekMessage() function in a loop. The operating system returns from the function – issues a message (including idle messages) – sequentially to all applications in turn.

Until an application completes message processing and calls PeekMessage(), neither the operating system nor other applications execute. Thus, "switching" between threads is actually performed by the operating system's PeekMessage() function.

The obvious disadvantage is that the operating system has no control over the amount of CPU time used by an application. As soon as one application "freezes" and doesn't call the PeekMessage() function, all other applications stop working, including the operating system. The only option is to press Reset. It's clear that there's no "simultaneous thread execution" here.

Despite significant disadvantages, thanks to implementation simplicity, such a system is often used in operating systems for portable devices, for example – PalmOS.

**2.** Serious OSes use so-called "preemptive multitasking".

During initialization, the operating system kernel configures a timer to trigger a hardware interrupt at specific time intervals (quantum). In the hardware interrupt handler, the OS can save the complete processor state (registers), restore the state for another thread, and transfer control to it. A thread doesn't need to call any functions and can even execute an infinite loop – the operating system will still interrupt execution and allocate some amount of CPU time to another thread (called "time slice").

The advantages are obvious: one thread freezing doesn't lead to other threads and the operating system freezing. The operating system can even destroy a thread it considers "frozen" at any moment.

The nuance here is the time period for hardware interrupt invocation (quantum) and the amount of time allocated to each thread (time slice). You won't find this information in any documentation, and there's a reason for that: Microsoft Windows doesn't claim to be a "Real-time OS". It simply guarantees that everything will work normally for regular (read: office) applications.

These time intervals differ in different Windows versions, and for Windows XP they are quantum=10ms, time slice = 130ms (!). Here, a game developer should already be concerned, since at 50 FPS, the frame length is 20ms.

***Note.*** *Contrary to popular misconception, Windows 95/98 are built precisely according to the second scheme. It's just that these systems have many objects requiring exclusive access (DOS legacy), and if a thread "freezes" after capturing and not releasing such an object, no preemptive multitasking will help prevent other threads and the entire system from freezing.*

![Image](images/image2.png)

*Figure 2. ThreadTest application.*

For experiments, I wrote a special application (source code is included with the article). It contains a set of tests illustrating the above statements.

Close all unnecessary applications and run Test #1.

![Image](images/image3.png)

*Figure 3. Test #1. One thread (the main application thread) calculates the inverse of a 4×4 matrix in a loop, while recording time samples in a special array (but no more often than every 10 microseconds). By displaying the samples on a timeline, we can clearly see when the thread was executing and when it was idle, interrupted by the operating system. The result also shows the total number of calculated inverse matrices and the rate of matrices/sec (we're interested in the latter).*

You should get results as shown in the figure. The thread executed almost continuously, occasionally being interrupted by the operating system to perform service tasks and other threads (here we can also notice that the intervals between interruptions are approximately 10ms, i.e., quantum).

***Note.*** *For testing, you should use a computer with a single processor, without HT technology, or disable HT in BIOS.*

Here, an inexperienced programmer might immediately ask: but our thread isn't the only one, there are many in the system. According to the graph, our thread executed almost continuously. Does this mean other threads aren't working?

The fact is that other threads have no work, and after quickly checking a few flags, they give up their CPU time using Sleep(), WaitForObject() functions, etc. Accordingly, after going through all threads, the OS switches back to our thread. This explains the small gaps in our thread's execution. This concept is fundamental in Windows, allowing a large number of background threads to run without visible impact on application performance.

For comparison, run WinRar archiver to compress a large file, and repeat Test #1.

![Image](images/image4.png)

*Figure 4. Thread operation when WinRar is running in the background.*

This time we can observe significant gaps in thread operation. It's periodically interrupted for 130ms (time slice) – obviously, WinRar is using its CPU time. Accordingly, our application reduced the execution speed of "useful" work (matrix calculation) by 25%.

Our application receives 3 times more time because its window is active. If you start the test and quickly switch to WinRar, the picture reverses:

![Image](images/image5.png)

*Figure 5. Background application thread operation.*

Now it's obvious why you need to close other applications when launching 3D games – many of them may not be so kind and may not always quickly give up their CPU time (as is well known – ICQ is the enemy of smooth FPS).

We can visually see thread operation by running tests 2 (two threads with normal priority) and 3 (four threads with normal priority).

![Image](images/image61.png)

*Figure 6. Test #2. Two threads with normal priority.*

![Image](images/image7.png)

*Figure 7. Test #3. Four threads with normal priority.*

It should be noted here that the sum of "useful" work execution speeds equals the speed of a single thread. Everything's clear here – no matter how you spin it – we have only one processor!

### **Misconception Two. Thread Priority Affects timeslice Length.**

From Test #2, we can conclude that by launching a second thread performing any work, we thereby reduce the main application thread's performance by exactly half. This means that by opening a second thread, we'll halve the FPS. But we'd like the second thread to leisurely perform some background task (for example, background level loading), taking no more than 10% of performance.

It would seem the obvious solution is to set the second thread's priority lower than the main one. Well – let's run Test #4.

![Image](images/image8.png)

*Figure 8. Test #4. Main thread with normal priority, second thread – below normal.*

What do we see? Priority doesn't affect time slice length. It doesn't even affect how often the second thread receives time slice (as many think). In fact, WINDOWS WILL NOT EXECUTE A LOW-PRIORITY THREAD WHILE THERE ARE READY-TO-EXECUTE THREADS WITH HIGHER PRIORITY. The second thread received no CPU time at all until the first thread exited the loop.

Everything falls into place if you clearly understand how the Microsoft Windows thread scheduler works.

The thread scheduler contains queues of threads ready for execution. Each priority has its own queue. When a thread is ready for execution (ready for execution) – that is, it's not inside Sleep() or WaitForObject() – the system places it in the queue of threads with the corresponding priority. The scheduler examines all queues, starting from the highest priority. As soon as it finds a non-empty queue, it gives one time slice to the first thread, moves it to the end of the queue, and starts the scan again. The scheduler won't even examine lower-priority queues while there are non-empty higher-priority queues.

Such scheduler behavior leads to the system "freezing" when a high (HIGH) priority thread "hangs", responding with great difficulty to CTRL+ALT+DEL. There are third-party programs [10] to solve such problems, lowering the priority of aggressive processes.

### **Misconception Three. Sleep(1) Always Takes 1 ms.**

Well, that didn't work. But we don't give up! We dive into MSDN and find the wonderful Sleep() function. In theory, by calling Sleep(1) between frames, we should be able to run the second thread for 1ms, since the current thread stops being ready for execution, disappears from the queue, and the scheduler can move to the lower-priority queue.

But since we already know how preemptive multitasking works, it becomes clear that after launching the second thread, the scheduler won't return control to the main thread until a hardware interrupt occurs. And it occurs, as we've already seen, every 10 ms. This means Sleep(1) can take 1ms, or it can take 10 – depending on luck [4]. With a frame time of 20ms, this isn't 10%, but 1% – 50%. As a result, we get extremely unstable FPS.

***Note.*** *The scheduler can receive control not only as a result of a hardware interrupt, but also when the executing thread calls Sleep(), WaitForObject() functions.*

***Note.*** *If your application isn't the only active one in the system, a very long time may pass before control returns to the calling thread after the Sleep() period expires. Yes, the system will place the thread in the queue at least after 10 ms, but it will place it at the end of the queue. In fact, the system guarantees that Sleep(1) will take NO LESS THAN 1ms, and the upper limit is not restricted.*

The Sleep() function allows passing 0 (zero), and its behavior is described as "yield the remainder of the time slice" to other processes. For interest, let's see if we can yield the remainder of the time slice to a lower-priority thread.

![Image](images/image9.png)

*Figure 9. Test #5. Main thread with normal priority, second thread – below normal. Main thread calls Sleep(0).*

No, the picture hasn't changed. The second thread doesn't execute while the main one is in the loop. This is explained as follows: Sleep(0) is ready to yield the remainder of time, but since this function doesn't remove the thread from the queue, it (the only one) is still there, and Sleep(0) immediately returns control to the same thread.

According to the statement, Sleep(0) can only yield time slice to a thread with the same priority, which Test #6 confirms.

![Image](images/image10.png)

*Figure 10. Test #6. Two threads with normal priority, both call Sleep(0).*

As a result, we see apparent parallel execution (actually very fast switching). However, the "useful" work execution speed has decreased – because the processor spends 50% of its time switching threads.

It should be noted that after some time, when the system realizes that a low-priority thread isn't receiving CPU time at all because there are aggressive high-priority threads (CPU time starvation detection), the scheduler will still allocate a little time to this thread. For it to start doing this, some time period must pass, which is approximately 5 seconds.

![Image](images/image11.png)

*Figure 11. Test #7. Main thread with normal priority, second thread – below normal (only the second thread is shown on the graph). After 5 seconds, the second thread received time slice. The second thread began executing normally after the main one finished (after 10 seconds).*

This explains the fact that by opening a second thread with idle priority in a DirectX application that doesn't sleep for a millisecond in attempts to produce the highest FPS, the second thread seems to work, but ve-e-ery slowly.

But we've digressed from the topic – we need to execute the second thread using approximately 10% of CPU time. Based on the described rules, it turns out this can only be arranged by creating two threads with the same priority, and the second thread must independently control its CPU time amount, periodically calling Sleep(n).

![Image](images/image12.png)

*Figure 12. Test #8. Two threads with normal priority. The second thread works for 2 ms and calls Sleep(10).*

We seem to have achieved what we wanted – the second thread takes approximately 10% of CPU time. But to call Sleep(10) in the second thread, this thread must execute a specially modified algorithm that controls CPU time, and we need to perform regular tasks. And in general – if we could modify the algorithm in this way, we could do without threads altogether, simply calling 2ms functions between frames.

The large quantum is fundamentally bothering us – can we reduce it?

### **Belief Four. timeBeginPeriod() is Intended for Changing Timer Resolution.**

If you read the timeBeginPeriod() function description in MSDN, you'll never guess that it actually changes the quantum.

The timeBeginPeriod(1) function is designed to increase the resolution of multimedia and waitable timers to 1ms. In reality, timers are handled by the scheduler, and their events cannot occur more frequently than the scheduler receives control. By lowering the quantum to 1ms, we allow the scheduler to more accurately trigger timer events.

***Note.*** *If you diligently performed the previous tests but got different results – either HT is enabled, or another application is running that called timeBeginPeriod(1).*

Well then, it's time to conduct an experiment.

![Image](images/image131.png)

*Figure 13. Test #9. Main thread with normal priority, second thread – below normal. Main thread calls Sleep(2) every 20ms to execute the second thread. timeBeginPeriod(1) is used.*

Finally, we've achieved what was required – an unmodified algorithm executes in the second thread, and it takes no more than 10% of CPU time.

### **Result**

Actually, we arrived at approximately this architecture when creating the game "Xenus: Boiling Point". Unfortunately, the task isn't completely solved. When performing real work in the second thread, we flush the processor cache, cause memory page redistribution, capture objects required by the first thread, and worse, cause swapping. This leads to FPS becoming unstable during background level loading, with unpredictable delays of 1-10 ms, which significantly reduces game comfort.

It's also necessary to understand the fact that since the thread uses only 10% of CPU time, real work in it is performed 10 times slower. This means that if a level loads in 1 second in the main thread, the same will take 10 seconds in the second.

There are many more nuances with multitasking in Windows, including thread priority boost during its creation or to quickly release a synchronization object, delay when creating a new thread (thread creation timeout, approximately 100ms), timings for restoring thread operation when releasing an awaited synchronization object, behavior scenario when competing for synchronization object capture (race conditions), etc. You can read about all this in the articles whose links are provided.

Second part of the article: [Multithreading in DirectX Applications](http://localhost:8080/?page_id=622)

### **Notes.**

The following single-processor system was used in the article:

AMD Athlon XP 2.5GHz
nVidia nForce2 chipset
1.5GB RAM 400MHz
Radeon 9600 PRO

The following HyperThreading system was used:

Intel Pentium 2.8 GHz
ABIT AA8XE
ATI X1600
1GB RAM DDR II

The following dual-core system was used:

Intel Pentium D Smithfield 2.67GHz
Asus P5LD2-VM
Intel GMA
1GB RAM DDR 533MHz

### **References**

1. [Multitasking Discussion](http://www.wideman-one.com/gw/tech/dataacq/multitasking.htm)

2. [Timers tutorial](http://www.codeproject.com/system/timers_intro.asp)

3. [Time is the Simplest Thing…](http://www.codeproject.com/system/simpletime.asp)

4. [Quantifying The Accuracy Of Sleep](http://www.codeproject.com/system/sleepstudy.asp) (commendable diligence in testing, but the author didn't read this article)

5. [Threading Articles](http://www.devx.com/Intel/Door/29081)

6. [GDC 2004: Multithreading in Games](http://www.extremetech.com/article2/0,1697,1554193,00.asp)

7. [Threading Basics for Games](http://www.devx.com/Intel/Link/28614)

8. [Using Multithreading in Games](http://www.gamedev.ru/articles/?id=70119) (the example of performance increase through thread usage given in the article is incorrect)

9. [Hyper-Threading Technology and Computer Games](http://www.dtf.ru/articles/read.php?id=113)

10. [ProcessTamer](http://www.donationcoder.com/Software/Mouser/proctamer/)

11. [Managing Concurrency: Latent Futures, Parallel Lives](http://www.gamearchitect.net/Articles/ManagingConcurrency1.html)

12. [The Free Lunch Is Over: A Fundamental Turn Toward Concurrency in Software](http://www.gotw.ca/publications/concurrency-ddj.htm)

13. [ThreadTest Application with Source Code](threadtest.zip)
