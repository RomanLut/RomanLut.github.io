# Monitoring Thread Execution in Windows XP/2000 Applications

*Article published on [dtf.ru](https://web.archive.org/web/20070703031540/http://dtf.ru/articles/read.php?id=40520)*

*In this article, the author describes a library that allows visual representation of thread execution on a timeline graph, as well as measuring CPU time allocated to each thread with microsecond precision.*

**Foreword**

![IA-32](images/image_unnamed_1.png)

It is assumed that the reader is familiar with Windows architecture, Windows API, x86 assembly language, and IA-32 architecture. Of course, I would like to explain everything as simply as possible, but presenting all of this material would be worthy of an entire book. I will try to add links to materials where you can read more details.

It should be noted that the topic has somewhat deviated from game development :), so if you are not interested in the internal workings of the library, you can skip directly to Section 3, "Usage."

## Introduction

![Last minute debugging](images/image_unnamed_2.png)

I think everyone will agree that monitoring and debugging tools significantly ease the lives of programmers and help make applications better. Virtually no serious IDE today is complete without a powerful debugger. Monitoring utilities built into the applications themselves also play an important role—console output, function execution timing measurements, and logging.

In the article "What No One Told You About Multitasking in Windows"[[1](../2006-05_M1_Multitasking_Windows/article_en.md)], I presented the basic rules of thread execution. Attached to it is a special application that visually demonstrates how Windows distributes CPU time. Having the same execution monitor in your own application would significantly simplify finding the causes of improper CPU resource distribution. Even knowing all the rules, it is often quite difficult to definitively say that everything is working as intended without having the ability to verify it.

Unfortunately, the working principle of that example is based on the fact that the algorithms running in test threads must periodically record time stamps in a special buffer. Obviously, applying such an approach in a real application is impossible. A different solution must be found.

## Will the Operating System Help Us?

![Windows](images/image_unnamed_3.png)

The most obvious solution would be to receive callbacks from the operating system at the moment of thread switching.

In Windows 98, there is a Call_When_Thread_Switched callback, but it is no longer supported in Windows XP/2000 systems. The only information that can be obtained through WinAPI is the amount of CPU time allocated to a thread—the GetThreadTimes() function. I do not consider the information from performance counters (CPU load, number of context switches), available through WMI, to be useful.

This won't help us display a graph. Moreover, the GetThreadTimes() function only counts time when a thread has fully used its Quantum and a forced preemption has occurred. Quantum is 10-15ms. If a thread woke up from a wait object, performed work in 9ms and "went to sleep" again—which is a fairly common scenario—the GetThreadTimes() function will not credit the thread with any time[2].

## Part 1. Passive Profiler

![Profiler](images/image_unnamed_4.gif)

Profilers are used to identify the most critical sections of code. With some modifications, a profiler can be used to monitor thread execution.

A passive profiler works on the principle of "you work, and I'll watch." The key elements for creating a passive profiler are:

1) the ability to receive periodic asynchronous events with sufficiently high frequency, for example—1ms;

2) in the event handler, having the ability to get information about the execution progress of the application being investigated.

We already know that the Windows scheduler is not designed for real-time tasks, and therefore there is no way to receive periodic timer events with 1ms precision. The only events that can occur regularly are hardware interrupts.

## Hardware Interrupts

![Hardware](images/image_unnamed_5.jpg)

Today's computer on the IA-32 platform[3] contains three hardware timers capable of triggering interrupts (IRQ).

1) the 8253 (or 8254) chip[4], preserved from the earliest IBM PC XT (although now it is inside the chipset). Contains 3 timers, channel 0 output is tied to IRQ0;

2) Real Time Clock (RTC)[5]—the very clock that ticks constantly from the battery on the motherboard. Tied to IRQ8;

3) Timer in the Local APIC. APIC (Advanced Interrupt Controller)[3] appeared in Pentium Pro processors to increase the number of available IRQs and support multiprocessor systems. In a multiprocessor system, each processor (including HT and DualCore) contains its own Local APIC. Since the Local APIC is inside the processor, the Local APIC timer is not tied to an IRQ but triggers any interrupt whose vector is configurable.

