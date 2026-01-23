# MORPHING

>Article published in the magazine "Computers + Programs" 07/01/1997

These days on TV - in ads, films, even simple bumpers - you can see the effect of one image "flowing" into another: image morphing. Whether it's a werewolf turning into a wolf, the gallery of faces in a Michael Jackson music video, or the T-1000 in Terminator 2, the action happens so smoothly it's hard to catch the exact moment the subject loses all traits of the previous form and gains the new ones. How is this done?

Morphing is the smooth "transformation" of one image into another, during which a specific element of the first image "flows" into the corresponding element of the second. For example, when morphing one car into another, the wheel of the first turns into the wheel of the second. A computer cannot perform morphing of two images on its own - the artist first has to specify which elements of the first image correspond to elements of the second, along with other parameters, using a special editor. The way correspondences are set depends on the editor - points, lines, or polygons can be used.

Morphing itself can be split into three parts: warping, tweening, and dissolving.

Warping (to warp, bend) is a transformation where an image is locally compressed and stretched - as if it were printed on rubber. Every point of the image is computed by formulas based on the element correspondences defined by the artist. During warping, the elements of the image attempt to take on the position and shape of the elements of the second image.

Tweening (building intermediate frames) is the interpolation of two images to obtain smooth animation. For instance, if correspondences are set by points, then interpolating the point positions yields intermediate correspondences.

Dissolving (to dissolve; in film, cross-dissolving means darkening one scene and brightening another) is the merging of two images, where each pixel's color in the new image is a blend of the colors of the corresponding pixels of the two source images in a specified proportion.

Consider car morphing as an example:

![](images/image001.jpg)
![](images/image003.gif)
![](images/image002.gif)

Fig. 1.

During warping one car tries to take the shape of the other (with predictably ugly results):

![](images/image004.gif)
![](images/image003.gif)
![](images/image005.jpg)

Fig. 2.

Tweening applies warping to interpolated points, i.e., it produces intermediate phases (final frames are shown above).

Dissolving combines the two resulting images into one.

Overall, during morphing the first car smoothly tries to assume the shape of the second, while the second, having assumed the shape of the first, tries to return to normal. Dissolving mixes the images: the first car fades out and the second fades in.

## ALGORITHMS

The algorithm depends on the required quality, speed, and how correspondences are specified. It is convenient to define correspondences with a mesh, for example:

![](images/image006.gif)
![](images/image007.gif)

Fig. 3.

Mesh density affects computation speed, memory requirements, and resulting image quality. An editor that provides other correspondence methods must convert them to a mesh. An artist working in such an editor may not even suspect that ultimately everything is defined that way (generally, the better the editor hides this, the more convenient it is).

The mesh is defined by nodes, and those very nodes (points) move smoothly from their first positions to their second during tweening - in other words, tweening morphs the mesh. Warping is carried out according to the initial mesh and the mesh obtained for the current frame. For mesh nodes this is easy: we know that in the source mesh the node was at point (x, y) with color c. Therefore, in the target image the point where that node now resides has color c. For other points it is more complex: bilinear or bicubic interpolation is used.

In the algorithm proposed by Douglas Smithe for the special effects in the movie "Willow" (1988), a two-pass image transformation is used: first the image is deformed along x, then along y. I'll explain with an example:

![](images/image008.gif)

Fig. 4.

During morphing along y, the x-movement of mesh nodes is ignored. We know that nodes on a given vertical grid line have changed position (shifted up or down). Thus, we have pairs of numbers - old y-coordinates of the nodes and new ones (coordinates in the original mesh and in the current mesh). Using spline interpolation, they define an unambiguous function y_old = f(y_new). Substituting into this function the y-coordinates of image pixels that intersect with vertical mesh lines, we can obtain the old y-coordinates of those pixels - that is, determine the color of the pixel for the new image. The old y-coordinates for pixels that do not intersect vertical mesh lines are determined by further spline interpolation of the pixels of the same scanline that do intersect vertical mesh lines. Note that the resulting coordinates are fractional, and for good image quality this must be accounted for by weighting the contribution of each neighboring pixel according to the fractional parts - this is especially important in a two-pass algorithm.

Mesh deformation is constrained: its cells must not overlap, and the side nodes must not move; otherwise a unique spline function cannot be built. In more complex algorithms additional parameters can be set at mesh nodes - for example, the dissolving speed - to control the unwanted rapid appearance of bright parts of the second image, etc.

An implementation of this algorithm can be found on the internet - file morfsrc.zip. Unfortunately, the source cannot be used on a PC because of the difference in endianness between a PC and the Sun SPARC workstation for which it was written.

## REAL TIME?

"I watched the Heart-Quake/Iguana demo (ftp.cdrom.com pub/demos/demos/1994/heartq.zip) - they do morphing in real time. The algorithm above is too slow for that. How do they manage it, even on a 486DX33?" I can't say exactly how it's done in the demo. However, the idea shown in the source code will look visually like what Iguana showed us.

