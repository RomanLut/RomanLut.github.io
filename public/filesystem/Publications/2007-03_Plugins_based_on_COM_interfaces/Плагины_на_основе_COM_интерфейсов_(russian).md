# Плагины на основе COM интерфейсов

*Статья опубликована на сайте [dtf.ru](https://web.archive.org/web/20080101150038/http://dtf.ru/articles/read.php?id=44995).*

*Связанные темы: Программирование с использованием абстрактных интерфейсов, экспорт классов из DLL, межъязыковое взаимодействие, система плагинов.*

В этой статье я расскажу, как использовать COM‑интерфейсы для обеспечения бинарной совместимости между модулями, написанными на разных языках программирования.

## Взаимодействие программ, написанных на разных языках программирования

Несмотря на то, что Андрей Плахов в своей лекции о языках программирования на КРИ 2006 даже не упомянул о Delphi и C++ Builder [12], мы активно используем эти продукты для создания редакторов, утилит и плагинов.

Причина проста: продукты Borland позволяют очень быстро и легко писать GUI‑приложения, и для них существует огромное количество полезных компонентов.

К сожалению, простота написания GUI‑плагина, скажем, для редактирования системы частиц, заканчивается, когда становится необходимо связать его с кодом движка, который безусловно написан на Visual C++.

Ни Delphi, ни C++ Builder не являются совместимыми с Visual C++ по формату obj и lib файлов, поэтому единственным способом связывания остается экспорт функций из DLL.

![Рисунок 1. Экспорт класса как набора функций.](images/01.gif)

В принципе, это работает, но есть масса неудобных моментов. Объектно‑ориентированное программирование превращается в «пародию на объекты».

Формат DLL позволяет экспортировать исключительно функции. В Visual C++ существует расширение, которое позволяет экспортировать классы и переменные, но VC++ совместима здесь только сама с собой.

Поэтому приходится писать и экспортировать:

- функцию‑конструктор, которая конструирует экземпляр класса (по `new`) и возвращает указатель на этот экземпляр в виде `void*`;
- полный набор прокси‑функций, дублирующих методы класса, которые принимают указатель на экземпляр в виде `void*` и вызывают на экземпляре класса соответствующий метод;
- функцию‑деструктор, которая принимает указатель на экземпляр в виде `void*` и уничтожает объект.

Пример. В DLL на VC++ реализован класс `TSphere`. Вот так выглядит его экспорт‑импорт в Delphi:

```
=================== VC ++ =================
class TSphere
 private:
  T3DVECTOR center;
  float radius;

 public:
  ...
  T3DVECTOR& GetCenter() const;
  float GetRadius() const;
  ...
};

void* __cdecl TSphere_Create()
{
 return new TSphere();
}

void __cdecl TSphere_GetCenter(void* pthis, float* x, float* y, float* z)
{
 T3DVECTOR c = ((TSphere*)pthis)->GetCenter();
 *x = c.x;
 *y = c.y;
 *z = c.z;
}

float __cdecl TSphere_GetRadius(void* pthis)
{
 return ((TSphere*)pthis)->GetRadius();
}

void TSphere_Destroy(void* pthis)
{
 delete ((TSphere*)pthis);
}
=================== Delphi =================
function TSphere_Create(): pointer; cdecl; external 'mydll.dll';
procedure TSphere_GetCenter(pthis: pointer; var x, y, z: single); cdecl; external 'mydll.dll';
function TSphere_GetRadius(pthis: pointer): single; cdecl; external 'mydll.dll';
procedure TSphere_Destroy(pthis: pointer); cdecl; external 'mydll.dll';

var
  p: pointer;
begin
  p := TSphere_Create();
  radius := TSphere_GetRadius(p);
  TSphere_Destroy(p);
end;
```

Очевидно, что так работать совсем неудобно. При изменении или добавлении метода класса необходимо исправлять прокси‑функцию, её отражение в проекте на другом языке и заново пересобирать оба проекта. Кроме того, в случае экспорта Delphi → VC++ приходится описывать получение адреса через `GetProcAddress()`, так как VC++ не позволяет просто написать «функция находится в такой‑то DLL», как это можно в Delphi. DLL приходится загружать динамически с помощью функции `LoadLibrary()`.

Несмотря на недостатки, этот способ широко используется при портировании библиотек. На эту тему есть множество статей [13] [14] [15] [16] [17] [18].

Фундаментальной проблемой является то, что один и тот же класс, откомпилированный разными компиляторами, или даже одним и тем же компилятором, но с разными настройками, не совместим в бинарном виде.

Нельзя передавать указатель на экземпляр класса из модуля на VC++ в модуль на C++Builder, в котором пытаться вызывать методы этого класса, даже если используется один и тот же `.h`‑файл с описанием класса.

К счастью, практически все компиляторы поддерживают Component Object Model (COM).

Оформляя классы как COM‑объекты, но не используя все «тяжёлые» возможности COM, можно добиться бинарной совместимости классов между разными языками программирования и компиляторами.

## Component Object Model (COM)

Архитектура COM – достаточно обширная тема, поэтому я просто укажу ссылки [1] [2] [6] [9] [11].

Принцип работы COM вкратце:

- Код классов располагается в библиотеках (DLL), которые регистрируются в специальном разделе системного реестра.
- Каждый класс реализует один или несколько известных COM‑интерфейсов.
- DLL экспортирует функцию создания экземпляра указанного класса, возвращающую указатель на базовый интерфейс `IUnknown` (все классы обязаны его реализовывать).
- Каждому интерфейсу сопоставляется GUID.
- Пользователь вызывает `CoCreateInstance(GUID)`, которая ищет запись в реестре, загружает DLL и вызывает фабричную функцию.
- Работа с объектом ведётся через указатель на интерфейс; время жизни контролируется счётчиком ссылок (`IUnknown->Release()`).

COM‑интерфейс можно воспринимать как базовый абстрактный класс без конструктора, деструктора и полей данных. Указатель на COM‑объект в бинарном виде – это указатель на экземпляр, первые четыре байта которого содержат указатель на таблицу виртуальных функций (vtable).

![Рисунок 2. Бинарный формат COM объекта.](images/02.gif)

### Плагины на основе COM

Идея использовать COM‑подобные интерфейсы является расширением идеи абстрактных интерфейсов в дизайне движка [4]. Преимущества: разделение интерфейса и реализации, инкапсуляция, низкая связанность и, как результат, понятная архитектура и простота сопровождения.

Игровой «движок» представляет собой набор различных менеджеров (объектов, текстур, моделей, уровней и т.д.). Создав COM‑интерфейс для всех этих объектов, можно обеспечить широкие возможности для написания плагинов.

Система плагинов включает:

- менеджер плагинов `dlvmnager.dll`, который загружает плагины и диспетчеризирует вызов `DLVManager.GetInterface()` во все модули DLV (аналог `CoCreateInstance()`);
- плагины – модули `dll`, переименованные в `dlv`. DLV‑модуль экспортирует три функции: `DLV_Init()`, `DLV_GetInterface()` и `DLV_Close()`;
- каждому описанию интерфейса сопоставляются уникальный идентификатор (`DWORD`) и версия (`DWORD`) – аналог GUID;
- для расширения функциональности плагин либо настраивает callbacks/listeners в `DLV_Init()`, либо создаёт объекты/фабрики объектов с известными Id в `DLV_GetInterface()`.

![Рисунок 3. Схема взаимодействия плагинов.](images/03.gif)

### Интерфейсы на C++

```
//==========================================================
// ICanvas
//==========================================================
class ICanvas : public IUnknown
{
 public:
  virtual void GetWidth(OUT unsigned int* width) = 0;
  virtual void GetHeight(OUT unsigned int* height) = 0;
  virtual void DrawPixel(unsigned int x, unsigned int y, unsigned int RGB) = 0;
  virtual void DrawLine(unsigned int x1, unsigned int y1,
                        unsigned int x2, unsigned int y2,
                        unsigned int RGB) = 0;
};

extern "C" __declspec(dllexport)
void DLV_Init()
{
  DLVManager.RegisterObject(ICanvas::ID, ICanvas::VERSION, GetCanvas);
}
```

В Delphi интерфейсы поддерживаются нативно, но управление временем жизни отличается. Например, если `Manager.DeleteObject(i)` удаляет объект, нужно явно обнулить все указатели на интерфейс, чтобы компилятор не вызвал `Release()` на уничтоженном объекте:

```
var
  iptr: ISomeInterface;
  i: integer;
begin
  for i := 0 to Manager.ObjectsCount() - 1 do
  begin
    pointer(iptr) := Manager.GetObject(i);
    if iptr.Selected() = true then
    begin
      Manager.DeleteObject(i);
      pointer(iptr) := nil; // важно обнулить
      break;
    end;
  end;
end;
```

Неправильный вариант: компилятор может создать временную переменную `ISomeInterface`, которую попытается уничтожить после удаления объекта:

```
var
  i: integer;
begin
  for i := 0 to Manager.ObjectsCount() - 1 do
    if ISomeInterface(Manager.GetObject(i)).Selected() = true then
    begin
      Manager.DeleteObject(i);
      break;
    end;
end;
```

### Интерфейсы на Delphi

![Рисунок 4. Пример интерфейса на Delphi.](images/04.gif)

### Managed C++

При разработке под .NET проблема межъязыкового взаимодействия почти исчезает, однако если часть приложения написана на native‑языках, можно использовать COM‑интерфейсы.

Чтобы native‑клиенты могли вызывать managed‑интерфейс, нужно объявить его со специальными атрибутами:

```
//==========================================================
// ICanvas
//==========================================================
[InterfaceTypeAttribute(ComInterfaceType::InterfaceIsIUnknown),
 GuidAttribute("83893202-0000-0000-0000-000000000000")]
public interface class ICanvas
{
 public:
  virtual void GetWidth(OUT unsigned int* width)  = 0;
  virtual void GetHeight(OUT unsigned int* height) = 0;
  virtual void DrawPixel(unsigned int x, unsigned int y, unsigned int RGB) = 0;
  virtual void DrawLine(unsigned int x1, unsigned int y1,
                        unsigned int x2, unsigned int y2,
                        unsigned int RGB) = 0;
};
```

Реализация компилируется в управляемый код, поэтому для вызовов из native‑кода используется **Callable COM Wrapper (CCW)** – специальный класс, выполняющий конвертацию типов и вызов managed‑функций.

![Рисунок 5. Callable COM Wrapper (CCW).](images/05.gif)

Получить CCW можно так:

```
//===============================================
// IntPtr GetCCW()
//===============================================
// return ptr to COM callable wrapper for object implementing interfaceType
// used to pass pointers to interfaces out of .net framework
static IntPtr GetCCW(Object^ obj, Type^ interfaceType)
{
  GuidAttribute^ ga =
      (GuidAttribute^)Attribute::GetCustomAttribute(interfaceType, GuidAttribute::typeid);

  String^ SIID = ga->Value;
  Guid guid(SIID);

  IntPtr unknownIntPtr = Marshal::GetIUnknownForObject(obj); // AddRef()

  IntPtr CCW;
  Marshal::QueryInterface(unknownIntPtr, guid, CCW);

  int ii = Marshal::Release(unknownIntPtr); // не наращиваем refcount на CCW
  System::Diagnostics::Debug::WriteLine("refcount after GetCCW() = " + ii);

  return CCW;
}
```

Чтобы managed‑код мог вызывать методы native COM‑интерфейсов, нужен **Runtime Callable Wrapper (RCW)**:

```
ICanvas^ Canvas =
  (ICanvas^)Marshal::GetTypedObjectForIUnknown(pCanvas, ICanvas::typeid);
```

![Рисунок 6. Runtime Callable Wrapper (RCW).](images/06.gif)

### C#

Из всех упомянутых языков C# сложнее всего использовать для плагинов: отсутствие прямого экспорта native‑функций из DLL требует писать дополнительный Managed C++‑проект, который экспортирует `DLV_Init()`, `DLV_Close()`, `DLV_GetInterface()` и вызывает методы из C#‑сборки.

Тем не менее существует способ экспортировать native‑функции из C#‑сборки [19.1], но после такого преобразования сборки плагин нельзя запускать под отладчиком.

Описание интерфейса на C# следует тем же правилам, что и для Managed C++:

```
//==========================================================
// ICanvas
//==========================================================
[InterfaceTypeAttribute(ComInterfaceType.InterfaceIsIUnknown),
 Guid("83893202-0000-0000-0000-000000000000")]
public interface ICanvas
{
  void GetWidth(out uint width);
  void GetHeight(out uint height);
  void DrawPixel(uint x, uint y, uint RGB);
  void DrawLine(uint x1, uint y1, uint x2, uint y2, uint RGB);
};

public static class iCanvas
{
  public static uint ID      = 0x83893202;
  public static uint VERSION = 0x00010000;
};
```

Те же правила действуют и при получении CCW/RCW.

Дополнительные особенности:

1. В .NET сборщик мусора может перемещать объекты. В native‑код можно передавать только указатели на объекты, созданные в неперемещаемой памяти:

   ```
   private IntPtr name;

   name = Marshal.StringToHGlobalAnsi("Diamond, implemented in C# plugin");

   public void GetDesc(out IntPtr desc)
   {
     desc = name;
   }
   ```

2. GC уничтожает объект только во время сборки мусора. Если объект держит ресурсы, нужен явный метод освобождения, потому что деструктор не будет вызван в момент `Release()`.

3. При закрытии плагина нужно вызвать:

   ```
   GC.Collect();
   GC.WaitForPendingFinalizers();
   ```

   чтобы гарантировать корректную работу деструкторов.

В книге [21] подробно описаны различные примеры взаимодействия managed и native‑кода.

## Заключение

Описанную систему можно расширить и для других языков: VB, VB.net, J# и др. К статье прилагается приложение‑пример [20.2]; приёмы работы в нём наглядно раскрывают способы реализации.

Примерно такая же система используется в движке Vital Engine 3.0. В примере к данной статье система плагинов немного упрощена, чтобы сосредоточить внимание на основных принципах, а также расширена для поддержки .NET‑языков.

## Ссылки

[1] [3 кита COM. Кит первый: реестр](http://wasm.ru/article.php?article=comkit1)  
[2] [3 кита COM. Кит второй: dll](http://wasm.ru/article.php?article=comkit2)  
[3] [Adding Plug-ins To Your Application](http://www.flipcode.com/articles/article_winplugins.shtml)  
[4] “Programming with abstract interfaces”, *Game Programming Gems 2*  
[5] “Exporting C++ classes from DLLs”, *Game Programming Gems 2*  
[6] [COM Interface Basics](http://www.codeproject.com/com/COMBasics.asp)  
[7] [Abstract class versus Interface](http://www.codeproject.com/csharp/abstractsvsinterfaces.asp)  
[8] [C++ и Java: совместное использование](http://articles.org.ru/cfaq/index.php?qid=2427&catid=64)  
[9] [COM in plain C](http://www.codeproject.com/com/com_in_c1.asp)  
[10] [How to automate exporting .NET function to unmanaged](http://www.codeproject.com/useritems/DllExport.asp)  
[11] [Архив статей “Что такое “технология COM”](http://www.developing.ru/com/index.html)  
[12] [Андрей Плахов. Параллельное измерение, или за гранью C++](http://www.kriconf.ru/2006/index.php?type=info&doc=speech_records)  
[13] [Вызов Delphi DLL из MS Visual C++](http://www.delphirus.com/article69.html)  
[14] [Using C++ objects in Delphi](http://www.rvelthuis.de/articles/articles-cppobjs.html)  
[15] [Utilizing Delphi Codes in VC Without Using a DLL](http://www.codeguru.com/cpp/w-p/dll/importexportissues/article.php/c3647/)  
[16] [Using C DLLs with Delphi](http://www.drbob42.com/delphi/headconv.htm)  
[17] [Step by Step: Calling C++ DLLs from VC++ and VB – Part 2](http://www.codeproject.com/dll/XDllPt2.asp)  
[18] [Создание в среде Borland C++ Builder dll, совместимой с Visual C++](http://www.rsdn.ru/article/devtools/bcbdll.xml)  
[19.1]/[19.2] [Unmanaged code can wrap managed methods](http://www.codeproject.com/dotnet/emilio_managed_unmanaged.asp)  
[20.1]/[20.2] [Приложение – пример](cominterface.rar)  
[21] Bruce Bukovics. * .NET 2.0 Interoperability Recipes.* ISBN‑13: 978‑1‑59059‑669‑2, ISBN‑10: 1‑59059‑669‑2