Windows uses IRQ8 (RTC) for the thread scheduler (the same hardware interrupt mentioned in the previous article). The 8254 timer and Local APIC remain available to us.

You can write a driver that configures the hardware timer to trigger interrupts with sufficiently high precision (for example, 1KHz). Configuring the timer involves outputting 4-5 bytes to I/O ports. The driver will handle the specified interrupt.

According to Windows driver ideology, a driver must provide an Interrupt Service Routine (ISR)[25]. When a hardware interrupt occurs, Windows receives control. The system begins calling one by one all ISRs that handle the specified interrupt (multiple devices can "hang" on one IRQ).

Unfortunately, having received control inside an ISR, we cannot find out where program execution was interrupted. The GetCurrentThreadId() and GetCurrentProcessId() functions are unavailable in the interrupt handler (as are almost all other functions), since the interrupt does not execute in a thread context. The saved instruction pointer (EIP) is somewhere on the stack, but we don't know its structure. To get the EIP register value, the interrupt must be handled directly.

When the processor enters an interrupt handler, the registers SS,ESP,flags,CS,EIP are saved on the stack. The stack registers are saved only when the processor was in user mode (ring 3) at the moment of the interrupt. It needs to switch to kernel mode (ring 0) and set up a new stack.

Stack structure if a Ring 3 – Ring 0 transition occurred:

```
[ESP] eip
[ESP+0x04] cs
[ESP+0x08] flags
[ESP+0x0c] esp
[ESP+0x10] ss
```

Stack structure if the processor was in Ring 0:

```
[ESP] eip
[ESP+0x04] cs
[ESP+0x08] flags
```

Knowing the stack structure, in the interrupt handler you can obtain EIP, CS, processor flags, and the FS register, which in user mode addresses the Thread Information Block (TIB)[6].

To directly handle the interrupt, you must perform the work that the system usually does.

**1.** Configure the interrupt controller.

![APIC](images/image_unnamed_6.gif)

In DOS times, hardware interrupts were handled by two 8259 chips[7]. Today's computers also have them (although not as separate chips), but Windows disables them and uses the Advanced Interrupt Controller (APIC)[8]. The APIC architecture consists of a Local APIC (located inside the processor) and one or more IO APICs (located inside the chipset). IRQ lines are connected to the IO APIC. By programming the IO APIC, you can assign an IRQ to any interrupt number. Typically, a motherboard has one IO APIC handling 16 or 24 IRQs.

**2.** Find an unused interrupt number by analyzing the Interrupt Descriptor Table (IDT)[9].

**3.** Configure the IDT to call your procedure[10].

After evaluating all the complexities (programming the timer, interrupt controller, analyzing IDT), I decided it would be simpler to just "hook" IRQ8 and call timeBeginPeriod(1) (this will force the system to program the timer at 1KHz). After completing the EIP/CS/FS analysis, the new handler will pass control to the system's original handler.

## Interrupt Handler

![Handler](images/image_unnamed_7.jpg)

The source code from article[10] provided invaluable assistance in writing the driver. The interrupt handler code looks like this:

```cpp
__declspec( naked ) void Handler()
{
  __asm
  {
  //ess         //esp+60
  //esp         //esp+56  ___ only in case of r3-r0 transition
  //flags       //esp+52
  //cs          //esp+48
  //eip         //esp+44
  push eax   //esp+40
  push ebx   //esp+36
  push ecx   //esp+32
  push edx   //esp+28
  push esi   //esp+24
  push edi   //esp+20
  push ebp   //esp+16
  push ds    //esp+12
  push es    //esp+8
  push fs    //esp+4
  push gs    //esp+0

  //Eflags bit 17 is VM bit, if VM = 1, it shows that the caller is from V86 mode,
  test dword ptr [esp+52],0x20000
  je l4

  //V86 mode
  push 0
  push 0
  jmp l2

  l4:
  //are we in kernel mode?  (kernel cs = 0x8)
  cmp DWORD PTR [esp+48],0x8
  je l1

  //user mode
  //fs is pointing Thread Environment Block (TEB)
  mov eax,fs:[0x24]  //current thread Id
  push eax
  mov eax,fs:[0x20]  //curent process Id
  push eax
  jmp l2

  l1:
  //kernel mode
  push 0
  push 0

  l2:
  mov ebx,0x30  //kernel processor control region (KPCR)
  mov eax,0x23  //kernel selector for data in Windows
  mov fs,bx
  mov ds,ax
  mov es,ax
  CALL ProcessData
  pop gs
  pop fs
  pop es
  pop ds
  pop ebp
  pop edi
  pop esi
  pop edx
  pop ecx
  pop ebx
  pop eax
  JMP DWORD PTR [pOriginalHandlerProc]
  };
}
```