First - only linear interpolation. This greatly reduces computation while not hurting image quality much when point correspondences are well chosen. Next - work in 256 shades of gray. With this limitation we can use a trick: operate on whole mesh cells instead of image pixels. Indeed, it's enough to transform the quadrilateral of the image that forms a cell of the first mesh into the quadrilateral it becomes in the current mesh - and we automatically get the needed deformed image. Anyone who programs 3D graphics is familiar with the procedure that performs such a transformation. This is the so-called linear texture mapping. The procedure takes the vertices of the source quadrilateral on the texture (image, below - s_polybmp), a pointer to the image itself, and the coordinates of the vertices of the target quadrilateral on the screen (s_poly2d). The procedure itself is not described here - that's a topic for another article.

Dissolving is simple: the pixel color is computed by c = c1 + (c2 - c1) * t, 0 < t < 1, where c1 and c2 are the pixel colors in the first and second images, and t is the morph phase. For color images the same is done for the RGB components. As for Heart-Quake, judging by all appearances, they look up the pixel color (palette index) in a precomputed table c = ColTable[c1, c2, t], whose size for t = 0..20 is 256*256*20 = 1,310,720 bytes (!). However, the table size can be greatly reduced if both images are forced to use not all palette colors but, say, 64. That requires a table of only 81 KB (while the remaining palette colors are used to represent intermediate colors). Did you notice how strong the dithering is on the photos in Heart-Quake?

Source code is for Borland Pascal 7.0 for DPMI. It is designed for 256x256 images and a 9x9 mesh. Because of size, some procedure bodies are omitted - the appropriate comment is placed instead. All procedures of the module myvesa and the mesh editor description are omitted.

```
{=========================================
  RealTime Morphing Demo  (c) Lut Roman 2:463\586.20
==========================================}

uses winapi,crt,myvesa;

type
 TGrate = array [0..8,0..8,1..2] of single;


{returns the timer tick counter}
function timercounter: longint; assembler;
asm
 mov es,seg0040
 mov ax,es:[$6c]
 mov dx,es:[$6c+2]
end;


var
 Image1,Image2       : word;
 Grate1,Grate2       : TGrate;
 x,y                 : integer;
 outImage1,outImage2,outImage3 : word;

var

{data for the procedure linetextmap_simple_256}
 s_poly2d : array [1..4,1..2] of integer;
 s_polybmp : array [1..4,1..2] of byte;

{internal data}
 s_leftx : array [1..256] of integer;
 s_rightx : array [1..256] of integer;
 s_left_bmpxy : array [1..256] of integer;
 s_right_bmpxy : array [1..256] of integer;
 csalias      : word;  

 s_scrbuf1seg : word; {screen buffer selector}
 s_bmpseg     : word; {texture selector}

{-------------- procedures ---------------}
 {$F+}
 
 {texture-mapping procedure working in 256x256 coordinates}
 procedure texturemap_simple_256; external;
 {$F-}
 {$L textmaps}

{allocates memory and loads an image from an HSI RAW file}
procedure LoadImage(var Image: word; fname: string);
f: file;
begin
 assign(f,fname);
 reset(f,1);
 seek(f,800);
 Image:=globalalloc(gmem_fixed,65536);
 blockread(f,mem[Image:0],65535);
 blockread(f,mem[Image:65535],1);
 close(f);
end;

{sets a grayscale palette}
procedure setbwpalette;
var
 i: integer;
begin
 for i:=0 to 255 do
  begin
   port[$3c8]:=i;
   port[$3c9]:=i div 4;
   port[$3c9]:=i div 4;
   port[$3c9]:=i div 4;
  end;
end;

{displays an image}
procedure showImage(Image: word;tx,ty: integer);
{Omitted. Displays a 256x256 image on the screen; the upper-left corner of the image goes to point x,y of the screen}

{deforms an image}
procedure WarpPic(Grate1,Grate2: TGrate;Image,outImage: word);
var
 x,y : integer;
begin
 s_scrbuf1seg:=outImage;  {parameters passed to texturemap_simple_256}
 s_bmpseg:=Image;         {are set in global variables}
 csalias:=cseg+selectorinc;
 
 for y:=0 to 7 do
  for x:=0 to 7 do
   begin
    s_polybmp[1,1]:=round(Grate1[x,y,1]);
    s_polybmp[1,2]:=round(Grate1[x,y,2]);
    s_polybmp[2,1]:=round(Grate1[x+1,y,1]);
    s_polybmp[2,2]:=round(Grate1[x+1,y,2]);
    s_polybmp[3,1]:=round(Grate1[x+1,y+1,1]);
    s_polybmp[3,2]:=round(Grate1[x+1,y+1,2]);
    s_polybmp[4,1]:=round(Grate1[x,y+1,1]);
    s_polybmp[4,2]:=round(Grate1[x,y+1,2]);

    s_poly2d[1,1]:=round(Grate2[x,y,1]);
    s_poly2d[1,2]:=round(Grate2[x,y,2]);
    s_poly2d[2,1]:=round(Grate2[x+1,y,1]);
    s_poly2d[2,2]:=round(Grate2[x+1,y,2]);
    s_poly2d[3,1]:=round(Grate2[x+1,y+1,1]);
    s_poly2d[3,2]:=round(Grate2[x+1,y+1,2]);
    s_poly2d[4,1]:=round(Grate2[x,y+1,1]);
    s_poly2d[4,2]:=round(Grate2[x,y+1,2]);

    texturemap_simple_256;
   end;
end;

{deforms a mesh}
procedure WarpGrate(Grate1,Grate2:tGrate ;var Grate: tGrate; t: single);
var
 x,y: integer;
 r: single;
begin
 for y:=0 to 8 do
  for x:=0 to 8 do
   begin
    r:=Grate1[y,x,1];
    Grate[y,x,1]:=(Grate2[y,x,1]-r)*t+r;
    r:=Grate1[y,x,2];
    Grate[y,x,2]:=(Grate2[y,x,2]-r)*t+r;
   end;
end;

{dissolves images}
procedure MorphPic(pic1,pic2,pic,t: word); assembler;
asm
 push ds
 mov ax,pic1
 db 8eh,0e8h  {mov gs,ax}
 mov ds,pic2
 mov es,pic
 xor di,di
 mov si,t
 cld
 mov cx,0ffffh

 @@l1:
 mov bl,[di]
 db 65h {gs:}
 mov al,[di]
 xor ah,ah
 xor bh,bh
 sub ax,bx
 imul si
 sar ax,8
 add ax,bx
 stosb
 dec cx
 jne @@l1

 pop ds
end;

{the morphing demo itself}
procedure Morph;
var
 Grate : tGrate;
 i     : integer;
 dir   : boolean;
 r     : single;
 t     : longint;
 label l1,l2;
begin

 dir:=true;
l1:
 for i:=0 to 30 do
  begin
   t:=timercounter;
    if dir then r:=i/30 else r:=1-i/30;
   WarpGrate(Grate1,Grate2,Grate,r);
   Warppic(Grate1,Grate,Image1,outImage1);
   WarpPic(Grate2,Grate,Image2,outImage2);
   MorphPic(outImage2,outImage1,outImage3,(Round(r*256)));
    ShowImage(outImage,192,64);
   if KeyPressed then goto l2;
    while timercounter-t<1 do;  {pause}
  end;
  delay(6000);
  dir:=not dir;
goto l1;
l2: while KeyPressed do ReadKey;
end;

{loads meshes from a file}
procedure loadGrate (Fname: string);
var
 f:file;
begin
 assign(f,fname);
 reset(f,1);
 blockread(f,Grate1,sizeof(TGrate));
 blockread(f,Grate2,sizeof(TGrate));
 close(f);
end;

begin
 if paramcount<>3 then halt;
 SetVesaMode($100);            {set video mode 640x400x256}
 SetBWPalette;                 {set grayscale palette}
 LoadImage(Image1,paramstr(1));
 LoadImage(Image2,paramstr(2));
 LoadGrate(paramstr(3));

 outImage1:=GlobalAlloc(GMEM_FIXED,65536);
 outImage2:=GlobalAlloc(GMEM_FIXED,65536);
 outImage3:=GlobalAlloc(GMEM_FIXED,65536); {allocate memory for intermediate images}

 Morph;

 textmode(3);
end.
```

## 3D MORPHING

It uses completely different - and surprisingly simpler - algorithms. An object in a 3D editor is represented as a set of triangles (a tri-mesh) resting on vertices. Many programs require that for two objects, one to be morphed into the other, the number of vertices be the same and the triangles share the same vertices - in other words, the only difference between phases is the positions of the vertices in space. The algorithm is obvious: the position of each vertex is determined by interpolating between its positions in the initial and final phases. If the number of vertices differs, the program finds a partner in the second phase (a single vertex may correspond to two vertices of the other phase if there aren't enough). As a result, what appears in intermediate phases may not resemble either final phase. As for texture, straightforward dissolving is applied to it, though more complex methods can be used.

3D morphing is often used to represent moving objects - for example, the running monster in the game Quake consists of several phases of motion morphing into each other. Real-time morphing of this sort can be seen in many demos (in fact, the demomaking programming scene deserves its own article; for now I recommend visiting ftp.cdrom.com pub\demos\demos), for example ftp.cdrom.com pub/demos/demos/1995/n/nooon_st.zip.

### References.

1. morphscr.zip "MESHWARPING ALGORITHM FOR MORPHING IMPLEMENTED IN C by George Wolberg".
2. DEMO.DESIGN.* Frequently Asked Questions, Release 9 ((c) Peter Sobolev, 2:5030/84@fidonet).
3. Demo Heart-Quake/Iguana (ftp.cdrom.com pub/demos/demos/1994/heartq.zip)
4. Demo Stars/Noon (ftp.cdrom.com pub/demos/demos/1995/n/nooon_st.zip).