The ProcessData() function writes ProcessId, ThreadId, and timer samples (RDTSC[13]) to a circular buffer.

An interrupt can occur at any moment. At that moment, the processor can be in 4 modes:

1) user mode, executing applications

2) kernel mode, inside kernel code or a driver

3) kernel mode, inside another interrupt handler

4) V86 mode, DOS emulation mode.

At the moment of the interrupt, the processor flags are saved on the stack. By analyzing bit 17, you can determine whether the processor is in V86 mode. I don't know how to get ProcessId and ThreadId in this mode, so the driver attributes this sample to the system thread (ProcessId:0, ThreadId:0).

In kernel mode, the CS register contains selector 0x08[11]. Despite the fact that in this mode you can determine the process and thread Id by analyzing the Thread Environment Block (TEB) structure[12], which is addressed by selector 0x38, this should not be done. An interrupt can occur at any moment, including in the context of a system thread that does not contain a TEB, or at the moment of starting a new thread when the TEB has not yet been configured. Since thread time in kernel mode is usually within 10-15%, the driver simply attributes this sample to the system thread.

In user mode, there is a 100% guarantee that all structures are configured correctly, so the driver can safely read ProcessId and ThreadId from the TEB structure, which is addressed by the selector in the FS register.

## About RDTSC, HT, and DualCore

![RDTSC](images/image_unnamed_8.jpg)

Operating system functions cannot be used in the interrupt handler, so the Time Stamp Counter[13] value is used for timer samples.

```cpp
unsigned __int64 RDTSC()
{
 unsigned __int64 cycles;
 __asm
 {
  _emit 0x0f
  _emit 0x31
   mov DWORD PTR cycles, eax
   mov DWORD PTR [cycles + 4], edx
 }
 return cycles;
}
```

TSC counts processor cycles since the kernel started (reset). It should be noted that some processors can reduce frequency to decrease power consumption, so the application needs to recalculate the TSC speed every second, synchronizing with the clock.

To sample thread execution on multi-core systems, you need to intercept the interrupt on each processor separately, otherwise you will only see threads executing on the first core.

Keep in mind that TSC values on different cores may not match. This, incidentally, leads to problems in older games that use RDTSC as a timer. When a thread migrates from core to core, the game may receive negative time deltas. To avoid this problem, in newer Intel processors and Athlon X2, the TSC counts constantly, even when the core is stopped.

To avoid dealing with TSC synchronization, I decided to sacrifice precision and use the first core's samples on the second core:

```cpp
__int64 tick;
DWORD CPUIndex = GetCPUIndex();
if (CPUIndex==0)
  {
   tick = RDTSC();
   AtomicCopy64(currentTickCPU0,tick);
  }
   else
  {
   AtomicCopy(tick,currentTickCPU0);
  }
```

The core number on which the thread is executing can be determined using the CPUID instruction:

```cpp
DWORD GetCPUIndex()
{
 DWORD result;
 __asm
 {
  mov eax,1
  cpuid
  shr ebx,24
  and ebx,0xf
  mov result,ebx
 }
 return result;
}
```

I wrote a test application that uses the driver to display thread execution. The source codes are attached to the article[14]

![Figure 1](images/Image11.gif)

*Figure 1. The ThreadsTest2 application uses IRQ8 interception to display thread execution.*

Despite the relatively low sampling rate, the monitor even manages to display the execution of thread 5, which runs very fast.

## Part 2. Intercepting the SwapContext() Function

![Gopher](images/image2.jpg)

*Figure 2. The gopher exists, but it's not documented.*

It is completely clear that the context switching function exists, and it is located in the operating system kernel code (ntoskrnl.exe). How do we get to it?

Usually, documentation on undocumented things can be found on various hacker sites and sites dedicated to computer security. Incidentally, determining whether such a site is dedicated to writing viruses or methods of combating them is often as difficult as distinguishing erotica from pornography :).

![Rootkit](images/image_unnamed_9.jpg)

The endless battle between virus authors and antivirus developers has been going on for many years. In particular, the former try to hide processes from the user, while the latter try to find and destroy them.

The front has long moved to the kernel level (kernel mode), and rootkit[15] authors have become so proficient in development that it has come down to reading scheduler thread lists[16].

Briefly, a rootkit for Windows is a library that allows intercepting kernel function calls. Today, rootkits have a negative connotation, so antivirus authors avoid applying this term to their products, although they use exactly the same methods, just for opposite purposes[17][18].

I found the information I needed on a site with the straightforward name [www.rootkit.com](http://www.rootkit.com/) :)

In Windows, you can safely hide a process by excluding it from the system's doubly-linked list of processes. Such a process will not appear in Task Manager or similar programs. However, you cannot exclude the threads of this process from the scheduler lists, because they simply won't be executed. By examining threads, you can find hidden processes, so the authors of various antivirus programs have devoted much attention to studying the thread scheduler queues and the SwapContext() function.

The scheduler structures differ too much between different versions of Windows, so I decided to focus on intercepting the SwapContext() function. Moreover, kimmo wrote an excellent article on this topic with clear source code[20].

## Logging Context Switches with a Homemade Rootkit

The SwapContext() function is located in the kernel (ntoskrnl.exe) and performs thread context switching. At the time of the call, the EDI register points to the ETHREAD structure[21] of the thread being stopped, and the ESI register points to the ETHREAD structure of the thread receiving control.

To install a hook on this function call, you need to know its address in memory. Since this function is not exported from ntoskrnl.exe, we must either hardcode a known address or scan memory for a signature. We will use the second method, as it is more reliable.

The beginning of the SwapContext() function looks like this:

```
0AC9                    or     cl,cl
26C6462D02              mov    b,es:[esi][0002D],002
9C                      pushfd
8B0B                    mov    ecx,[ebx]
83BB9409000000          cmp    d,[ebx][000000994],000
51                      push   ecx
0F8534010000            jne    000005005 ---------- (1)
833D8CA9480000          cmp    d,[00048A98C],000
0F85FE000000            jne    000004FDC ---------- (2)
0F20C5                  mov    ebp,cr0
8BD5                    mov    edx,ebp
8A4E2C                  mov    cl,[esi][0002C]
884B50                  mov    [ebx][00050],cl
FA                      cli
896728                  mov    [edi][00028],esp
8B4618                  mov    eax,[esi][00018]
8B4E1C                  mov    ecx,[esi][0001C]
2D10020000              sub    eax,000000210
894B08                  mov    [ebx][00008],ecx
894304                  mov    [ebx][00004],eax
```

When researching, this function can be easily found in any version of the kernel by the signature `0F 20 C5 (mov ebp,cr0)`

After loading, our driver scans the memory region where ntoskrnl.exe is loaded and finds the function address by the specified signature (16 bytes).

The hook is installed in the same way as done in the Detours library[23].

![Figure 3](images/Image3.gif)

*Figure 3. Intercepting the SwapContext() function.*

We write a JMP instruction to our hook function at the beginning of the SwapContext() function. In the hook function, we process the input parameters as we need, and pass control to the original function through the Trampoline. To avoid restoring the initial bytes of the original function (and then having to find a moment to write JMP at the beginning again), the initial instructions are copied to a specially allocated memory region, to which a JMP to the continuation of the function is added (Trampoline function).

The JMP instruction overwrites the first 5 bytes of the original function. An important point is the requirement to copy not exactly 5 bytes, but the overwritten assembly instructions in their entirety, so the driver performs code disassembly using the xde engine[24].

The ProcessData() function writes ProcessId, ThreadId, and the processor's cycle counter value (RDTSC) to a circular buffer. By taking snapshots of this buffer, the library can calculate thread execution time with microsecond precision over the last 1-3 seconds.

The driver source code is attached to the article[14]. Practically, 90% of the work was done by the author of article[20], I only added support for the PAE kernel (ntkrnlpa.exe), support for multicore kernels (PAE/NOPAE), compatibility with Kaspersky Antivirus (klif.sys also hooks SwapContext(), and this interferes with signature searching), IOCTL for communication with the driver, and the context switch logging procedure itself.

![Figure 4](images/Image4.gif)

*Figure 4. Thread monitoring using SwapContext() function interception.*

The driver uses a circular buffer for 10,000 records. If the number of context switches per second is too high, the program will not be able to draw a complete graph. For example, javaw.exe running in the background from the Nokia J2ME SDK added ~4000 context switches per second.

The context switch logging is so precise that you can even see how the system starts thread 3 immediately after thread 2 releases the critical section, and then returns to thread 2 to "go to sleep."

## Part 3. Using the Library

To use the library, you need to add the files ThreadSampler.cpp and ThreadSampler.h to your project.

By default, the SwapContext() function interception method is used. To switch to the IRQ8 interception mode, you need to define the string TIMERSAMPLER in the Preprocessor definitions of the project.

The driver files (irq8_hook.sys or swap_hook.sys) need to be placed next to the application's executable file. Windows does not load drivers from network or SUBST directories. If you plan to run the application over a network, the driver file must be moved to the C:\Windows\System32\ directory.

When an instance of the TThreadSampler class is created, the driver is loaded and begins collecting data.

```cpp
TThreadSampler* sampler = new TThreadSampler();
```

For the class to work correctly, you must call the method:

```cpp
DWORD contextSwitches;

if (sampler->MakeSnapshot(&contextSwitches)==true)  ...
```

no less frequently than every two seconds. For example—on every frame.

The method fills in the number of context switches per second (only for the SwapContext() interception method). A return of false means that the driver could not be installed.

The class allows direct access to the collected data through the member class samples, but this information is of little interest.

Using the method:

```cpp
CreateSpanListForThread(DWORD processId, DWORD threadId, TSpanList& spanList, DWORD width, DWORD scale, DWORD* totalTime)
```

You can request a list of segments for drawing a thread execution graph, where:

- processId, threadId—the thread for which to build the list. If threadId = OTHER_THREADS, return the list for threads not belonging to the specified process;
- spanList—the resulting list of segments;
- width—the graph width in pixels;
- scale—the graph scale, in 0.5 second units, for example 2—1 sec, 6—3 sec.;
- totalTime—the average time in milliseconds allocated to the thread during one second.

Using the methods EnumerateProcesses() and EnumerateThreads(DWORD processId), you can get lists of processes and threads respectively (read from the sampler->processes and sampler->threads arrays).

The class can store thread names internally:

```cpp
static void SetThreadName(const char* name);
static void SetThreadNameEx(DWORD threadId, const char* name);
static const char* GetThreadName(DWORD threadId);
```

The SetThreadName() method must be called at the very beginning of ThreadFunc. In addition to simply saving the specified name, it will set the thread name displayed in the Visual Studio debugger:

![Figure 5](images/Image5.gif)

*Figure 5. Visual Studio Threads window.*

## Compatibility

SwapContext() function interception version:

![Compatibility](images/image_unnamed_10.jpg)

Windows XP Professional, SP1& SP2, NOPAE/PAE kernels, including multiprocessor ones. Compatible with Kaspersky Antivirus 4.0-6.0. The library may not be compatible with some antivirus programs (and viruses).

Timer-based version:

Windows 2000, NT, XP. The library is not compatible with programs that actively intercept IRQ8 (including viruses).

During the development of the library, there was no initial goal of distributing it with a finished product.

UNDOCUMENTED WINDOWS FEATURES WERE USED DURING THE DEVELOPMENT OF THIS LIBRARY. THE AUTHOR IS NOT RESPONSIBLE FOR ANY DAMAGE CAUSED AS A RESULT OF USING THE LIBRARY.

## Result

![Figure 6](images/image6.jpg)

*Figure 6. Thread execution diagnostics in a real application.*

We have obtained a library that can be used to monitor thread execution when debugging multithreaded applications. I think this concludes the matter of thread execution.

P.S. This is my first driver; there may be errors in it. I would be glad to hear about them.

## References from the Article

1. [What No One Told You About Multitasking in Windows](../2006-05_M1_Multitasking_Windows/article_en.md)

2. Why GetThreadTimes() wrong
   [http://blog.kalmbachnet.de/?postid=28](http://blog.kalmbachnet.de/?postid=28)

3. IA-32 Intel architecture software developers manual
   [http://www.intel.com/design/pentium4/manuals/index_new.htm](http://www.intel.com/design/pentium4/manuals/index_new.htm)

4. Intel 8253 programmable interrupt timer
   [http://en.wikipedia.org/wiki/Intel_8253](http://en.wikipedia.org/wiki/Intel_8253)

5. Real Time Clock (RTC) (Wikipedia)
   [http://en.wikipedia.org/wiki/Real-time_clock](http://en.wikipedia.org/wiki/Real-time_clock)

6. Thread Information Block (TIB) (Wikipedia)
   [http://en.wikipedia.org/wiki/Win32_Thread_Information_Block](http://en.wikipedia.org/wiki/Win32_Thread_Information_Block)

7. Using interrupts (Intel 8259)
   [http://www.beyondlogic.org/interrupts/interupt.htm](http://www.beyondlogic.org/interrupts/interupt.htm)

8. Advanced programmable interrupt controller (APIC)
   [http://www.osdever.net/tutorials/pdf/apic.pdf](http://www.osdever.net/tutorials/pdf/apic.pdf)

9. Interrupt descriptor table (IDT) (Wikipedia)
   [http://en.wikipedia.org/wiki/Interrupt_Descriptor_Table](http://en.wikipedia.org/wiki/Interrupt_Descriptor_Table)

10. Interrupt Hooking and retrieving device information on Windows NT
    [http://www.codeproject.com/system/interrupthook.asp](http://www.codeproject.com/system/interrupthook.asp)

11. Exploring Windows 2000 memory
    [http://www.informit.com/articles/article.asp?p=167857&rl=1](http://www.informit.com/articles/article.asp?p=167857&rl=1)

12. Thread Environment Block
    [http://undocumented.ntinternals.net/UserMode/Undocumented%20Functions/NT%20Objects/Thread/TEB.html](http://undocumented.ntinternals.net/UserMode/Undocumented%20Functions/NT%20Objects/Thread/TEB.html)

13. RDTSC (Wikipedia)
    [http://ru.wikipedia.org/wiki/Rdtsc](http://ru.wikipedia.org/wiki/Rdtsc)

14. ThreadsTest2 application with source codes
    [threadstest2.rar](threadstest2.rar)

15. Rootkit (Wikipedia)
    [http://ru.wikipedia.org/wiki/Rootkit](http://ru.wikipedia.org/wiki/Rootkit)

16. Bypass Scheduler List Process Detection
    [http://www.rootkit.com/newsread_print.php?newsid=117](http://www.rootkit.com/newsread_print.php?newsid=117)

17. Kaspersky Lab comments on accusations of using rootkit technologies
    [http://www.securitylab.ru/news/254796.php](http://www.securitylab.ru/news/254796.php)

18. DRM tools from Sony partners include a real rootkit
    [http://security.compulenta.ru/236649/](http://security.compulenta.ru/236649/)

19. ROOTKIT – The Online Rootkit Magazine
    [http://www.rootkit.com](http://www.rootkit.com)

20. Detecting Hidden Processes by Hooking the SwapContext Function
    [http://www.rootkit.com/newsread.php?newsid=170](http://www.rootkit.com/newsread.php?newsid=170)

21. Undocumented functions for Windows 2000/NT
    [http://undocumented.ntinternals.net/](http://undocumented.ntinternals.net/)

22. ETHREAD, KTHREAD structures
    [http://forum.sources.ru/index.php?showtopic=48114](http://forum.sources.ru/index.php?showtopic=48114)

23. Microsoft Detours library
    [http://research.microsoft.com/sn/detours/](http://research.microsoft.com/sn/detours/)

24. eXtended (XDE) disassembler engine
    [http://madchat.org/vxdevl/vxmags/29a-8/Utilities/29A-8.009/xde.txt](http://madchat.org/vxdevl/vxmags/29a-8/Utilities/29A-8.009/xde.txt)

25. DDK – Windows Driver Development Kit
    [http://www.microsoft.com/whdc/devtools/ddk/default.mspx](http://www.microsoft.com/whdc/devtools/ddk/default.mspx)

## Additional Information Links

1. Coding for multiple cores
   [http://download.microsoft.com/download/5/b/e/5bec52bd-8f96-4137-a2ab-df6c7a2580b9/Coding_for_Multiple_Cores.ppt](http://download.microsoft.com/download/5/b/e/5bec52bd-8f96-4137-a2ab-df6c7a2580b9/Coding_for_Multiple_Cores.ppt)

2. Intel VTune Analyser
   [http://www.intel.com/cd/software/products/asmo-na/eng/vtune/index.htm](http://www.intel.com/cd/software/products/asmo-na/eng/vtune/index.htm)

3. Kernel Loop-up
   [http://www.codeproject.com/csharp/lookup.asp](http://www.codeproject.com/csharp/lookup.asp)

4. Remote debugging using VMWare
   [http://www.catch22.net/tuts/vmware.asp](http://www.catch22.net/tuts/vmware.asp)

5. Win2K Kernel Hidden Process/Module Checker
   [http://www.security.org.sg/code/kproccheck.html](http://www.security.org.sg/code/kproccheck.html)

6. Driver from scratch
   [http://www.abc-it.lv/index.php/id/1151](http://www.abc-it.lv/index.php/id/1151)

7. API Hooking revealed part 3 and 4 – Thread Deadlock Detector
   [http://www.codeproject.com/system/APIHookingPart3.asp](http://www.codeproject.com/system/APIHookingPart3.asp)

8. Entering the kernel without a driver and getting interrupt information from APIC
   [http://www.codeproject.com/system/soviet_kernel_hack.asp](http://www.codeproject.com/system/soviet_kernel_hack.asp)

9. The VTrace Tool: Building a System Tracer for Windows NT and Windows 2000
   [http://msdn.microsoft.com/msdnmag/issues/1000/VTrace/default.aspx](http://msdn.microsoft.com/msdnmag/issues/1000/VTrace/default.aspx)

10. Undocumented Functions for Microsoft Windows NT/2000
    [http://undocumented.ntinternals.net/](http://undocumented.ntinternals.net/)

11. Inside Microsoft Windows 2000, Third Edition
    [http://www.microsoft.com/MSPress/books/4354.asp](http://www.microsoft.com/MSPress/books/4354.asp)

12. Windows NT Design, implementation, internal structure
    [http://labe.felk.cvut.cz/~posik/osa/NTDesign.pdf](http://labe.felk.cvut.cz/~posik/osa/NTDesign.pdf)

13. Windows Support for Hyper-Threading Technology
    [http://www.microsoft.com/whdc/system/CEC/HT-Windows.mspx](http://www.microsoft.com/whdc/system/CEC/HT-Windows.mspx)

14. Basics of writing a kernel-level driver for Windows 2000, XP, and XP Embedded
    [http://www.cta.ru/pdf/2006-2/20062068_000.pdf](http://www.cta.ru/pdf/2006-2/20062068_000.pdf)

15. Contexts inside out
    [http://www.securitylab.ru/contest/212094.php](http://www.securitylab.ru/contest/212094.php)

16. Understanding IRQL
    [http://ext2fsd.sourceforge.net/documents/irql.htm](http://ext2fsd.sourceforge.net/documents/irql.htm)
